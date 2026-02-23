---
id: BUG-VQ-001
title: "Enterprise pricing button has no green fill — inconsistent with Starter/Pro"
severity: low
area: webapp/pricing
status: open
found_by: visual-qa
date: 2026-02-24
---

# Enterprise Pricing Button Missing Primary Style

## Description
The "Buy Enterprise" button in the Pricing section uses the base `.pricing-btn` class but
is **missing the `.primary` class** that both "Buy Starter" and "Buy Pro" have.
This results in the Enterprise button appearing as a plain outline/ghost button instead
of the green filled CTA, creating a visual inconsistency in the pricing grid.

## Expected
All three Buy buttons should use the same green filled style (`.pricing-btn.primary`).

## Actual
- **Buy Starter**: green fill ✅
- **Buy Pro**: green fill ✅
- **Buy Enterprise**: ghost/outline ❌

## Root Cause
Line 2221 of `index.html`:
```html
<!-- Missing .primary class -->
<button class="pricing-btn" onclick="openPurchaseModal('enterprise')">Buy Enterprise</button>
```

## Fix
Add `primary` class:
```html
<button class="pricing-btn primary" onclick="openPurchaseModal('enterprise')">Buy Enterprise</button>
```
