## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.
## $(date +%Y-%m-%d) - Adding ARIA Labels to Icon-only Buttons
**Learning:** Found an accessibility issue where many icon-only buttons (`size="icon"` and `size="icon-xs"`) in `PlaygroundPage.tsx` were relying purely on `title` attributes for tooltips, but lacking a dedicated `aria-label` attribute, potentially hindering screen readers.
**Action:** Replicated the tooltip values from the `title` attributes directly into a newly added `aria-label` attribute for improved semantic accessibility across all instances.
