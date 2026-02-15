---
description: Full QA cycle for the application
---
# QA Cycle

## Preconditions
- Identify environment (local/staging/production)
- Read `PRD.yml`, `roadmap.yml`, sprint YAML, `_contract.md`
- Filesystem reflects `main`

## Phases

### 1. Automated Tests
- Backend: unit, integration, API contract tests
- Frontend: unit, component, e2e tests, lint, build
- Capture: failures, warnings, flaky tests, coverage gaps

### 2. Environment Validation
- Verify services healthy, APIs respond, frontend loads
- Validate env vars, feature flags, integrations

### 3. Black-Box QA
- Test via public APIs and UI only
- Execute core flows, edge cases, error scenarios
- Validate against PRD acceptance criteria

### 4. Exploratory QA
- Navigate app as user would
- Test happy paths, invalid inputs, unexpected sequences
- Note: UX friction, missing feedback, inconsistencies

### 5. Issue Recording
Classify and save to:
- `.seedgpt/bugs/` — Bug
- `.seedgpt/features/` — Missing feature
- `.seedgpt/minor-improvements/` — Enhancement

Include: title, description, repro steps, severity, affected area

### 6. Plan Updates
- Update roadmap.yml, PRD.yml, sprint YAML
- Ensure PRD traceability matrix is current
- Verify all issues have correct `prd_refs` and `roadmap_refs`
- Commit to `main`

### 7. Summary
- Pass/fail status
- Blocking vs non-blocking issues
- Recommendation: ready / ready with known issues / not ready

See: `_contract.md`
