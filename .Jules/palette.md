## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.
## 2024-10-26 - Better tooltips for icon-only buttons
**Learning:** Native `title` attributes are slow to display and inconsistently styled across browsers, which degrades the UX of heavily icon-driven interfaces like the Playground.
**Action:** Always replace native `title` attributes on icon-only buttons with the custom `Tooltip` component (wrapping the button) and add an explicit `aria-label` to the button itself for screen reader users.
