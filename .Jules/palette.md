## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.
## 2026-09-08 - Responsive Button Accessibility
**Learning:** When using Tailwind classes like `hidden sm:inline` to visually hide text on mobile viewports, the text is also hidden from screen readers, effectively turning them into unlabeled icon-only buttons on small screens.
**Action:** Always provide an explicit `aria-label` for buttons that use responsive text hiding, ensuring a consistent accessible name across all viewports.
