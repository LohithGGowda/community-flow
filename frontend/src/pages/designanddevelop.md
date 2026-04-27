# frontend/src/pages/ — Page Components Design & Development Guide

> **Scope:** The 4 page components. Each maps to a route and represents a complete user flow.

---

## 1. Page Overview

| File | Route | Primary User | Core Job |
|---|---|---|---|
| `Home.jsx` | `/` | Anyone | Orient the user, route to the right flow |
| `VolunteerOnboarding.jsx` | `/volunteer` | Field worker / volunteer | Register a volunteer in any language, any format |
| `CrisisDashboard.jsx` | `/crisis` | Crisis coordinator / NGO worker | Find and deploy volunteers for an active crisis |
| `AnalyticsDashboard.jsx` | `/analytics` | NGO manager / coordinator | See the live state of all resources on a map |

---

## 2. `Home.jsx`

### Purpose
The landing page. Two giant action buttons dominate the screen. The user should be able to understand and act within 3 seconds.

### Key Components
- **Logo + title** — CommunityFlow branding with Zap icon
- **Live stats banner** — 3 animated counters (volunteers, active, areas)
- **"I NEED HELP" button** — Red/danger, routes to `/crisis`
- **"I WANT TO HELP" button** — Green/success, routes to `/volunteer`
- **Secondary actions** — Community Map (→ `/analytics`) and Emergency: 112 (tel link)
- **Trust footer** — "Powered by Google AI · End-to-end encrypted" + live clock

### `useAnimatedCounter` Hook
Custom hook that animates a number from 0 to `target` over `duration` ms. Used for the stats banner.

```javascript
const useAnimatedCounter = (target, duration = 2000) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    // Increments count in 30ms intervals until target is reached
  }, [target, duration]);
  return count;
};
```

**Current issue:** Targets are hardcoded (1247, 89, 34). Should fetch from `GET /api/analytics/summary`.

### Improvement Plan
```jsx
// Replace hardcoded targets with:
const [stats, setStats] = useState({ volunteers: 0, active: 0, areas: 0 });

useEffect(() => {
  getAnalyticsSummary()
    .then(data => setStats({
      volunteers: data.total_volunteers,
      active: data.deployed_volunteers,
      areas: data.coverage_areas,
    }))
    .catch(() => {}); // Fail silently — show 0s
}, []);
```

---

## 3. `VolunteerOnboarding.jsx`

### Purpose
The most complex page. Allows a volunteer to register using any combination of 4 input methods. Designed for low-literacy users who may not be able to type.

### State Architecture

```javascript
// Shared form state (all 4 methods write here)
const [name, setName] = useState('');
const [phone, setPhone] = useState('');
const [location, setLocation] = useState('');
const [selectedSkills, setSelectedSkills] = useState([]);
const [availableDays, setAvailableDays] = useState([]);
const [spokenLangs, setSpokenLangs] = useState([]);
const [notes, setNotes] = useState('');
const [hintLang, setHintLang] = useState(null);

// Which accordion panels are open
const [openPanels, setOpenPanels] = useState({ speak: false, photo: false, upload: false, type: false });

// Which methods have contributed data
const [contributions, setContributions] = useState({ speak: false, photo: false, upload: false, type: false });

// Step: 'input' | 'review' | 'success'
const [step, setStep] = useState('input');
```

### Input Method 1: Voice Recording

**Flow:**
1. User taps "Start Recording" → `navigator.mediaDevices.getUserMedia({ audio: true })`
2. `MediaRecorder` captures audio chunks
3. `AudioContext` + `AnalyserNode` drives the waveform canvas animation
4. User taps "Stop" → blob created → audio player shown
5. User taps "Process & Translate" → `POST /api/ingest/audio` (NOT YET IMPLEMENTED)
6. Response: `{ native_transcript, english_translation, detected_language, confidence }`
7. `english_translation` merged into `notes` field

**Current state:** Step 5 fails with a 404 because `POST /api/ingest/audio` doesn't exist. The error is caught and shown to the user.

**To fix:** Implement the audio endpoint in the backend (see `app/api/designanddevelop.md`).

### Input Method 2: Camera Capture

**Flow:**
1. User taps "Open Camera" → `react-webcam` component shown
2. User aligns document in the dashed frame guide
3. User taps "Snap" → `webcamRef.current.getScreenshot()` → base64 JPEG
4. Image stored in `capturedImage` state
5. On submit: `dataURLtoBlob(capturedImage)` → `ingestFile(blob, hintLang)`

**Camera flip:** Toggle between `facingMode: 'environment'` (rear) and `'user'` (front).

### Input Method 3: File Upload

**Flow:**
1. Hidden `<input type="file">` triggered by button click
2. Accepted types: PDF, images, text files
3. Image files get a preview via `FileReader`
4. On submit: `ingestFile(uploadedFile, hintLang)`

### Input Method 4: Typed Text

**Fields:** Name, Phone, Location, Skills (chip grid), Available Days (chip grid), Languages (chip grid), Notes (textarea).

**`buildTextPayload()`** assembles all typed fields into a single string:
```
"Name: Priya. Phone: 9876543210. Location: Koramangala. Skills: First Aid, Cooking. Available: Sat, Sun. Languages: English, Kannada."
```
This string is sent to `POST /api/ingest/text`.

### Submission Priority

```javascript
if (capturedImage && !uploadedFile) {
  // Photo takes priority over text
  data = await ingestFile(photoBlob, hintLang);
} else if (uploadedFile) {
  // Uploaded file takes priority over text
  data = await ingestFile(uploadedFile, hintLang);
} else {
  // Fall back to assembled text
  data = await ingestText(buildTextPayload(), hintLang);
}
```

