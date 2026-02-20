#!/bin/bash
set -e

PROJECT_ID="seedgpt-planter"
REGION="us-central1"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/moltbot"
TAG="$(date +%Y%m%d-%H%M%S)"

echo "=== Configuring Docker for Artifact Registry ==="
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet

SERVICES=("moltbank" "moltcredit" "moltmail" "moltphone")

for SVC in "${SERVICES[@]}"; do
  IMAGE="${REGISTRY}/${SVC}"
  echo ""
  echo "=== Building ${SVC} (linux/amd64) ==="
  docker build --platform linux/amd64 -f apps/${SVC}/backend/Dockerfile -t ${IMAGE}:${TAG} -t ${IMAGE}:latest .

  echo "=== Pushing ${SVC} ==="
  docker push ${IMAGE}:${TAG}
  docker push ${IMAGE}:latest

  echo "=== Deploying ${SVC} to Cloud Run ==="
  gcloud run deploy ${SVC} \
    --project=${PROJECT_ID} \
    --region=${REGION} \
    --image=${IMAGE}:${TAG} \
    --port=3000 \
    --min-instances=0 \
    --max-instances=3 \
    --allow-unauthenticated \
    --quiet

  echo "=== ${SVC} deployed successfully ==="
done

echo ""
echo "=== All services deployed! ==="
