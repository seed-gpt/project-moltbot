---
description: Report and plan bug fixes
---
See: `bug-solve.md`, `_tdd-loop.md`
# Bug Report

## Steps
1. Add bug to `.seedgpt/bugs/` with:
   - Title, description, reproduction steps
   - Expected vs actual behavior
   - Severity (low/medium/high/critical)

2. Assess complexity:
   - **Small**: Fix directly, add test at each level (unit, integration, e2e)
   - **Big**: Create sprint entry using `_tdd-loop.md`

3. Ensure test coverage for the bug at ALL levels


