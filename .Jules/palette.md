## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.
## 2025-02-18 - Replacing Native Tooltips on Icon Buttons
**Learning:** Native `title` attributes on `size="icon"` buttons appear too slowly and inconsistently, causing a poor UX. Replacing them with custom React portal `Tooltip` wrappers creates a snappier, more professional interface, but we must ensure we explicitly pass `aria-label` to the `Button` to retain screen reader context that was previously inferred from `title`.
**Action:** When adding or upgrading icon-only buttons (`<Button size="icon">`), wrap them in a custom `<Tooltip text="...">` component and supply a matching `aria-label` on the inner button.
