# app/core/ — Configuration Design & Development Guide

> **Scope:** Central configuration management. All environment variables, feature flags, model names, and thresholds live here.

---

## 1. What Lives Here

```
app/core/
├── __init__.py
└── config.py    # The Settings class — single source of truth for all config
```

---

## 2. The `Settings` Class

`config.py` uses `pydantic-settings` (`BaseSettings`) to load configuration from:
1. Real environment variables (highest priority)
2. `.env` file in the project root
3. Default values defined in the class

The `settings` singleton is imported everywhere:
```python
from app.core.config import settings
print(settings.GEMINI_API_KEY)
```

---

## 3. Configuration Reference

### Project Identity

| Variable | Default | Description |
|---|---|---|
| `PROJECT_NAME` | `"CommunityFlow"` | Shown in API docs and health check |
| `VERSION` | `"0.1.0"` | Semantic version |
| `ENV` | `"development"` | `development` / `staging` / `production` |

### Google Cloud

| Variable | Default | Description |
|---|---|---|
| `GOOGLE_CLOUD_PROJECT` | `"community-flow-dev"` | GCP project ID for Firestore + Vertex AI |
| `GOOGLE_CLOUD_REGION` | `"us-central1"` | GCP region for all services |

### Gemini API

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | `""` | **Required for real AI.** Get from Google AI Studio |
| `MODEL_PERCEPTION` | `"gemini-2.0-flash"` | Agent 1 model |
| `MODEL_AUDITOR` | `"gemini-2.5-pro"` | Agent 2 model (expensive, justified) |
| `MODEL_SCHEMA` | `"gemini-2.0-flash"` | Agent 3 model |
| `MODEL_EMBEDDING` | `"text-embedding-004"` | Agent 4 model |

### XAI Thresholds

| Variable | Default | Description |
|---|---|---|
| `CULTURAL_ADEQUACY_THRESHOLD` | `0.85` | G-Eval score below this → `flagged` status |
| `BACK_TRANSLATION_DELTA_THRESHOLD` | `0.15` | Semantic drift above this → `high_back_translation_delta` flag |

### Vector Search

| Variable | Default | Description |
|---|---|---|
| `VECTOR_BACKEND` | `"local"` | `local` (ChromaDB) or `vertex` (Vertex AI) |
| `VERTEX_INDEX_ENDPOINT` | `""` | Vertex AI index endpoint URL (production only) |
| `VERTEX_DEPLOYED_INDEX_ID` | `""` | Deployed index ID (production only) |
| `EMBEDDING_DIMENSION` | `768` | Vector dimensions (must match `text-embedding-004`) |

### Database

| Variable | Default | Description |
|---|---|---|
| `DB_BACKEND` | `"mock"` | `mock` (in-memory dict) or `firestore` |
| `FIRESTORE_COLLECTION_VOLUNTEERS` | `"volunteers"` | Firestore collection name |
| `FIRESTORE_COLLECTION_CRISIS` | `"crisis_requests"` | Firestore collection for crisis records |

### Pipeline Control

| Variable | Default | Description |
|---|---|---|
| `SKIP_AUDIT_FOR_ENGLISH` | `false` | Skip cultural audit for English inputs (saves cost) |
| `MAX_UPLOAD_SIZE_BYTES` | `10485760` | Max file upload size (10 MB) |

---

## 4. Environment Setup

### Local Development

```bash
cp .env.example .env
# Edit .env and add:
GEMINI_API_KEY=your_key_here
```

Minimum `.env` for local dev:
```
GEMINI_API_KEY=your_key_here
DB_BACKEND=mock
VECTOR_BACKEND=local
```

### Production (Cloud Run)

Set via `gcloud run deploy --set-env-vars`:
```bash
gcloud run deploy communityflow \
  --set-env-vars \
    GEMINI_API_KEY=your_key,\
    DB_BACKEND=firestore,\
    VECTOR_BACKEND=vertex,\
    GOOGLE_CLOUD_PROJECT=your-project-id,\
    ENV=production
```

---

## 5. Adding a New Configuration Variable

1. Add the field to the `Settings` class in `config.py`:
   ```python
   NEW_FEATURE_FLAG: bool = os.getenv("NEW_FEATURE_FLAG", "false").lower() == "true"
   ```
2. Add it to `.env.example` with a comment
3. Use it anywhere via `from app.core.config import settings; settings.NEW_FEATURE_FLAG`

---

## 6. Feature Flags Pattern

Use boolean settings for feature flags:
```python
SKIP_AUDIT_FOR_ENGLISH: bool = False
```

Check in code:
```python
if settings.SKIP_AUDIT_FOR_ENGLISH and lang == "en":
    # skip audit
```

This allows toggling features without code changes — just environment variables.

---

## 7. Planned Configuration Additions

```python
# Rate limiting
MAX_REQUESTS_PER_MINUTE: int = 60

# Notification service
FCM_SERVER_KEY: str = ""  # Firebase Cloud Messaging

# Geo-aware matching
GEO_WEIGHT_FACTOR: float = 0.3  # How much to weight distance vs semantic similarity
MAX_MATCH_RADIUS_KM: float = 50.0  # Only match volunteers within this radius

# Human review queue
ENABLE_HUMAN_REVIEW_QUEUE: bool = False
REVIEW_QUEUE_COLLECTION: str = "review_queue"

# Analytics
ENABLE_ANALYTICS_EVENTS: bool = True
```

---

*See `app/designanddevelop.md` for how config is used across the application.*
