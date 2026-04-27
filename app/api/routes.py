"""
routes.py — FastAPI Route Definitions

POST /api/ingest/text     — Ingest plain text volunteer data
POST /api/ingest/file     — Ingest a file (PDF, image, etc.)
POST /api/ingest/audio    — Transcribe + translate spoken audio (any language)
POST /api/match           — Match a crisis request to volunteers
POST /api/volunteers/{id}/status  — Update volunteer availability
GET  /api/volunteers      — List all volunteers (debug/demo)
GET  /api/health          — Health check
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional

from app.models.schemas import (
    TextUploadRequest,
    CrisisRequest,
    MatchResponse,
    MatchResult,
    StatusUpdateRequest,
    PipelineResponse,
)
from app.orchestrator import run_ingestion_pipeline
from app.services import db, vector_search
from app.agents.embedding_agent import generate_query_embedding
from app.core.config import settings

router = APIRouter()


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "vector_backend": settings.VECTOR_BACKEND,
        "db_backend": settings.DB_BACKEND,
        "gemini_configured": bool(settings.GEMINI_API_KEY),
    }


# ---------------------------------------------------------------------------
# Ingestion: Text
# ---------------------------------------------------------------------------

@router.post("/ingest/text", response_model=PipelineResponse)
async def ingest_text(request: TextUploadRequest):
    """
    The Ingestion Gate (text path).

    Accepts raw unstructured text — e.g., a typed form, pasted survey response,
    or any messy text from an NGO. Runs it through the full 4-agent pipeline.

    Example input:
    {
      "raw_text": "My name is Priya. I can help with elderly care and cooking.
                   Available on weekends. Contact: 9876543210. I am in Koramangala.",
      "hint_language": "en"
    }
    """
    try:
        result = run_ingestion_pipeline(
            raw_text=request.raw_text,
            hint_language=request.hint_language,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Ingestion: File upload
# ---------------------------------------------------------------------------

@router.post("/ingest/file", response_model=PipelineResponse)
async def ingest_file(
    file: UploadFile = File(...),
    hint_language: Optional[str] = Form(None),
):
    """
    The Ingestion Gate (file path).

    Accepts a PDF, JPEG, PNG, or HEIC file — e.g., a scanned handwritten survey
    or a photo of a whiteboard. The Perception Agent handles multimodal extraction.

    Max file size: 10 MB (configurable via MAX_UPLOAD_SIZE_BYTES).
    """
    # Validate file size
    file_bytes = await file.read()
    if len(file_bytes) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size is {settings.MAX_UPLOAD_SIZE_BYTES // (1024*1024)} MB.",
        )

    # Validate MIME type
    allowed_types = {
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/heic",
        "image/webp",
        "text/plain",
    }
    content_type = file.content_type or "application/octet-stream"
    if content_type not in allowed_types:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {content_type}. Allowed: {', '.join(allowed_types)}",
        )

    try:
        result = run_ingestion_pipeline(
            file_bytes=file_bytes,
            mime_type=content_type,
            hint_language=hint_language,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Ingestion: Audio (speech-to-text + translation)
# ---------------------------------------------------------------------------

ALLOWED_AUDIO_TYPES = {
    "audio/webm",
    "audio/ogg",
    "audio/wav",
    "audio/mp4",
    "audio/mpeg",
    "audio/m4a",
    "audio/x-m4a",
}

@router.post("/ingest/audio")
async def ingest_audio(
    file: UploadFile = File(...),
    hint_language: Optional[str] = Form(None),
):
    """
    Audio Transcription + Translation Gate.

    Accepts a recorded audio blob (webm/ogg/wav/mp4) from the browser's
    MediaRecorder API. Uses Gemini's native audio understanding to:
      1. Transcribe the speech verbatim in the original language.
      2. Translate it to English, preserving cultural terms and honorifics.

    Returns:
    {
      "native_transcript":   "<original language text>",
      "english_translation": "<English translation with cultural notes>",
      "detected_language":   "<ISO 639-1 code>",
      "confidence":          "high|medium|low"
    }

    The frontend uses this to populate the volunteer text area with both
    the native transcript and the English translation for cultural review.
    """
    audio_bytes = await file.read()

    if len(audio_bytes) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Audio too large. Max size is {settings.MAX_UPLOAD_SIZE_BYTES // (1024*1024)} MB.",
        )

    content_type = file.content_type or "audio/webm"
    # Normalize common browser variants
    if content_type in ("audio/webm;codecs=opus", "audio/webm; codecs=opus"):
        content_type = "audio/webm"

    if content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported audio type: {content_type}. Allowed: {', '.join(ALLOWED_AUDIO_TYPES)}",
        )

    if not settings.GEMINI_API_KEY:
        print("[Routes] GEMINI_API_KEY not found. Returning mock audio transcription.")
        return {
            "native_transcript": "ನಾನು ತುರ್ತು ಪರಿಸ್ಥಿತಿಯಲ್ಲಿ ಸಹಾಯ ಮಾಡಬಲ್ಲೆ. ನನ್ನ ಬಳಿ ವಾಹನವಿದೆ.",
            "english_translation": "I can help in an emergency. I have a vehicle.",
            "detected_language": "kn",
            "confidence": "high"
        }

    try:
        from app.agents.audio_agent import transcribe_and_translate
        result = transcribe_and_translate(
            audio_bytes=audio_bytes,
            mime_type=content_type,
            hint_language=hint_language,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Matching Engine
# ---------------------------------------------------------------------------

@router.post("/match", response_model=MatchResponse)
async def match_volunteers(request: CrisisRequest):
    """
    The Vector Brain — Semantic Matching.

    Converts the crisis request into a vector and performs k-NN search
    against the volunteer index. Returns the top N matches ranked by
    semantic similarity.

    Example input:
    {
      "description": "Need volunteers for flood relief in HSR Layout",
      "required_skills": ["first_aid", "logistics"],
      "location": "HSR Layout, Bangalore",
      "volunteers_needed": 5,
      "urgency": "high"
    }
    """
    # Build a rich query string
    query_text = (
        f"Crisis at {request.location}: {request.description}. "
        f"Required skills: {', '.join(request.required_skills)}. "
        f"Urgency: {request.urgency}."
    )

    # Try to get a semantic embedding for the query
    query_embedding = None
    if settings.GEMINI_API_KEY:
        try:
            query_embedding = generate_query_embedding(query_text)
        except Exception as e:
            print(f"[Routes] Warning: Could not generate query embedding: {e}")

    # Search the vector store
    raw_matches = vector_search.search_volunteers(
        query_text=query_text,
        query_embedding=query_embedding,
        n_results=request.volunteers_needed,
    )

    # Enrich matches with full volunteer data from DB
    results = []
    for match in raw_matches:
        volunteer_data = db.get_volunteer(match["id"])
        if volunteer_data:
            # Remove internal fields before building the profile
            profile_data = {
                k: v for k, v in volunteer_data.items()
                if k not in ("id", "audit_metadata")
            }
            try:
                from app.models.schemas import VolunteerProfile
                profile = VolunteerProfile(**profile_data)
                results.append(
                    MatchResult(
                        volunteer_id=match["id"],
                        match_score=match["score"],
                        volunteer_details=profile,
                    )
                )
            except Exception as e:
                print(f"[Routes] Warning: Could not build profile for {match['id']}: {e}")

    return MatchResponse(
        crisis_request=request,
        matches=results,
        total_found=len(results),
    )


# ---------------------------------------------------------------------------
# Volunteer status update
# ---------------------------------------------------------------------------

@router.patch("/volunteers/{volunteer_id}/status")
async def update_volunteer_status(volunteer_id: str, update: StatusUpdateRequest):
    """
    The Execution Loop — Real-time status update.

    Called when a volunteer accepts or rejects a deployment.
    Prevents the "Leaky Bucket" problem by marking busy volunteers immediately.
    """
    success = db.update_volunteer_status(volunteer_id, update.status.value)
    if not success:
        raise HTTPException(status_code=404, detail=f"Volunteer '{volunteer_id}' not found.")
    return {
        "message": "Status updated successfully.",
        "volunteer_id": volunteer_id,
        "new_status": update.status.value,
    }


# ---------------------------------------------------------------------------
# List volunteers (debug / demo)
# ---------------------------------------------------------------------------

@router.get("/volunteers")
async def list_volunteers():
    """
    Returns all volunteers currently in the system.
    Useful for demos and debugging.
    """
    return db.get_all_volunteers()


@router.get("/volunteers/{volunteer_id}")
async def get_volunteer(volunteer_id: str):
    """Get a single volunteer by ID."""
    volunteer = db.get_volunteer(volunteer_id)
    if not volunteer:
        raise HTTPException(status_code=404, detail=f"Volunteer '{volunteer_id}' not found.")
    return volunteer
