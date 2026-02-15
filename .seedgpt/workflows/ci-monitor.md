---
description: Monitor CI and report failures
---
# CI Monitor
You want to monitor the CI and report failures using built in commands. 

## Steps
1. Check recent builds: `gh run list --limit 10`
2. For failed runs: `gh run view <id>`
3. If there are running build that you need to verify, wait for them using `gh watch`
4. Analyze failure cause
5. Report issues using `bug-report.md`

See: `bug-report.md`
