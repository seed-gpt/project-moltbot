---
description: Visual QA via browser exploration
---
# QA Visual

Browse the application as a user and report visual/UX issues.

## Preconditions
- Identify environment (local/staging/production)
- Read `PRD.yml`, `roadmap.yml`, sprint YAML
- Filesystem reflects `main`

## Steps
1. Open app in browser
2. Navigate through all pages and flows
3. Check for:
   - Layout issues
   - Broken images/links
   - Color/contrast problems
   - Responsiveness issues
   - Missing content
   - Inconsistent styling
4. Record issues in `.seedgpt/bugs/` or `.seedgpt/minor-improvements/`
5. Take screenshots as evidence

See: `qa-cycle.md`
