## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.
## 2026-09-27 - Add ARIA Labels to Icon-Only Buttons
**Learning:** Screen readers miss the context of icon-only buttons like those found in the playground sidebar without explicit aria-labels, even if a title attribute is present.
**Action:** Add aria-label attributes to <Button size="icon"> and <Button size="icon-xs"> elements to improve accessibility.
