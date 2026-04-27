# app/agents/ — AI Agent Design & Development Guide

> **Scope:** The 4 AI agents that form the core of the CommunityFlow pipeline. Each agent is independent, stateless (reads/writes `SharedIngestionState`), and can fail without crashing the pipeline.

---

## 1. Agent Architecture Overview

All 4 agents follow the same contract:

```python
def run(state: SharedIngestionState, **kwargs) -> SharedIngestionState:
    """
    - Read from state
    - Do AI work
    - Write results back to state
    - Append errors to state.pipeline_errors (never raise)
    - Return state
    """
```

This pattern means:
- Agents are independently testable
- Any agent can be swapped or upgraded without touching others
- The orchestrator doesn't need to know what's inside each agent

---

## 2. Agent 1: `perception_agent.py` — The Vision Agent

**Responsibility:** Multimodal OCR + language detection  
**Model:** `gemini-2.0-flash` (fast, cheap, multimodal)  
**Input:** `file_bytes` (binary) OR `state.extracted_raw_text` (already set)  
**Output:** `state.extracted_raw_text`, `state.detected_language`, `state.raw_input_type`

### What It Does

**File path:**
1. Encodes file as base64
2. Sends to Gemini with a strict "extract only, do not interpret" prompt
3. Parses the `DETECTED_LANGUAGE: <code>` tag from the response
4. Sets `state.extracted_raw_text` and `state.detected_language`

**Text path (already provided):**
1. Sends first 500 chars to Gemini for language detection only
2. Returns ISO 639-1 code (e.g., `kn`, `hi`, `ta`, `en`)

### Supported Input Types

| MIME Type | `InputType` Enum |
|---|---|
| `application/pdf` | `PDF` |
| `image/jpeg`, `image/jpg` | `IMAGE_HANDWRITTEN` |
| `image/png`, `image/webp` | `IMAGE_PRINTED` |
| `image/heic` | `IMAGE_HANDWRITTEN` |
| `text/plain` | `TEXT` |

### Key Design Decisions

- **"Extract only, do not interpret"** — The perception agent is deliberately dumb. It faithfully copies what it sees, including typos, regional spellings, and non-standard formatting. Interpretation happens in later agents.
- **Language detection at the end** — The `DETECTED_LANGUAGE:` tag is appended at the end of the extraction prompt so it doesn't interfere with the text extraction.
- **Lazy client init** — The Gemini client is only created when first needed, so the app starts even without an API key.

### Improvement Opportunities

- Add support for Excel/CSV files (currently returns `UNKNOWN` type)
- Add confidence score for language detection
- Add support for multi-page PDFs (currently processes as single document)
- Add image preprocessing (deskew, contrast enhancement) before OCR

---

## 3. Agent 2: `auditor_agent.py` — The Cultural Auditor

**Responsibility:** Translation + XAI cultural integrity verification  
**Model:** `gemini-2.5-pro` (expensive, deep reasoning — justified here)  
**Input:** `state.extracted_raw_text`, `state.detected_language`  
**Output:** `state.translated_working_copy`, `state.audit_metadata`

### What It Does (4 Steps)

**Step 1: Translation**
- Translates non-English text to English
- Prompt explicitly instructs: preserve honorifics, keep untranslatable terms with parenthetical explanations
- Example: "Shramadana" → "Shramadana (community labour/service)" NOT "social work"

**Step 2: Back-Translation**
- Translates the English working copy back to the source language
- Used to detect semantic drift

**Step 3: Semantic Delta Computation**
- Asks Gemini to compare original vs back-translated text
- Returns a float 0.0 (identical) to 1.0 (completely different)
- Threshold: `BACK_TRANSLATION_DELTA_THRESHOLD = 0.15`

**Step 4: G-Eval (AI-as-a-Judge)**
- Gemini evaluates the translation on Cultural-Pragmatic Adequacy
- Returns JSON with: `score`, `idioms_detected`, `honorifics_preserved`, `context_shift`, `notes`
- Score threshold: `CULTURAL_ADEQUACY_THRESHOLD = 0.85`

### XAI Flags

| Flag | Meaning |
|---|---|
| `high_back_translation_delta` | Semantic drift > 15% — meaning may have changed |
| `idiom_detected` | Regional idiom found — verify translation |
| `honorific_preserved` | Title/honorific correctly preserved |
| `context_shift_detected` | Significant meaning shift detected |

### Audit Status

| Status | Condition |
|---|---|
| `passed` | Score ≥ 0.85 |
| `flagged` | Score < 0.85 (needs human review) |
| `failed` | Exception during audit |
| `pending` | Not yet audited |

### English Bypass

If `SKIP_AUDIT_FOR_ENGLISH=true` and `detected_language == "en"`, the audit is skipped and score is set to 1.0. This saves API costs for English-only deployments.

### Why Gemini 2.5 Pro Here?

