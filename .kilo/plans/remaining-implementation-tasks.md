# Remaining Implementation Tasks

## Issues to Address

### 1. Compact View Feature (High Priority)
**Status:** Partially implemented - state added but UX incomplete

**Remaining work:**
- Add `useEffect` to persist compactView to localStorage with key `playground-compact-view`
- Add compact view toggle button near the Send button in the chat input area
- Implement truncation logic in `AssistantBubble` component:
  - When compactView is true and assistant message has >6 lines, show truncated content
  - Add "Show more" button to expand collapsed content
  - Use `line-clamp-6` Tailwind class or manual line counting

**Files to modify:**
- `client/src/pages/PlaygroundPage.tsx`

### 2. Server Message Cleanup Task (Medium Priority)
**Status:** Not implemented

**Work needed:**
- Add `startOldMessageCleanup()` function to `server/src/index.ts`
- Query to delete `playground_messages` older than 30 days
- Schedule cleanup to run daily (24-hour interval)
- Run cleanup on server startup

**Files to modify:**
- `server/src/index.ts`

### 3. Pre-existing TypeScript Errors (Low Priority)
**Status:** Existing codebase issues

**Work needed:**
- Remove unused imports: `Gauge`, `ImageIcon`, `Play`, `Zap` (lines 10-11, 20, 32)
- Remove unused: `mediaSkills` (line 37), `detectedMediaSkills` (line 294)
- Add or import `estimateTokenCost` function (line 522)

**Files to modify:**
- `client/src/pages/PlaygroundPage.tsx`

## Proposed Implementation Order

1. **Compact View Toggle Button** (Frontend) - User experience improvement
2. **Compact View Persistence & Truncation** (Frontend) - Complete feature
3. **Server Message Cleanup** (Backend) - Storage optimization
4. **TypeScript Cleanup** (Code quality) - Remove warnings

## Technical Details

### Compact View Implementation
```tsx
// In AssistantBubble component:
const [expandedContent, setExpandedContent] = useState(false)
const lineCount = content.split('\n').length
const displayContent = compactView && lineCount > 6 && !expandedContent 
  ? content.split('\n').slice(0, 6).join('\n') + '...' 
  : content
```

### Server Cleanup Implementation
```ts
function startOldMessageCleanup() {
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
  const cleanup = () => {
    const { getDb } = require('./db/index.js')
    const db = getDb()
    const cutoffTime = new Date(Date.now() - THIRTY_DAYS_MS).toISOString()
    db.prepare('DELETE FROM playground_messages WHERE created_at < ?').run(cutoffTime)
  }
  cleanup()
  setInterval(cleanup, 24 * 60 * 60 * 1000)
}
```

## Validation
- Run `npm run dev` to verify dev server starts
- Test compact view toggle in browser
- Verify old messages are cleaned up after 30 days
- Run `npm run build` to ensure no TypeScript errors