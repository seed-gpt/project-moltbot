---
id: MI-VQ-002
title: "API code block is truncated on desktop — long lines cut off"
area: webapp/api-section
status: open
found_by: visual-qa
date: 2026-02-24
---

# API Code Block Truncation on Desktop

## Description
In the API Access section on desktop, the `<pre><code>` block clips long lines like the
`fetch()` URL, `first_message`, and `console.log` comment. The text is cut off at the
right edge without horizontal scrolling or wrapping visible.

The code block on mobile actually handles this better (it scrolls horizontally) due to
different overflow behavior in the responsive layout.

## Suggestion
Ensure the desktop code block also allows horizontal scrolling with `overflow-x: auto`:
```css
.code-block pre {
  overflow-x: auto;
}
```
