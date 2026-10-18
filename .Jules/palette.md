## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.
## 2024-10-17 - Improve Tooltips on Icon-Only Buttons
**Learning:** Native `title` attributes on icon-only buttons (`<Button size="icon">` or `<Button size="icon-xs">`) provide delayed and visually inconsistent feedback across browsers, reducing clarity for frequent actions. Furthermore, they are sometimes used as a substitute for actual `aria-label`s.
**Action:** When adding or modifying icon-only buttons, wrap them in the application's custom portal-based `<Tooltip text="...">` component (found at `client/src/components/tooltip.tsx`) for immediate and consistent visual feedback. Additionally, always explicitly set the `aria-label` on the `<Button>` to ensure robust screen reader accessibility.
