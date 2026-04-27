# CommunityFlow Frontend — Development Guide

**Last updated:** April 27, 2026  
**Stack:** React 19 + Vite 8 + React Router 7

---

## Quick Start

```bash
cd frontend
npm install
npm run dev
```

The dev server runs on `http://localhost:5173` and proxies `/api/*` to `http://localhost:8000` (backend).

---

## Architecture Overview

### Pages & Routes

| Route | Component | Purpose |
|---|---|---|
| `/` | `Home.jsx` | Landing page with two CTAs: volunteer signup and crisis request |
| `/volunteer` | `VolunteerOnboarding.jsx` | Volunteer registration (text or file upload) |
| `/crisis` | `CrisisDashboard.jsx` | Crisis request form + semantic volunteer matching |

### API Client (`src/api.js`)

Centralized fetch wrapper for all backend calls. Uses relative `/api/*` paths so the Vite dev proxy handles CORS.

**Functions:**
- `ingestText(rawText, hintLanguage)` → `POST /api/ingest/text`
- `ingestFile(file, hintLanguage)` → `POST /api/ingest/file`
- `matchVolunteers(payload)` → `POST /api/match`
- `updateVolunteerStatus(volunteerId, status)` → `PATCH /api/volunteers/:id/status`
- `getHealth()` → `GET /api/health`

**Error handling:** All functions throw on HTTP errors with the backend's `detail` message.

---

## Design System

### CSS Variables (`src/index.css`)

```css
--primary-gradient: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
--secondary-gradient: linear-gradient(135deg, #10b981 0%, #059669 100%);
--background-dark: #0f172a;
--text-light: #f8fafc;
--text-muted: #94a3b8;
--glass-bg: rgba(255, 255, 255, 0.05);
--glass-border: rgba(255, 255, 255, 0.1);
--glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
```

### Reusable Classes

- `.glass-card` — Glassmorphism container (backdrop blur, semi-transparent)
- `.btn-primary` — Purple gradient button
- `.btn-secondary` — Green gradient button
- `.page-container` — Max-width 600px, centered, flex column
- `.page-header` — Title + subtitle block
- `.page-title` — Large gradient text
- `.page-subtitle` — Muted subtitle
- `.animate-fade-in` — Fade-in animation (0.4s)

### Icons

Using **Lucide React** (`lucide-react` package). Common icons:
- `ArrowLeft`, `Send`, `Upload`, `Search`, `Loader2`
- `User`, `MapPin`, `Phone`, `Clock`, `Languages`, `Globe`
- `CheckCircle`, `AlertTriangle`, `ShieldCheck`, `FileText`, `X`

---

## Backend API Contract

### 1. `POST /api/ingest/text`

**Request:**
```json
{
  "raw_text": "Hi, I'm Priya. I can help with elderly care...",
  "hint_language": "en"
}
```

**Response (`PipelineResponse`):**
```json
{
  "request_id": "uuid",
  "volunteer_id": "uuid",
  "success": true,
  "structured_profile": {
    "name": "Priya Sharma",
    "skills": ["elderly care", "cooking", "first aid"],
    "availability": "weekends",
    "location": "Koramangala, Bangalore",
    "contact_info": "9876543210",
    "languages": ["English", "Kannada"],
    "cultural_context": "...",
    "status": "available"
  },
  "audit_metadata": {
    "source_language": "en",
    "cultural_adequacy_score": 0.92,
    "xai_flags": ["honorific_preserved"],
    "back_translation_delta": 0.08,
    "audit_status": "passed",
    "audit_notes": "..."
  },
  "pipeline_errors": []
}
```

**Key fields:**
- `success` — `true` if all 4 agents completed successfully
- `audit_metadata.cultural_adequacy_score` — 0.0–1.0 (threshold: 0.85)
- `audit_metadata.back_translation_delta` — 0.0–1.0 (threshold: 0.15, lower is better)
- `audit_metadata.audit_status` — `"passed"` | `"flagged"` | `"failed"` | `"pending"`

---

### 2. `POST /api/ingest/file`

**Request:** `multipart/form-data`
- `file` — PDF, JPG, PNG, HEIC, WEBP, TXT (max 10 MB)
- `hint_language` — Optional

**Response:** Same as `/api/ingest/text`

---

### 3. `POST /api/match`

**Request:**
```json
{
  "description": "Flooding in HSR Layout",
  "required_skills": ["first_aid", "driving"],
  "location": "HSR Layout, Bangalore",
  "volunteers_needed": 5,
  "urgency": "high"
}
```

**Response:**
```json
{
  "matches": [
    {
      "volunteer_id": "uuid",
      "match_score": 0.12,
      "volunteer_details": { }
    }
  ],
  "total_found": 3
}
```

> ⚠️ `match_score` is **cosine distance** (0 = perfect, 1 = no match).  
> Convert to similarity %: `(1 - match_score) * 100`

---

### 4. `PATCH /api/volunteers/:id/status`

```json
{ "volunteer_id": "uuid", "status": "busy" }
```

---

## Running Locally

**Backend:**
```bash
source solutionschallegeprototypevenv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend && npm run dev
```

Open `http://localhost:5173` — Vite proxies `/api/*` to `localhost:8000`.

---

## Common Issues

| Issue | Fix |
|---|---|
| CORS errors | Use `/api/*` paths, not `http://localhost:8000/api/*` |
| "Failed to submit" | Check `GEMINI_API_KEY` in `.env` and backend logs |
| Match scores wrong | `match_score` is distance — use `(1 - score) * 100` |
| Status update 404 | Volunteer ID doesn't exist — check `GET /api/volunteers` |

---

## Build & Deploy

```bash
# Production build
cd frontend && npm run build

# Copy to backend static dir for Cloud Run deployment
cp -r frontend/dist/* app/static/

# Deploy to Cloud Run
gcloud run deploy communityflow --source . --region us-central1 --allow-unauthenticated
```

---

## File Structure

```
frontend/
├── src/
│   ├── api.js                      # Centralized API client
│   ├── App.jsx                     # Root component (router)
│   ├── index.css                   # Design system
│   └── pages/
│       ├── Home.jsx
│       ├── VolunteerOnboarding.jsx # Text + file upload, XAI audit display
│       └── CrisisDashboard.jsx     # Crisis form, semantic matching, status updates
├── vite.config.js                  # Dev proxy → localhost:8000
└── DEVELOPMENT_GUIDE.md            # This file
```
