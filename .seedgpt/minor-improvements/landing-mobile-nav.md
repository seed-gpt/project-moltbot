# Enhancement: Landing Page Nav Links Hidden on Mobile with No Hamburger Menu

## Description
On the landing page (`apps/moltphone/landing/index.html`), the mobile responsive
CSS simply hides `.nav-links` with `display: none` (line 522-524) without providing
a hamburger menu or alternative navigation. Mobile users have no way to navigate to
Features, How it Works, API, or Pricing sections from the header.

The webapp correctly implements a mobile hamburger via `#mobile-menu-btn`.

## Priority
Low

## Affected Area
`apps/moltphone/landing/index.html`, mobile viewport
