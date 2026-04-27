"""
orchestrator.py — The A2A Pipeline Orchestrator

This is the "glue" that connects all 4 agents in sequence.
It manages the SharedIngestionState object as it flows through the pipeline:

  [File/Text Input]
       ↓
  PerceptionAgent   → extracts raw text + detects language
       ↓
  AuditorAgent      → translates + XAI cultural audit
       ↓
  SchemaAgent       → enforces VolunteerProfile JSON structure
       ↓
  EmbeddingAgent    → generates vector embedding
       ↓
  [VectorDB + Firestore]

Design principles:
- Each agent is independent and can fail without crashing the whole pipeline.
- Errors are collected in state.pipeline_errors (non-fatal) or raised (fatal).
- The orchestrator decides whether to proceed based on audit score thresholds.
"""

from typing import Optional

from app.models.schemas import SharedIngestionState, InputType, PipelineResponse
from app.agents import perception_agent, auditor_agent, schema_agent, embedding_agent
from app.services import db, vector_search
from app.core.config import settings


def run_ingestion_pipeline(
    raw_text: Optional[str] = None,
    file_bytes: Optional[bytes] = None,
    mime_type: Optional[str] = None,
    hint_language: Optional[str] = None,
) -> PipelineResponse:
    """
    Main entry point for the ingestion pipeline.

    Args:
        raw_text: Plain text input (e.g., typed form data).
        file_bytes: Binary file content (PDF, image, etc.).
        mime_type: MIME type of the file.
        hint_language: Optional language hint to skip auto-detection.

    Returns:
        PipelineResponse with the structured profile, audit metadata, and any errors.
    """
    # -----------------------------------------------------------------------
    # Initialize the shared state object
    # -----------------------------------------------------------------------
    state = SharedIngestionState()

    if raw_text:
        state.extracted_raw_text = raw_text
        state.raw_input_type = InputType.TEXT

    if hint_language:
        state.detected_language = hint_language

    print(f"\n{'='*60}")
    print(f"[Orchestrator] Pipeline started — request_id={state.request_id}")
    print(f"{'='*60}")

    # -----------------------------------------------------------------------
    # Stage 1: Perception Agent
    # -----------------------------------------------------------------------
    state = perception_agent.run(state, file_bytes=file_bytes, mime_type=mime_type)

    if not state.extracted_raw_text:
        return _build_response(state, success=False)

    # -----------------------------------------------------------------------
    # Stage 2: Cultural Auditor Agent
    # -----------------------------------------------------------------------
    state = auditor_agent.run(state)

    # Check if audit failed hard (score = 0 and status = FAILED)
    if state.audit_metadata and state.audit_metadata.cultural_adequacy_score == 0.0:
        print("[Orchestrator] WARNING: Audit score is 0.0 — proceeding with caution.")

    # -----------------------------------------------------------------------
    # Stage 3: Schema Agent
    # -----------------------------------------------------------------------
    state = schema_agent.run(state)

    if not state.structured_profile:
        return _build_response(state, success=False)

    # -----------------------------------------------------------------------
    # Stage 4: Embedding Agent
    # -----------------------------------------------------------------------
    state = embedding_agent.run(state)

    # -----------------------------------------------------------------------
    # Persist to DB + Vector Store
    # -----------------------------------------------------------------------
    volunteer_id = None

    try:
        # Save structured profile to Firestore (or mock DB)
        volunteer_data = state.structured_profile.model_dump()
        volunteer_data["audit_metadata"] = (
            state.audit_metadata.model_dump() if state.audit_metadata else {}
        )
        volunteer_id = db.save_volunteer(volunteer_data)
        state.vector_db_id = volunteer_id

        # Add to vector index
        if state.embedding_vector:
            vector_search.add_volunteer_to_index(
                volunteer_id=volunteer_id,
                embedding=state.embedding_vector,
                metadata={
                    "name": state.structured_profile.name,
                    "location": state.structured_profile.location,
                    "skills": ", ".join(state.structured_profile.skills),
                },
            )
        else:
            # Fallback: use text-based ChromaDB embedding
            embed_text = (
                f"{state.structured_profile.name} from {state.structured_profile.location}. "
                f"Skills: {', '.join(state.structured_profile.skills)}."
            )
            vector_search.add_volunteer_to_index_text(
                volunteer_id=volunteer_id,
                text=embed_text,
                metadata={
                    "name": state.structured_profile.name,
                    "location": state.structured_profile.location,
                },
            )

        print(f"[Orchestrator] Saved volunteer — id={volunteer_id}")

    except Exception as e:
        state.pipeline_errors.append(f"Persistence error: {str(e)}")
        print(f"[Orchestrator] Persistence ERROR: {e}")

    state.is_complete = True

    print(f"[Orchestrator] Pipeline complete — errors={state.pipeline_errors}")
    print(f"{'='*60}\n")

    return _build_response(state, success=True, volunteer_id=volunteer_id)


def _build_response(
    state: SharedIngestionState,
    success: bool,
    volunteer_id: Optional[str] = None,
) -> PipelineResponse:
    return PipelineResponse(
        request_id=state.request_id,
        volunteer_id=volunteer_id,
        structured_profile=state.structured_profile,
        audit_metadata=state.audit_metadata,
        pipeline_errors=state.pipeline_errors,
        success=success,
    )
