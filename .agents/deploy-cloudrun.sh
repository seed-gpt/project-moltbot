#!/bin/bash
# Configure all 4 MoltBot Cloud Run services with Cloud SQL connection
set -e

PROJECT_ID="magic-mirror-427812"
REGION="us-central1"
CLOUD_SQL_CONNECTION="magic-mirror-427812:us-central1:seedgpt-db"
DB_USER="moltbot"
DB_PASS="moltbot_prod_2026"
DB_NAME="moltbot"
IMAGE_BASE="us-central1-docker.pkg.dev/${PROJECT_ID}/moltbot"

# DATABASE_URL for Cloud SQL with Unix socket (Cloud Run auto-creates /cloudsql/ socket)
DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@localhost/${DB_NAME}?host=/cloudsql/${CLOUD_SQL_CONNECTION}"

SERVICES=("moltbank" "moltcredit" "moltmail" "moltphone")

for SVC in "${SERVICES[@]}"; do
  echo "=== Deploying ${SVC} ==="
  gcloud run deploy "${SVC}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --image="${IMAGE_BASE}/${SVC}:latest" \
    --set-env-vars="DATABASE_URL=${DATABASE_URL},NODE_ENV=production" \
    --add-cloudsql-instances="${CLOUD_SQL_CONNECTION}" \
    --min-instances=0 \
    --max-instances=3 \
    --allow-unauthenticated \
    --quiet
  echo "Done: ${SVC}"
done

echo "=== All services deployed ==="
