# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
# SAPS — Smart Ambulance Priority System

SAPS is a browser-based educational simulation of an emergency vehicle priority controller at a four-way intersection. All signals, detections, vehicle movement, RFID reads, and event records shown in this prototype are simulated. It is not connected to public-road traffic signals or physical hardware.

**Live demo:** https://prayaglohakare-stack.github.io/smart-ambulance-priority-system/

## Architecture

- `src/core/controller.ts` is a React-independent deterministic state machine with injected clock and configurable durations.
- RFID demonstration registry and authentication decision are applied in the controller before requests enter the FIFO queue.
- `src/App.tsx` renders the control-room dashboard and supplies simulated operator inputs.
- `src/core/controller.test.ts` checks safety invariants and transition behavior with a controllable clock.

## Requirements and setup

Prerequisites: Node.js 20.19+ or 22.12+, and npm. From Windows PowerShell:

```powershell
cd "C:\Users\praya\OneDrive\Desktop\LDM CP"
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). Stop the server with Ctrl+C.

## Commands

```powershell
npm test                 # Vitest unit and controller integration tests
npm run build            # TypeScript check and production Vite build
npm run preview          # Preview the production build locally
```

## Simulation controls

Choose an approach and submit an authorized ambulance, unauthorized tag, or normal vehicle. Authenticated requests are queued in arrival order and receive emergency green only after the active traffic group completes yellow and all-red clearance. Confirm passage explicitly. The missing-passage scenario advances the request into the configured timeout recovery path. Pause/resume holds the current modeled indications; safe reset holds all-red for its clearance interval before normal operation resumes. Clear-log requires a second confirmation click.

Authorized demonstration IDs are `AMB-7F2A` (Medic 07) and `AMB-91C4` (Rescue 12). `UNAUTH-00FF` is a rejected example. Duplicate outstanding scans are ignored.

## Controller rules and limits

The simplified model treats North/South and East/West as opposing pairs. Conflicting groups are never green together. Emergency request reception cannot directly change a light. Yellow and all-red intervals are mandatory. Only the pair containing the active approach may receive emergency green. Passage is never inferred from RFID detection. A missing passage timeout sets every signal red, raises an auditable warning, and requires explicit operator acknowledgement before all-red recovery begins.

This is an educational simulation, not certified traffic-control software. Do not connect it to public-road signals. Simulated RFID matching only proves that an entered demo string matched this local registry; it does not verify real-world emergency status. RFID UIDs alone are not secure cryptographic authentication and can be copied or spoofed.

## Future hardware integration

Typed event/state structures form a boundary for future `RFID event`, `sensor event`, signal state, emergency request, telemetry, and communication-status adapters. A future ESP32 adapter could publish signed device telemetry to an authenticated API or WebSocket; MQTT is another possible transport if deployment requirements justify it. The adapter would validate device identity and sensor freshness, convert physical inputs into typed controller events, and report controller outputs/health. None of that hardware or transport integration is implemented here.
