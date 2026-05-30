const CARD = {
  background: "#161920",
  borderRadius: 10,
  border: "1px solid #2a2d3a",
  padding: "18px 20px",
};

export default function EventLog({ events }) {
  return (
    <div style={{ ...CARD, display: "flex", flexDirection: "column" }}>
      <h2 style={{ margin: "0 0 14px", fontSize: 12, opacity: 0.4, fontWeight: 500, letterSpacing: 1, textTransform: "uppercase" }}>
        Event Log
      </h2>
      <div style={{
        flex: 1,
        overflowY: "auto",
        maxHeight: 200,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}>
        {events.length === 0 && (
          <div style={{ fontSize: 12, opacity: 0.3, fontFamily: "monospace" }}>No events yet…</div>
        )}
        {events.map(ev => {
          const isOk = ev.result?.startsWith("ACK") || ev.result?.startsWith("PONG") || ev.result?.startsWith("AUTO");
          return (
            <div key={ev.id} style={{
              display: "flex",
              gap: 8,
              alignItems: "baseline",
              padding: "4px 8px",
              borderRadius: 4,
              background: "#1e2130",
              fontFamily: "monospace",
              fontSize: 11,
            }}>
              <span style={{ color: isOk ? "#1D9E75" : "#E24B4A", flexShrink: 0 }}>
                {isOk ? "✓" : "✗"}
              </span>
              <span style={{ opacity: 0.35, flexShrink: 0 }}>
                {ev.timestamp_ms != null ? `T+${(ev.timestamp_ms / 1000).toFixed(0)}s` : ""}
              </span>
              <span style={{ color: isOk ? "#a8d8b0" : "#f0a0a0", wordBreak: "break-all" }}>
                {ev.result}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
