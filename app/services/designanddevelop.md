# app/services/ — Services Design & Development Guide

> **Scope:** The persistence and search layer. These services abstract over local (mock/ChromaDB) and production (Firestore/Vertex AI) backends.

---

## 1. What Lives Here

```
app/services/
├── db.py            # Volunteer data persistence (mock ↔ Firestore)
├── vector_search.py # Vector index operations (ChromaDB ↔ Vertex AI)
└── ingestion.py     # Legacy mock ingestion (superseded by agents/)
```

---

## 2. `db.py` — Database Service

### Design Pattern: Dual Backend

The DB service uses a simple strategy pattern controlled by `settings.DB_BACKEND`:

```
DB_BACKEND=mock      → In-memory Python dict (_MOCK_DB)
DB_BACKEND=firestore → Google Cloud Firestore
```

The public interface is identical regardless of backend:

```python
save_volunteer(data: dict) -> str          # Returns volunteer_id
get_volunteer(volunteer_id: str) -> dict   # Returns volunteer data or None
get_all_volunteers() -> List[dict]         # Returns all volunteers
update_volunteer_status(id, status) -> bool # Returns True if found
```

### Mock Backend

The mock backend uses a module-level dict `_MOCK_DB`. This means:
- Data persists for the lifetime of the process
- Data is lost on server restart
- No credentials needed
- Perfect for local development and demos

**Important:** The mock DB is shared across all requests in the same process. In tests, you may want to clear it between test runs:
```python
from app.services.db import _MOCK_DB
_MOCK_DB.clear()
```

### Firestore Backend

The Firestore client is lazy-loaded on first use. Requires:
- `google-cloud-firestore` package installed
- Application Default Credentials (ADC) configured, OR
- Service account key file

Collections:
- `volunteers` — Volunteer profiles (configurable via `FIRESTORE_COLLECTION_VOLUNTEERS`)
- `crisis_requests` — Crisis records (configurable via `FIRESTORE_COLLECTION_CRISIS`)

### Data Schema in Firestore

Each volunteer document contains the full `VolunteerProfile` dict plus:
```json
{
  "id": "uuid",
  "name": "Priya Sharma",
  "skills": ["elderly_care", "cooking"],
  "availability": "weekends",
  "location": "Koramangala, Bangalore",
  "contact_info": "9876543210",
  "languages": ["English", "Kannada"],
  "cultural_context": null,
  "status": "available",
  "audit_metadata": {
    "source_language": "en",
    "cultural_adequacy_score": 0.97,
    "xai_flags": [],
    "back_translation_delta": 0.03,
    "audit_status": "passed",
    "audit_notes": null
  }
}
```

### Planned Improvements

- Add `created_at` and `updated_at` timestamps to all records
- Add Firestore query filtering (e.g., `WHERE status = 'available'`)
- Add pagination for `get_all_volunteers()` (currently returns everything)
- Add a `crisis_requests` collection with full CRUD
- Add a `review_queue` collection for flagged audit records

---

## 3. `vector_search.py` — Vector Search Service

### Design Pattern: Dual Backend

```
VECTOR_BACKEND=local  → ChromaDB (in-memory, no credentials)
VECTOR_BACKEND=vertex → Vertex AI Vector Search (production)
```

### ChromaDB (Local Backend)

ChromaDB is an in-memory vector database. It:
- Runs entirely in-process (no separate server needed)
- Uses cosine similarity by default (`hnsw:space: cosine`)
- Can embed text automatically (using its built-in model) OR accept pre-computed vectors
- Data is lost on process restart (same as mock DB)

**Two insertion methods:**

```python
# Method 1: Pre-computed embedding (preferred — uses Gemini text-embedding-004)
add_volunteer_to_index(volunteer_id, embedding, metadata)

# Method 2: Raw text (ChromaDB embeds it automatically — fallback)
add_volunteer_to_index_text(volunteer_id, text, metadata)
```

**Search:**
```python
search_volunteers(
    query_text="flood relief first aid",
    query_embedding=[0.1, 0.2, ...],  # Optional — preferred
    n_results=5
)
# Returns: [{"id": "uuid", "score": 0.87, "metadata": {...}}]
```

**Score interpretation:**
- `score` is cosine **similarity** (1 - distance)
- Range: 0.0 (no match) to 1.0 (perfect match)
- Higher is better

**Note:** The `CrisisDashboard.jsx` currently displays `match_score` directly as a percentage. Since the service now returns similarity (not distance), `87` means 87% similar — which is correct.

### Vertex AI Backend (Production)

The Vertex AI backend is stubbed out with `NotImplementedError`. To implement:

1. Create a Vertex AI Vector Search index in GCP console
2. Deploy the index to an endpoint
3. Set `VERTEX_INDEX_ENDPOINT` and `VERTEX_DEPLOYED_INDEX_ID` in `.env`
4. Implement `_vertex_upsert()` and `_vertex_search()` using the `google-cloud-aiplatform` SDK

```python
from google.cloud import aiplatform

def _vertex_upsert(volunteer_id, embedding, metadata):
    aiplatform.init(project=settings.GOOGLE_CLOUD_PROJECT)
    index_endpoint = aiplatform.MatchingEngineIndexEndpoint(
        index_endpoint_name=settings.VERTEX_INDEX_ENDPOINT
    )
    index_endpoint.upsert_datapoints(
        deployed_index_id=settings.VERTEX_DEPLOYED_INDEX_ID,
        datapoints=[
            aiplatform.gapic.IndexDatapoint(
                datapoint_id=volunteer_id,
                feature_vector=embedding,
            )
        ]
    )
```

### Planned Improvements

- Add geo-aware filtering: only return volunteers within X km of crisis location
- Add skill-based pre-filtering before vector search (reduce search space)
- Add status filtering: exclude `busy` and `inactive` volunteers from results
- Persist ChromaDB to disk for development (use `chromadb.PersistentClient`)
- Add batch upsert for bulk volunteer imports

---

## 4. `ingestion.py` — Legacy Mock Service

This file is a leftover from the initial prototype. It contains simple mock functions that return hardcoded volunteer data. It is **not used** by the current pipeline — the real ingestion is handled by the 4-agent pipeline in `app/agents/`.

**Do not delete it yet** — it may be useful as a reference for testing. But do not add new features here.

---

## 5. Service Initialization Pattern

Both `db.py` and `vector_search.py` use lazy initialization:
- The Firestore client is created on first use (not at import time)
- The ChromaDB collection is created on first use
- This means the app starts even without credentials configured

---

## 6. Adding a New Service

1. Create `app/services/new_service.py`
2. Follow the dual-backend pattern if the service has a local/production split
3. Use lazy initialization for external clients
4. Export the public interface functions (no classes needed — module-level functions are fine)
5. Import in `app/api/routes.py` or `app/orchestrator.py` as needed

---

## 7. Testing Services

The mock pipeline test (`tests/test_pipeline_mock.py`) directly tests both services:
- Saves 4 volunteers to the mock DB
- Adds them to ChromaDB
- Runs a semantic search
- Updates a volunteer's status

Run it with:
```bash
python tests/test_pipeline_mock.py
```

No API key needed — it bypasses all AI agents.

---

*See `app/models/designanddevelop.md` for the data structures these services store and retrieve.*
