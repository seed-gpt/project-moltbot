---
description: Professional visual design review for mobile view
---
# Review: Visual Design (Mobile-First)

## Preconditions
- Read `PRD.yml`, `roadmap.yml`, `_contract.md`
- Start dev server (`npm run dev`)
- Set browser to mobile viewport (375x667 or 390x844)

## Review Process

### 1. Screenshot Capture
// turbo
- Navigate to each major page in mobile view
- Capture screenshots using browser tool
- Save to `.agents/visual-review/` with naming: `{page}-mobile-{date}.png`
- Document viewport size used

### 2. Color Assessment
- Primary/secondary color usage
- Contrast ratios (WCAG AA minimum)
- Color harmony and brand consistency
- Dark/light mode transitions (if applicable)
- Score: 1-10

### 3. Typography Review
- Font sizes on mobile (min 16px body)
- Line height and readability
- Heading hierarchy visual weight
- Font loading performance
- Score: 1-10

### 4. Layout & Spacing
- Touch target sizes (min 44x44px)
- Padding/margin consistency
- Content breathing room
- Responsive breakpoint behavior
- Score: 1-10

### 5. Visual Hierarchy
- Call-to-action prominence
- Information flow and scanability
- Important elements above the fold
- Visual balance and alignment
- Score: 1-10

### 6. UI Components
- Button styles and states
- Form input visibility
- Navigation usability
- Loading states and feedback
- Score: 1-10

### 7. Imagery & Media
- Image quality on mobile
- Aspect ratios and cropping
- Lazy loading behavior
- Hero/banner effectiveness
- Score: 1-10

## Improvement Actions
- Update colors directly in CSS/Tailwind config
- Adjust component styling as needed
- Document changes with before/after screenshots
- Test changes across multiple mobile viewports

## Output
- Visual design score (1-100)
- Screenshot gallery with annotations
- Top 5 visual priorities
- Quick wins (<1 day)
- Record issues in `.seedgpt/bugs/`, `.seedgpt/features/`, or `.seedgpt/minor-improvements/`
- Commit updates to `main`

See: `_contract.md`
