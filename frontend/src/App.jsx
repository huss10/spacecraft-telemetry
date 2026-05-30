import { useState, useEffect, useRef, useCallback } from "react";
import TelemetryGauges from "./components/TelemetryGauges";
import StateDisplay from "./components/StateDisplay";
import CommandPanel from "./components/CommandPanel";
import EventLog from "./components/EventLog";

const WS_URL = "ws://localhost:8000/ws";
const API_URL = "http://localhost:8000";

const STATE_COLORS = {
  BOOT:      "#7F77DD",
  NOMINAL:   "#1D9E75",
  SAFE_MODE: "#BA7517",
  FAULT:     "#E24B4A",
};

export default function App() {
  const [telemetry, setTelemetry]       = useState(null);
  const [history, setHistory]           = useState([]);   // last 30 frames for sparklines
  const [events, setEvents]             = useState([]);
  const [connected, setConnected]       = useState(false);
  const [cmdStatus, setCmdStatus]       = useState("");
  const wsRef = useRef(null);

  const connectWS = useCallback(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => setConnected(true);

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "telemetry") {
        setTelemetry(msg);
        setHistory(h => [...h.slice(-29), msg]);
      } else if (msg.type === "cmd") {
        setEvents(ev => [{ ...msg, id: Date.now() }, ...ev.slice(0, 49)]);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      setTimeout(connectWS, 2000);   // auto-reconnect
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connectWS();
    return () => wsRef.current?.close();
  }, [connectWS]);

  const sendCommand = async (command) => {
    setCmdStatus("Sending…");
    try {
      const res = await fetch(`${API_URL}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      const data = await res.json();
      setCmdStatus(res.ok ? `✓ ${data.command}` : `✗ ${data.detail}`);
    } catch {
      setCmdStatus("✗ Connection error");
    }
    setTimeout(() => setCmdStatus(""), 3000);
  };

  const stateColor = telemetry ? (STATE_COLORS[telemetry.state] ?? "#888") : "#888";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0d0f14",
      color: "#e2e4ec",
      fontFamily: "system-ui, sans-serif",
      padding: "24px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <div style={{
          width: 10, height: 10, borderRadius: "50%",
          background: connected ? "#1D9E75" : "#E24B4A",
          boxShadow: connected ? "0 0 8px #1D9E75" : "none",
          flexShrink: 0,
        }}/>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: 1 }}>
          NYX TELEMETRY GROUND STATION
        </h1>
        <span style={{
          marginLeft: "auto", fontSize: 12, opacity: 0.5,
          fontVariantNumeric: "tabular-nums",
        }}>
          {telemetry ? `MET ${(telemetry.timestamp_ms / 1000).toFixed(0)}s` : "—"}
        </span>
      </div>

      {/* State banner */}
      <div style={{
        padding: "10px 20px",
        borderRadius: 8,
        background: stateColor + "22",
        border: `1px solid ${stateColor}55`,
        marginBottom: 20,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: stateColor }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: stateColor, letterSpacing: 1 }}>
          {telemetry?.state ?? "CONNECTING…"}
        </span>
        <span style={{ fontSize: 12, opacity: 0.5, marginLeft: "auto" }}>
          SPACECRAFT STATE
        </span>
      </div>

      {/* Main grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "auto auto",
        gap: 16,
      }}>
        <TelemetryGauges telemetry={telemetry} history={history} />
        <StateDisplay telemetry={telemetry} history={history} stateColor={stateColor} />
        <CommandPanel onCommand={sendCommand} cmdStatus={cmdStatus} />
        <EventLog events={events} />
      </div>
    </div>
  );
}
