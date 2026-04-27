"""
schema_agent.py — Agent 3: The "Schema" Agent (The Librarian)

Responsibility: Deterministic schema enforcement.
- Takes the audited English working copy.
- Maps it strictly into the VolunteerProfile Pydantic schema.
- Uses Gemini's response_schema / JSON mode for 100% structural integrity.
- Does NOT reason or interpret — just structures.

Model: gemini-2.0-flash (fast, cheap, JSON-mode reliable)
"""

import json
from typing import Optional

from google import genai
from google.genai import types

from app.core.config import settings
from app.models.schemas import SharedIngestionState, VolunteerProfile, VolunteerStatus


_client: Optional[genai.Client] = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not settings.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is not set.")
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def run(state: SharedIngestionState) -> SharedIngestionState:
    """
    Schema Agent entry point.

    Reads state.translated_working_copy (or falls back to extracted_raw_text).
    Writes state.structured_profile.
    """
    print(f"[SchemaAgent] Starting — request_id={state.request_id}")

    # Use the translated copy if available, otherwise fall back to raw text
    source_text = state.translated_working_copy or state.extracted_raw_text

    if not source_text:
        state.pipeline_errors.append("SchemaAgent: No text available to structure.")
        return state

    try:
        profile = _extract_structured_profile(source_text, state)
        state.structured_profile = profile
        print(f"[SchemaAgent] Done — name={profile.name}, skills={profile.skills}")

    except Exception as e:
        state.pipeline_errors.append(f"SchemaAgent error: {str(e)}")
        print(f"[SchemaAgent] ERROR: {e}")

    return state


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _extract_structured_profile(text: str, state: SharedIngestionState) -> VolunteerProfile:
    """
    Use Gemini in JSON mode to extract a VolunteerProfile from the text.
    The response_mime_type="application/json" ensures we always get valid JSON back.
    """
    client = _get_client()

    # Include cultural context from the auditor if available
    cultural_notes = ""
    if state.audit_metadata and state.audit_metadata.xai_flags:
        cultural_notes = (
            f"\nCultural audit notes: {state.audit_metadata.audit_notes or ''}\n"
            f"XAI flags: {', '.join(state.audit_metadata.xai_flags)}\n"
            "Preserve any cultural context in the 'cultural_context' field."
        )

    prompt = f"""
Extract volunteer information from the text below and return a JSON object.

RULES:
- Extract ONLY what is explicitly stated. Do not invent or assume data.
- For 'skills', extract specific skills (e.g., "elderly_care", "translation", "first_aid").
  Do NOT use generic terms like "social work" if a more specific term is present.
- For 'availability', use natural language (e.g., "weekends", "Monday evenings", "full-time").
- For 'languages', list all languages mentioned or implied.
- For 'status', always set to "available" unless the text says otherwise.
- If a field cannot be determined, use a sensible default or empty string.
{cultural_notes}

Required JSON schema:
{{
  "name": "string",
  "skills": ["string"],
  "availability": "string",
  "location": "string",
  "contact_info": "string",
  "languages": ["string"],
  "cultural_context": "string or null",
  "status": "available"
}}

Text to extract from:
{text}
"""

    response = client.models.generate_content(
        model=settings.MODEL_SCHEMA,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )

    raw_json = json.loads(response.text)

    # Ensure status is a valid enum value
    raw_json["status"] = raw_json.get("status", "available")
    if raw_json["status"] not in [s.value for s in VolunteerStatus]:
        raw_json["status"] = "available"

    # Ensure lists are actually lists
    for list_field in ["skills", "languages"]:
        if isinstance(raw_json.get(list_field), str):
            raw_json[list_field] = [raw_json[list_field]]
        elif not raw_json.get(list_field):
            raw_json[list_field] = []

    return VolunteerProfile(**raw_json)
