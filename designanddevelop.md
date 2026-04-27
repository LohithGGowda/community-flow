# CommunityFlow — Root Design & Development Guide

> **Purpose:** This document is the master reference for Google Kiro (and any AI agent) to understand, rebuild, extend, or audit the entire CommunityFlow application from scratch. Every folder in this project has its own `designanddevelop.md` that goes deeper. Start here.

---

## 1. What This Project Is

**CommunityFlow** is an AI-powered volunteer coordination platform built for the Google Solutions Challenge. It solves a real problem: local NGOs and social groups collect volunteer data on paper, in multiple languages, across scattered formats — and have no fast way to match those volunteers to active crises.

The system ingests messy, multilingual, multimodal volunteer data (typed text, scanned PDFs, handwritten photos, voice recordings), runs it through a 4-agent AI pipeline, and semantically matches volunteers to crisis requests in real time.

**Target users:**
- NGO field workers registering volunteers (often on mobile, often in regional languages)
- Crisis coordinators who need to find the right people fast
- Community leaders who want a live map of resource availability

---

## 2. Hackathon Scoring Alignment

Every architectural decision maps to one of the four Google hackathon criteria:

| Criterion | Weight | How CommunityFlow Scores |
|---|---|---|
| Technical Merit | 40% | 4-agent A2A pipeline, XAI cultural audit, Gemini 2.5 Pro G-Eval, ChromaDB → Vertex AI vector search, Firestore dual-backend |
| User Experience | 10% | Mobile-first React UI, 4 input modalities (voice/photo/file/text), accessible large-touch design, live map |
| Alignment With Cause | 25% | Directly addresses NGO data fragmentation; multilingual support for India's linguistic diversity |
| Innovation & Creativity | 25% | Back-translation XAI audit is novel; cultural-pragmatic adequacy scoring preserves terms like "Shramadana" that generic parsers destroy |

---

