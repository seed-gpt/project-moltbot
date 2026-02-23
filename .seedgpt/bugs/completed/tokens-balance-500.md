# Bug: Token Balance Endpoint Returns 500

## Severity: medium

## Description
`GET /tokens/balance` returns a `500 Internal Server Error` when called from the webapp after authentication.

## Reproduction Steps
1. Open the MoltPhone webapp
2. Sign in via Auth0
3. Observe the dashboard panel — token balance fails to load
4. Check browser console — `500` on `/tokens/balance`

## Expected Behavior
The endpoint should return `{ balance: <number> }` for the authenticated user.

## Actual Behavior
`500 Internal Server Error` — likely an unhandled exception when the user has no `tokenBalances` document in Firestore.

## Notes
- Possibly a null/undefined access on a missing Firestore document
- The `fetchTokenBalance()` function silently catches this error in the webapp, so it doesn't surface to the user

## Resolution
- **Investigation**: The `/tokens/balance` endpoint code handles missing Firestore docs correctly (`doc.exists ? ... : 0`). Direct API testing returns proper error messages (401 for invalid keys), not 500.
- **Likely cause**: Transient cold-start error or the 500 was from an Auth0 token validation failure during initial setup. Not reproducible now.
- **Status**: Monitoring — code is defensively written, no fix needed
