# tests/sample_inputs/ — Sample Input Files Guide

> **Scope:** Test data for the CommunityFlow pipeline. These files cover the key input scenarios the system must handle.

---

## 1. File Inventory

| File | Language | Script | Tests |
|---|---|---|---|
| `volunteer_english.txt` | English | Latin | Baseline pipeline, schema extraction |
| `volunteer_hindi.txt` | Hindi | Devanagari | Translation, cultural audit |
| `volunteer_kannada.txt` | Kannada | Kannada script | Cultural term preservation ("Shramadana") |
| `crisis_request.json` | N/A | JSON | Matching engine, API contract |

---

## 2. File Details

### `volunteer_english.txt`

```
Name: Priya Sharma
Skills: Elderly care, cooking, first aid
Availability: Weekends and Monday evenings
Location: Koramangala, Bangalore
Contact: 9876543210
Languages: English, Kannada
Notes: Has 2 years experience volunteering at old age homes.
```

**Expected pipeline output:**
- `detected_language`: `en`
- `audit_status`: `passed` (score ≥ 0.85)
- `structured_profile.name`: `Priya Sharma`
- `structured_profile.skills`: `["elderly_care", "cooking", "first_aid"]`
- `structured_profile.location`: `Koramangala, Bangalore`

---

### `volunteer_hindi.txt`

```
नाम: अनिता वर्मा
कौशल: प्राथमिक चिकित्सा, बाढ़ राहत, रसद प्रबंधन
उपलब्धता: सप्ताहांत और आपातकाल में कभी भी
स्थान: इंदिरानगर, बेंगलुरु
संपर्क: 9900112233
भाषाएं: हिंदी, अंग्रेजी
नोट: एनएसएस स्वयंसेवक, 3 साल का अनुभव
```

**Expected pipeline output:**
- `detected_language`: `hi`
- `translated_working_copy`: English translation of the above
- `audit_status`: `passed` or `flagged` depending on translation quality
- `structured_profile.name`: `Anita Verma`
- `structured_profile.skills`: `["first_aid", "flood_relief", "logistics"]`
- `audit_metadata.xai_flags`: may include `idiom_detected` for "NSS volunteer"

---

### `volunteer_kannada.txt`

```
ಹೆಸರು: ರಾಜೇಶ್ ಕುಮಾರ್
ಕೌಶಲ್ಯಗಳು: ವೃದ್ಧರ ಆರೈಕೆ, ಶ್ರಮದಾನ, ಅಡುಗೆ
ಲಭ್ಯತೆ: ಭಾನುವಾರ ಮತ್ತು ರಜಾ ದಿನಗಳು
ಸ್ಥಳ: ಜಯನಗರ, ಬೆಂಗಳೂರು
ಸಂಪರ್ಕ: 9845012345
ಭಾಷೆಗಳು: ಕನ್ನಡ, ಹಿಂದಿ
```

**Expected pipeline output:**
- `detected_language`: `kn`
- `audit_metadata.xai_flags`: `["idiom_detected"]` — "ಶ್ರಮದಾನ" (Shramadana) is a cultural term
- `structured_profile.skills`: must contain `shramadana` (NOT "social work")
- `audit_metadata.cultural_adequacy_score`: ≥ 0.85 if translation preserves the term
- `audit_metadata.audit_notes`: should mention Shramadana preservation

**This is the canonical test for the XAI cultural audit.** If the pipeline returns "social work" instead of "shramadana", the cultural audit has failed its core purpose.

---

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

**Expected matching output:**
- Returns volunteers with `first_aid`, `logistics`, or `flood_relief` skills
- Anita Verma should be the top match (has all 3 skills)
- Match scores should be > 0.5 for relevant volunteers

---

## 3. Adding New Sample Inputs

### New Language Test

Create `volunteer_<language_code>.txt` following the same structure:
```
Name/नाम/ಹೆಸರು: [Name]
Skills/कौशल/ಕೌಶಲ್ಯ: [Skills]
Availability/उपलब्धता/ಲಭ್ಯತೆ: [When]
Location/स्थान/ಸ್ಥಳ: [Where]
Contact/संपर्क/ಸಂಪರ್ಕ: [Phone]
Languages/भाषाएं/ಭಾಷೆಗಳು: [Languages]
```

Priority languages to add:
- `volunteer_tamil.txt` — Tamil ( Tamil Nadu)
- `volunteer_telugu.txt` — Telugu (Andhra Pradesh, Telangana)
- `volunteer_bengali.txt` — Bengali (West Bengal)
- `volunteer_marathi.txt` — Marathi (Maharashtra)

### New Crisis Scenario

Create `crisis_<scenario>.json`:
```json
{
  "description": "Medical emergency at community center...",
  "required_skills": ["medical", "first_aid"],
  "location": "...",
  "volunteers_needed": 3,
  "urgency": "critical"
}
```

### Image/PDF Test Files

Add:
- `volunteer_handwritten.jpg` — Photo of a handwritten form (tests PerceptionAgent OCR)
- `volunteer_printed.pdf` — Scanned printed form (tests PDF extraction)
- `volunteer_id_card.jpg` — Photo of an ID card (tests structured document extraction)

---

## 4. Using Sample Inputs in Tests

```python
# In test files:
import os

SAMPLE_DIR = os.path.join(os.path.dirname(__file__), "sample_inputs")

def load_sample(filename):
    with open(os.path.join(SAMPLE_DIR, filename), "r", encoding="utf-8") as f:
        return f.read()

def load_json_sample(filename):
    import json
    with open(os.path.join(SAMPLE_DIR, filename), "r", encoding="utf-8") as f:
        return json.load(f)

# Usage:
english_text = load_sample("volunteer_english.txt")
crisis_payload = load_json_sample("crisis_request.json")
```

---

*See `tests/designanddevelop.md` for the full testing strategy.*
