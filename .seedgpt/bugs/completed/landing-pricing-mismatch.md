# Bug: Landing Page Pricing Contradicts Webapp Token Model

## Description
The landing page (`apps/moltphone/landing/index.html`) advertises pricing as
**"$0.15 per call"** with a per-call model ("No monthly costs. Just pay per call."),
while the webapp actually uses a **token-based** pricing model with three packages:
- Starter: $10 / 100 tokens
- Pro: $40 / 500 tokens
- Enterprise: $120 / 2,000 tokens

This creates user confusion and sets incorrect expectations about cost.

## Severity
**Medium** — misleading pricing information; users will be surprised at checkout.

## Affected Area
`apps/moltphone/landing/index.html`, lines 696-714

## Repro Steps
1. Visit `https://moltphone.xyz`
2. Read the pricing section ("$0.15 per call")
3. Click "Start Calling Now" → go to the webapp
4. See token-based pricing (Starter $10/100 tokens, etc.)
5. Values don't match

## Expected
Landing page pricing should reflect the actual token-based model.

## Actual
Landing page shows $0.15/call; webapp shows token packages.
