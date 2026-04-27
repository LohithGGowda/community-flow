# app/ — Backend Design & Development Guide

> **Scope:** The entire FastAPI Python backend. Read this before touching any `.py` file in this directory.

---

## 1. What Lives Here

```
app/
├── main.py          # FastAPI app factory + CORS + router mount
├── orchestrator.py  # A2A pipeline orchestrator (the "glue")
├── agents/          # The 4 AI agents (each has its own designanddevelop.md)
├── api/             # Route definitions
├── core/            # Config (pydantic-settings)
├── models/          # Pydantic schemas — the A2A contract
├── services/        # DB + vector search abstractions
├── static/          # Legacy static files (superseded by frontend/)
└── templates/       # Legacy Jinja templates (currently empty/unused)
```

---

## 2. Entry Point: `main.py`

The FastAPI application is created here. Key responsibilities:
- Creates the `FastAPI` instance with metadata from `settings`
- Adds CORS middleware (open `*` for prototype — restrict in production)
- Mounts the API router at `/api`
- Exposes a root `GET /` endpoint that returns project info

**To add a new router:** Import it and call `app.include_router(new_router, prefix="/api/new-prefix")`.

**CORS in production:** Replace `allow_origins=["*"]` with the actual frontend domain.

---

## 3. The Orchestrator: `orchestrator.py`

This is the most important file in the backend. It is the "glue" that connects all 4 agents.

### Pipeline Stages

```python
state = SharedIngestionState()          # Initialize shared state
state = perception_agent.run(state)     # Stage 1: Extract text + detect language
state = auditor_agent.run(state)        # Stage 2: Translate + XAI audit
state = schema_agent.run(state)         # Stage 3: Enforce JSON schema
state = embedding_agent.run(state)      # Stage 4: Generate vector
db.save_volunteer(...)                  # Persist to Firestore/mock
vector_search.add_volunteer_to_index()  # Persist to ChromaDB/Vertex AI
```

### Error Handling Philosophy

- **Non-fatal errors** are appended to `state.pipeline_errors` — the pipeline continues
- **Fatal errors** (no text extracted, no profile built) return early with `success=False`
- Each agent wraps its logic in `try/except` and appends errors to state
- The orchestrator checks for hard failures (e.g., `audit_score == 0.0`) and logs warnings but does NOT stop the pipeline

### The `SharedIngestionState` Object

This Pydantic model is the "patient chart" — it flows through all 4 agents. Each agent reads from it and writes its output back to it. Never pass raw strings between agents — always use this object.

```python
state.extracted_raw_text      # Written by PerceptionAgent
state.detected_language       # Written by PerceptionAgent
state.translated_working_copy # Written by AuditorAgent
state.audit_metadata          # Written by AuditorAgent
state.structured_profile      # Written by SchemaAgent
state.embedding_vector        # Written by EmbeddingAgent
state.pipeline_errors         # Appended by any agent on error
```

### Adding a New Pipeline Stage

1. Create a new agent file in `app/agents/`
2. Implement a `run(state: SharedIngestionState) -> SharedIngestionState` function
3. Add the new fields to `SharedIngestionState` in `app/models/schemas.py`
4. Call the agent in `orchestrator.py` in the correct sequence

---

## 4. Module Dependency Graph

```
main.py
  └── api/routes.py
        ├── orchestrator.py
        │     ├── agents/perception_agent.py
        │     ├── agents/auditor_agent.py
        │     ├── agents/schema_agent.py
        │     ├── agents/embedding_agent.py
        │     ├── services/db.py
        │     └── services/vector_search.py
        ├── services/db.py
        ├── services/vector_search.py
        └── agents/embedding_agent.py  (for query embedding)
```

All modules import from:
- `app.core.config` — settings singleton
- `app.models.schemas` — all data structures

---

## 5. Configuration Pattern

All configuration lives in `app/core/config.py` as a `pydantic-settings` `BaseSettings` class. Values come from:
1. Environment variables (highest priority)
2. `.env` file
3. Default values in the class

**Never hardcode API keys, model names, or thresholds.** Always use `settings.FIELD_NAME`.

---

## 6. Adding a New API Endpoint

1. Open `app/api/routes.py`
2. Add a new route function with the appropriate decorator (`@router.get`, `@router.post`, etc.)
3. Define request/response Pydantic models in `app/models/schemas.py`
4. If the endpoint needs a new service, add it to `app/services/`

---

## 7. Static Files & Templates

`app/static/` and `app/templates/` are legacy from an earlier prototype iteration. The production frontend is now in `frontend/` (React + Vite). During deployment, the built frontend is copied to `app/static/` for Cloud Run serving.

---

## 8. Testing

Run the mock pipeline test (no API key needed):
```bash
python tests/test_pipeline_mock.py
```

Run the FastAPI server and test via Swagger UI:
```bash
uvicorn app.main:app --reload --port 8000
# Open http://localhost:8000/docs
```

---

## 9. Production Checklist

- [ ] Set `DB_BACKEND=firestore` and configure Firestore credentials
- [ ] Set `VECTOR_BACKEND=vertex` and configure Vertex AI index endpoint
- [ ] Set `GEMINI_API_KEY` from Google AI Studio
- [ ] Restrict CORS `allow_origins` to the actual frontend domain
- [ ] Set `ENV=production` to enable production-mode logging
- [ ] Set `SKIP_AUDIT_FOR_ENGLISH=false` (keep cultural audit active)
- [ ] Review `CULTURAL_ADEQUACY_THRESHOLD` (default 0.85 is appropriate)

---

*See subdirectory `designanddevelop.md` files for agent-level and service-level details.*
