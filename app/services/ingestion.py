"""
ingestion.py — Mocked Ingestion Service

In a production environment, this parses raw text or files using Gemini to
extract skills, availability, and location into a structured JSON profile.
Because the prototype might not have an active API key during local tests,
this acts as a robust mock.
"""
import json
from typing import Optional

def process_raw_data(raw_text: str, hint_language: Optional[str] = None) -> dict:
    # This is a mock extraction
    return {
        "name": "Alex Volunteer",
        "contact_info": "alex@example.com",
        "skills": ["first aid", "driving", "logistics"],
        "location": "Bangalore",
        "availability_status": "available",
        "raw_text": raw_text
    }

def process_file(file_bytes: bytes, mime_type: str, hint_language: Optional[str] = None) -> dict:
    return {
        "name": "Jane DocUpload",
        "contact_info": "jane@example.com",
        "skills": ["medical", "cooking"],
        "location": "HSR Layout",
        "availability_status": "available",
        "raw_text": "[Extracted from photo]"
    }
