## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.

## 2023-10-02 - Icon Button ARIA Labels
**Learning:** Found multiple instances where `size="icon"` or `size="icon-xs"` buttons relied entirely on the `title` attribute for screen reader context. `title` attributes alone are not sufficient or reliably read by all screen readers.
**Action:** Created a script to ensure any icon button using the `title` attribute automatically receives a mirroring `aria-label` attribute if missing. Going forward, ensure all `<Button size="icon">` usages require an explicit `aria-label`.
