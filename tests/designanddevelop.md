# tests/ — Testing Design & Development Guide

> **Scope:** The test suite for CommunityFlow. Covers mock pipeline testing, sample inputs, and the testing strategy for all layers.

---

## 1. What Lives Here

```
tests/
├── test_pipeline_mock.py    # Full pipeline test — no API key needed
└── sample_inputs/
    ├── crisis_request.json  # Sample crisis request payload
    ├── volunteer_english.txt
    ├── volunteer_hindi.txt
    └── volunteer_kannada.txt
```

---

## 2. `test_pipeline_mock.py` — The Core Test

### What It Tests

This script tests the entire data layer **without** a Gemini API key. It bypasses all 4 AI agents and directly creates mock `VolunteerProfile` and `AuditMetadata` objects, then tests:

1. **DB persistence** — Save 4 volunteers to the mock DB
2. **Vector indexing** — Add all 4 to ChromaDB using text-based embedding
3. **Semantic search** — Run a crisis query and verify matches are returned
4. **Status update** — Mark a volunteer as `busy` and verify the update
5. **Sample file reading** — Verify all sample input files are readable

### How to Run

```bash
# From project root (with venv activated):
python tests/test_pipeline_mock.py
```

No environment variables needed. No API key needed.

### Expected Output

```
============================================================
  STEP 1: Ingesting Volunteers (Mock Pipeline)
============================================================
  Volunteer ingested:
    ID            : <uuid>
    Name          : Priya Sharma
    Skills        : ['elderly_care', 'cooking', 'first_aid']
    ...

============================================================
  STEP 3: Crisis Request → Semantic Matching
============================================================
  Top 3 matches found:
    Match #1
      Name          : Anita Verma
      Match score   : 0.8234  (1.0 = perfect)
      ...

============================================================
  SUMMARY
============================================================
  Volunteers ingested : 4
  Volunteers in DB    : 4
  Crisis matches found: 3
  Best match          : Anita Verma (score: 0.8234)
  All tests PASSED (mock mode — no API key required)
```

### Test Volunteers

The test creates 4 volunteers that cover key scenarios:

| Name | Key Feature | Why It Matters |
|---|---|---|
| Priya Sharma | English, standard skills | Baseline test case |
| Rajesh Kumar | Kannada, "Shramadana" skill | Tests cultural term preservation |
| Anita Verma | Hindi, flood relief skills | Tests multilingual + crisis matching |
| Mohammed Farhan | Urdu, translation skills | Tests minority language support |

---

## 3. Sample Input Files

### `crisis_request.json`

```json
{
  "description": "Flood relief needed in HSR Layout. Families displaced, need food distribution and medical assistance.",
  "required_skills": ["first_aid", "logistics", "flood_relief"],
  "location": "HSR Layout, Bangalore",
  "volunteers_needed": 5,
  "urgency": "high"
}
```

Use this to test `POST /api/match` via curl or Swagger UI:
```bash
curl -X POST http://localhost:8000/api/match \
  -H "Content-Type: application/json" \
  -d @tests/sample_inputs/crisis_request.json
```

### `volunteer_english.txt`

Standard English volunteer registration. Use to test `POST /api/ingest/text`:
```bash
curl -X POST http://localhost:8000/api/ingest/text \
  -H "Content-Type: application/json" \
  -d '{"raw_text": "'"$(cat tests/sample_inputs/volunteer_english.txt)"'"}'
```

### `volunteer_hindi.txt`

Hindi volunteer registration (Devanagari script). Tests:
- PerceptionAgent language detection
- AuditorAgent Hindi → English translation
- Cultural adequacy scoring for Hindi text

### `volunteer_kannada.txt`

Kannada volunteer registration (Kannada script). Contains "ಶ್ರಮದಾನ" (Shramadana). Tests:
- Kannada OCR/language detection
- Cultural term preservation in translation
- XAI flag: `idiom_detected`

---

## 4. Testing Strategy

### Layer 1: Mock Pipeline (No API Key)

`test_pipeline_mock.py` — Tests DB + vector search in isolation.

**Run:** `python tests/test_pipeline_mock.py`  
**When:** Before every commit, in CI/CD pipeline

### Layer 2: API Integration (Requires Running Server)

Test via Swagger UI at `http://localhost:8000/docs` or curl.

