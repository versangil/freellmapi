## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.

## 2026-09-03 - Responsive Text and Accessible Names
**Learning:** When using responsive utility classes like `hidden sm:inline` to visually hide text on mobile devices, screen readers lose the accessible name of the element (e.g., a button with just an icon on mobile) because the text node is effectively removed from the accessibility tree by `display: none`.
**Action:** Always provide an explicit `aria-label` on interactive elements that rely on responsive classes to visually hide their primary text content.
