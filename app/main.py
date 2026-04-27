"""
main.py — CommunityFlow FastAPI Application Entry Point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "End-to-end AI pipeline for volunteer-crisis matching. "
        "Ingests multilingual/multimodal NGO data, audits cultural integrity via XAI, "
        "and semantically matches volunteers to crisis requests."
    ),
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — open for prototype; restrict in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/")
def root():
    return {
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "health": "/api/health",
    }
