"""
auditor_agent.py — Agent 2: The "Cultural Auditor" Agent

Responsibility: XAI-based cultural verification.
- Translates non-English text to English (working copy).
- Performs Back-Translation Audit to detect semantic drift.
- Runs G-Eval (AI-as-a-Judge) to score Cultural-Pragmatic Adequacy.
- Flags regional idioms and honorifics that must be preserved.

Model: gemini-2.5-pro (used only here — expensive tokens justified by reasoning depth)

This agent is the core of what makes CommunityFlow different from a generic parser.
It ensures that "Shramadana" (a specific Kannada term for community service) is NOT
flattened to "social work" — preserving the volunteer's true intent.
"""

import json
from typing import Optional

from google import genai
from google.genai import types

from app.core.config import settings
from app.models.schemas import SharedIngestionState, AuditMetadata, XAIAuditStatus


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
    Cultural Auditor Agent entry point.

    Reads state.extracted_raw_text and state.detected_language.
    Writes state.translated_working_copy and state.audit_metadata.
    """
    print(f"[AuditorAgent] Starting — language={state.detected_language}")

    if not state.extracted_raw_text:
        state.pipeline_errors.append("AuditorAgent: No raw text to audit.")
        return state

    try:
        lang = state.detected_language or "en"

        # Skip heavy audit for English if configured
        if lang == "en" and settings.SKIP_AUDIT_FOR_ENGLISH:
            state.translated_working_copy = state.extracted_raw_text
            state.audit_metadata = AuditMetadata(
                source_language="en",
                cultural_adequacy_score=1.0,
                audit_status=XAIAuditStatus.PASSED,
                audit_notes="Skipped — English input, no translation needed.",
            )
            print("[AuditorAgent] Skipped (English input).")
            return state

        # Step 1: Translate to English (working copy)
        translated = _translate_to_english(state.extracted_raw_text, lang)
        state.translated_working_copy = translated

        # Step 2: Back-Translation Audit
        back_translated = _back_translate(translated, lang)
        delta = _compute_semantic_delta(state.extracted_raw_text, back_translated, lang)

        # Step 3: G-Eval — AI-as-a-Judge
        g_eval_result = _run_g_eval(state.extracted_raw_text, translated, lang)

        # Step 4: Assemble audit metadata
        xai_flags = []
        if delta > settings.BACK_TRANSLATION_DELTA_THRESHOLD:
            xai_flags.append("high_back_translation_delta")
        if g_eval_result["idioms_detected"]:
            xai_flags.append("idiom_detected")
        if g_eval_result["honorifics_preserved"]:
            xai_flags.append("honorific_preserved")
        if g_eval_result["context_shift"]:
            xai_flags.append("context_shift_detected")

        score = g_eval_result["score"]
        audit_status = (
            XAIAuditStatus.PASSED
            if score >= settings.CULTURAL_ADEQUACY_THRESHOLD
            else XAIAuditStatus.FLAGGED
        )

        state.audit_metadata = AuditMetadata(
            source_language=lang,
            cultural_adequacy_score=score,
            xai_flags=xai_flags,
            back_translation_delta=delta,
            audit_status=audit_status,
            audit_notes=g_eval_result.get("notes"),
        )

        print(
            f"[AuditorAgent] Done — score={score:.2f}, "
            f"status={audit_status}, flags={xai_flags}"
        )

    except Exception as e:
        state.pipeline_errors.append(f"AuditorAgent error: {str(e)}")
        print(f"[AuditorAgent] ERROR: {e}")
        # Provide a fallback so the pipeline can continue
        if not state.translated_working_copy:
            state.translated_working_copy = state.extracted_raw_text
        if not state.audit_metadata:
            state.audit_metadata = AuditMetadata(
                source_language=state.detected_language or "unknown",
                cultural_adequacy_score=0.0,
                audit_status=XAIAuditStatus.FAILED,
                audit_notes=f"Audit failed: {str(e)}",
            )

    return state


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _translate_to_english(text: str, source_lang: str) -> str:
    """Translate text to English, preserving cultural nuance."""
    if source_lang == "en":
        return text

    client = _get_client()
    prompt = (
        f"Translate the following text from {source_lang} to English. "
        "IMPORTANT: Preserve all cultural terms, honorifics, and regional idioms. "
        "If a term has no direct English equivalent, keep the original word and add "
        "a brief explanation in parentheses. Do not generalize specific cultural concepts.\n\n"
        f"Text:\n{text}"
    )

    response = client.models.generate_content(
        model=settings.MODEL_AUDITOR,
        contents=prompt,
    )
    return response.text.strip()


def _back_translate(english_text: str, target_lang: str) -> str:
    """Translate the English working copy back to the source language."""
    if target_lang == "en":
        return english_text

    client = _get_client()
    prompt = (
        f"Translate the following English text back to {target_lang}. "
        "Be as literal as possible.\n\n"
        f"Text:\n{english_text}"
    )

    response = client.models.generate_content(
        model=settings.MODEL_AUDITOR,
        contents=prompt,
    )
    return response.text.strip()


def _compute_semantic_delta(original: str, back_translated: str, lang: str) -> float:
    """
    Ask the model to estimate semantic drift between original and back-translated text.
    Returns a float 0.0 (identical) to 1.0 (completely different).
    """
    client = _get_client()
    prompt = (
        f"Compare these two {lang} texts for semantic similarity. "
        "Return ONLY a JSON object: {{\"delta\": <float 0.0 to 1.0>}} "
        "where 0.0 means identical meaning and 1.0 means completely different meaning.\n\n"
        f"Original:\n{original[:800]}\n\n"
        f"Back-translated:\n{back_translated[:800]}"
    )

    response = client.models.generate_content(
        model=settings.MODEL_AUDITOR,
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json"),
    )

    try:
        result = json.loads(response.text)
        return float(result.get("delta", 0.5))
    except Exception:
        return 0.5  # neutral fallback


def _run_g_eval(original: str, translated: str, source_lang: str) -> dict:
    """
    G-Eval: AI-as-a-Judge.
    Scores the translation on Cultural-Pragmatic Adequacy (0.0–1.0).
    Also detects idioms, honorifics, and context shifts.
    """
    client = _get_client()
    prompt = (
        f"You are a cultural linguistics expert evaluating a translation from {source_lang} to English.\n\n"
        f"Original ({source_lang}):\n{original[:1000]}\n\n"
        f"English translation:\n{translated[:1000]}\n\n"
        "Evaluate and return ONLY a JSON object with these fields:\n"
        "{\n"
        '  "score": <float 0.0 to 1.0, where 1.0 = perfect cultural preservation>,\n'
        '  "idioms_detected": <true/false, were regional idioms found?>,\n'
        '  "honorifics_preserved": <true/false, were honorifics/titles preserved?>,\n'
        '  "context_shift": <true/false, did the meaning shift significantly?>,\n'
        '  "notes": "<brief explanation of any issues found>"\n'
        "}"
    )

    response = client.models.generate_content(
        model=settings.MODEL_AUDITOR,
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json"),
    )

    try:
        result = json.loads(response.text)
        # Ensure score is in valid range
        result["score"] = max(0.0, min(1.0, float(result.get("score", 0.5))))
        return result
    except Exception:
        return {
            "score": 0.5,
            "idioms_detected": False,
            "honorifics_preserved": False,
            "context_shift": False,
            "notes": "G-Eval parsing failed — using neutral defaults.",
        }
