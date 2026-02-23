# Bug: Mobile Header Nav Overlap

## Severity: low

## Description
On narrow viewports (≤375px), the header navigation links and authentication buttons overlap and stack poorly, making the header difficult to use.

## Reproduction Steps
1. Open the MoltPhone webapp
2. Resize browser window to 375px width (or use mobile device)
3. Observe the header area — elements overlap

## Expected Behavior
The mobile hamburger menu should activate, hiding nav links behind a toggle. Auth buttons should be accessible.

## Actual Behavior
Nav links and auth buttons stack and overlap, creating a cluttered, unusable header.

## Notes
- The mobile menu button exists but the CSS breakpoint may not be covering all auth states
- The auth area buttons may need additional mobile-specific styling

## Resolution
- **Fix**: Added `display: none` for `.auth-area` at `@media (max-width: 768px)` in `index.html`
- Auth controls are accessible through the hamburger menu and dashboard panel on mobile
- Also tightened header `.container` gap to 8px for mobile viewports
