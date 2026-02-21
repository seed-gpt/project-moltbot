#!/bin/bash
set -e

# GA4 Measurement ID
GA_ID="G-HP6XZJLHP5"

GA_SNIPPET='<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id='"$GA_ID"'"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('\''js'\'', new Date());\n  gtag('\''config'\'', '\'''"$GA_ID"'\'');\n</script>'

FILES=(
  "docs/index.html"
  "apps/moltbank/landing/index.html"
  "apps/moltbank/webapp/index.html"
  "apps/moltcredit/landing/index.html"
  "apps/moltmail/landing/index.html"
  "apps/moltphone/landing/index.html"
  "apps/moltphone/webapp/index.html"
)

cd /Users/roei/dev_workspace/project-moltbot

for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    if grep -q "gtag" "$f"; then
      echo "⏭️  $f — already has gtag"
    else
      # Insert GA snippet right after <head> tag
      sed -i '' "s|<head>|<head>\\
<!-- Google tag (gtag.js) -->\\
<script async src=\"https://www.googletagmanager.com/gtag/js?id=${GA_ID}\"></script>\\
<script>\\
  window.dataLayer = window.dataLayer || [];\\
  function gtag(){dataLayer.push(arguments);}\\
  gtag('js', new Date());\\
  gtag('config', '${GA_ID}');\\
</script>|" "$f"
      echo "✅ $f — gtag added"
    fi
  else
    echo "⚠️  $f — file not found"
  fi
done

echo ""
echo "Done! Verify with: grep -l 'G-HP6XZJLHP5' docs/index.html apps/*/landing/index.html apps/*/webapp/index.html"