### Success Screen

Shows:
- Volunteer's structured profile (name, location, contact, skills, languages, availability)
- XAI audit scores (cultural fit %, semantic drift %, language detected)
- Audit status badge (PASSED / FLAGGED / FAILED)

### Sub-Components (defined inline)

| Component | Purpose |
|---|---|
| `Chip` | Toggleable skill/day/language chip |
| `ContribBadge` | "✓ Done" badge on completed method cards |
| `MethodCard` | Accordion card for each input method |
| `Row` | Label + value row in profile display |
| `ScorePill` | Colored pill for audit score display |
| `Badge` | Colored badge for contribution tracking |

---

## 4. `CrisisDashboard.jsx`

### Purpose
Fast volunteer finding for crisis coordinators. Optimized for speed — large inputs, minimal steps.

### Form Fields

```javascript
const [formData, setFormData] = useState({
  description: '',        // Free text
  required_skills: '',    // Comma-separated string (split on submit)
  location: '',
  volunteers_needed: 5,
  urgency: 'high'
});
```

### Matching Flow

1. Form submit → `POST /api/match` (currently hardcoded URL — bug)
2. Response: `{ matches: [{ volunteer_id, match_score, volunteer_details }] }`
3. Each match rendered as a card with name, location, skills, match score
4. "MESSAGE THEM" button triggers simulated deployment

### Deployment Simulation

```javascript
const handleSendAlert = (volunteerId) => {
  setDeployStatus(prev => ({ ...prev, [volunteerId]: 'polling' }));
  setTimeout(() => {
    const isAccepted = Math.random() > 0.3;  // 70% acceptance rate
    setDeployStatus(prev => ({
      ...prev,
      [volunteerId]: isAccepted ? 'deployed' : 'declined'
    }));
  }, 3000);
};
```

**Status states:** `undefined` → `'polling'` → `'deployed'` | `'declined'`

**Production replacement:** Replace `setTimeout` + `Math.random()` with:
1. `POST /api/notify/{volunteer_id}` → sends FCM push notification
2. Volunteer receives notification on their phone
3. They tap Accept/Decline
4. Frontend polls `GET /api/deployments/{deployment_id}/status` or uses WebSocket

### Bug: Hardcoded URL

```javascript
// WRONG (current):
const response = await fetch('http://localhost:8000/api/match', { ... });

// CORRECT (fix):
import { matchVolunteers } from '../api';
const data = await matchVolunteers(payload);
```

---

## 5. `AnalyticsDashboard.jsx`

### Purpose
Live operational map for NGO managers. Shows where volunteers are and where crises are happening.

### Map Architecture

```
MapContainer (React Leaflet)
├── TileLayer (CartoDB light basemap)
├── TrueHeatmapLayer (leaflet.heat — crisis intensity)
├── Circle markers (invisible, for crisis popup click targets)
└── Marker pins (volunteer locations — green=available, red=deployed)
```

### `TrueHeatmapLayer` Component

A React Leaflet custom layer that uses `leaflet.heat` to render a heatmap:

```javascript
function TrueHeatmapLayer({ hotspots }) {
  const map = useMap();
  useEffect(() => {
    const points = hotspots.map(h => [h.pos[0], h.pos[1], h.reports * 10]);
    const heatLayer = L.heatLayer(points, {
      radius: 45, blur: 35,
      gradient: { 0.3: '#3b82f6', 0.5: '#10b981', 0.7: '#f59e0b', 1.0: '#ef4444' }
    }).addTo(map);
    return () => map.removeLayer(heatLayer);
  }, [map, hotspots]);
}
```

**`window.L = L` hack:** Required because `leaflet.heat` accesses `window.L` directly (it's not a proper ES module). This is a known compatibility issue.

### Geocoding

The `geocodeLocation(locationStr)` function maps location strings to lat/lng coordinates using a hardcoded lookup table of Bangalore neighborhoods. Unknown locations get a random offset from the Bangalore center so pins don't stack.

**Production replacement:** Use Google Maps Geocoding API or store lat/lng in the volunteer profile during registration.

### Auto-Refresh

```javascript
useEffect(() => {
  const interval = setInterval(fetchVolunteers, 10000);
  return () => clearInterval(interval);
}, []);
```

Fetches volunteer data every 10 seconds. In production, replace with WebSocket or Firebase Realtime Database listener for true real-time updates.

### Bug: Hardcoded URL

```javascript
// WRONG (current):
const res = await fetch('http://localhost:8000/api/volunteers');

// CORRECT (fix):
import { getVolunteers } from '../api';
const data = await getVolunteers();
```

---

## 6. Adding a New Page

1. Create `src/pages/NewPage.jsx`:
```jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function NewPage() {
  const navigate = useNavigate();
  return (
    <div className="page-container animate-fade-in">
      <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', cursor: 'pointer' }}>
        <ArrowLeft size={20} /> Back
      </button>
      <h1 className="page-title">New Page</h1>
    </div>
  );
}
```

2. Add route in `App.jsx`:
```jsx
import NewPage from './pages/NewPage';
<Route path="/new" element={<NewPage />} />
```

3. Add navigation button in `Home.jsx` or wherever appropriate.

---

## 7. Planned New Pages

| Route | Component | Purpose |
|---|---|---|
| `/admin` | `AdminDashboard.jsx` | NGO admin: bulk import, audit review queue |
| `/volunteer/:id` | `VolunteerProfile.jsx` | View/edit own profile |
| `/crisis/:id` | `CrisisDetail.jsx` | Detailed crisis view with deployment history |
| `/onboard` | `NGOOnboarding.jsx` | Register a new NGO organization |

---

*See `frontend/designanddevelop.md` for the full frontend architecture and design system.*
