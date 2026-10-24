## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.
## 2024-10-24 - Custom Tooltip Component Learnings
**Learning:** Native HTML `title` attributes on icon-only buttons are notoriously slow, difficult for screen readers to handle predictably, and are not keyboard accessible. A custom React `<Tooltip>` component provides a consistently fast, styled, and accessible experience when used in combination with an explicit `aria-label` on the underlying button.
**Action:** When finding native `title="..."` attributes on icon-only buttons (`<Button size="icon">` or `<Button size="icon-xs">`), migrate them to use the local `<Tooltip text="...">` component while ensuring the `<Button>` keeps an explicit `aria-label` for screen reader accessibility.
