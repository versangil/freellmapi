## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.
## 2024-10-08 - Adding `aria-label`s to visually hidden text buttons on mobile
**Learning:** Using classes like `hidden sm:inline` visually hides button text on smaller screens. However, without an `aria-label`, the button loses its accessible name for screen reader users on mobile devices, resulting in an unlabeled button.
**Action:** When using utility classes to visually hide text depending on viewport sizes, ensure an explicit `aria-label` is defined on the interactive element to provide context to screen readers across all viewports.
