## 2024-05-15 - Icon Button Tooltips and Labels
**Learning:** Found multiple instances where small icon-only buttons lacked `aria-label` or `title`, which hinders screen-reader and tooltip experiences.
**Action:** Always verify `<Button size="icon" />` and `<Button size="icon-xs" />` have an accessible label or title attached when maintaining existing code in this repository.
## 2024-10-09 - Accessible Icon-Only Buttons in Playground
**Learning:** Found multiple `<Button size="icon">` and `<Button size="icon-xs">` components in `PlaygroundPage.tsx` using `title` for tooltips but missing explicit `aria-label`s, breaking screen reader announcements for critical application paths like project management.
**Action:** Always map `title` attribute strings to matching `aria-label` attributes on icon-only buttons (`size="icon"`, `size="icon-xs"`) when explicit text content is absent to ensure keyboard and assistive-tech accessibility.
