# Nyx Ground Station — Spacecraft Telemetry System

A fault-tolerant telemetry and command system for a simulated spacecraft.

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
<img width="1502" height="777" alt="Screenshot 2026-05-30 at 12 28 26 PM" src="https://github.com/user-attachments/assets/2db575f8-fcce-413f-9db3-b7a3ffd8792e" />

