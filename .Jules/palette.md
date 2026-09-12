## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.
## 2025-01-20 - Playground Accessibility Improvements
 **Learning:** Missing ARIA labels and focus rings on interactive icon buttons reduce accessibility and visual feedback for keyboard users. Adding them improves the overall user experience and complies with accessibility best practices.
 **Action:** When introducing new interactive elements like ad-hoc `<button>` tags, ensure standard Tailwind and shadcn-ui classes like `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring` are applied, along with `aria-label` attributes for icon-only buttons.
