## 2025-02-18 - Missing Accessible Names on Visually Hidden Text
**Learning:** Using Tailwind utility classes like `hidden sm:inline` to visually hide text inside buttons on mobile devices also hides the text from screen readers, leaving the button without an accessible name.
**Action:** Always provide an explicit `aria-label` attribute on interactive elements where the inner text is conditionally hidden via CSS (e.g., `hidden`), so that screen readers can consistently identify the element's purpose across all breakpoints.
