# frontend/ — Frontend Design & Development Guide

> **Scope:** The complete React + Vite frontend. Mobile-first, accessibility-focused, designed for field workers in low-connectivity environments.

---

## 1. Stack

| Tool | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| Vite | 8 | Build tool + dev server |
| React Router | 7 | Client-side routing |
| Lucide React | latest | Icon library |
| React Webcam | latest | Camera capture |
| React Leaflet | latest | Interactive map |
| Leaflet.heat | latest | Heatmap layer on map |

---

## 2. Application Routes

| URL | Component | Purpose |
|---|---|---|
| `/` | `Home.jsx` | Landing page — two primary CTAs + live stats |
| `/volunteer` | `VolunteerOnboarding.jsx` | Multi-modal volunteer registration |
| `/crisis` | `CrisisDashboard.jsx` | Crisis form + semantic volunteer matching |
| `/analytics` | `AnalyticsDashboard.jsx` | Live map with volunteer pins + crisis heatmap |

---

## 3. Design System

### Philosophy

The UI is designed for **field workers on mobile devices**, often in stressful situations. Design principles:
- **Large touch targets** — minimum 64px button height for crisis actions
- **High contrast** — dark background with bright accent colors
- **Minimal cognitive load** — one primary action per screen
- **Accessible** — ARIA labels, semantic HTML, keyboard navigable
- **Fast** — no heavy animations, lazy loading where possible

### CSS Variables (`src/index.css`)

```css
--primary-gradient: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)
--secondary-gradient: linear-gradient(135deg, #10b981 0%, #059669 100%)
--background-dark: #0f172a
--text-light: #f8fafc
--text-muted: #94a3b8
--glass-bg: rgba(255, 255, 255, 0.05)
--glass-border: rgba(255, 255, 255, 0.1)
--glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37)
```

### Utility Classes

| Class | Description |
|---|---|
| `.glass-card` | Glassmorphism container (backdrop blur, semi-transparent) |
| `.btn-primary` | Purple gradient button, full width |
| `.btn-secondary` | Green gradient button, full width |
| `.btn-danger` | Red gradient button (crisis actions) |
| `.btn-success` | Green solid button (confirmation) |
| `.btn-outline` | Bordered button (secondary actions) |
| `.page-container` | Max-width 600px, centered, flex column |
| `.page-title` | Large gradient text heading |
| `.page-subtitle` | Muted subtitle text |
| `.animate-fade-in` | Fade-in + slide-up animation (0.4s) |
| `.accessible-card` | High-contrast card for accessibility mode |

### Color Semantics

| Color | Hex | Use |
|---|---|---|
| Primary (purple) | `#4f46e5` / `#7c3aed` | Navigation, primary actions |
| Success (green) | `#10b981` / `#059669` | Volunteer registration, confirmed |
| Danger (red) | `#DC2626` / `#ef4444` | Crisis alerts, emergency |
| Warning (amber) | `#D97706` / `#f59e0b` | Flagged audits, moderate urgency |
| Info (blue) | `#3B82F6` / `#2563EB` | Stats, informational |

---

## 4. Page Architecture

### `Home.jsx` — Landing Page

**Purpose:** Immediate decision point. Two giant buttons: "I NEED HELP" and "I WANT TO HELP".

**Key features:**
- Animated counters (volunteers, active deployments, areas covered) — currently hardcoded targets, should be fetched from `GET /api/analytics/summary`
- Live clock (updates every second)
- Emergency call button (tel:112)
- Navigation to analytics map

**Known issue:** The stats (1247 volunteers, 89 active, 34 areas) are hardcoded animation targets. They should be fetched from the backend.

**Improvement:** Add `useEffect` to call `GET /api/analytics/summary` on mount and use real numbers.

---

### `VolunteerOnboarding.jsx` — Multi-Modal Registration

**Purpose:** Register a volunteer using any combination of 4 input methods.

**Input Methods (accordion panels):**
1. **Voice** — Record audio → send to `POST /api/ingest/audio` → get transcript + translation
2. **Photo** — Webcam capture → send to `POST /api/ingest/file` as JPEG
3. **File Upload** — PDF/image upload → send to `POST /api/ingest/file`
4. **Typed Text** — Manual form fields (name, phone, location, skills, days, languages)

**State Architecture:**
- All 4 methods write into a shared form state (name, phone, location, skills, etc.)
- `contributions` object tracks which methods have contributed data
- A summary bar shows what's been collected so far
- On submit: priority order is photo > uploaded file > text

**3-Step Flow:**
1. `input` — Choose methods and fill in data
2. `review` — Preview everything before submitting
3. `success` — Show structured profile + XAI audit scores

**Known Gap:** The voice recording feature calls `POST /api/ingest/audio` which doesn't exist in the backend yet. The frontend handles the 404 gracefully with an error message.

**Skills Grid:** 10 predefined skills with icons and colors (first_aid, driving, cooking, repair, teaching, security, childcare, cleaning, medical, counseling). Users tap to toggle.

**Language Support:** 10 Indian languages in the hint dropdown (auto-detect, English, Hindi, Kannada, Tamil, Telugu, Bengali, Malayalam, Marathi, Gujarati, Urdu).

---

### `CrisisDashboard.jsx` — Crisis Matching

**Purpose:** Find volunteers for an active crisis.

