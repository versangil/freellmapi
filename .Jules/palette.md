## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.

## 2024-07-26 - Hidden Screen Reader Elements on Mobile
**Learning:** Using `hidden sm:inline` to hide text visually on mobile screens without explicitly providing an `aria-label` makes the button completely inaccessible to screen readers on mobile devices since they have no accessible name.
**Action:** Always provide an explicit `aria-label` for buttons where the text content is conditionally hidden on certain screen sizes.