The cultural audit requires genuine reasoning about linguistic nuance — understanding that "Shramadana" has spiritual and community significance that "social work" doesn't capture. Flash models don't have the reasoning depth for this. Pro is used only for this agent to keep costs manageable.

### Improvement Opportunities

- Add a human review queue for `flagged` records (Firestore collection + admin UI)
- Add language-specific cultural knowledge bases (e.g., Kannada idiom dictionary)
- Cache audit results for identical text to reduce API costs
- Add confidence intervals to the cultural adequacy score

---

## 4. Agent 3: `schema_agent.py` — The Librarian

**Responsibility:** Deterministic JSON schema enforcement  
**Model:** `gemini-2.0-flash` (fast, cheap, JSON-mode reliable)  
**Input:** `state.translated_working_copy` (or `state.extracted_raw_text` as fallback)  
**Output:** `state.structured_profile` (a `VolunteerProfile` Pydantic object)

### What It Does

1. Builds a prompt with the `VolunteerProfile` JSON schema
2. Includes cultural audit notes if available (to preserve flagged terms)
3. Calls Gemini with `response_mime_type="application/json"` — guarantees valid JSON
4. Validates and normalizes the response (ensures lists are lists, status is valid enum)
5. Constructs a `VolunteerProfile` Pydantic object

### Schema Enforcement Rules (in the prompt)

- Extract ONLY what is explicitly stated — never invent data
- For skills: use specific terms, not generic ones
- For availability: use natural language
- For status: always `"available"` unless text says otherwise
- If a field can't be determined: use sensible default or empty string

### Why JSON Mode?

Without `response_mime_type="application/json"`, LLMs sometimes return markdown code blocks, explanatory text, or malformed JSON. JSON mode guarantees a parseable response every time.

### Improvement Opportunities

- Add field-level confidence scores (how certain is the extraction?)
- Add a "review required" flag for profiles with many empty fields
- Support extracting `geo_location` (lat/lng) from location strings via geocoding
- Add skill normalization (map "first aid" → "first_aid", "driving" → "driving")

---

## 5. Agent 4: `embedding_agent.py` — The Semantic Agent

**Responsibility:** Vectorization for semantic matching  
**Model:** `text-embedding-004` (Google's embedding model, 768 dimensions)  
**Input:** `state.structured_profile`  
**Output:** `state.embedding_vector` (List[float], 768 dimensions)

### What It Does

1. Builds a rich text representation of the volunteer profile:
   ```
   "Volunteer: Priya Sharma. Location: Koramangala, Bangalore. 
    Skills: elderly_care, cooking, first_aid. Availability: weekends. 
    Languages: English, Kannada. Cultural context: ..."
   ```
2. Calls the Gemini Embeddings API
3. Returns the 768-dimensional vector

### Why Rich Text for Embedding?

The more context in the embedding text, the better the semantic matching. A volunteer who speaks Kannada and has "shramadana" skills should match differently than one with "social work" skills — even if the surface-level skills look similar.

### Query Embedding (for Matching)

The `generate_query_embedding(query_text)` function is also exported from this module. It's called by `routes.py` when processing a crisis match request. The crisis description is embedded using the same model, enabling semantic similarity search.

### Improvement Opportunities

- Experiment with different embedding text templates to improve match quality
- Add location-weighted embeddings (boost geographic proximity)
- Cache embeddings for identical profiles to reduce API costs
- Support batch embedding for bulk volunteer imports

---

## 6. Adding a New Agent

1. Create `app/agents/new_agent.py`
2. Implement the standard interface:
   ```python
   def run(state: SharedIngestionState) -> SharedIngestionState:
       try:
           # Do work, write to state
           pass
       except Exception as e:
           state.pipeline_errors.append(f"NewAgent error: {str(e)}")
       return state
   ```
3. Add new fields to `SharedIngestionState` in `app/models/schemas.py`
4. Import and call in `app/orchestrator.py`
5. Export from `app/agents/__init__.py`

---

## 7. Agent Testing Without API Key

All agents can be tested in mock mode using `tests/test_pipeline_mock.py`. This test bypasses all 4 agents and directly creates `VolunteerProfile` and `AuditMetadata` objects, then tests the DB and vector search layers.

To test individual agents with a real API key:
```python
from app.models.schemas import SharedIngestionState
from app.agents import perception_agent

state = SharedIngestionState()
state.extracted_raw_text = "My name is Priya..."
state = perception_agent.run(state)
print(state.detected_language)
```

---

## 8. Model Cost Reference

| Agent | Model | Approx Cost | Justification |
|---|---|---|---|
| Perception | gemini-2.0-flash | Low | Fast OCR, no deep reasoning needed |
| Auditor | gemini-2.5-pro | High | Cultural reasoning requires best model |
| Schema | gemini-2.0-flash | Low | JSON extraction, no reasoning needed |
| Embedding | text-embedding-004 | Very Low | Embedding is cheap per token |

---

*See `app/designanddevelop.md` for orchestrator-level details.*
