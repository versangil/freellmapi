## 2024-05-24 - Accessibility standards on icon-only buttons
**Learning:** Found multiple icon-only `<Button size="icon">` and `<Button size="icon-xs">` components in PlaygroundPage.tsx lacking `aria-label`s. While they had `title` attributes for tooltips, relying solely on `title` is insufficient for robust screen reader support across all browsers and AT combinations. One button nearby ("New project chat") did correctly implement both.
**Action:** Always add an explicit `aria-label` matching the `title` text for icon-only buttons to ensure consistent accessibility.
