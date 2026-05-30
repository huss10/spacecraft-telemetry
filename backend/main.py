"""
Spacecraft Telemetry Backend
FastAPI server that:
- Spawns the C++ spacecraft binary as a subprocess
- Reads JSON telemetry lines from its stdout
- Broadcasts telemetry to connected WebSocket clients
- Accepts HTTP commands and forwards them to the binary's stdin
"""

import asyncio
import json
import subprocess
import sys
from collections import deque
from pathlib import Path
from typing import Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(title="Spacecraft Telemetry API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------
BINARY_PATH = Path(__file__).parent.parent / "core" / "spacecraft"

spacecraft_process: subprocess.Popen | None = None
connected_clients: Set[WebSocket] = set()
telemetry_history: deque = deque(maxlen=100)   # last 100 telemetry frames
cmd_log: deque = deque(maxlen=50)              # last 50 command results
latest_telemetry: dict = {}


# ---------------------------------------------------------------------------
# Process management
# ---------------------------------------------------------------------------
async def start_spacecraft():
    """Launch the C++ binary and begin reading its stdout."""
    global spacecraft_process

    if not BINARY_PATH.exists():
        print(f"[BACKEND] Binary not found at {BINARY_PATH}. Run: cd core && make", flush=True)
        return

    spacecraft_process = subprocess.Popen(
        [str(BINARY_PATH)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
    )
    print(f"[BACKEND] Spacecraft process started (PID {spacecraft_process.pid})", flush=True)
    asyncio.create_task(read_telemetry_loop())


async def read_telemetry_loop():
    """Async wrapper around blocking readline — runs via executor."""
    loop = asyncio.get_event_loop()

    def blocking_readline():
        if spacecraft_process and spacecraft_process.stdout:
            return spacecraft_process.stdout.readline()
        return ""

    while spacecraft_process and spacecraft_process.poll() is None:
        line = await loop.run_in_executor(None, blocking_readline)
        if not line:
            await asyncio.sleep(0.05)
            continue
        await handle_output_line(line.strip())


async def handle_output_line(line: str):
    """Parse a JSON line from the C++ process and dispatch it."""
    global latest_telemetry
    if not line:
        return
    try:
        msg = json.loads(line)
    except json.JSONDecodeError:
        print(f"[BACKEND] Non-JSON output: {line}", flush=True)
        return

    if msg.get("type") == "telemetry":
        latest_telemetry = msg
        telemetry_history.append(msg)
        await broadcast(msg)
    elif msg.get("type") == "cmd":
        entry = {"type": "cmd", "result": msg.get("result", ""), "timestamp_ms": latest_telemetry.get("timestamp_ms", 0)}
        cmd_log.append(entry)
        await broadcast(entry)


async def broadcast(msg: dict):
    """Send a message to all connected WebSocket clients."""
    dead: Set[WebSocket] = set()
    for ws in connected_clients:
        try:
            await ws.send_json(msg)
        except Exception:
            dead.add(ws)
    connected_clients.difference_update(dead)


def send_command(command: str):
    """Write a command line to the C++ process stdin."""
    if spacecraft_process is None or spacecraft_process.stdin is None:
        raise RuntimeError("Spacecraft process not running")
    spacecraft_process.stdin.write(command + "\n")
    spacecraft_process.stdin.flush()


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def startup():
    await start_spacecraft()


@app.on_event("shutdown")
async def shutdown():
    if spacecraft_process:
        try:
            send_command("SHUTDOWN")
        except Exception:
            pass
        spacecraft_process.wait(timeout=3)


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------
class CommandRequest(BaseModel):
    command: str


VALID_COMMANDS = {"PING", "RESET", "SET_MODE NOMINAL", "SET_MODE SAFE_MODE", "SET_MODE FAULT"}


@app.post("/command")
async def post_command(req: CommandRequest):
    if req.command not in VALID_COMMANDS:
        raise HTTPException(status_code=400, detail=f"Unknown command. Valid: {VALID_COMMANDS}")
    try:
        send_command(req.command)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return {"status": "sent", "command": req.command}


@app.get("/telemetry/latest")
async def get_latest():
    return latest_telemetry or {"error": "No telemetry yet"}


@app.get("/telemetry/history")
async def get_history():
    return list(telemetry_history)


@app.get("/commands/log")
async def get_cmd_log():
    return list(cmd_log)


@app.get("/status")
async def get_status():
    running = spacecraft_process is not None and spacecraft_process.poll() is None
    return {
        "process_running": running,
        "clients_connected": len(connected_clients),
        "telemetry_frames": len(telemetry_history),
    }


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    # Send last 10 frames immediately so the dashboard isn't blank on connect
    for frame in list(telemetry_history)[-10:]:
        await websocket.send_json(frame)
    try:
        while True:
            # Keep the connection alive; commands come via REST
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        connected_clients.discard(websocket)
