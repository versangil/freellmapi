## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.

## 2024-09-19 - Keyboard Focus on Ad-hoc Buttons
**Learning:** Found that custom/ad-hoc interactive `<button>` elements embedded within complex UI components (like the "Show more" expander or "Remove skill" badges in the Playground) often lack explicit visual focus indicators, breaking keyboard navigation flow for power users and those relying on keyboard accessibility.
**Action:** Always append standard Tailwind focus utility classes (`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1`) when adding or modifying non-shadcn `<button>` elements.