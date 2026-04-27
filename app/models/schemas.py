"""
schemas.py — The "A2A Handshake Contract"

This is the single source of truth for all data structures passed between agents.
Every agent in the swarm reads from and writes to these Pydantic models.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum
import uuid


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class InputType(str, Enum):
    TEXT = "TEXT"
    IMAGE_HANDWRITTEN = "IMAGE_HANDWRITTEN"
    IMAGE_PRINTED = "IMAGE_PRINTED"
    PDF = "PDF"
    EXCEL = "EXCEL"
    UNKNOWN = "UNKNOWN"


class XAIAuditStatus(str, Enum):
    PASSED = "passed"
    FLAGGED = "flagged"
    FAILED = "failed"
    PENDING = "pending"


class VolunteerStatus(str, Enum):
    AVAILABLE = "available"
    BUSY = "busy"
    INACTIVE = "inactive"


# ---------------------------------------------------------------------------
# Core Volunteer Profile (output of the full pipeline)
# ---------------------------------------------------------------------------

class GeoLocation(BaseModel):
    lat: float = Field(..., description="Latitude")
    lng: float = Field(..., description="Longitude")
    address: Optional[str] = Field(None, description="Human-readable address")


class VolunteerProfile(BaseModel):
    """
    The final structured output after all 4 agents have processed the input.
    This is what gets stored in Firestore and vectorized.
    """
    name: str = Field(..., description="Full name of the volunteer")
    skills: List[str] = Field(..., description="List of skills extracted from the input")
    availability: str = Field(..., description="Available time slots (e.g., 'weekends', 'evenings')")
    location: str = Field(..., description="City/area of the volunteer")
    geo_location: Optional[GeoLocation] = Field(None, description="Lat/lng coordinates")
    contact_info: str = Field(..., description="Phone number or email")
    languages: List[str] = Field(default_factory=list, description="Languages spoken")
    cultural_context: Optional[str] = Field(
        None,
        description="Notes on cultural nuances or local dialects captured during audit"
    )
    status: VolunteerStatus = Field(VolunteerStatus.AVAILABLE, description="Current availability status")


# ---------------------------------------------------------------------------
# XAI Audit Metadata (output of the Cultural Auditor Agent)
# ---------------------------------------------------------------------------

class AuditMetadata(BaseModel):
    """
    Explainability metadata produced by the Cultural Auditor Agent.
    Attached to every processed record for transparency.
    """
    source_language: str = Field("en", description="Detected source language code (e.g., 'kn', 'ta', 'hi')")
    cultural_adequacy_score: float = Field(
        0.0,
        ge=0.0,
        le=1.0,
        description="G-Eval score: how well the translation preserves cultural intent (0.0–1.0)"
    )
    xai_flags: List[str] = Field(
        default_factory=list,
        description="Flags like 'honorific_preserved', 'idiom_detected', 'context_shift_detected'"
    )
    back_translation_delta: float = Field(
        0.0,
        ge=0.0,
        le=1.0,
        description="Semantic drift score between original and back-translated text (lower is better)"
    )
    audit_status: XAIAuditStatus = Field(XAIAuditStatus.PENDING)
    audit_notes: Optional[str] = Field(None, description="Human-readable explanation of any flags")


# ---------------------------------------------------------------------------
# Shared Ingestion State — The "Patient Chart" passed between all agents
# ---------------------------------------------------------------------------

class SharedIngestionState(BaseModel):
    """
    The central state object passed through the entire A2A pipeline.
    Each agent reads from it and appends its output to it.
    """
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    raw_input_type: InputType = Field(InputType.UNKNOWN)

    # Stage 1: Perception Agent output
    extracted_raw_text: Optional[str] = Field(None, description="Raw text extracted by the Perception Agent")
    detected_language: Optional[str] = Field(None, description="Language detected in the raw text")

    # Stage 2: Cultural Auditor output
    translated_working_copy: Optional[str] = Field(None, description="English working copy after translation")
    audit_metadata: Optional[AuditMetadata] = Field(None)

    # Stage 3: Schema Agent output
    structured_profile: Optional[VolunteerProfile] = Field(None)

    # Stage 4: Embedding Agent output
    embedding_vector: Optional[List[float]] = Field(None, description="768-dim vector from Vertex AI Embeddings")
    vector_db_id: Optional[str] = Field(None, description="ID in the vector store after indexing")

    # Pipeline control
    pipeline_errors: List[str] = Field(default_factory=list, description="Errors encountered at any stage")
    is_complete: bool = Field(False)


# ---------------------------------------------------------------------------
# Crisis Request & Matching
# ---------------------------------------------------------------------------

class CrisisRequest(BaseModel):
    """Incoming request for volunteer matching."""
    description: str = Field(..., description="Description of the crisis or need")
    required_skills: List[str] = Field(..., description="Skills required for this crisis")
    location: str = Field(..., description="Location of the crisis")
    volunteers_needed: int = Field(1, ge=1, description="Number of volunteers needed")
    urgency: str = Field("normal", description="Urgency level: low / normal / high / critical")


class MatchResult(BaseModel):
    """A single volunteer match result."""
    volunteer_id: str
    match_score: float = Field(..., description="Similarity score (lower distance = better match)")
    volunteer_details: VolunteerProfile


class MatchResponse(BaseModel):
    """Full response from the matching engine."""
    crisis_request: CrisisRequest
    matches: List[MatchResult]
    total_found: int


# ---------------------------------------------------------------------------
# API Request/Response helpers
# ---------------------------------------------------------------------------

class TextUploadRequest(BaseModel):
    """For uploading raw text (e.g., typed or pasted form data)."""
    raw_text: str = Field(..., description="Raw unstructured text from the NGO")
    hint_language: Optional[str] = Field(None, description="Optional language hint (e.g., 'kn' for Kannada)")


class StatusUpdateRequest(BaseModel):
    volunteer_id: str
    status: VolunteerStatus


class PipelineResponse(BaseModel):
    """Returned after a successful ingestion pipeline run."""
    request_id: str
    volunteer_id: Optional[str] = None
    structured_profile: Optional[VolunteerProfile] = None
    audit_metadata: Optional[AuditMetadata] = None
    pipeline_errors: List[str] = Field(default_factory=list)
    success: bool
