## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.
## 2026-07-27 - Responsive Button Accessibility
**Learning:** When using utility classes like `hidden sm:inline` to visually hide text on smaller screens, screen readers will also ignore the text. This turns responsive text buttons into inaccessible icon-only buttons on mobile devices.
**Action:** Always add an explicit `aria-label` to buttons where the primary text label is conditionally hidden based on viewport size, ensuring the button's purpose remains accessible to screen reader users on all devices.
