"""
db.py — Database Service

Abstracts over two backends:
- "mock": In-memory dict (default for local development, no credentials needed)
- "firestore": Google Cloud Firestore (for production)

Switch via DB_BACKEND env var.
"""

import uuid
from typing import Dict, Any, List, Optional

from app.core.config import settings

# ---------------------------------------------------------------------------
# In-memory mock store (prototype / local dev)
# ---------------------------------------------------------------------------
_MOCK_DB: Dict[str, Any] = {}


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def save_volunteer(data: dict) -> str:
    """Save a volunteer record. Returns the generated volunteer_id."""
    if settings.DB_BACKEND == "firestore":
        return _firestore_save(data)
    return _mock_save(data)


def get_volunteer(volunteer_id: str) -> Optional[dict]:
    """Retrieve a volunteer by ID."""
    if settings.DB_BACKEND == "firestore":
        return _firestore_get(volunteer_id)
    return _mock_get(volunteer_id)


def get_all_volunteers() -> List[dict]:
    """Return all volunteers."""
    if settings.DB_BACKEND == "firestore":
        return _firestore_get_all()
    return list(_MOCK_DB.values())


def update_volunteer_status(volunteer_id: str, status: str) -> bool:
    """Update a volunteer's availability status. Returns True if found."""
    if settings.DB_BACKEND == "firestore":
        return _firestore_update_status(volunteer_id, status)
    return _mock_update_status(volunteer_id, status)


# ---------------------------------------------------------------------------
# Mock backend
# ---------------------------------------------------------------------------

def _mock_save(data: dict) -> str:
    volunteer_id = str(uuid.uuid4())
    _MOCK_DB[volunteer_id] = {**data, "id": volunteer_id}
    return volunteer_id


def _mock_get(volunteer_id: str) -> Optional[dict]:
    return _MOCK_DB.get(volunteer_id)


def _mock_update_status(volunteer_id: str, status: str) -> bool:
    if volunteer_id in _MOCK_DB:
        _MOCK_DB[volunteer_id]["status"] = status
        return True
    return False


# ---------------------------------------------------------------------------
# Firestore backend (production)
# ---------------------------------------------------------------------------

def _get_firestore_client():
    """Lazy-load the Firestore client."""
    try:
        from google.cloud import firestore
        return firestore.Client(project=settings.GOOGLE_CLOUD_PROJECT)
    except ImportError:
        raise RuntimeError(
            "google-cloud-firestore is not installed. "
            "Run: pip install google-cloud-firestore"
        )


def _firestore_save(data: dict) -> str:
    db = _get_firestore_client()
    doc_ref = db.collection(settings.FIRESTORE_COLLECTION_VOLUNTEERS).document()
    doc_ref.set({**data, "id": doc_ref.id})
    return doc_ref.id


def _firestore_get(volunteer_id: str) -> Optional[dict]:
    db = _get_firestore_client()
    doc = db.collection(settings.FIRESTORE_COLLECTION_VOLUNTEERS).document(volunteer_id).get()
    return doc.to_dict() if doc.exists else None


def _firestore_get_all() -> List[dict]:
    db = _get_firestore_client()
    docs = db.collection(settings.FIRESTORE_COLLECTION_VOLUNTEERS).stream()
    return [doc.to_dict() for doc in docs]


def _firestore_update_status(volunteer_id: str, status: str) -> bool:
    db = _get_firestore_client()
    ref = db.collection(settings.FIRESTORE_COLLECTION_VOLUNTEERS).document(volunteer_id)
    doc = ref.get()
    if doc.exists:
        ref.update({"status": status})
        return True
    return False
