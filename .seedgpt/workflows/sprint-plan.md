---
description: Plan the first or next sprint
---
# Sprint Plan

## Steps
1. Read `_contract.md`, `_tdd-loop.md`, `roadmap.yml`, `PRD.yml`
2. Review current `.seedgpt/sprints/` state
3. Create sprint file: `.seedgpt/sprints/sprint-vXX-{slug}.yml`

## Sprint YAML Template
```yaml
sprint: vXX
name: [Sprint Name]
goal: |
  [Goal description]
status: planned
estimated_hours: N

stories:
  - id: SP-VXX-001
    title: [Story Title]
    description: |
      [Description]
    status: planned
    prd_refs: [PRD-001]           # Which PRD requirements this fulfills
    roadmap_refs: [RM-v1.0-001]   # Which roadmap item this belongs to
    acceptance_criteria:
      - [Criterion]
    tests:
      - [Test command]

dependencies:
  - sprint-vXX-previous
```

## Rules
- Each feature goes through `feature-cycle.md`
- Issues are 1-4 hours max
- Update roadmap.yml with new sprint reference

See: `_contract.md`, `feature-cycle.md`