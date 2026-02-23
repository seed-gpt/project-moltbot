# Bug: Call Button Initially Shows "📞 Call Now — Free" Before Auth Init

## Description
The call button HTML (line 2111) renders with the text "📞 Call Now — Free" on
initial page load. Only after `initAuth0()` completes and `updateRateUI()` runs
does it update to the correct text ("🔒 Sign in to make calls" or "📞 Call Now — 1 Token").

This creates a brief moment where the button says "Free" even though no free
tier exists, and is technically clickable before auth state is resolved.

## Severity
**Low** — brief flash of incorrect state on page load.

## Affected Area
`apps/moltphone/webapp/index.html`, line 2111

## Expected
Initial button text should be a neutral state like "Loading..." or disabled
until auth state is resolved.

## Actual
Shows "📞 Call Now — Free" which matches neither the authenticated nor
unauthenticated state.
