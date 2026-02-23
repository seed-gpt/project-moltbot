---
id: MI-VQ-004
title: "Clear History button appears floating — lacks visual containment"
area: webapp/history
status: open
found_by: visual-qa
date: 2026-02-24
---

# Clear History Button Appears Floating

## Description
The "Clear History" button in the History section is centered with `text-align:center`
but sits outside any card or container. When shown, it looks visually detached and
"floating" beneath the call list.

## Suggestion
Move the button inside the calls list container, or wrap it in a bordered card matching
the call items to give it visual containment. Alternatively, use a subtle text-button
style (like "clear all ×") at the top-right of the history section header.
