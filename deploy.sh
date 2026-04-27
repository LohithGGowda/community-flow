#!/bin/bash
# =============================================================================
# deploy.sh — CommunityFlow Cloud Run Deployment Script
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# What this does:
#   1. Enables required GCP APIs
#   2. Stores GEMINI_API_KEY in Secret Manager
#   3. Builds and pushes the Docker image to Artifact Registry
#   4. Deploys to Cloud Run
# =============================================================================

set -e  # Exit immediately on any error

# ---------------------------------------------------------------------------
# CONFIG — edit these before running
# ---------------------------------------------------------------------------
PROJECT_ID="community-flow-prototype"   # Your GCP project ID
REGION="us-central1"
SERVICE_NAME="communityflow-api"
IMAGE_NAME="communityflow-api"

# Read GEMINI_API_KEY from local .env (never hardcode it here)
if [ -f ".env" ]; then
  export $(grep -v '^#' .env | grep GEMINI_API_KEY | xargs)
fi

if [ -z "$GEMINI_API_KEY" ]; then
  echo "ERROR: GEMINI_API_KEY is not set in your .env file."
  echo "Add it and re-run: echo 'GEMINI_API_KEY=your_key' >> .env"
  exit 1
fi

ARTIFACT_REPO="communityflow"
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}/${IMAGE_NAME}:latest"

echo ""
echo "=============================================="
echo "  CommunityFlow — Deploying to Cloud Run"
echo "  Project : $PROJECT_ID"
echo "  Region  : $REGION"
echo "  Image   : $IMAGE_URI"
echo "=============================================="
echo ""

# ---------------------------------------------------------------------------
# STEP 1: Set active project
# ---------------------------------------------------------------------------
echo "[1/6] Setting GCP project..."
gcloud config set project "$PROJECT_ID"

# ---------------------------------------------------------------------------
# STEP 2: Enable required APIs
# ---------------------------------------------------------------------------
echo "[2/6] Enabling required GCP APIs (this takes ~1 min on first run)..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  aiplatform.googleapis.com \
  firestore.googleapis.com \
  --quiet

# ---------------------------------------------------------------------------
# STEP 3: Store API key in Secret Manager
# ---------------------------------------------------------------------------
echo "[3/6] Storing GEMINI_API_KEY in Secret Manager..."

# Create the secret if it doesn't exist yet
if ! gcloud secrets describe gemini-api-key --quiet 2>/dev/null; then
  gcloud secrets create gemini-api-key --replication-policy="automatic"
fi

# Add a new version with the current key value
echo -n "$GEMINI_API_KEY" | gcloud secrets versions add gemini-api-key --data-file=-
echo "    Secret stored."

# ---------------------------------------------------------------------------
# STEP 4: Create Artifact Registry repository (if not exists)
# ---------------------------------------------------------------------------
echo "[4/6] Setting up Artifact Registry..."

if ! gcloud artifacts repositories describe "$ARTIFACT_REPO" \
    --location="$REGION" --quiet 2>/dev/null; then
  gcloud artifacts repositories create "$ARTIFACT_REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="CommunityFlow Docker images"
fi

# Configure Docker to authenticate with Artifact Registry
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# ---------------------------------------------------------------------------
# STEP 5: Build and push Docker image
# ---------------------------------------------------------------------------
echo "[5/6] Building and pushing Docker image..."
docker build -t "$IMAGE_URI" .
docker push "$IMAGE_URI"
echo "    Image pushed: $IMAGE_URI"

# ---------------------------------------------------------------------------
# STEP 6: Deploy to Cloud Run
# ---------------------------------------------------------------------------
echo "[6/6] Deploying to Cloud Run..."

# Get the Cloud Run service account email to grant Secret Manager access
SA_EMAIL="${PROJECT_ID}@appspot.gserviceaccount.com"

# Grant the service account access to the secret
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet 2>/dev/null || true

gcloud run deploy "$SERVICE_NAME" \
  --image="$IMAGE_URI" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --set-secrets="GEMINI_API_KEY=gemini-api-key:latest" \
  --set-env-vars="DB_BACKEND=mock,VECTOR_BACKEND=local,GOOGLE_CLOUD_PROJECT=${PROJECT_ID}" \
  --quiet

# ---------------------------------------------------------------------------
# Done — print the service URL
# ---------------------------------------------------------------------------
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" \
  --format="value(status.url)")

echo ""
echo "=============================================="
echo "  Deployment complete!"
echo "  URL     : $SERVICE_URL"
echo "  Docs    : $SERVICE_URL/docs"
echo "  Health  : $SERVICE_URL/api/health"
echo "=============================================="
echo ""
