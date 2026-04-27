"""
perception_agent.py — Agent 1: The "Vision" Agent

Responsibility: Multimodal OCR + spatial reasoning.
- Accepts raw binary (PDF, JPEG, PNG, HEIC) or plain text.
- Extracts raw text and detects the source language.
- Does NOT clean or interpret — just perceives.

Model: gemini-2.0-flash (fast, cheap, multimodal)
"""

import base64
import mimetypes
from typing import Optional

from google import genai
from google.genai import types

from app.core.config import settings
from app.models.schemas import SharedIngestionState, InputType


# ---------------------------------------------------------------------------
# Gemini client (lazy init so the app starts even without a key)
# ---------------------------------------------------------------------------
_client: Optional[genai.Client] = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not settings.GEMINI_API_KEY:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. "
                "Add it to your .env file or environment variables."
            )
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def run(state: SharedIngestionState, file_bytes: Optional[bytes] = None, mime_type: Optional[str] = None) -> SharedIngestionState:
    """
    Perception Agent entry point.

    Args:
        state: The shared pipeline state object.
        file_bytes: Raw binary content of the uploaded file (optional).
                    If None, the agent expects text already in state or raw_text.
        mime_type: MIME type of the file (e.g., 'image/jpeg', 'application/pdf').

    Returns:
        Updated state with extracted_raw_text and detected_language populated.
    """
    print(f"[PerceptionAgent] Starting — request_id={state.request_id}")

    try:
        if file_bytes:
            state = _process_file(state, file_bytes, mime_type or "application/octet-stream")
        elif state.extracted_raw_text:
            # Text was already provided (e.g., typed input) — just detect language
            state = _detect_language_only(state)
        else:
            state.pipeline_errors.append("PerceptionAgent: No input provided (no file and no text).")
            return state

    except Exception as e:
        state.pipeline_errors.append(f"PerceptionAgent error: {str(e)}")
        print(f"[PerceptionAgent] ERROR: {e}")

    print(f"[PerceptionAgent] Done — detected_language={state.detected_language}")
    return state


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _process_file(state: SharedIngestionState, file_bytes: bytes, mime_type: str) -> SharedIngestionState:
    """Send the file to Gemini for multimodal extraction."""
    client = _get_client()

    # Determine input type for state tracking
    state.raw_input_type = _classify_input_type(mime_type)

    # Build the prompt — instruct the model to extract text faithfully
    prompt = (
        "You are a precise document scanner. Your ONLY job is to extract ALL text "
        "from this document exactly as it appears — do not translate, correct, or interpret. "
        "Preserve the original language, spelling, and structure. "
        "If you see checkboxes or circles, note them as [CHECKED] or [UNCHECKED]. "
        "At the end, on a new line, write: DETECTED_LANGUAGE: <ISO 639-1 code>"
    )

    # Encode file as base64 for the API
    encoded = base64.standard_b64encode(file_bytes).decode("utf-8")

    response = client.models.generate_content(
        model=settings.MODEL_PERCEPTION,
        contents=[
            types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
            prompt,
        ],
    )

    raw_output = response.text.strip()

    # Parse out the language tag if present
    if "DETECTED_LANGUAGE:" in raw_output:
        parts = raw_output.rsplit("DETECTED_LANGUAGE:", 1)
        state.extracted_raw_text = parts[0].strip()
        state.detected_language = parts[1].strip().lower()[:5]  # e.g., "kn", "ta", "hi"
    else:
        state.extracted_raw_text = raw_output
        state.detected_language = "en"  # default assumption

    return state


def _detect_language_only(state: SharedIngestionState) -> SharedIngestionState:
    """For plain text input — just detect the language."""
    client = _get_client()

    prompt = (
        f"Detect the language of the following text and respond with ONLY the ISO 639-1 "
        f"language code (e.g., 'en', 'kn', 'ta', 'hi', 'bn'). Nothing else.\n\n"
        f"{state.extracted_raw_text[:500]}"  # Use first 500 chars for detection
    )

    response = client.models.generate_content(
        model=settings.MODEL_PERCEPTION,
        contents=prompt,
    )

    lang = response.text.strip().lower()[:5]
    state.detected_language = lang if len(lang) <= 3 else "en"
    state.raw_input_type = InputType.TEXT

    return state


def _classify_input_type(mime_type: str) -> InputType:
    """Map MIME type to our InputType enum."""
    mapping = {
        "application/pdf": InputType.PDF,
        "image/jpeg": InputType.IMAGE_HANDWRITTEN,
        "image/jpg": InputType.IMAGE_HANDWRITTEN,
        "image/png": InputType.IMAGE_PRINTED,
        "image/heic": InputType.IMAGE_HANDWRITTEN,
        "image/webp": InputType.IMAGE_PRINTED,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": InputType.EXCEL,
        "text/plain": InputType.TEXT,
    }
    return mapping.get(mime_type.lower(), InputType.UNKNOWN)
