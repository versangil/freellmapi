## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.

## 2024-05-15 - Enforce Accessible Tooltips on Icon Buttons
**Learning:** Found multiple instances where native `title` attributes were used instead of the custom accessible `Tooltip` component for icon-only `<Button>`s. Native titles are slow to appear, unstyled, and their usage often coincides with a missing explicit `aria-label`, compromising the UX for keyboard and screen-reader users.
**Action:** Always wrap icon-only buttons in `<Tooltip text="...">` and ensure they have matching `aria-label="..."` properties instead of relying on native `title="..."` attributes.
