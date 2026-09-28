## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.
## 2025-01-24 - Add ARIA Labels to Icon-Only Buttons in Playground
**Learning:** Found multiple instances in `PlaygroundPage.tsx` where `<Button size="icon">` and `<Button size="icon-xs">` had a `title` attribute for tooltips but were missing a corresponding `aria-label`. Relying solely on `title` is insufficient for robust screen reader support.
**Action:** Always ensure that icon-only interactive elements explicitly provide an `aria-label` attribute (mirroring the title or intent) to guarantee accessibility for assistive technologies.
