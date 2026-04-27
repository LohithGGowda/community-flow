# app/api/ — API Routes Design & Development Guide

> **Scope:** All FastAPI route definitions. This is the HTTP interface between the frontend and the backend pipeline.

---

## 1. Route Map

| Method | Path | Handler | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | `health_check` | System health + config status |
| `POST` | `/api/ingest/text` | `ingest_text` | Ingest plain text volunteer data |
| `POST` | `/api/ingest/file` | `ingest_file` | Ingest file (PDF, image, etc.) |
| `POST` | `/api/match` | `match_volunteers` | Semantic volunteer matching |
| `PATCH` | `/api/volunteers/{id}/status` | `update_volunteer_status` | Update volunteer availability |
| `GET` | `/api/volunteers` | `list_volunteers` | List all volunteers (debug/demo) |
| `GET` | `/api/volunteers/{id}` | `get_volunteer` | Get single volunteer by ID |

**Missing endpoint (planned):**
- `POST /api/ingest/audio` — Audio file ingestion (voice registration)

---

## 2. Endpoint Details

### `GET /api/health`

Returns system status including which backends are configured. Use this to verify the deployment is working before running demos.

```json
{
  "status": "ok",
  "project": "CommunityFlow",
  "version": "0.1.0",
  "vector_backend": "local",
  "db_backend": "mock",
  "gemini_configured": true
}
```

### `POST /api/ingest/text`

The primary volunteer registration endpoint for typed/pasted text.

**Request:** `TextUploadRequest`
```json
{
  "raw_text": "My name is Priya. I can help with elderly care...",
  "hint_language": "en"
}
```

**Response:** `PipelineResponse`
```json
{
  "request_id": "uuid",
  "volunteer_id": "uuid",
  "success": true,
  "structured_profile": { ... },
  "audit_metadata": { ... },
  "pipeline_errors": []
}
```

**Error cases:**
- `500` — Pipeline exception (check `pipeline_errors` in response)

### `POST /api/ingest/file`

Multipart file upload for PDFs, images, and documents.

**Request:** `multipart/form-data`
- `file` — The file (max 10 MB, allowed types: PDF, JPEG, PNG, HEIC, WEBP, TXT)
- `hint_language` — Optional language hint

**Validation:**
- File size checked against `MAX_UPLOAD_SIZE_BYTES` (default 10 MB) → `413`
- MIME type checked against allowlist → `415`

**Missing:** Audio file support (`audio/webm`, `audio/mp4`, `audio/ogg`). The frontend's voice recording feature calls `POST /api/ingest/audio` which doesn't exist yet. This is a known gap.

### `POST /api/match`

The semantic matching engine. Converts a crisis request to a vector and finds the closest volunteers.

**Request:** `CrisisRequest`
```json
{
  "description": "Flooding in HSR Layout",
  "required_skills": ["first_aid", "driving"],
  "location": "HSR Layout, Bangalore",
  "volunteers_needed": 5,
  "urgency": "high"
}
```

**Response:** `MatchResponse`
```json
{
  "crisis_request": { ... },
  "matches": [
    {
      "volunteer_id": "uuid",
      "match_score": 0.87,
      "volunteer_details": { ... }
    }
  ],
  "total_found": 3
}
```

**Important:** `match_score` is **cosine similarity** (0.0 = no match, 1.0 = perfect match). The frontend displays this as a percentage. Note: the vector_search service returns similarity (1 - distance), so higher is better.

**Matching logic:**
1. Build rich query string from crisis fields
2. Generate query embedding (if `GEMINI_API_KEY` is set)
3. Search ChromaDB/Vertex AI for top N matches
4. Enrich each match with full volunteer data from DB
5. Return ranked results

### `PATCH /api/volunteers/{id}/status`

Updates a volunteer's availability status. Called when a volunteer accepts or declines a deployment.

**Request body:**
```json
{ "volunteer_id": "uuid", "status": "busy" }
```

Valid statuses: `available`, `busy`, `inactive`

**Note:** The `volunteer_id` in the URL path and in the request body must match. This is slightly redundant — a future refactor should remove the body field and use only the path parameter.

---

## 3. Request/Response Models

All models are defined in `app/models/schemas.py`. Key ones:

| Model | Used By |
|---|---|
| `TextUploadRequest` | `POST /api/ingest/text` |
| `PipelineResponse` | Both ingest endpoints |
| `CrisisRequest` | `POST /api/match` |
| `MatchResponse` | `POST /api/match` |
| `MatchResult` | Inside `MatchResponse` |
| `StatusUpdateRequest` | `PATCH /api/volunteers/:id/status` |

---

## 4. Error Handling Pattern

All endpoints follow this pattern:
```python
try:
    result = do_work()
    return result
except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))
```

For validation errors (file size, MIME type), `HTTPException` is raised directly with the appropriate status code and a human-readable `detail` message.

The frontend's `api.js` reads the `detail` field from error responses and throws it as an `Error` object.

---

## 5. Adding a New Endpoint

```python
# In app/api/routes.py

@router.post("/new-endpoint", response_model=NewResponseModel)
async def new_endpoint(request: NewRequestModel):
    """
    Docstring appears in Swagger UI at /docs
    """
    try:
        result = some_service.do_work(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

Then add `NewRequestModel` and `NewResponseModel` to `app/models/schemas.py`.

---

## 6. Planned Endpoints

### `POST /api/ingest/audio`

Needed to support the frontend's voice recording feature.

```python
@router.post("/ingest/audio", response_model=AudioTranscriptResponse)
async def ingest_audio(
    file: UploadFile = File(...),
    hint_language: Optional[str] = Form(None),
):
    """
    Accepts audio/webm, audio/mp4, audio/ogg.
    Returns native transcript + English translation + detected language.
    """
```

Response model:
```python
class AudioTranscriptResponse(BaseModel):
    native_transcript: str
    english_translation: str
    detected_language: str
    confidence: float
```

### `GET /api/crisis`

List all active crisis requests (for the analytics dashboard).

### `POST /api/crisis`

Create a new crisis request (separate from matching — for tracking purposes).

### `GET /api/analytics/summary`

Return aggregate stats: total volunteers, deployed count, crisis count, top skills, coverage by area.

---

## 7. API Documentation

FastAPI auto-generates interactive docs:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

All endpoint docstrings appear in the Swagger UI. Keep them descriptive — they're the primary API documentation for frontend developers.

---

## 8. CORS Configuration

Currently set to `allow_origins=["*"]` in `app/main.py`. For production:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend-domain.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type", "Authorization"],
)
```

---

*See `app/models/designanddevelop.md` for schema details and `app/agents/designanddevelop.md` for pipeline details.*
