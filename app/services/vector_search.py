"""
vector_search.py — Vector Search Service

Abstracts over two backends:
- "local": ChromaDB in-memory (default for local dev, no credentials needed)
- "vertex": Vertex AI Vector Search (for production)

Switch via VECTOR_BACKEND env var.

The local ChromaDB backend uses its own built-in embedding model for text-based
search, which is fine for prototyping. In production, we pass pre-computed
Vertex AI embeddings directly.
"""

from typing import List, Dict, Any, Optional

import chromadb

from app.core.config import settings

# ---------------------------------------------------------------------------
# ChromaDB client (local backend)
# ---------------------------------------------------------------------------
_chroma_client: Optional[chromadb.Client] = None
_chroma_collection = None


def _get_chroma_collection():
    global _chroma_client, _chroma_collection
    if _chroma_collection is None:
        _chroma_client = chromadb.Client()
        _chroma_collection = _chroma_client.get_or_create_collection(
            name="volunteers",
            metadata={"hnsw:space": "cosine"},  # cosine similarity
        )
    return _chroma_collection


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def add_volunteer_to_index(
    volunteer_id: str,
    embedding: List[float],
    metadata: dict,
) -> None:
    """
    Add a volunteer to the vector index using a pre-computed embedding.
    Used when the EmbeddingAgent successfully generates a vector.
    """
    if settings.VECTOR_BACKEND == "vertex":
        _vertex_upsert(volunteer_id, embedding, metadata)
    else:
        collection = _get_chroma_collection()
        collection.upsert(
            ids=[volunteer_id],
            embeddings=[embedding],
            metadatas=[metadata],
        )


def add_volunteer_to_index_text(
    volunteer_id: str,
    text: str,
    metadata: dict,
) -> None:
    """
    Add a volunteer using raw text (ChromaDB will embed it automatically).
    Fallback when the EmbeddingAgent is unavailable.
    """
    collection = _get_chroma_collection()
    collection.upsert(
        ids=[volunteer_id],
        documents=[text],
        metadatas=[metadata],
    )


def search_volunteers(
    query_text: str,
    query_embedding: Optional[List[float]] = None,
    n_results: int = 5,
) -> List[Dict[str, Any]]:
    """
    Search for the best-matching volunteers.

    Args:
        query_text: The crisis request as a text string.
        query_embedding: Pre-computed embedding (optional, preferred).
        n_results: Number of top matches to return.

    Returns:
        List of dicts with 'id', 'score', and 'metadata'.
    """
    if settings.VECTOR_BACKEND == "vertex":
        if not query_embedding:
            raise ValueError("Vertex AI backend requires a pre-computed query embedding.")
        return _vertex_search(query_embedding, n_results)

    # Local ChromaDB
    collection = _get_chroma_collection()

    # Check if collection has any documents
    count = collection.count()
    if count == 0:
        return []

    actual_n = min(n_results, count)

    if query_embedding:
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=actual_n,
        )
    else:
        results = collection.query(
            query_texts=[query_text],
            n_results=actual_n,
        )

    matches = []
    if results and results.get("ids") and results["ids"][0]:
        for i in range(len(results["ids"][0])):
            distance = results["distances"][0][i] if results.get("distances") else 0.0
            # Convert cosine distance to similarity score (1 - distance)
            score = round(1.0 - distance, 4)
            matches.append({
                "id": results["ids"][0][i],
                "score": score,
                "metadata": results["metadatas"][0][i] if results.get("metadatas") else {},
            })

    return matches


# ---------------------------------------------------------------------------
# Vertex AI Vector Search backend (production)
# ---------------------------------------------------------------------------

def _vertex_upsert(volunteer_id: str, embedding: List[float], metadata: dict) -> None:
    """
    Upsert a vector into Vertex AI Vector Search.
    Requires VERTEX_INDEX_ENDPOINT and VERTEX_DEPLOYED_INDEX_ID to be set.
    """
    try:
        from google.cloud import aiplatform
        aiplatform.init(project=settings.GOOGLE_CLOUD_PROJECT, location=settings.GOOGLE_CLOUD_REGION)

        # Vertex AI Vector Search upsert via the index endpoint
        # In production this would use the MatchingEngineIndexEndpoint
        # For now we raise a clear error if not configured
        if not settings.VERTEX_INDEX_ENDPOINT:
            raise RuntimeError(
                "VERTEX_INDEX_ENDPOINT is not configured. "
                "Set it in your .env file to use the Vertex AI backend."
            )

        # TODO: Implement actual Vertex AI upsert when endpoint is configured
        raise NotImplementedError("Vertex AI upsert not yet implemented in prototype.")

    except ImportError:
        raise RuntimeError("google-cloud-aiplatform is not installed.")


def _vertex_search(query_embedding: List[float], n_results: int) -> List[Dict[str, Any]]:
    """Query Vertex AI Vector Search."""
    raise NotImplementedError("Vertex AI search not yet implemented in prototype.")
