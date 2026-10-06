## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.

## 2024-05-18 - [Add focus styles and ARIA labels to Badge buttons]
**Learning:** Ad-hoc buttons inside Badge components (like remove buttons for selected items) are easily missed for accessibility. They need explicit `focus-visible` styles (`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`) and `aria-label` attributes to be usable by keyboard and screen reader users.
**Action:** When adding interactive elements like "X" icons inside tags/badges, always include `aria-label` and shadcn/Tailwind focus rings.
