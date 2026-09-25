## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.
## 2025-02-12 - Aria Labels on Playground Buttons
**Learning:** `PlaygroundPage.tsx` contained multiple icon-only buttons using `size="icon"` or `size="icon-xs"` with missing `aria-label` tags, despite having `title` attributes.
**Action:** Always ensure that when modifying or adding icon buttons with `title` attributes that the `aria-label` matches the title.
