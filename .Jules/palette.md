## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.
## 2026-09-11 - Custom Component Focus States\n**Learning:** Custom interactive elements (like raw `<button>` tags) created ad-hoc within components often lack visible focus states for keyboard navigation, unlike standard shadcn/ui components.\n**Action:** Always add standard Tailwind focus classes (`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`) when using standard HTML buttons.
