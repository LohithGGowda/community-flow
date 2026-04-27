# frontend/src/ — Source Code Design & Development Guide

> **Scope:** The React source tree. Entry points, routing, global styles, and the API client.

---

## 1. File Map

```
frontend/src/
├── main.jsx        # React DOM entry point — mounts <App /> into #root
├── App.jsx         # Root component — BrowserRouter + all Routes
├── App.css         # App-level styles (minimal — most styles in index.css)
├── index.css       # Global design system (CSS variables, utility classes)
├── api.js          # Centralized API client (all fetch calls)
├── assets/         # Static assets (images, SVGs)
└── pages/          # Page components (one per route)
```

---

## 2. `main.jsx` — Entry Point

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

**StrictMode** is enabled — this causes double-renders in development to catch side effects. Don't be alarmed by double API calls in dev mode.

---

## 3. `App.jsx` — Router

Defines all 4 routes. To add a new page:
1. Create `src/pages/NewPage.jsx`
2. Import it in `App.jsx`
3. Add `<Route path="/new-path" element={<NewPage />} />`

```jsx
<BrowserRouter>
  <Routes>
    <Route path="/"          element={<Home />} />
    <Route path="/volunteer" element={<VolunteerOnboarding />} />
    <Route path="/crisis"    element={<CrisisDashboard />} />
    <Route path="/analytics" element={<AnalyticsDashboard />} />
  </Routes>
</BrowserRouter>
```

---

## 4. `index.css` — Design System

This is the single source of truth for all visual design. Key sections:

**CSS Variables** — Colors, gradients, glass effects. Change these to retheme the entire app.

**Reset** — `box-sizing: border-box`, zero margin/padding on all elements.

**Body** — Dark background (`#0f172a`), Inter font, full viewport height.

**Utility Classes:**
- `.glass-card` — The primary card component (glassmorphism)
- `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-success`, `.btn-outline` — Button variants
- `.page-container` — Max-width centered layout wrapper
- `.page-title`, `.page-subtitle` — Typography
- `.animate-fade-in` — Entry animation

**Form Elements** — Global styles for `input` and `textarea` (dark background, glass border, purple focus ring).

**To add a new utility class:** Add it to `index.css` and document it in `frontend/designanddevelop.md`.

---

## 5. `api.js` — API Client

All backend communication goes through this file. Never use `fetch()` directly in page components.

### Pattern

```javascript
export async function functionName(params) {
  const res = await fetch(`${BASE}/endpoint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);  // Throws Error on non-2xx
}
```

### `handleResponse(res)`

The shared error handler:
1. If `res.ok` → parse and return JSON
2. If not `res.ok` → try to parse `body.detail`, throw `Error(detail)`

This means all API errors surface as JavaScript `Error` objects with the backend's error message.

### Usage in Components

```jsx
import { ingestText } from '../api';

try {
  const result = await ingestText(rawText, hintLanguage);
  setResult(result);
} catch (err) {
  setError(err.message);  // err.message is the backend's detail string
}
```

### Adding a New API Function

```javascript
/**
 * GET /api/analytics/summary
 * @returns {Promise<AnalyticsSummary>}
 */
export async function getAnalyticsSummary() {
  const res = await fetch(`${BASE}/analytics/summary`);
  return handleResponse(res);
}
```

---

## 6. `assets/` — Static Assets

| File | Use |
|---|---|
| `hero.png` | Hero image (currently unused in pages) |
| `react.svg` | React logo (Vite default, unused) |
| `vite.svg` | Vite logo (Vite default, unused) |

Clean up `react.svg` and `vite.svg` before production — they're Vite scaffolding leftovers.

---

## 7. Component Patterns Used Across Pages

### Loading State

```jsx
const [loading, setLoading] = useState(false);

// In JSX:
{loading ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
{loading ? 'Processing...' : 'Submit'}
```

### Error Display

```jsx
const [error, setError] = useState('');

// In JSX:
{error && (
  <div style={{ color: '#ef4444', padding: '12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px' }}>
    <AlertTriangle size={16} /> {error}
  </div>
)}
```

### Async Submit Handler

```jsx
const handleSubmit = async () => {
  setLoading(true);
  setError('');
  try {
    const data = await apiFunction(params);
    setResult(data);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

---

## 8. Planned Source Files

```
frontend/src/
├── components/           # Shared reusable components (to be extracted)
│   ├── GlassCard.jsx
│   ├── LoadingButton.jsx
│   ├── ErrorBanner.jsx
│   ├── AuditScoreCard.jsx
│   └── VolunteerCard.jsx
├── hooks/                # Custom React hooks
│   ├── useApi.js         # Generic API call hook with loading/error state
│   ├── useGeolocation.js # Browser geolocation hook
│   └── useWebSocket.js   # Real-time updates hook
├── context/              # React context providers
│   └── AppContext.jsx    # Global state (current user, notifications)
└── utils/                # Pure utility functions
    ├── formatters.js     # Date, score, distance formatters
    └── validators.js     # Form validation helpers
```

---

*See `frontend/src/pages/designanddevelop.md` for individual page documentation.*