**Form fields:**
- What happened? (textarea)
- Where is it? (location input)
- What skills are needed? (comma-separated)
- How many volunteers? (number, default 5)
- Urgency level (low/normal/high/critical)

**Matching flow:**
1. Submit form → `POST /api/match`
2. Display ranked volunteer cards
3. "MESSAGE THEM" button → simulated 3-second polling → random accept/decline

**Known Issue:** The fetch call uses `http://localhost:8000/api/match` (hardcoded) instead of the relative `/api/match` path. This breaks in production. Should use the `matchVolunteers()` function from `api.js`.

**Deployment simulation:** Currently uses `setTimeout` + `Math.random()` to simulate volunteer response. In production, this should use Firebase Cloud Messaging (FCM) with real push notifications.

---

### `AnalyticsDashboard.jsx` — Live Map

**Purpose:** Visual overview of volunteer locations and crisis hotspots.

**Map features:**
- Base layer: CartoDB light tiles
- Green pins: available volunteers (from `GET /api/volunteers`)
- Red pins: deployed volunteers
- Heatmap layer: crisis hotspots (currently hardcoded 5 hotspots)
- Auto-refresh every 10 seconds
- Filter buttons: All / Ready / Deployed

**Geocoding:** Uses a hardcoded lookup table (`LOCATION_COORDS`) for known Bangalore neighborhoods. Unknown locations get a random offset from the Bangalore center. In production, use Google Maps Geocoding API.

**Known Issues:**
- Crisis hotspots are hardcoded — should come from `GET /api/crisis` (endpoint not yet built)
- Volunteer fetch uses `http://localhost:8000/api/volunteers` (hardcoded) — should use relative path
- `window.L = L` hack needed for `leaflet.heat` plugin compatibility

---

## 5. API Client (`src/api.js`)

Centralized fetch wrapper. All API calls go through here.

```javascript
ingestText(rawText, hintLanguage)     // POST /api/ingest/text
ingestFile(file, hintLanguage)        // POST /api/ingest/file
matchVolunteers(payload)              // POST /api/match
updateVolunteerStatus(id, status)     // PATCH /api/volunteers/:id/status
getHealth()                           // GET /api/health
```

**Error handling:** All functions throw `Error` with the backend's `detail` message on non-2xx responses.

**Base URL:** `/api` (relative) — Vite dev proxy forwards to `http://localhost:8000`.

**Missing functions:**
```javascript
// Needed:
ingestAudio(audioBlob, hintLanguage)  // POST /api/ingest/audio
getVolunteers()                        // GET /api/volunteers
getAnalyticsSummary()                  // GET /api/analytics/summary
getCrises()                            // GET /api/crisis
```

---

## 6. Vite Configuration (`vite.config.js`)

```javascript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    }
  }
}
```

This proxy means:
- In development: `/api/health` → `http://localhost:8000/api/health`
- In production: `/api/health` → same origin (Cloud Run serves both frontend and backend)

**Never use `http://localhost:8000` directly in frontend code.** Always use `/api/*` paths.

---

## 7. Running Locally

```bash
cd frontend
npm install
npm run dev
# Opens http://localhost:5173
```

Backend must be running on port 8000 for API calls to work.

---

## 8. Production Build

```bash
cd frontend
npm run build
# Output in frontend/dist/

# Copy to backend static dir for Cloud Run
cp -r dist/* ../app/static/
```

---

## 9. Known Bugs to Fix

| File | Issue | Fix |
|---|---|---|
| `CrisisDashboard.jsx` | Hardcoded `http://localhost:8000/api/match` | Use `matchVolunteers()` from `api.js` |
| `AnalyticsDashboard.jsx` | Hardcoded `http://localhost:8000/api/volunteers` | Use relative `/api/volunteers` |
| `Home.jsx` | Hardcoded stat counters | Fetch from `GET /api/analytics/summary` |
| `VolunteerOnboarding.jsx` | Audio endpoint 404 | Implement `POST /api/ingest/audio` in backend |
| `CrisisDashboard.jsx` | Simulated deployment | Implement real FCM push notifications |
| `AnalyticsDashboard.jsx` | Hardcoded crisis hotspots | Fetch from `GET /api/crisis` |

---

## 10. Accessibility Checklist

- [ ] All buttons have descriptive text (not just icons)
- [ ] Color is not the only indicator of state (use icons + text)
- [ ] Touch targets are minimum 44×44px (crisis buttons are 64-80px)
- [ ] Form inputs have associated `<label>` elements
- [ ] Images have `alt` attributes
- [ ] Focus indicators are visible
- [ ] Screen reader tested with VoiceOver/TalkBack

---

## 11. Planned Features

1. **PWA / Offline support** — Service worker for field workers with poor connectivity
2. **Push notifications** — FCM integration for volunteer alerts
3. **Real-time updates** — WebSocket or SSE for live volunteer status changes
4. **Dark/light mode toggle** — Currently dark-only
5. **Language switcher** — UI in Hindi/Kannada for non-English field workers
6. **Volunteer profile page** — View/edit your own profile after registration
7. **Crisis history** — List of past crises and outcomes
8. **Admin panel** — NGO admin view with bulk import and audit review queue

---

*See `frontend/src/pages/` for individual page guides and `frontend/DEVELOPMENT_GUIDE.md` for the original development reference.*
