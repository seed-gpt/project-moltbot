# Bug: Webapp Hero Stats Show "3 Free calls / hour" — No Free Tier Exists

## Description
The webapp hero section displays "3 Free calls / hour" as a stat (line 1937-1938),
and the "How It Works" section says "No signup needed" (line 2156). However:

1. The system is entirely **token-based** — there is no free tier
2. Users must sign in (Auth0 or API key) to make any call
3. The call button shows "🔒 Sign in to make calls" when not authenticated

Additionally the legacy "Rate Limit Reached" result message mentions
"You can make 3 free calls per hour" (line 2710) — also incorrect.

## Severity
**Medium** — misleading marketing copy that contradicts actual behavior.

## Affected Area
- `apps/moltphone/webapp/index.html`, lines 1936-1938 (hero stats)
- `apps/moltphone/webapp/index.html`, line 2156 (how it works)
- `apps/moltphone/webapp/index.html`, line 2710 (rate limit result)

## Expected
Remove references to free calls and "no signup needed". The hero stat should
reflect actual functionality (e.g., token balance or number of supported countries).

## Actual
Says "3 Free calls / hour" and "No signup needed" despite requiring auth + tokens.
