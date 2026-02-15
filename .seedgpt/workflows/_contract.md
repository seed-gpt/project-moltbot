---
description: Binding execution rules for all SeedGPT work
---
# Execution Contract

## Entry Criteria (work may start when ALL true)
1. Item exists in `.seedgpt/features/`, `.seedgpt/bugs/`, or `.seedgpt/minor-improvements/`
2. Referenced in `roadmap.yml` (with `prd_refs`) and `PRD.yml` (with acceptance criteria)
3. Sprint entry exists in `.seedgpt/sprints/sprint-vXX-*.yml`
   - Story includes `prd_refs` and `roadmap_refs` linking to parent items
4. Filesystem reflects current truth

## Execution Rules
- Follow `_tdd-loop.md` exactly
- Dev and test are separate responsibilities
- Tests validate PRD as black-box via official APIs
- Work on feature-scoped branches
- CI must be green at every merge

## Required Artifacts
- Production code + unit tests + black-box tests
- Feature branch merged to `main` with clean history
- Sprint YAML: story `status: complete`, `completed_date` set
- PRD + roadmap updated to reflect reality

## Exit Criteria (DONE when ALL true)
1. Code merged to `main`
2. All tests pass (local + CI)
3. Sprint YAML updated and committed
4. PRD and roadmap updated
5. Deployment completed (if applicable)

## Auto-Mode
- No user questions
- Resolve ambiguity pragmatically
- Log decisions via commits
- Effort: easy/medium/hard (no hours)

## Final Rule
**If not in git, tested, documented, and in sprint YAML → it does not exist.**
