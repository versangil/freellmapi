## 2024-05-24 - Accessibility Names on Mapped Controls
**Learning:** When generating interactive components (like Switch or Button) in a `.map` loop over groups or items, developers often forget to give each mapped element a unique accessible name. Icon-only edit buttons inside list items are especially prone to this.
**Action:** When adding or reviewing lists/groups, explicitly check if icon-only buttons or toggle switches within the loop have an `aria-label` providing context based on the iteration item (e.g. `aria-label={"Toggle " + group.label}`).
