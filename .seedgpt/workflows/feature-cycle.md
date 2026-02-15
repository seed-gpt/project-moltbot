---
description: End-to-end feature delivery cycle
---
# Feature Cycle

A feature is DONE when: buildable, sellable, discoverable, measurable, delivered, documented.

## Phases

### 1. Market & Positioning
- Identify target persona and problem solved
- Define value proposition and feature name
- Write: headline, description (≤3 sentences), primary CTA
- Output to: PRD (marketing section)

### 2. Sales Enablement
- Define when feature is pitched (before/during/after sale)
- Identify objections it removes
- Write: sales pitch paragraph, objection responses
- Output to: PRD (sales section)

### 3. Product Definition
- Define scope (in/out), user flows, acceptance criteria
- Define edge cases and success metrics
- Output to: PRD (functional requirements)

### 4. Engineering (TDD)
- Create `feature-name/dev` and `feature-name/test` branches
- Tester: black-box tests via public APIs
- Developer: implementation + unit tests
- Follow `_tdd-loop.md`

### 5. Deployment
- Deploy to target environment
- Run post-deploy validation
- Verify metrics and feature flags

### 6. Go-To-Market
- Create release notes
- Update user-facing docs
- Verify CTA is reachable

### 7. Closure
- Update sprint YAML (mark complete, set `completed_date`)
- Update PRD.yml traceability section
- Update roadmap.yml item status
- Ensure feature story has `prd_refs` and `roadmap_refs`
- Move feature file to `.seedgpt/features/completed/`
- Commit all to `main`

### 8. Feedback Loop
- Capture client feedback and usage signals
- Create new features/bugs/improvements as needed

See: `_contract.md`, `_tdd-loop.md`
