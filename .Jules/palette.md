## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.

## 2026-09-13 - ARIA labels for mobile-hidden text
**Learning:** Buttons using responsive classes like `hidden sm:inline` to hide text on mobile become inaccessible icon-only buttons for screen readers on small viewports.
**Action:** Always provide an explicit `aria-label` for buttons relying on responsive visibility classes for their text content.
