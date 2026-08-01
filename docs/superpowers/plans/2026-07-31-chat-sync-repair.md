# Chat UI and Sync Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render ChatGPT-style messages reliably, stream assistant text live, and keep iOS history aligned with Poly UI desktop SQLite in light and dark mode.

**Architecture:** Desktop SQLite remains canonical. iOS reads and writes through the existing authenticated mobile API, mirrors successful history locally for offline fallback, and renders messages with native SwiftUI `Text` instead of a per-message React Native layout bridge.

**Tech Stack:** Expo SDK 57, `@expo/ui/swift-ui`, `expo/fetch`, Expo SQLite, Zustand, Rust, SQLx, SSE.

## Global Constraints

- Use Expo SDK 57 and exact versioned Expo documentation.
- Keep desktop SQLite as source of truth; never copy or expose its database file.
- Preserve existing pairing authentication and relay encryption.
- Use semantic system colors for light/dark mode.
- Add no dependencies.

---

### Task 1: Native message rendering

**Files:**
- Modify: `src/components/message-bubble.tsx`

**Interfaces:**
- Consumes: `ChatMessage`
- Produces: content-sized user bubbles and full-width assistant Markdown using SwiftUI `Text`

- [ ] Replace `RNHostView` message islands with native `Text` and `markdownEnabled` for assistant output.
- [ ] Use a minimum leading spacer for right-aligned, content-sized user bubbles.
- [ ] Use semantic foreground and background colors.
- [ ] Show an indeterminate native progress view for an empty in-flight assistant message.

### Task 2: Reliable SSE completion

**Files:**
- Modify: `src/network/poly-api.ts`
- Modify: `src/network/stream-events.ts`
- Modify: `/home/squeegee/Documents/code/poly/poly-ui/src-tauri/src/mobile_pairing.rs`
- Test: `src/network/stream-events.test.ts`

**Interfaces:**
- Consumes: desktop `/api/chat-stream` SSE
- Produces: live `chunk` callbacks and one non-empty canonical `done` result

- [ ] Import `fetch` from `expo/fetch` for explicit SDK 57 streaming behavior.
- [ ] Preserve accumulated chunks when a `done` event omits final text.
- [ ] Fail visibly when a stream ends without `done`.
- [ ] Append desktop text deltas to final content before SQLite persistence.
- [ ] Run split-chunk SSE test and desktop mobile-pairing tests.

### Task 3: Desktop history sync and iOS cache

**Files:**
- Modify: `src/data/conversation-cache.ts`
- Modify: `src/hooks/use-conversation.ts`
- Modify: `src/components/home-screen.tsx`
- Modify: `src/components/chat-surface.tsx`

**Interfaces:**
- Consumes: desktop `/api/messages` history
- Produces: periodic canonical history refresh with local SQLite fallback

- [ ] Replace local cached rows transactionally when remote history changes.
- [ ] Load cached history only when desktop is unavailable.
- [ ] Pause polling while a response streams, then refresh from desktop SQLite.
- [ ] Clear current cached history when starting a new conversation.
- [ ] Surface network/stream errors in the conversation instead of silently swallowing them.

### Task 4: Verification

**Files:**
- Verify: iOS and desktop changed files

**Interfaces:**
- Consumes: completed implementation
- Produces: fresh test, type, lint, Rust, build, and diff evidence

- [ ] Run `bun test src/network/stream-events.test.ts`.
- [ ] Run `bunx tsc --noEmit`, `bun run lint`, and `bun run check:domain`.
- [ ] Run `cargo fmt --check` and `cargo test mobile_pairing --lib` in desktop repo.
- [ ] Run `git diff --check` in both repos.
