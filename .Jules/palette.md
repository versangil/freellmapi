## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.

## 2024-05-16 - Custom Sub-Element Accessibility
**Learning:** When building ad-hoc interactive sub-elements within components (like a small native `<button>` to act as an "X" remove icon inside a `Badge`), standard accessible primitives might be overlooked.
**Action:** Always ensure that custom button implementations manually include `aria-label`s for screen readers and `focus-visible` ring styling for keyboard navigation, specifically compensating for what pre-built UI components normally handle automatically.
