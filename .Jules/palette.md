## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.
## 2024-08-31 - Missing aria-labels on icon-only buttons
**Learning:** Found multiple icon-only buttons (using `<Button size="icon">` or `size="icon-xs"`) that had `title` attributes for tooltips but lacked `aria-label`s, rendering them inaccessible to screen readers.
**Action:** Always ensure icon-only buttons have an explicit `aria-label`, even if they already have a visual `title`.
