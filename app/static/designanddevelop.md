# app/static/ — Static Files Design & Development Guide

> **Scope:** Static file serving for the production deployment. This folder is the bridge between the React frontend build and the FastAPI backend.

---

## 1. Purpose

In production (Cloud Run), FastAPI serves both the API and the frontend from a single container. The built React app is copied here during deployment.

**In development:** This folder is NOT used. The Vite dev server (`http://localhost:5173`) serves the frontend directly with hot reload.

**In production:** The contents of `frontend/dist/` are copied here, and FastAPI serves them as static files.

---

## 2. Current Contents

```
app/static/
├── index.html          # Legacy prototype HTML (superseded by React frontend)
└── css/
    └── style.css       # Legacy prototype CSS (superseded by React frontend)
```

The `index.html` and `style.css` here are from the original prototype iteration before the React frontend was built. They are **not used** in the current application.

---

## 3. Production Deployment Flow

```bash
# Step 1: Build the React frontend
cd frontend
npm run build
# Creates frontend/dist/ with index.html, assets/, etc.

# Step 2: Copy built files to app/static/
cp -r dist/* ../app/static/

# Step 3: Deploy to Cloud Run
cd ..
gcloud run deploy communityflow --source . --region us-central1
```

After step 2, `app/static/` will contain:
```
app/static/
├── index.html          # React app entry point
├── assets/
│   ├── index-[hash].js  # Bundled JavaScript
│   └── index-[hash].css # Bundled CSS
└── favicon.svg
```

---

## 4. Serving Static Files from FastAPI

To serve the React app from FastAPI, add this to `app/main.py`:

```python
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

# Mount static files
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

    # Serve React app for all non-API routes (SPA fallback)
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        index_path = os.path.join(static_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return {"error": "Frontend not built. Run: cd frontend && npm run build"}
```

**Note:** This is not yet implemented in `main.py`. The current `main.py` only has a root `GET /` that returns JSON. Add the above for production serving.

---

## 5. Cleanup Needed

Before production deployment, delete the legacy files:
```bash
rm app/static/index.html
rm app/static/css/style.css
rmdir app/static/css
```

Then copy the React build output as described above.

---

## 6. Alternative: Separate Frontend Hosting

Instead of serving the frontend from FastAPI, you can host it separately:
- **Firebase Hosting** — Free, fast CDN, easy deployment
- **Cloud Storage + CDN** — Scalable, cost-effective
- **Vercel / Netlify** — Zero-config deployment

If using separate hosting, update the Vite proxy config to point to the Cloud Run backend URL, and configure CORS in `app/main.py` to allow the frontend domain.

---

*See `frontend/designanddevelop.md` for the React build process.*
