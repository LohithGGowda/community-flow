"""
routes.py — FastAPI Route Definitions

Three core endpoints matching the CommunityFlow architecture:

POST /api/ingest/text     — Ingest plain text volunteer data
POST /api/ingest/file     — Ingest a file (PDF, image, etc.)
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
from app.services import db, vector_search, geo
from app.agents.embedding_agent import generate_query_embedding
from app.core.config import settings
import datetime

router = APIRouter()

def _score_severity(description: str) -> str:
    if not settings.GEMINI_API_KEY:
        return "high"
    try:
        from google import genai
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        prompt = (
            "Classify the urgency of the following crisis description into exactly one of "
            "these four categories: 'low', 'normal', 'high', 'critical'. "
            f"Respond with ONLY the category word.\n\nDescription: {description}"
        )
        response = client.models.generate_content(
            model=settings.MODEL_SCHEMA,  # gemini-2.0-flash — fast, cheap, sufficient for classification
            contents=prompt,
        )
        level = response.text.strip().lower()
        if level in ["low", "normal", "high", "critical"]:
            return level
        return "high"
    except Exception as e:
        print(f"[Routes] Error scoring severity: {e}")
        return "high"


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
    # Auto-classify urgency
    auto_urgency = _score_severity(request.description)
    request.urgency = auto_urgency

    # Geocode the crisis location
    crisis_lat, crisis_lng = geo.geocode(request.location)

    # Save to database to appear on analytics map
    crisis_record_data = request.dict()
    crisis_record_data["timestamp"] = datetime.datetime.utcnow().isoformat() + "Z"
    crisis_record_data["geo_location"] = {"lat": crisis_lat, "lng": crisis_lng, "address": request.location}
    crisis_record_data["reports"] = 5 if auto_urgency == "critical" else (3 if auto_urgency == "high" else 1)
    db.save_crisis(crisis_record_data)

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

    # Search the vector store (get more than needed to allow distance re-ranking)
    raw_matches = vector_search.search_volunteers(
        query_text=query_text,
        query_embedding=query_embedding,
        n_results=request.volunteers_needed * 3,
    )

    # Enrich matches and apply geo-weighting
    results = []
    for match in raw_matches:
        volunteer_data = db.get_volunteer(match["id"])
        if volunteer_data and volunteer_data.get("status") != "busy":
            # Distance scoring
            v_loc = volunteer_data.get("geo_location")
            if v_loc:
                v_lat, v_lng = v_loc["lat"], v_loc["lng"]
            else:
                v_lat, v_lng = geo.geocode(volunteer_data.get("location", ""))
            
            dist_km = geo.calculate_distance_km(crisis_lat, crisis_lng, v_lat, v_lng)
            geo_score = geo.compute_geo_score(dist_km, settings.MAX_MATCH_RADIUS_KM)
            
            # Blend semantic and geo scores using configurable weight
            semantic_score = match["score"]
            geo_w = settings.GEO_WEIGHT_FACTOR
            final_score = (semantic_score * (1.0 - geo_w)) + (geo_score * geo_w)

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
                        match_score=final_score,
                        volunteer_details=profile,
                    )
                )
            except Exception as e:
                print(f"[Routes] Warning: Could not build profile for {match['id']}: {e}")

    # Sort by final blended score descending and take top N
    results.sort(key=lambda x: x.match_score, reverse=True)
    results = results[:request.volunteers_needed]

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


# ---------------------------------------------------------------------------
# Analytics and Crisis map endpoints
# ---------------------------------------------------------------------------

@router.get("/crisis")
async def list_crises():
    """List all active crises for the analytics map."""
    return db.get_all_crises()

@router.get("/analytics/summary")
async def get_analytics_summary():
    """Return live summary statistics sourced entirely from the database.
    Never returns hardcoded fallback numbers — shows real zeros when empty.
    """
    volunteers = db.get_all_volunteers()
    crises = db.get_all_crises()

    total      = len(volunteers)
    deployed   = sum(1 for v in volunteers if v.get("status") == "busy")
    available  = total - deployed
    active_crises = len(crises)

    from app.models.schemas import AnalyticsSummary
    return AnalyticsSummary(
        total_volunteers=total,
        deployed_volunteers=deployed,
        active_crises=active_crises,
    )
