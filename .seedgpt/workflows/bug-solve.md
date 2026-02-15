---
description: Solve bugs from the bugs folder
---
See: `_tdd-loop.md`, `bug-report.md`
# Bug Solve

## Quick Fix (small bugs)
1. Read bug from `.seedgpt/bugs/`
2. Reproduce locally
3. Locate root cause
4. Fix and add test (unit + integration + e2e)
5. Run test suite
6. Move to `.seedgpt/bugs/completed/{name}.md`
7. Commit and push

## Full TDD (big bugs)
1. Plan fix in sprint YAML
2. Write tests that reproduce bug (should fail initially)
3. Implement fix until tests pass
4. Document: root cause, fix description, tests added
5. Move to `completed/` folder
6. Commit and push

## Post-Resolution
- Update sprint plan if applicable
- Update roadmap if affected features
- Document patterns to prevent similar bugs
