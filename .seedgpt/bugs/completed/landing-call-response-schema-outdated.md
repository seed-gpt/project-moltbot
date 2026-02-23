# Bug: Landing Page "Get Call History" Response Example is Outdated

## Description
The landing page shows a response example for `GET /calls` that includes fields
`duration: "2:34"`, `cost: 0.15`, and `totalCost: 0.15` — none of which exist in
the actual API response. The real response returns Firestore document fields like
`toNumber`, `status`, `mode`, `createdAt`, `twilioCallSid`, etc.

## Severity
**Medium** — developer documentation shows wrong response shape.

## Affected Area
`apps/moltphone/landing/index.html`, lines 670-691

## Repro Steps
1. Visit `https://moltphone.xyz`
2. Scroll to "Get call history" code block
3. Compare with actual `GET /calls` response from the API

## Expected
Response example should match the real Firestore-based response schema.

## Actual
Shows legacy fields (`duration: "2:34"`, `cost`, `totalCost`) that don't exist.
