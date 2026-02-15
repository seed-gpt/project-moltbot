---
description: Solve a single item (story/task) from an active sprint
---
# Sprint Item Solve

Focused workflow for completing a single item within an active sprint.

## Input
- **Item ID**: The sprint item ID (e.g., `SP-001-003`)
- OR **Item Index**: Numeric index within the sprint (1-based)

## Steps

### 1. Load Context
- Read current sprint YAML from `.seedgpt/sprints/`
- Locate the specific item by ID or index
- Load `PRD.yml` and `roadmap.yml` for traceability refs
- Verify item has `prd_refs` and `roadmap_refs` set

### 2. Pre-Flight Checks
- Ensure sprint `status: in_progress`
- Mark item `status: in_progress`
- Commit status change before starting work

### 3. Understand Requirements
- Read item acceptance criteria
- Identify affected files and components
- Check for dependencies on other items

### 4. Execute (TDD)
- Create feature branch: `{sprint-id}/{item-id}`
- Write tests that validate acceptance criteria (should fail)
- Implement until tests pass
- Run full test suite

### 5. Complete Item
```yaml
status: complete
completed_date: "YYYY-MM-DD"
```

### 6. Post-Completion
- Merge to sprint branch or `main`
- Update sprint progress percentage
- Commit and push

## Item YAML Structure
```yaml
- id: SP-001-003
  title: "Implement user login"
  status: complete          # planned | in_progress | complete
  completed_date: "2026-01-24"
  prd_refs: [PRD-005]
  roadmap_refs: [RM-v1.0-002]
```

See: `sprint-solve.md`, `_tdd-loop.md`, `_contract.md`
