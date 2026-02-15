#!/bin/bash
# Build and push all MoltBot service images locally
set -e

PROJECT_ID="magic-mirror-427812"
REGION="us-central1"
IMAGE_BASE="${REGION}-docker.pkg.dev/${PROJECT_ID}/moltbot"

cd /Users/roei/dev_workspace/project-moltbolt

SERVICES=("moltbank" "moltcredit" "moltmail" "moltphone")

for SVC in "${SERVICES[@]}"; do
  echo "=== Building ${SVC} ==="
  docker build -f services/${SVC}/Dockerfile -t ${IMAGE_BASE}/${SVC}:latest .
  echo "=== Pushing ${SVC} ==="
  docker push ${IMAGE_BASE}/${SVC}:latest
  echo "Done: ${SVC}"
  echo ""
done

echo "=== All images built and pushed ==="
