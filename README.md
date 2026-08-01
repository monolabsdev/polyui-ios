<div align="center">
  <h1>Poly UI iOS</h1>

  <p>A native iOS remote client for <a href="https://github.com/monolabsdev/poly-ui">Poly UI</a>, the desktop AI application.</p>

  <p>
    <img src="https://img.shields.io/badge/Expo_SDK-57-000000?logo=expo&logoColor=white" alt="Expo SDK 57" />
    <img src="https://img.shields.io/badge/SwiftUI-native-0D1117?logo=swift&logoColor=white" alt="SwiftUI" />
    <img src="https://img.shields.io/badge/E2E_Encrypted-X25519_%2B_XChaCha20--Poly1305-6a4cff" alt="End-to-end encrypted" />
    <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License" />
  </p>

  <br />

  <img src="public/poly-ui-demo.gif" alt="Poly UI iOS demo" width="300" />

  <p><sub>Live demo · loops continuously</sub></p>
</div>

## Features

- Native SwiftUI chrome: workspace, chat, activity, and settings
- Real-time agent chat with streaming messages and Markdown rendering
- QR code pairing with the Poly desktop app
- End-to-end encrypted sessions (X25519 + XChaCha20-Poly1305)
- Background agent completion notifications via native APNs
- Offline conversation history in SQLite

## Tech stack

- Expo SDK 57 + Expo Router
- `@expo/ui/swift-ui` + TypeScript
- React Query + Zustand + Zod
- Expo Secure Store + `@noble/*` cryptography

## Getting started

```bash
bun install
npx expo start
```

Open the app in a development build, iOS simulator, or Expo Go.

<div align="center">
  <sub>MIT © <a href="https://github.com/monolabsdev">monolabsdev</a></sub>
</div>
