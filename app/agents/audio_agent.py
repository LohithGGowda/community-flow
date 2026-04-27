"""
audio_agent.py — Audio Transcription + Translation Agent

Responsibility: Speech-to-text with cultural preservation.
- Accepts raw audio bytes (webm, ogg, mp4, wav, m4a).
- Uses Gemini's native audio understanding to:
    1. Transcribe the speech in its original language.
    2. Translate it to English, preserving cultural terms.
- Returns a structured JSON with native_transcript + english_translation.

Model: gemini-2.0-flash (natively supports audio input)
"""

import json
from typing import Optional

from google import genai
from google.genai import types

from app.core.config import settings


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

def transcribe_and_translate(
    audio_bytes: bytes,
    mime_type: str = "audio/webm",
    hint_language: Optional[str] = None,
) -> dict:
    """
    Transcribe audio and translate to English using Gemini's native audio support.

    Args:
        audio_bytes: Raw audio file bytes.
        mime_type:   MIME type of the audio (audio/webm, audio/ogg, audio/wav, etc.)
        hint_language: Optional ISO 639-1 language hint (e.g. 'kn', 'hi').

    Returns:
        dict with keys:
            native_transcript  — verbatim transcription in original language
            english_translation — English translation preserving cultural terms
            detected_language  — ISO 639-1 code of detected language
            confidence         — "high" | "medium" | "low"
    """
    client = _get_client()

    lang_hint = f"\nThe speaker is likely speaking {hint_language}." if hint_language else ""

    prompt = f"""You are a culturally-aware speech transcription and translation specialist.
Listen to this audio recording carefully.{lang_hint}

Your task:
1. Transcribe EXACTLY what was said, in the original language (preserve all words, names, local terms).
2. Translate the transcription to English. For cultural terms, honorifics, or idioms that don't
   translate directly, keep the original word and add a brief note in parentheses.
3. Detect the spoken language.

Return ONLY a valid JSON object with this exact structure:
{{
  "native_transcript": "<exact transcription in original language>",
  "english_translation": "<English translation with cultural notes>",
  "detected_language": "<ISO 639-1 code, e.g. en, hi, kn, ta>",
  "confidence": "<high|medium|low>"
}}

Do not include any text outside the JSON object."""

    print(f"[AudioAgent] Processing audio — mime={mime_type}, size={len(audio_bytes)} bytes")

    response = client.models.generate_content(
        model=settings.MODEL_PERCEPTION,  # gemini-2.0-flash supports audio natively
        contents=[
            types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
            prompt,
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )

    result = json.loads(response.text)

    # Validate and fill defaults for any missing keys
    result.setdefault("native_transcript", "")
    result.setdefault("english_translation", "")
    result.setdefault("detected_language", hint_language or "en")
    result.setdefault("confidence", "medium")

    print(f"[AudioAgent] Done — lang={result['detected_language']}, confidence={result['confidence']}")
    return result
