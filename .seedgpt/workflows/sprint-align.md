---
description: Align sprints with roadmap and communications
---
# Sprint Align

## Steps
1. Read `roadmap.yml`, `PRD.yml`, `_contract.md`
2. Read client communications in `docs/client-communication/`
3. Read all sprints in `.seedgpt/sprints/`
4. For each sprint:
   - Ensure stories/tasks are well-written
   - Verify dependencies and acceptance criteria
   - Check actual implementation status
   - Update `status` to reflect reality
5. Update `roadmap.yml` and `PRD.yml` with actual status

## Validation Checklist
- [ ] All client requests reflected in sprints
- [ ] Stories have clear acceptance criteria
- [ ] Stories include `prd_refs` and `roadmap_refs` for traceability
- [ ] Dependencies are accurate
- [ ] Code exists for "complete" items
- [ ] Tests exist for "complete" items

See: `_contract.md`, `comms-intake.md`
