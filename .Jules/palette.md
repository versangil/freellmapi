## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.
## 2026-07-29 - Added aria labels for mobile hidden text
**Learning:** When using Tailwind classes like `hidden sm:inline` to visually hide text on smaller viewports, buttons can become icon-only on mobile devices. This causes them to lose their accessible name, negatively impacting screen reader users.
**Action:** Always provide an explicit `aria-label` on buttons that rely on viewport-based CSS classes to hide text to ensure accessibility is maintained across all devices.
