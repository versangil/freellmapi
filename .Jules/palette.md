## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.
## 2023-10-24 - Accessibility for icon-only buttons
**Learning:** `title` attributes on buttons are not always reliably read by screen readers. `<Button size="icon">` and `<Button size="icon-xs">` components should include explicit `aria-label` attributes to ensure robust accessibility.
**Action:** Always add `aria-label` to icon-only buttons for consistent screen reader behavior.
