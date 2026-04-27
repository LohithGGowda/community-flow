# CommunityFlow
### Google Solutions Challenge 2026

> Eliminating the "Leaky Bucket" of volunteering — converting non-digitized, multilingual community data into real-time, semantically matched volunteer deployments.

---

## The Problem

NGOs waste enormous time on broken volunteer coordination:
- Handwritten surveys in Kannada, Tamil, Hindi that no system can read
- Volunteers called repeatedly even when already deployed ("Leaky Bucket")
- Generic keyword matching that misses cultural nuance ("Shramadana" ≠ "social work")

## The Solution

CommunityFlow is an end-to-end AI pipeline with three stages:

```
[Messy Input: PDF / Photo / Text in any language]
         ↓
  ┌─────────────────────────────────────────┐
  │         4-Agent Swarm (A2A)             │
  │  1. Perception  → OCR + language detect │
  │  2. Auditor     → XAI cultural audit    │
  │  3. Schema      → JSON enforcement      │
  │  4. Embedding   → Vectorization         │
  └─────────────────────────────────────────┘
         ↓
  [Firestore + Vector Index]
         ↓
  [Semantic k-NN Matching → Notification]
```

---

## Architecture

### Agent Swarm

| Agent | Model | Responsibility |
|---|---|---|
| Perception Agent | `gemini-2.0-flash` | Multimodal OCR, spatial reasoning, language detection |
| Cultural Auditor | `gemini-2.5-pro` | Back-translation audit, G-Eval scoring, idiom detection |
| Schema Agent | `gemini-2.0-flash` | Strict JSON enforcement via Pydantic |
| Embedding Agent | `text-embedding-004` | 768-dim vector generation for semantic search |

### XAI — Cultural Integrity Pipeline

The Cultural Auditor runs three checks on every non-English input:

1. **Back-Translation Audit** — Translates English output back to source language, measures semantic drift
2. **G-Eval (AI-as-a-Judge)** — Scores Cultural-Pragmatic Adequacy (0.0–1.0)
3. **Idiom/Honorific Detection** — Flags regional terms that must not be generalized

Records below the adequacy threshold (default: 0.85) are flagged for human review.

### Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python + FastAPI on Cloud Run |
| AI | Google Gemini API (`google-genai`) |
| Vector DB (local) | ChromaDB (in-memory) |
| Vector DB (prod) | Vertex AI Vector Search |
| Database (local) | In-memory dict |
| Database (prod) | Google Cloud Firestore |
| Schema validation | Pydantic v2 |

---

## Project Structure

```
community-flow-prototype/
├── app/
│   ├── agents/
│   │   ├── perception_agent.py   # Agent 1: Multimodal OCR
│   │   ├── auditor_agent.py      # Agent 2: XAI Cultural Audit
│   │   ├── schema_agent.py       # Agent 3: JSON Enforcement
│   │   └── embedding_agent.py    # Agent 4: Vectorization
│   ├── api/
│   │   └── routes.py             # FastAPI endpoints
│   ├── core/
│   │   └── config.py             # Settings (env vars)
│   ├── models/
│   │   └── schemas.py            # Pydantic models (A2A contract)
│   ├── services/
│   │   ├── db.py                 # Firestore / mock DB
│   │   └── vector_search.py      # ChromaDB / Vertex AI Vector Search
│   ├── orchestrator.py           # A2A pipeline orchestrator
│   └── main.py                   # FastAPI app entry point
├── project-planner/              # Design documents
├── requirements.txt
├── .env.example
└── README.md
```

---

## Quick Start

### 1. Set up environment

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure API key

```bash
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
# Get one free at: https://aistudio.google.com/app/apikey
```

### 3. Run the server

```bash
uvicorn app.main:app --reload
```

Open http://localhost:8000/docs for the interactive API docs.

---

## API Endpoints

### Ingest text
```
POST /api/ingest/text
{
  "raw_text": "My name is Priya. I can help with elderly care. Available weekends. Koramangala.",
  "hint_language": "en"
}
```

### Ingest file (PDF / image)
```
POST /api/ingest/file
Content-Type: multipart/form-data
file: <your PDF or image>
```

### Match volunteers to a crisis
```
POST /api/match
{
  "description": "Need volunteers for flood relief in HSR Layout",
  "required_skills": ["first_aid", "logistics"],
  "location": "HSR Layout, Bangalore",
  "volunteers_needed": 5,
  "urgency": "high"
}
```

### Update volunteer status
```
PATCH /api/volunteers/{id}/status
{ "volunteer_id": "...", "status": "busy" }
```

---

## KPIs (Google Solutions Challenge Benchmarks)

| Metric | Target |
|---|---|
| Semantic Match Rate vs keyword search | >40% improvement |
| G-Eval Ingestion Fidelity (non-English) | >0.90 avg score |
| E2E Latency (upload → matched notification) | <8 seconds |

---

## Switching to Production

Change these env vars in `.env`:

```bash
DB_BACKEND=firestore
VECTOR_BACKEND=vertex
GOOGLE_CLOUD_PROJECT=your-project-id
VERTEX_INDEX_ENDPOINT=your-endpoint
VERTEX_DEPLOYED_INDEX_ID=your-index-id
```

No code changes needed — the service layer handles the switch automatically.
