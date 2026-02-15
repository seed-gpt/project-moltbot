---
description: Core TDD development loop for all features
---
See: `_contract.md`
# TDD Loop

## Cycle (repeat for each feature/sprint)
1. **Status Recap** — Check git, communications, roadmap, PRD. Commit if needed.
2. **Planning** — Plan sprint. Effort x2: tester + dev parallel tracks.
3. **Implementation**
   - Tester: black-box tests validating PRD via official APIs
   - Dev: feature code + unit tests
   - Work on `feature-name/dev` and `feature-name/test` branches
4. **Integration** — Merge both into `feature-name` branch, debug until green
5. **Merge** — Merge to `main`, run full test cycle, fix until green
6. **Deploy** — Push, test post-deployment
7. **Review** — Present results, gather feedback
8. **Update** — Update docs, roadmap, PRD, sprint YAML
9. **Commit** — Ensure all pushed

## Sprint YAML Updates
After each sprint completion:
```yaml
status: complete
completed_date: "YYYY-MM-DD"
progress: 100
```
Mark each story with `status: complete` and `completed_date`.

## Rules
- Auto-mode: no questions, decide autonomously
- Tests: well-structured, cover edge cases, smart hierarchy
- No time constraints: if problems found, create sprint(s) for them
- Always update roadmap/PRD at end of each operation

