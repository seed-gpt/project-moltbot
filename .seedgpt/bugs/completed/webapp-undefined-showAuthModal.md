# Bug: Undefined `showAuthModal` Function Reference in Webapp Header

## Description
The initial header render (line 1920) contains an `onclick="showAuthModal()"` handler,
but no `showAuthModal` function is ever defined in the script. The `updateAuthUI()`
function later replaces this with the correct `auth0Login()` and `showApiKeyLogin()`
buttons, so this is a brief flash-of-broken-state issue.

If Auth0 fails to initialize (e.g., network timeout, see line 3120), the fallback
buttons never render and clicking "Sign Up" throws a console error.

## Severity
**Low** — only visible during initial load or if Auth0 init fails.

## Affected Area
`apps/moltphone/webapp/index.html`, line 1920

## Repro Steps
1. Open `https://app.moltphone.xyz` with Auth0 CDN blocked
2. Click the "Sign Up" button in the header
3. Observe `ReferenceError: showAuthModal is not defined` in console

## Expected
Either define `showAuthModal()` or use `auth0Login()` in the initial HTML.

## Actual
`showAuthModal()` is referenced but never defined.
