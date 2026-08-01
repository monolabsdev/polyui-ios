# Local Chat Sync Implementation Plan

**Goal:** Mirror every desktop conversation onto the paired iPhone, import the full history during pairing, and keep the local copy reconciled automatically.

**Architecture:** The desktop remains canonical. The iPhone stores conversation metadata and messages in separate SQLite mirror tables, reads the chat browser from SQLite, and asks the desktop only for conversations whose `updatedAt` value changed. A successful reconciliation updates the local sync timestamp atomically.

**Tech:** Expo SDK 57, `expo-sqlite`, TanStack Query, Expo Router, `@expo/ui` SwiftUI.

---

### Task 1: Persistent mirror and incremental sync

**Files:**
- Modify: `src/data/conversation-cache.ts`
- Create: `src/utils/conversation-sync.ts`
- Create: `src/utils/conversation-sync.test.ts`
- Modify: `src/network/poly-api.ts`

Add host-scoped conversation, message, and sync-state tables without changing the existing active-chat cache. Compare remote and local `updatedAt` values, fetch every conversation on the initial sync and only changed conversations later, then apply metadata/messages/deletions in one exclusive transaction.

Run: `bun test src/utils/conversation-sync.test.ts`

### Task 2: Pairing and automatic reconciliation

**Files:**
- Modify: `src/hooks/use-pairing.ts`
- Modify: `src/hooks/use-agents.ts`

Await the first full sync after a host is paired. Keep reconciliation running while connected and let TanStack Query refresh it when the app returns to the foreground.

Run: `npx tsc --noEmit`

### Task 3: Local-first chat browser

**Files:**
- Modify: `src/components/conversations-screen.tsx`
- Modify: `src/hooks/use-conversation.ts`

Load the browser from SQLite, display syncing/last-synced state, refresh from the desktop on demand, and fall back to mirrored messages when a selected conversation cannot be fetched live.

Run: `npx eslint src/components/conversations-screen.tsx src/hooks/use-conversation.ts src/hooks/use-agents.ts src/hooks/use-pairing.ts src/network/poly-api.ts src/data/conversation-cache.ts src/utils/conversation-sync.ts src/utils/conversation-sync.test.ts`

### Task 4: Native verification

Run: `npx tsc --noEmit`, `npx eslint src`, `bun test`, and `npx expo export --platform ios --output-dir /tmp/polyui-ios-sync-export`.
