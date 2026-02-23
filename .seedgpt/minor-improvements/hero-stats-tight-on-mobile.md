---
id: MI-VQ-003
title: "Hero stats row is tight on narrow mobile screens"
area: webapp/hero
status: open
found_by: visual-qa
date: 2026-02-24
---

# Hero Stats Row Tight on Narrow Mobile Screens

## Description
The three statistics in the hero section ("3 Free calls / hour", "30s Average setup
time", "50+ Countries supported") are displayed in a flex row with `flex-wrap: wrap`
and `gap: 24px` on mobile. On 375px screens, the items fit but are visually tight.
The labels nearly touch each other.

## Suggestion
Consider stacking the stats vertically on very small screens (< 400px) or adding
slightly more gap between items:
```css
@media (max-width: 400px) {
  .hero-stats {
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
}
```
