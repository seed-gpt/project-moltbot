# Bug: app.moltphone.xyz Unreachable

## Severity: critical

## Description
The primary webapp URL `https://app.moltphone.xyz` returns `ERR_CONNECTION_CLOSED`. The webapp is only accessible via the raw Cloud Run URLs (e.g. `moltphone-webapp-oy7ayfiglq-uc.a.run.app`).

## Reproduction Steps
1. Open a browser
2. Navigate to `https://app.moltphone.xyz`
3. Observe connection error

## Expected Behavior
The page should load the MoltPhone webapp.

## Actual Behavior
`ERR_CONNECTION_CLOSED` — the domain appears to have a DNS or SSL/proxy misconfiguration.

## Notes
- The Cloud Run service itself is running and accessible via its `.run.app` URL
- This is likely a DNS CNAME / Cloudflare proxy / SSL certificate issue
- The CNAME file in the webapp directory contains `app.moltphone.xyz`

## Resolution
- **Root cause**: SSL certificate provisioning pending on Cloud Run domain mapping (created 2026-02-23T21:06:12Z)
- **DNS is correct**: CNAME points to `ghs.googlehosted.com.` as required
- **Fix**: No code changes needed. The managed SSL cert needs time to provision. Google retries automatically.
- **Status**: Will auto-resolve once cert is issued (typically 15-60 min, can take up to 24h)
