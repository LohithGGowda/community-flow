"""
config.py — Central configuration for CommunityFlow

All environment variables and feature flags live here.
Uses pydantic-settings so values can come from a .env file or real env vars.
"""

import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # -----------------------------------------------------------------------
    # Project identity
    # -----------------------------------------------------------------------
    PROJECT_NAME: str = "CommunityFlow"
    VERSION: str = "0.1.0"
    ENV: str = "development"  # development | staging | production

    # -----------------------------------------------------------------------
    # Google Cloud
    # -----------------------------------------------------------------------
    GOOGLE_CLOUD_PROJECT: str = os.getenv("GOOGLE_CLOUD_PROJECT", "community-flow-dev")
    GOOGLE_CLOUD_REGION: str = os.getenv("GOOGLE_CLOUD_REGION", "us-central1")

    # -----------------------------------------------------------------------
    # Gemini API
    # -----------------------------------------------------------------------
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    # Model names — using stable, reasonably-priced models
    # Flash-Lite: fast + cheap for OCR/perception
    # Flash: balanced for schema enforcement
    # Pro: powerful for cultural reasoning (used sparingly)
    MODEL_PERCEPTION: str = "gemini-2.0-flash"          # Perception Agent
    MODEL_AUDITOR: str = "gemini-2.5-pro"               # Cultural Auditor (reasoning)
    MODEL_SCHEMA: str = "gemini-2.0-flash"              # Schema Agent
    MODEL_EMBEDDING: str = "text-embedding-004"         # Embedding Agent (Vertex AI)

    # -----------------------------------------------------------------------
    # XAI thresholds
    # -----------------------------------------------------------------------
    # Records below this score are flagged for human review
    CULTURAL_ADEQUACY_THRESHOLD: float = 0.85
    # Back-translation delta above this triggers a flag
    BACK_TRANSLATION_DELTA_THRESHOLD: float = 0.15

    # -----------------------------------------------------------------------
    # Vector Search
    # -----------------------------------------------------------------------
    # "local" uses ChromaDB (prototype), "vertex" uses Vertex AI Vector Search
    VECTOR_BACKEND: str = os.getenv("VECTOR_BACKEND", "local")
    VERTEX_INDEX_ENDPOINT: str = os.getenv("VERTEX_INDEX_ENDPOINT", "")
    VERTEX_DEPLOYED_INDEX_ID: str = os.getenv("VERTEX_DEPLOYED_INDEX_ID", "")
    EMBEDDING_DIMENSION: int = 768

    # -----------------------------------------------------------------------
    # Firestore
    # -----------------------------------------------------------------------
    # "mock" uses in-memory dict (prototype), "firestore" uses real Firestore
    DB_BACKEND: str = os.getenv("DB_BACKEND", "mock")
    FIRESTORE_COLLECTION_VOLUNTEERS: str = "volunteers"
    FIRESTORE_COLLECTION_CRISIS: str = "crisis_requests"

    # -----------------------------------------------------------------------
    # Pipeline control
    # -----------------------------------------------------------------------
    # Skip the Cultural Auditor for English-only inputs (saves cost)
    SKIP_AUDIT_FOR_ENGLISH: bool = False
    # Max file size for uploads (bytes) — 10 MB default
    MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
