"""
embedding_agent.py — Agent 4: The "Semantic" Agent

Responsibility: Vectorization for semantic matching.
- Converts the structured VolunteerProfile into a dense embedding vector.
- Stores the vector in the vector database (ChromaDB locally, Vertex AI in prod).
- The embedding captures skills, location, cultural context, and availability
  as a single high-dimensional representation.

Model: text-embedding-004 (Vertex AI / Google Generative AI)
"""

from typing import Optional, List

from google import genai

from app.core.config import settings
from app.models.schemas import SharedIngestionState, VolunteerProfile


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
    Embedding Agent entry point.

    Reads state.structured_profile.
    Writes state.embedding_vector.
    """
    print(f"[EmbeddingAgent] Starting — request_id={state.request_id}")

    if not state.structured_profile:
        state.pipeline_errors.append("EmbeddingAgent: No structured profile to embed.")
        return state

    try:
        # Build a rich text representation of the volunteer for embedding
        embed_text = _build_embed_text(state.structured_profile, state)

        # Generate the embedding vector
        vector = _generate_embedding(embed_text)
        state.embedding_vector = vector

        print(f"[EmbeddingAgent] Done — vector_dim={len(vector)}")

    except Exception as e:
        state.pipeline_errors.append(f"EmbeddingAgent error: {str(e)}")
        print(f"[EmbeddingAgent] ERROR: {e}")

    return state


def generate_query_embedding(query_text: str) -> List[float]:
    """
    Generate an embedding for a crisis request query.
    Used by the matching engine to find similar volunteers.
    """
    return _generate_embedding(query_text)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _build_embed_text(profile: VolunteerProfile, state: SharedIngestionState) -> str:
    """
    Build a rich text string from the volunteer profile for embedding.
    The richer the text, the better the semantic matching.
    """
    parts = [
        f"Volunteer: {profile.name}",
        f"Location: {profile.location}",
        f"Skills: {', '.join(profile.skills)}",
        f"Availability: {profile.availability}",
        f"Languages: {', '.join(profile.languages) if profile.languages else 'not specified'}",
    ]

    if profile.cultural_context:
        parts.append(f"Cultural context: {profile.cultural_context}")

    # Include audit notes for richer semantic context
    if state.audit_metadata and state.audit_metadata.audit_notes:
        parts.append(f"Notes: {state.audit_metadata.audit_notes}")

    return ". ".join(parts)


def _generate_embedding(text: str) -> List[float]:
    """
    Call the Gemini Embeddings API to get a vector for the given text.
    Falls back to a zero vector if the API is unavailable (prototype mode).
    """
    client = _get_client()

    result = client.models.embed_content(
        model=settings.MODEL_EMBEDDING,
        contents=text,
    )

    # The API returns an EmbedContentResponse with .embeddings list
    if result.embeddings and len(result.embeddings) > 0:
        return result.embeddings[0].values
    else:
        raise ValueError("Embedding API returned empty result.")
