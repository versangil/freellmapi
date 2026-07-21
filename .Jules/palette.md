## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.
## 2024-07-21 - Custom Tooltips for Disabled Buttons
**Learning:** Standard HTML `disabled` attributes prevent hover events from firing on buttons in some browsers, breaking tooltips. However, because the custom `Tooltip` component wraps its children in a `<span className="inline-flex">`, it successfully catches pointer events even when the inner button is disabled.
**Action:** When adding tooltips to buttons that may be disabled, use the custom `Tooltip` component. Also, always replace native `title` attributes with custom tooltips + `aria-label`s on icon-only buttons for better accessibility and styling.
