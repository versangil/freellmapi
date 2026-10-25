## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.
## 2026-10-25 - Enhance Icon Buttons with Tooltip and Aria-label
**Learning:** Found multiple instances where small icon-only buttons relied on native `title` attributes for tooltips, which are visually inconsistent and not immediately visible, hindering both UX and accessibility.
**Action:** Replace native `title` attributes on icon-only `<Button>` components with the custom `<Tooltip text="...">` component and an explicit `aria-label="..."` attribute to ensure accessible, consistent, and fast visual feedback.
