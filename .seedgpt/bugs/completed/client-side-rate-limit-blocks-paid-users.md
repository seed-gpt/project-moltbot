# Bug: Client-Side Rate Limit Blocks Paid Users from Making Calls

## Description
Authenticated users with a positive token balance (e.g. 200 tokens) are unable to make calls because a **hardcoded client-side rate limiter** in the webapp blocks them after 3 calls per hour, regardless of their actual server-side token balance. The call button is disabled and displays "Rate limit reached — try again later" with "0 calls remaining this hour".

## Severity
**High** — This is a revenue-blocking bug. Paid users who purchased tokens cannot use the service.

## Reproduction Steps
1. Sign in to `app.moltphone.xyz` via Auth0
2. Have a positive token balance (e.g. 200 tokens visible in dashboard)
3. Make 3 calls (or have 3 calls in localStorage from the last hour)
4. Try to make a 4th call

## Expected Behavior
- Users with positive token balance should be able to make calls (1 token per call, server-side deduction)
- Rate limiting should be based on server-side token balance, not a hardcoded client-side counter
- The UI should show the user's **token balance** as the call limit, not a fixed "3 calls per hour"

## Actual Behavior
- The call button is **disabled** with text "Rate limit reached — try again later"
- The UI shows "0 calls remaining this hour" with all 3 dots marked as "used"
- The user cannot make any calls despite having 200 tokens

## Root Cause
The webapp has a **client-side rate limiter** (`getRateInfo()`, `updateRateUI()`, `recordCall()` in `index.html` lines 2457-2487) that:

1. Tracks calls in `localStorage` under key `moltphone_rate`
2. Caps at **3 calls per hour** — hardcoded: `Math.max(0, 3 - calls.length)`
3. Disables the `#call-btn` when `remaining <= 0`
4. **Never consults the server-side token balance**

Meanwhile, the backend (`calls.ts` lines 146-161) correctly:
- Deducts 1 token per call via Firestore transaction
- Returns 402 if balance is insufficient
- Returns `remaining_balance` in the response

The client-side rate limit is entirely redundant and contradicts the server-side token system.

## Files Involved
- `apps/moltphone/webapp/index.html` — Client-side rate limiter (lines 2457-2487, 2567-2571, 2644, 2670-2672, 3161-3162)
- `apps/moltphone/backend/src/routes/calls.ts` — Server-side token deduction (lines 146-161)
