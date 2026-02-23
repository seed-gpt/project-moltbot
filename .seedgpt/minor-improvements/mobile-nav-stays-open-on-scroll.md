---
id: MI-VQ-001
title: "Mobile nav menu stays open when user scrolls"
area: webapp/navigation
status: open
found_by: visual-qa
date: 2026-02-24
---

# Mobile Nav Menu Stays Open on Scroll

## Description
When the hamburger menu is opened on mobile (≤768px), the nav dropdown stays visible
as the user scrolls down the page. It only closes when the user clicks a nav link or
the hamburger button again. This can obscure page content and feel disorienting.

## Suggestion
Auto-close the mobile nav when the user scrolls. Add:
```javascript
window.addEventListener('scroll', () => {
  document.getElementById('nav-links').classList.remove('open');
}, { passive: true });
```
