## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.
## 2025-02-24 - Missing ARIA Labels on Inline Action Icons
**Learning:** Found that secondary inline actions inside complex components, such as the `X` to remove active skills inside the `Badge` elements of the `PlaygroundPage`, often lack `aria-label` attributes even though they are icon-only interactive controls (`<button>`).
**Action:** When adding or auditing complex composite UI elements (like Badges containing dismiss actions), ensure that small inline `<button>` tags with purely icon contents (`<X />`) are explicitly given `aria-label`s describing the action.
