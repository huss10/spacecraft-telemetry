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

