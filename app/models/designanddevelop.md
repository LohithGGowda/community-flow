# app/models/ — Data Schema Design & Development Guide

> **Scope:** The Pydantic data models that form the A2A (Agent-to-Agent) contract. This is the single source of truth for all data structures in the system.

---

## 1. Why This File Is Critical

`schemas.py` is the "constitution" of the CommunityFlow pipeline. Every agent, every API endpoint, and every service reads from and writes to these models. If you change a field here, you must update:
- The agent that writes it
- The agent that reads it
- The API endpoint that returns it
- The frontend that consumes it

**Never bypass these models.** Don't pass raw dicts between agents — always use the Pydantic models.

---

## 2. Model Hierarchy

```
SharedIngestionState          ← The "patient chart" flowing through all 4 agents
├── extracted_raw_text        ← Written by PerceptionAgent
├── detected_language         ← Written by PerceptionAgent
├── translated_working_copy   ← Written by AuditorAgent
├── audit_metadata            ← Written by AuditorAgent
│   └── AuditMetadata
│       ├── cultural_adequacy_score
│       ├── xai_flags
│       ├── back_translation_delta
│       └── audit_status (XAIAuditStatus enum)
├── structured_profile        ← Written by SchemaAgent
│   └── VolunteerProfile
│       ├── name, skills, availability, location
│       ├── contact_info, languages, cultural_context
│       ├── geo_location (GeoLocation)
│       └── status (VolunteerStatus enum)
└── embedding_vector          ← Written by EmbeddingAgent

CrisisRequest                 ← Input to the matching engine
MatchResult                   ← Single match result
MatchResponse                 ← Full matching response

PipelineResponse              ← Returned by both ingest endpoints
TextUploadRequest             ← Input to POST /api/ingest/text
StatusUpdateRequest           ← Input to PATCH /api/volunteers/:id/status
```

---

## 3. Model Details

### `SharedIngestionState`

The central state object. Created fresh for each pipeline run. Each agent reads from it and writes its output back.

```python
class SharedIngestionState(BaseModel):
    request_id: str                          # UUID, auto-generated
    raw_input_type: InputType                # TEXT, PDF, IMAGE_*, EXCEL, UNKNOWN
    extracted_raw_text: Optional[str]        # Stage 1 output
    detected_language: Optional[str]         # Stage 1 output (ISO 639-1)
    translated_working_copy: Optional[str]   # Stage 2 output
    audit_metadata: Optional[AuditMetadata]  # Stage 2 output
    structured_profile: Optional[VolunteerProfile]  # Stage 3 output
    embedding_vector: Optional[List[float]]  # Stage 4 output (768 dims)
    vector_db_id: Optional[str]              # Set after DB persistence
    pipeline_errors: List[str]               # Errors from any stage
    is_complete: bool                        # True after full pipeline run
```

### `VolunteerProfile`

The final structured output stored in Firestore and vectorized.

```python
class VolunteerProfile(BaseModel):
    name: str                              # Full name
    skills: List[str]                      # e.g., ["first_aid", "shramadana"]
    availability: str                      # e.g., "weekends and Monday evenings"
    location: str                          # e.g., "Koramangala, Bangalore"
    geo_location: Optional[GeoLocation]    # lat/lng (not yet populated by pipeline)
    contact_info: str                      # Phone or email
    languages: List[str]                   # e.g., ["English", "Kannada"]
    cultural_context: Optional[str]        # Cultural notes from audit
    status: VolunteerStatus                # available / busy / inactive
```

**Note:** `geo_location` is defined in the schema but not yet populated by the pipeline. The SchemaAgent would need to call a geocoding API to fill this. Currently `None` for all volunteers.

### `AuditMetadata`

XAI explainability metadata attached to every processed record.

