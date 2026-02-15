---
description: Production readiness review
---
# Review: Production

## Preconditions
- Read `PRD.yml`, `roadmap.yml`, `_contract.md`
- Identify environment (local/staging/production)
- Filesystem reflects `main`

## Review Areas

### Code Quality
- No mocks in production code
- No dead code
- Test coverage adequate
- No TODO/FIXME blockers

### Infrastructure
- Deployment status verified
- Health endpoints working
- Logging configured
- Monitoring active

### Database
- Migrations applied
- Indexes optimized
- Backups configured

### Security
- Secrets in Secret Manager (not in code)
- HTTPS enforced
- Auth working correctly

## Output
- Production readiness: ✅ Ready / ⚠️ Issues / ❌ Not Ready
- Record blockers in `.seedgpt/bugs/`
- Commit findings to `main`

See: `_contract.md`
