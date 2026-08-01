# Offline AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the iPhone chat continue without a desktop/network by using Apple Foundation Models or a downloaded expo-ai-kit model, while retaining desktop cloud, Cloud Pro, Codex, and Claude runtimes.

**Architecture:** Remote runtimes remain the existing Poly host path. A small on-device service discovers Apple/ML Kit/downloadable models, persists the selected local model, and streams local responses through the installed Vercel AI SDK 7 `streamText` + `expoAiKit` provider. The existing Zustand/SQLite message cache stores local history under a dedicated on-device agent id.

**Tech Stack:** Expo SDK 57, `expo-ai-kit` 0.12, Vercel AI SDK 7, `@expo/ui` SwiftUI, Expo SQLite/localStorage.

## Global Constraints

- Read Expo SDK v57 documentation before native changes.
- Use Apple semantic/native UI and keep existing liquid-glass chat styling.
- Never send a local-mode prompt to the desktop; only the explicit remote runtime path uses Poly networking.
- Downloadable model activation requires `meetsRequirements` and a downloaded status.
- Keep the AI SDK React Native polyfills loaded before local inference.

---

### Task 1: On-device runtime service

**Files:**
- Create: `src/services/on-device-ai.ts`
- Modify: `src/data/settings-storage.ts`
- Modify: `src/app/_layout.tsx`
- Create: `src/polyfills.ts`

Add dynamic expo-ai-kit imports so Expo Go/native-module absence becomes an unavailable local runtime instead of an app-start crash. Normalize built-in and downloadable model metadata, persist the selected model/local-mode preference, and expose an abortable `streamText` wrapper using `expoAiKit(modelId)`.

### Task 2: Model state and selection

**Files:**
- Create: `src/hooks/use-on-device-models.ts`
- Modify: `src/state/app-store.ts`
- Modify: `src/hooks/use-agents.ts`
- Modify: `src/components/home-screen.tsx`
- Modify: `src/components/chat-header.tsx`

Load model status with TanStack Query, activate/download models through the service, add local models to the runtime menu, and switch between local and remote modes without changing the existing desktop runtime API.

### Task 3: Offline chat path

**Files:**
- Modify: `src/hooks/use-conversation.ts`
- Modify: `src/components/chat-surface.tsx`
- Modify: `src/components/settings-screen.tsx`

Route local mode through the AI SDK stream, support cancellation and haptics, load local history from SQLite, and add native settings actions for model download/activation/removal with progress.

### Task 4: Verification

Run: `npx tsc --noEmit`, `npx eslint src`, `bun test`, and `npx expo export --platform ios --output-dir /tmp/polyui-ios-offline-ai-export`.
