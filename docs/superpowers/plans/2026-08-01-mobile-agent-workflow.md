# Mobile Agent Workflow Implementation Plan

> **For agentic workers:** Execute inline in dependency order. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make long remote jobs survive transport interruptions, add native conversation management, support background agent approvals and cancellation, and show live agent activity.

**Architecture:** Desktop remains canonical for conversations, jobs, approvals, and messages. iOS uses authenticated direct or encrypted relay requests, reconnects interrupted streams to a desktop job snapshot, and presents native Expo Router/SwiftUI controls. Existing SQLite, Secure Store, SSE, APNs, and runtime types are reused; no dependency added.

**Tech Stack:** Expo SDK 57, Expo Router, `@expo/ui/swift-ui`, Expo Notifications, React Query, Zustand, Rust/Tokio, SQLx, APNs.

## Global Constraints

- Read exact Expo SDK 57 documentation before code changes.
- Keep desktop SQLite canonical and pairing-token authentication on every mobile endpoint.
- Keep relay frames X25519/XChaCha20-Poly1305 encrypted.
- Preserve direct LAN support, semantic light/dark colors, Liquid Glass, haptics, and accessibility labels.
- Add no dependency and no speculative attachment, voice, or multi-host work.
- Do not commit unless user requests it.

---

### Task 1: Recover interrupted streams

**Files:**
- Modify: `/home/squeegee/Documents/code/poly/poly-ui/src-tauri/src/mobile_pairing.rs`
- Modify: `src/network/relay-client.ts`
- Modify: `src/network/poly-api.ts`
- Modify: `src/hooks/use-conversation.ts`
- Test: `src/network/relay-client.test.ts`
- Test: `/home/squeegee/Documents/code/poly/poly-ui/src-tauri/src/mobile_pairing.rs`

**Interfaces:**
- Desktop emits `started`, `ping`, `snapshot`, existing `chunk`, and terminal `done | error` SSE events.
- `GET /api/job-stream?requestId=<id>` authenticates, sends current content snapshot, then follows live job events.
- `sendHostMessage(..., onStarted, onSnapshot, onActivity, onApproval)` reconnects transient failures without duplicating a job.

- [x] Add smallest pure relay timeout test: handshake still times out; stream activity refreshes idle deadline.
- [x] Add desktop mobile-job snapshot test: missed text becomes one `snapshot`, later text remains ordered.
- [x] Store active mobile job snapshots in server-owned `Arc<Mutex<HashMap<...>>>` and retain terminal jobs for ten minutes.
- [x] Send SSE heartbeat every 15 seconds and expose authenticated resume stream.
- [x] Replace fixed 30-second relay total timeout with 30-second handshake plus activity-refreshed 45-second idle timeout.
- [x] Retry resume stream with bounded exponential delays; preserve partial assistant content while reconnecting.
- [x] Run focused iOS and Rust tests.

### Task 2: Native conversation browser

**Files:**
- Create: `src/app/conversations.tsx`
- Create: `src/components/conversations-screen.tsx`
- Modify: `src/components/chat-header.tsx`
- Modify: `src/components/home-screen.tsx`
- Modify: `src/network/poly-api.ts`
- Modify: `src/hooks/use-conversation.ts`
- Modify: `/home/squeegee/Documents/code/poly/poly-ui/src-tauri/src/mobile_pairing.rs`

**Interfaces:**
- `fetchHostConversations(): Promise<{ conversations: HostConversation[]; selectedConversationId: string }>`.
- `selectHostConversation(id)`, `renameHostConversation(id, title)`, and `deleteHostConversation(id)` update desktop and Secure Store state.
- `PATCH /api/conversations` accepts `{ id, title }`; `DELETE /api/conversations` accepts `{ id }` and deletes messages before conversation.

- [x] Add Rust boundary tests rejecting empty IDs/titles and accepting trimmed rename payloads.
- [x] Add authenticated PATCH/DELETE handlers using existing SQLite tables and desktop update event.
- [x] Add Expo Router screen using native stack title/search and SwiftUI `List` rows.
- [x] Add select, iOS `Alert.prompt` rename, destructive delete confirmation, empty/loading/error states.
- [x] Open browser from header and immediately replace active messages/cache after selection.
- [x] Run typecheck, lint, Expo export, and focused Rust tests.

### Task 3: Background approvals and stop control

**Files:**
- Modify: `/home/squeegee/Documents/code/poly/poly-ui/src-tauri/src/mobile_pairing.rs`
- Modify: `/home/squeegee/Documents/code/poly/poly-ui/src-tauri/src/mobile_push.rs`
- Modify: `src/services/notifications.ts`
- Modify: `src/app/_layout.tsx`
- Modify: `src/network/poly-api.ts`
- Modify: `src/hooks/use-conversation.ts`
- Modify: `src/components/chat-composer.tsx`
- Modify: `src/components/chat-surface.tsx`

**Interfaces:**
- `POST /api/cancel` accepts `{ request_id }` and calls existing `AiSidecar::cancel`.
- Approval APNs payload carries `kind`, `requestId`, `approvalId`, `action`, `command`, `paths`, and `cwd` with category `approval_requested`.
- iOS notification actions `approve` and `deny` call existing `approveHostRequest`.
- Composer replaces send arrow with stop square while request runs.

- [x] Add Rust APNs payload test and cancel request parser test.
- [x] Emit `started` before first model chunk and add authenticated cancel endpoint.
- [x] Send approval push when permission event arrives; suppress duplicate foreground banner while SSE alert is active.
- [x] Configure underscore category IDs and notification response listener per Expo SDK 57.
- [x] Track active request ID, cancel it from composer, and keep already-streamed text.
- [x] Run notification, pairing, type, lint, and export checks.

### Task 4: Compact live agent activity

**Files:**
- Modify: `/home/squeegee/Documents/code/poly/poly-ui/src-tauri/src/mobile_pairing.rs`
- Modify: `src/network/poly-api.ts`
- Modify: `src/hooks/use-conversation.ts`
- Modify: `src/components/chat-surface.tsx`

**Interfaces:**
- Desktop forwards non-permission `data-agent` chunks as `activity` SSE data.
- iOS normalizes reasoning, plan/task, terminal, and file events into one live `AgentActivity` status.

- [x] Forward safe activity fields only; never send environment variables, secrets, or file contents.
- [x] Parse activity and reasoning events without affecting text accumulation.
- [x] Render latest activity above composer with native progress indicator and semantic text.
- [x] Clear activity on completion, cancellation, error, conversation change, and new request.
- [x] Run all iOS tests/type/lint/export and desktop Rust/build tests; run `git diff --check` in both repos.

## Self-Review

- Spec coverage: stream recovery, browser, background approvals, stop, and activity each have a testable task.
- Security: all new endpoints retain token authentication; activity payload excludes file contents and secrets.
- Type consistency: request IDs use `requestId` in SSE/APNs and `request_id` in JSON endpoint bodies, matching existing boundaries.
- Deliberate ceiling: ten-minute in-memory job retention; persist jobs only if desktop restart recovery becomes required.