```python
class AuditMetadata(BaseModel):
    source_language: str                   # ISO 639-1 code
    cultural_adequacy_score: float         # 0.0–1.0 (G-Eval score)
    xai_flags: List[str]                   # Flags from the audit
    back_translation_delta: float          # 0.0–1.0 (lower = better)
    audit_status: XAIAuditStatus           # passed / flagged / failed / pending
    audit_notes: Optional[str]             # Human-readable explanation
```

### `CrisisRequest`

Input to the matching engine.

```python
class CrisisRequest(BaseModel):
    description: str                       # Free-text crisis description
    required_skills: List[str]             # Skills needed
    location: str                          # Crisis location
    volunteers_needed: int                 # How many volunteers (min 1)
    urgency: str                           # low / normal / high / critical
```

### `GeoLocation`

```python
class GeoLocation(BaseModel):
    lat: float
    lng: float
    address: Optional[str]                 # Human-readable address
```

---

## 4. Enums

### `InputType`
```python
TEXT, IMAGE_HANDWRITTEN, IMAGE_PRINTED, PDF, EXCEL, UNKNOWN
```

### `XAIAuditStatus`
```python
PASSED = "passed"    # Score ≥ 0.85
FLAGGED = "flagged"  # Score < 0.85 (needs human review)
FAILED = "failed"    # Exception during audit
PENDING = "pending"  # Not yet audited
```

### `VolunteerStatus`
```python
AVAILABLE = "available"  # Ready to be deployed
BUSY = "busy"            # Currently deployed
INACTIVE = "inactive"    # Not accepting deployments
```

---

## 5. Adding a New Field

**Example: Adding `age_group` to `VolunteerProfile`**

1. Add to `VolunteerProfile`:
   ```python
   age_group: Optional[str] = Field(None, description="Age group: youth/adult/senior")
   ```

2. Update `SchemaAgent` prompt to extract it:
   ```
   "age_group": "youth/adult/senior or null if not mentioned"
   ```

3. Update `EmbeddingAgent` to include it in embed text:
   ```python
   if profile.age_group:
       parts.append(f"Age group: {profile.age_group}")
   ```

4. Update frontend to display it in the success screen.

---

## 6. Adding a New Model

**Example: Adding `CrisisRecord` for tracking active crises**

```python
class CrisisRecord(BaseModel):
    crisis_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    description: str
    location: str
    required_skills: List[str]
    urgency: str
    status: str = "active"  # active / resolved / cancelled
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    assigned_volunteers: List[str] = Field(default_factory=list)
    resolved_at: Optional[str] = None
```

Then add a `POST /api/crisis` endpoint and a `crisis` Firestore collection.

---

## 7. Schema Versioning

Currently there is no schema versioning. For production, consider:
- Adding a `schema_version: str = "1.0"` field to `VolunteerProfile`
- Storing the version in Firestore so old records can be migrated
- Using Pydantic's `model_validator` for backward-compatible migrations

---

## 8. Planned Schema Additions

```python
# Volunteer reputation
class VolunteerReputation(BaseModel):
    total_deployments: int = 0
    successful_deployments: int = 0
    reliability_score: float = 1.0  # 0.0–1.0
    last_deployed: Optional[str] = None

# Add to VolunteerProfile:
reputation: Optional[VolunteerReputation] = None
age_group: Optional[str] = None  # youth / adult / senior
verified: bool = False           # ID verification status
photo_url: Optional[str] = None  # Profile photo URL

# Crisis tracking
class CrisisRecord(BaseModel):
    crisis_id: str
    description: str
    location: str
    geo_location: Optional[GeoLocation]
    required_skills: List[str]
    urgency: str
    status: str = "active"
    assigned_volunteers: List[str] = []
    created_at: str
    resolved_at: Optional[str] = None

# Analytics
class AnalyticsSummary(BaseModel):
    total_volunteers: int
    available_volunteers: int
    deployed_volunteers: int
    total_crises: int
    active_crises: int
    top_skills: List[Dict[str, int]]
    coverage_by_area: Dict[str, int]
```

---

*See `app/agents/designanddevelop.md` for how each agent uses these models.*
