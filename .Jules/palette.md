## 2024-05-24 - Accessibility standards on icon-only buttons
**Learning:** Found multiple icon-only `<Button size="icon">` and `<Button size="icon-xs">` components in PlaygroundPage.tsx lacking `aria-label`s. While they had `title` attributes for tooltips, relying solely on `title` is insufficient for robust screen reader support across all browsers and AT combinations. One button nearby ("New project chat") did correctly implement both.
**Action:** Always add an explicit `aria-label` matching the `title` text for icon-only buttons to ensure consistent accessibility.
## 2024-05-24 - Testing native fetch with http.createServer
**Learning:** When replacing `supertest` with Node's native `fetch` and an ephemeral HTTP server in test environments, `fetch` will use HTTP keep-alive by default. If `server.close()` is called without first forcibly closing connections (e.g., via `server.closeAllConnections()`), the test teardown will hang until the keep-alive timeout expires, leading to sluggish test execution and potential CI timeouts.
**Action:** Always call `server.closeAllConnections()` before `server.close()` when shutting down an ephemeral HTTP server tested with native `fetch`.
