# Design QA

- Source visual truth: `/tmp/codex-clipboard-P00fiB.png` and `/tmp/codex-clipboard-glr3G9.png`
- Implementation screenshot: unavailable
- Viewport: iOS, dark mode, keyboard open; exact device viewport and density unknown
- Source dimensions: 1178×1201 and 1178×1328 pixels
- State: compact and expanded chat composer

## Comparison Evidence

- Full view: blocked because this Linux workspace cannot render or capture the SwiftUI iOS component.
- Focused composer region: blocked for the same reason.
- Implemented change: one fixed 23pt continuous radius now becomes capsule-like at one line and rounded when native text height grows; no React state changes while typing.

## Findings

- P1: On-device visual transition and keyboard focus retention need an iOS capture before fidelity can be approved.

## Comparison History

- No visual iteration available; TypeScript, ESLint, and iOS bundle export pass.

final result: blocked
