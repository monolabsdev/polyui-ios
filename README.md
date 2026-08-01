# Poly UI iOS

An iOS remote client for the [Poly UI](https://github.com/monolabsdev/poly-ui) desktop AI application.

## Demo

<img src="public/poly-ui-demo.gif" alt="Poly UI iOS demo" width="360" />

## Features

- Native SwiftUI chrome: workspace, chat, activity, and settings
- Real-time agent chat with streaming messages and Markdown rendering
- QR code pairing with the Poly desktop app
- End-to-end encrypted sessions (X25519 + XChaCha20-Poly1305)
- Background agent completion notifications via native APNs
- Offline conversation history in SQLite

## Getting started

```bash
bun install
npx expo start
```

Then open the app in a development build, iOS simulator, or Expo Go.

## Tech stack

Expo SDK 57, Expo Router, `@expo/ui/swift-ui`, TypeScript, React Query, Zustand, Zod, Expo Secure Store, `@noble/*` cryptography.

## License

MIT
