const CARD = {
  background: "#161920",
  borderRadius: 10,
  border: "1px solid #2a2d3a",
  padding: "18px 20px",
};

const COMMANDS = [
  { cmd: "SET_MODE NOMINAL",   label: "Set NOMINAL",   color: "#1D9E75", desc: "Return to normal ops" },
  { cmd: "SET_MODE SAFE_MODE", label: "Safe Mode",      color: "#BA7517", desc: "Power-saving standby" },
  { cmd: "SET_MODE FAULT",     label: "Inject FAULT",  color: "#E24B4A", desc: "Simulate fault condition" },
  { cmd: "RESET",              label: "Reset",          color: "#7F77DD", desc: "Return to BOOT" },
  { cmd: "PING",               label: "Ping",           color: "#378ADD", desc: "Check comms link" },
];

export default function CommandPanel({ onCommand, cmdStatus }) {
  return (
    <div style={CARD}>
      <h2 style={{ margin: "0 0 14px", fontSize: 12, opacity: 0.4, fontWeight: 500, letterSpacing: 1, textTransform: "uppercase" }}>
        Command Uplink
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        {COMMANDS.map(({ cmd, label, color, desc }) => (
          <button
            key={cmd}
            onClick={() => onCommand(cmd)}
            title={desc}
            style={{
              background: color + "18",
              border: `1px solid ${color}44`,
              borderRadius: 8,
              padding: "10px 14px",
              color: color,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              textAlign: "left",
              transition: "background 0.15s",
              letterSpacing: 0.3,
            }}
            onMouseEnter={e => e.currentTarget.style.background = color + "30"}
            onMouseLeave={e => e.currentTarget.style.background = color + "18"}
          >
            <div>{label}</div>
            <div style={{ fontSize: 10, opacity: 0.5, fontWeight: 400, marginTop: 2 }}>{desc}</div>
          </button>
        ))}
      </div>

      {/* Status feedback */}
      <div style={{
        padding: "8px 12px",
        borderRadius: 6,
        background: "#1e2130",
        fontSize: 12,
        fontFamily: "monospace",
        color: cmdStatus.startsWith("✓") ? "#1D9E75" : cmdStatus.startsWith("✗") ? "#E24B4A" : "#555",
        minHeight: 34,
        transition: "color 0.2s",
      }}>
        {cmdStatus || "Awaiting command…"}
      </div>

      <div style={{ marginTop: 10, fontSize: 10, opacity: 0.3, lineHeight: 1.5 }}>
        Commands are forwarded via FastAPI to the C++ spacecraft process stdin.
      </div>
    </div>
  );
}
