# Background Agent Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep desktop AI work running after iOS suspension, persist its result, and notify the paired iPhone through native APNs when work completes.

**Architecture:** iOS registers its native APNs device token with the authenticated desktop pairing API. Desktop stores tokens in SQLite, stops coupling AI lifetime to the streaming socket, persists the final assistant message, then sends an APNs alert directly. iOS immediately refreshes presence/messages after returning to foreground.

**Tech Stack:** Expo SDK 57 `expo-notifications`, React Native AppState, Rust/Tokio, SQLx SQLite, Reqwest HTTP/2, APNs token authentication.

## Global Constraints

- Do not use EAS or Expo Push Service.
- Keep notification delivery independent from the iOS process and live socket.
- Keep pairing-token authentication on every mobile API mutation.
- Keep APNs private key outside source control; load it from desktop environment configuration.
- Existing unsigned IPA workflow cannot prove APNs delivery; physical signed-device verification remains external.

---

### Task 1: Persist and send native APNs notifications

**Files:**
- Create: `/home/squeegee/Documents/code/poly/poly-ui/src-tauri/src/db/migrations/20260731000000_mobile_push_tokens.sql`
- Create: `/home/squeegee/Documents/code/poly/poly-ui/src-tauri/src/mobile_push.rs`
- Modify: `/home/squeegee/Documents/code/poly/poly-ui/src-tauri/src/lib.rs`
- Modify: `/home/squeegee/Documents/code/poly/poly-ui/src-tauri/Cargo.toml`

**Interfaces:**
- Consumes: native hexadecimal APNs token and `sandbox | production` environment.
- Produces: `register_token`, `unregister_token`, and `notify_agent_completed`.

- [x] **Step 1: Add migration and unit tests**

```sql
CREATE TABLE IF NOT EXISTS mobile_push_tokens (
  token TEXT PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

- [x] **Step 2: Run desktop tests and confirm missing implementation fails**

Run: `cargo test mobile_push --manifest-path src-tauri/Cargo.toml`
Expected: FAIL until `mobile_push.rs` exists.

- [x] **Step 3: Implement APNs provider**

```rust
pub async fn register_token(db: &SqlitePool, token: &str, environment: &str) -> Result<(), String>;
pub async fn unregister_token(db: &SqlitePool, token: &str) -> Result<(), String>;
pub async fn notify_agent_completed(db: &SqlitePool, conversation_id: &str) -> Result<(), String>;
```

Load `POLY_APNS_TEAM_ID`, `POLY_APNS_KEY_ID`, and `POLY_APNS_PRIVATE_KEY_PATH`; sign ES256 JWTs, send HTTP/2 alert pushes to sandbox/production APNs, and delete invalid device tokens on `410 Gone`.

- [x] **Step 4: Run focused Rust tests**

Run: `cargo test mobile_push --manifest-path src-tauri/Cargo.toml`
Expected: PASS.

### Task 2: Decouple AI job lifetime from phone socket

**Files:**
- Modify: `/home/squeegee/Documents/code/poly/poly-ui/src-tauri/src/mobile_pairing.rs`

**Interfaces:**
- Consumes: `/api/push-token` registration and existing `/api/chat-stream` requests.
- Produces: completed DB message and APNs alert even after stream client disconnects.

- [x] **Step 1: Add tests for token body validation and disconnected-client policy**

```rust
assert!(parse_push_token_request(r#"{"token":"abcd","environment":"sandbox"}"#).is_ok());
assert!(!should_cancel_job_on_client_disconnect());
```

- [x] **Step 2: Run focused tests and verify failure**

Run: `cargo test mobile_pairing --manifest-path src-tauri/Cargo.toml`
Expected: FAIL before endpoint/job-policy implementation.

- [x] **Step 3: Add authenticated token endpoints and keep consuming AI events after write failure**

```rust
if method == "POST" && path.starts_with("/api/push-token") { /* register */ }
if method == "DELETE" && path.starts_with("/api/push-token") { /* unregister */ }
```

Record socket write failure, stop streaming to that socket, continue AI event consumption, persist final assistant message, emit desktop update, then call `notify_agent_completed`.

- [x] **Step 4: Run focused tests**

Run: `cargo test mobile_pairing --manifest-path src-tauri/Cargo.toml`
Expected: PASS.

### Task 3: Register native device token from iOS

**Files:**
- Modify: `src/network/poly-api.ts`
- Modify: `src/services/notifications.ts`
- Modify: `src/data/settings-storage.ts`
- Modify: `src/hooks/use-notifications-preference.ts`
- Modify: `src/hooks/use-pairing.ts`
- Modify: `src/app/_layout.tsx`

**Interfaces:**
- Consumes: `Notifications.getDevicePushTokenAsync()` and paired host request transport.
- Produces: `registerHostPushToken`, `unregisterHostPushToken`, and `syncNotificationRegistration`.

- [x] **Step 1: Add registration request functions**

```ts
export async function registerHostPushToken(token: string, environment: 'sandbox' | 'production'): Promise<void>;
export async function unregisterHostPushToken(token: string): Promise<void>;
```

- [x] **Step 2: Implement permission/token synchronization**

```ts
export async function syncNotificationRegistration(enabled: boolean): Promise<boolean>;
```

Use native APNs token, persist last registered token locally, unregister when disabled, register after pairing, and retry on app startup/foreground.

- [x] **Step 3: Verify iOS types and lint**

Run: `npx tsc --noEmit && npx eslint src/services/notifications.ts src/network/poly-api.ts src/hooks/use-notifications-preference.ts src/hooks/use-pairing.ts src/app/_layout.tsx`
Expected: PASS.

### Task 4: Reconnect and resync on foreground

**Files:**
- Modify: `src/hooks/use-conversation.ts`
- Modify: `src/hooks/use-agents.ts`

**Interfaces:**
- Consumes: React Native `AppState` transitions.
- Produces: immediate messages/presence refresh when state becomes `active`.

- [x] **Step 1: Add foreground listeners around existing sync/refetch functions**

```ts
const subscription = AppState.addEventListener('change', (state) => {
  if (state === 'active') void sync();
});
```

- [x] **Step 2: Run complete verification**

Run: `npx tsc --noEmit`, targeted ESLint, iOS Expo export, `cargo test mobile_pairing mobile_push --manifest-path src-tauri/Cargo.toml`, and desktop frontend tests.
Expected: all commands exit 0; physical APNs delivery remains an external signed-device check.
