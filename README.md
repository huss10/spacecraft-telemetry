# Nyx Ground Station — Spacecraft Telemetry System

A fault-tolerant telemetry and command system for a simulated spacecraft,
built as a portfolio project demonstrating flight-software engineering concepts.

## Architecture

```
┌─────────────────────────────────────┐
│  C++ Core (spacecraft binary)       │
│  • State machine: BOOT→NOMINAL→     │
│    SAFE_MODE→FAULT                  │
│  • Sensor simulator (temp, pressure,│
│    voltage, attitude)               │
│  • Command dispatcher (stdin/stdout)│
└────────────┬────────────────────────┘
             │ JSON over subprocess pipes
┌────────────▼────────────────────────┐
│  Python / FastAPI Backend           │
│  • Spawns C++ process               │
│  • REST API  (/command, /telemetry) │
│  • WebSocket broadcast (/ws)        │
└────────────┬────────────────────────┘
             │ WebSocket + REST
┌────────────▼────────────────────────┐
│  React Dashboard                    │
│  • Live sensor gauges + sparklines  │
│  • State machine display            │
│  • Command uplink panel             │
│  • Event log                        │
└─────────────────────────────────────┘
```

## Quick Start

### 1. Build the C++ core

```bash
cd core
make
# Run unit tests
g++ -std=c++17 -Wall -o tests test_spacecraft.cpp && ./tests
```

### 2. Start the FastAPI backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Start the React dashboard

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

## What it demonstrates

| Concept | Where |
|---|---|
| State machine with deterministic transitions | `core/spacecraft.cpp` |
| Real-time inter-process communication | FastAPI subprocess + pipes |
| Serialised telemetry protocol (JSON packets) | `emitTelemetry()` in C++ |
| Command dispatcher with ACK/NACK | `CommandDispatcher` class |
| WebSocket live data streaming | `backend/main.py` |
| Unit tests for safety-critical logic | `core/test_spacecraft.cpp` |
| Hardware/software boundary pattern | C++ binary ↔ Python bridge |

## Commands

| Command | Effect |
|---|---|
| `SET_MODE NOMINAL` | Normal operations |
| `SET_MODE SAFE_MODE` | Low-power standby |
| `SET_MODE FAULT` | Simulate fault (high temp, low pressure) |
| `RESET` | Return to BOOT state |
| `PING` | Verify comms link (returns PONG) |

## Resume talking points

- **"Developed a real-time distributed telemetry system"** — C++ binary emits
  timestamped sensor packets at 1 Hz; FastAPI bridges to the React dashboard via
  WebSocket with sub-second latency.
- **"Implemented a finite state machine for safety-critical mode management"** —
  BOOT → NOMINAL → SAFE_MODE → FAULT with guarded transitions and automatic
  boot sequencing.
- **"Wrote unit tests covering nominal and fault conditions"** — 324 assertions
  across 8 test suites; zero external dependencies.
- **"Designed an IPC protocol using structured telemetry packets"** — JSON
  serialisation over stdin/stdout, analogous to UART or CAN bus message framing.
- **"Familiar with SIL testing patterns"** — the Python bridge can be replaced
  with a hardware serial adapter for HIL testing without changing the C++ core.
