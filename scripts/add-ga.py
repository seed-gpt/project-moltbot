#!/usr/bin/env python3
"""Add GA4 gtag snippet to all MoltBot HTML files."""
import os

GA_ID = "G-HP6XZJLHP5"
GA_SNIPPET = f"""<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id={GA_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){{dataLayer.push(arguments);}}
  gtag('js', new Date());
  gtag('config', '{GA_ID}');
</script>"""

ROOT = "/Users/roei/dev_workspace/project-moltbot"
FILES = [
    "docs/index.html",
    "apps/moltbank/landing/index.html",
    "apps/moltbank/webapp/index.html",
    "apps/moltcredit/landing/index.html",
    "apps/moltmail/landing/index.html",
    "apps/moltphone/landing/index.html",
    "apps/moltphone/webapp/index.html",
]

for f in FILES:
    path = os.path.join(ROOT, f)
    if not os.path.exists(path):
        print(f"⚠️  {f} — not found")
        continue
    with open(path, 'r') as fh:
        content = fh.read()
    if GA_ID in content:
        print(f"⏭️  {f} — already has gtag")
        continue
    # Insert after <head> (or <head ...>)
    idx = content.find('<head>')
    if idx == -1:
        idx = content.find('<head ')
    if idx == -1:
        print(f"⚠️  {f} — no <head> tag found")
        continue
    # Find end of <head...> tag
    end = content.find('>', idx)
    insert_pos = end + 1
    new_content = content[:insert_pos] + '\n' + GA_SNIPPET + '\n' + content[insert_pos:]
    with open(path, 'w') as fh:
        fh.write(new_content)
    print(f"✅ {f} — gtag added")

print(f"\nDone! All files updated with {GA_ID}")
