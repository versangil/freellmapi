## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.
## 2024-05-15 - ARIA Labels for Responsive Text
**Learning:** Some buttons in the UI (like in `PlaygroundPage.tsx`) use `hidden sm:inline` to hide text on mobile devices, effectively making them icon-only buttons on small screens. Without an `aria-label`, these become inaccessible to screen readers on mobile viewports.
**Action:** When inspecting buttons that conditionally hide text for responsive design, always ensure an `aria-label` is present so the accessible name is preserved across all viewport sizes.