## 3. System Architecture (Bird's Eye)

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                  │
│  Home → VolunteerOnboarding → CrisisDashboard → AnalyticsMap   │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP /api/*
┌────────────────────────▼────────────────────────────────────────┐
│                    FASTAPI BACKEND (Python)                      │
│  routes.py → orchestrator.py → [4 Agents] → services           │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   Gemini API       ChromaDB          Firestore
  (Perception,     (Vector Store,    (Volunteer DB,
   Auditor,         local/Vertex)     mock/real)
   Schema,
   Embedding)
```

### The 4-Agent Pipeline (A2A Pattern)

```
[Input: text / file / audio]
        ↓
[Agent 1: PerceptionAgent]   — Multimodal OCR + language detection
        ↓                       Model: gemini-2.0-flash
[Agent 2: AuditorAgent]      — Translation + XAI cultural audit
        ↓                       Model: gemini-2.5-pro (G-Eval)
[Agent 3: SchemaAgent]       — JSON schema enforcement
        ↓                       Model: gemini-2.0-flash (JSON mode)
[Agent 4: EmbeddingAgent]    — Vector generation
        ↓                       Model: text-embedding-004
[Firestore + ChromaDB/Vertex AI]
```

The shared state object `SharedIngestionState` (defined in `app/models/schemas.py`) flows through all 4 agents like a "patient chart" — each agent reads from it and appends its output.

---

## 4. Folder Structure

```
community-flow-prototype/
├── app/                        # FastAPI backend
│   ├── agents/                 # The 4 AI agents
│   ├── api/                    # Route definitions
│   ├── core/                   # Config (env vars, feature flags)
│   ├── models/                 # Pydantic schemas (A2A contract)
│   ├── services/               # DB + vector search abstractions
│   ├── static/                 # Legacy static files (superseded by frontend/)
│   ├── templates/              # Legacy Jinja templates (unused)
│   ├── main.py                 # FastAPI app entry point
│   └── orchestrator.py         # Pipeline orchestrator
├── frontend/                   # React + Vite frontend
│   └── src/
│       ├── pages/              # 4 page components
│       ├── api.js              # Centralized API client
│       └── index.css           # Design system (CSS variables)
├── tests/                      # Test suite
│   └── sample_inputs/          # Multilingual test data
├── project-planner/            # Design documents (PDFs/DOCX)
├── .env                        # Environment variables (never commit)
├── .env.example                # Template for .env
├── requirements.txt            # Python dependencies
├── Dockerfile                  # Container definition
├── deploy.sh                   # Cloud Run deployment script
└── goal-anti_drift.md          # Hackathon scoring criteria
```

Each folder has its own `designanddevelop.md` with implementation details.

---

## 5. Data Flow: Volunteer Registration

1. User opens `/volunteer` on mobile
2. Chooses input method: voice / photo / file upload / typed text
3. Frontend calls `POST /api/ingest/text` or `POST /api/ingest/file`
4. Orchestrator runs the 4-agent pipeline:
   - PerceptionAgent extracts raw text + detects language
   - AuditorAgent translates + runs XAI cultural audit
   - SchemaAgent enforces `VolunteerProfile` JSON structure
   - EmbeddingAgent generates 768-dim vector
5. Profile saved to Firestore (or mock DB)
6. Vector saved to ChromaDB (or Vertex AI)
7. `PipelineResponse` returned to frontend with profile + audit metadata
8. Frontend shows success screen with XAI audit scores

## 6. Data Flow: Crisis Matching

1. Crisis coordinator opens `/crisis`
2. Fills in: description, location, required skills, urgency
3. Frontend calls `POST /api/match`
4. Backend generates query embedding from crisis text
5. ChromaDB k-NN search returns top N volunteer IDs
6. Volunteer profiles fetched from DB and returned
7. Frontend shows ranked matches with "Message Them" button
8. On click: simulated deployment alert (real: Firebase Cloud Messaging)
9. Volunteer status updated via `PATCH /api/volunteers/:id/status`

---

## 7. Key Design Decisions

### Why 4 separate agents instead of one big prompt?
Each agent has a single responsibility and a different model. The Auditor uses Gemini 2.5 Pro (expensive, deep reasoning) only for cultural analysis. The Schema agent uses Flash (cheap, fast, JSON-mode reliable). This keeps costs low and quality high.

### Why XAI / back-translation audit?
Generic translation flattens cultural terms. "Shramadana" (ಶ್ರಮದಾನ) means community labour with spiritual significance — not "social work". The back-translation audit detects when meaning drifts and flags it for human review. This is the core innovation.

### Why ChromaDB locally + Vertex AI in production?
ChromaDB requires zero credentials and runs in-memory. It lets the prototype work without any Google Cloud setup. The `VECTOR_BACKEND` env var switches to Vertex AI for production scale.

### Why mock DB + Firestore dual backend?
Same reason — zero-credential local dev. `DB_BACKEND=mock` uses an in-memory dict. `DB_BACKEND=firestore` uses real Firestore. The interface is identical.

---

## 8. Environment Variables

See `.env.example` for the full list. Critical ones:

| Variable | Default | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | (required) | All Gemini API calls |
| `DB_BACKEND` | `mock` | `mock` or `firestore` |
| `VECTOR_BACKEND` | `local` | `local` (ChromaDB) or `vertex` |
| `GOOGLE_CLOUD_PROJECT` | `community-flow-dev` | GCP project ID |
| `CULTURAL_ADEQUACY_THRESHOLD` | `0.85` | XAI pass/fail threshold |
| `SKIP_AUDIT_FOR_ENGLISH` | `false` | Skip audit for English inputs |

---

## 9. Running Locally

```bash
# Backend
python -m venv solutionschallegeprototypevenv
source solutionschallegeprototypevenv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Add your GEMINI_API_KEY to .env
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

---

## 10. Deployment

```bash
# Build frontend
cd frontend && npm run build
cp -r dist/* ../app/static/

# Deploy to Cloud Run
gcloud run deploy communityflow \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your_key,DB_BACKEND=firestore
```

---

## 11. Planned Improvements (Next Increments)

See `project-planner/` for full design documents. Key next features:

1. **Real-time notifications** — Firebase Cloud Messaging for volunteer alerts
2. **Audio ingestion endpoint** — `POST /api/ingest/audio` for voice registration
3. **Geo-aware matching** — Weight match scores by distance, not just semantic similarity
4. **Crisis severity scoring** — Auto-classify urgency from description using Gemini
5. **Volunteer reputation system** — Track deployment history and reliability scores
6. **Offline-first PWA** — Service worker for field workers with poor connectivity
7. **Admin dashboard** — NGO admin view with bulk import and audit review queue
8. **Multi-tenant support** — Separate volunteer pools per NGO organization

---

## 12. Files Every Agent Must Know

| File | Why It Matters |
|---|---|
| `app/models/schemas.py` | The A2A contract — all data structures |
| `app/orchestrator.py` | Pipeline flow and error handling |
| `app/core/config.py` | All configuration and feature flags |
| `app/api/routes.py` | All API endpoints |
| `frontend/src/api.js` | Frontend API contract |
| `frontend/DEVELOPMENT_GUIDE.md` | Frontend architecture |
| `goal-anti_drift.md` | Hackathon scoring criteria |

---

*Last updated: April 27, 2026 | Version: 0.1.0*