**Key test cases:**
```bash
# Health check
curl http://localhost:8000/api/health

# Ingest English text
curl -X POST http://localhost:8000/api/ingest/text \
  -H "Content-Type: application/json" \
  -d '{"raw_text": "Name: Test User. Skills: first aid. Location: Bangalore. Contact: 9999999999. Available: weekends."}'

# Ingest Kannada text (requires GEMINI_API_KEY)
curl -X POST http://localhost:8000/api/ingest/text \
  -H "Content-Type: application/json" \
  -d '{"raw_text": "ಹೆಸರು: ರಾಜೇಶ್. ಕೌಶಲ್ಯ: ಶ್ರಮದಾನ", "hint_language": "kn"}'

# Match volunteers
curl -X POST http://localhost:8000/api/match \
  -H "Content-Type: application/json" \
  -d @tests/sample_inputs/crisis_request.json

# List all volunteers
curl http://localhost:8000/api/volunteers
```

### Layer 3: Full AI Pipeline (Requires GEMINI_API_KEY)

Run the real pipeline with actual Gemini API calls.

**Test with English:**
```bash
GEMINI_API_KEY=your_key uvicorn app.main:app --port 8000 &
curl -X POST http://localhost:8000/api/ingest/text \
  -H "Content-Type: application/json" \
  -d '{"raw_text": "'"$(cat tests/sample_inputs/volunteer_english.txt)"'"}'
```

**Test with Kannada:**
```bash
curl -X POST http://localhost:8000/api/ingest/text \
  -H "Content-Type: application/json" \
  -d '{"raw_text": "'"$(cat tests/sample_inputs/volunteer_kannada.txt)"'", "hint_language": "kn"}'
```

**Verify XAI audit:**
- Check `audit_metadata.cultural_adequacy_score` ≥ 0.85 for clean inputs
- Check `audit_metadata.xai_flags` contains `idiom_detected` for Kannada input
- Check `structured_profile.skills` contains `shramadana` (not "social work")

### Layer 4: Frontend E2E

Manual testing checklist:
- [ ] Home page loads, stats animate
- [ ] "I WANT TO HELP" → VolunteerOnboarding loads
- [ ] Type name/phone/location/skills → Review → Submit → Success screen shows profile
- [ ] "I NEED HELP" → CrisisDashboard loads
- [ ] Fill crisis form → Submit → Volunteer cards appear
- [ ] Click "MESSAGE THEM" → Polling state → Deployed/Declined state
- [ ] Analytics map loads → Volunteer pins visible → Filter works

---

## 5. Adding New Tests

### Unit Test for a New Agent

```python
# tests/test_new_agent.py
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.schemas import SharedIngestionState
from app.agents import new_agent

def test_new_agent_basic():
    state = SharedIngestionState()
    state.extracted_raw_text = "Test input"
    state = new_agent.run(state)
    assert state.new_field is not None
    assert len(state.pipeline_errors) == 0
    print("PASSED")

test_new_agent_basic()
```

### Adding a New Sample Input

1. Create the file in `tests/sample_inputs/`
2. Name it descriptively: `volunteer_<language>.txt` or `crisis_<scenario>.json`
3. The mock test automatically reads and displays all files in `sample_inputs/`

---

## 6. CI/CD Integration

The mock test is safe to run in any CI environment (no credentials needed):

```yaml
# .github/workflows/test.yml (example)
- name: Run mock pipeline test
  run: python tests/test_pipeline_mock.py
```

For full AI pipeline tests, use GitHub Actions secrets:
```yaml
- name: Run full pipeline test
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  run: python tests/test_full_pipeline.py
```

---

## 7. Planned Test Files

```
tests/
├── test_pipeline_mock.py          # Existing — DB + vector search
├── test_agents_unit.py            # Unit tests for each agent (mock Gemini)
├── test_api_integration.py        # FastAPI TestClient integration tests
├── test_cultural_audit.py         # XAI audit quality tests
├── test_matching_quality.py       # Matching relevance tests
└── sample_inputs/
    ├── volunteer_tamil.txt        # Tamil language test
    ├── volunteer_telugu.txt       # Telugu language test
    ├── volunteer_handwritten.jpg  # Handwritten form image
    ├── volunteer_form.pdf         # PDF form test
    └── crisis_medical.json        # Medical crisis scenario
```

---

*See `app/agents/designanddevelop.md` for agent-level testing details.*
