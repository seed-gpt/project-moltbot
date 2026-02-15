---
description: Execute the next planned sprint
---
# Sprint Solve

## Steps
1. Grep sprints folder for `status: planned` or `status: in_progress`
2. Select lowest numbered sprint not completed
3. Mark sprint `status: in_progress` and commit
4. Read sprint stories and acceptance criteria
5. Execute each story using `_tdd-loop.md`
6. Run all tests until green
7. Update sprint YAML with completion status
8. Commit and push

## Pre-flight
- Read `roadmap.yml`, `PRD.yml`, `tech-stack.yml`
- Verify sprint story `prd_refs` and `roadmap_refs` are set
- Check previous sprint for context
- Commit all existing changes before starting

## Completion
```yaml
status: complete
completed_date: "YYYY-MM-DD"
progress: 100
```

See: `_contract.md`, `_tdd-loop.md`