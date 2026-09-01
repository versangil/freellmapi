## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.
## 2024-05-18 - Replace native title attributes with accessible Tooltip on icon buttons
**Learning:** Native `title` attributes on icon-only buttons are often slow to appear, visually inconsistent with the design system, and not easily accessible to keyboard users who tab through focusable elements without pausing.
**Action:** Replace `title` attributes on icon-only buttons with the custom, focus-aware `<Tooltip>` component that uses portals, and ensure the text is duplicated as an `aria-label` directly on the button for immediate screen reader announcements.
