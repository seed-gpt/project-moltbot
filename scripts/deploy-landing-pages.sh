#!/bin/bash
set -e

OWNER="levi-law"
MONOREPO="/Users/roei/dev_workspace/project-moltbot"

# Get the gh auth token for HTTPS push
GH_TOKEN=$(gh auth token)

deploy_landing() {
  local REPO_NAME="$1"
  local SOURCE_DIR="$2"
  local DOMAIN="$3"

  echo "========================================="
  echo "Deploying: $REPO_NAME → $DOMAIN"
  echo "========================================="

  TEMP_DIR=$(mktemp -d)
  cp -r "$MONOREPO/$SOURCE_DIR/"* "$TEMP_DIR/" 2>/dev/null || true
  echo "$DOMAIN" > "$TEMP_DIR/CNAME"

  cd "$TEMP_DIR"
  git init -b main
  git add -A
  git commit -m "Deploy $DOMAIN landing page"

  # Use HTTPS with token for auth
  git remote add origin "https://x-access-token:${GH_TOKEN}@github.com/$OWNER/$REPO_NAME.git"
  git push -f origin main

  # Enable Pages
  echo "Enabling GitHub Pages..."
  gh api "repos/$OWNER/$REPO_NAME/pages" \
    -X POST \
    -H "Accept: application/vnd.github+json" \
    -f 'source[branch]=main' \
    -f 'source[path]=/' 2>/dev/null || echo "(Pages already configured)"

  sleep 2

  # Set custom domain
  echo "Setting custom domain to $DOMAIN..."
  gh api "repos/$OWNER/$REPO_NAME/pages" \
    -X PUT \
    -H "Accept: application/vnd.github+json" \
    -f "cname=$DOMAIN" \
    -f 'source[branch]=main' \
    -f 'source[path]=/' 2>/dev/null || echo "(Domain updated)"

  cd "$MONOREPO"
  rm -rf "$TEMP_DIR"
  echo "✅ $REPO_NAME deployed"
  echo ""
}

deploy_landing "moltbank-landing"   "apps/moltbank/landing"   "molt-bank.com"
deploy_landing "moltcredit-landing" "apps/moltcredit/landing" "moltcredit.xyz"
deploy_landing "moltmail-landing"   "apps/moltmail/landing"   "moltmail.xyz"
deploy_landing "moltphone-landing"  "apps/moltphone/landing"  "moltphone.xyz"
deploy_landing "moltbank-webapp"    "apps/moltbank/webapp"    "app.molt-bank.com"
deploy_landing "moltphone-webapp"   "apps/moltphone/webapp"   "app.moltphone.xyz"

echo ""
echo "All content pushed! Waiting 15s for Pages builds..."
sleep 15

# Enforce HTTPS
for REPO in moltbank-landing moltcredit-landing moltmail-landing moltphone-landing moltbank-webapp moltphone-webapp; do
  echo "Enforcing HTTPS on $OWNER/$REPO..."
  gh api "repos/$OWNER/$REPO/pages" \
    -X PUT \
    -H "Accept: application/vnd.github+json" \
    -F https_enforced=true 2>/dev/null || echo "(SSL not ready yet)"
done

echo ""
echo "✅ Done! SSL certs provision within ~15 minutes."
