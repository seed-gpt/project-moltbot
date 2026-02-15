---
description: Verify a completed sprint
---
# Sprint Verify

## Steps
1. Find sprint under `.seedgpt/sprints/sprint-vXX-*.yml`
2. For each story:
   - Verify code exists (backend + frontend)
   - Verify tests exist (unit, integration, e2e)
   - Run all tests
3. Record findings in `.seedgpt/bugs/` or `.seedgpt/minor-improvements/`

## Preconditions
- Identify target environment (local/staging/production)
- Read `PRD.yml`, `roadmap.yml`, sprint YAML, `_contract.md`
- Ensure filesystem reflects `main` branch

## Output
- Update sprint YAML with verification status
- Verify story `prd_refs` match actual implemented requirements
- Create bug/improvement files for any issues found

See: `_contract.md`, `qa-cycle.md`
