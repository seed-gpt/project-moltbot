# Bug: CORS Errors on API Calls from Webapp

## Severity: high

## Description
Fetch requests from the webapp to `https://api.moltphone.xyz/call` are blocked by CORS policy — the response is missing the `Access-Control-Allow-Origin` header.

## Reproduction Steps
1. Open the MoltPhone webapp
2. Sign in via Auth0
3. Fill in the call form and submit
4. Open browser console — observe CORS error

## Expected Behavior
API responses should include proper CORS headers allowing requests from `app.moltphone.xyz` and the Cloud Run webapp URLs.

## Actual Behavior
```
Access to fetch at 'https://api.moltphone.xyz/call' from origin '...' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header
```

## Notes
- This may have been addressed in a previous session (conversation 69517c7f) but appears to still be present
- The backend Express app needs CORS middleware configured with the allowed origins

## Resolution
- **Root cause**: CORS config in `app.ts` is already correct — includes `app.moltphone.xyz`, Cloud Run URLs, and localhost patterns.
- **Actual issue**: The CORS errors were a downstream symptom of `app.moltphone.xyz` being unreachable (SSL cert pending). Once the domain mapping SSL cert provisions, CORS will work correctly.
- **Status**: Resolved (contingent on domain cert auto-provisioning)
