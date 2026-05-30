const CARD = {
  background: "#161920",
  borderRadius: 10,
  border: "1px solid #2a2d3a",
  padding: "18px 20px",
};

const STATES = ["BOOT", "NOMINAL", "SAFE_MODE", "FAULT"];
const STATE_COLORS = {
  BOOT:      "#7F77DD",
  NOMINAL:   "#1D9E75",
  SAFE_MODE: "#BA7517",
  FAULT:     "#E24B4A",
};
const STATE_DESC = {
  BOOT:      "Initialising systems, running self-checks.",
  NOMINAL:   "All systems green. Normal operations.",
  SAFE_MODE: "Non-critical systems offline. Conserving power.",
  FAULT:     "Anomaly detected. Awaiting ground command.",
};

// Mini attitude indicator (artificial horizon style)
function AttitudeIndicator({ deg }) {
  const r = 36;
  const rad = (deg * Math.PI) / 180;
  const nx = Math.cos(rad - Math.PI / 2) * r;
  const ny = Math.sin(rad - Math.PI / 2) * r;
  return (
    <svg width={r * 2 + 8} height={r * 2 + 8} style={{ display: "block" }}>
      <circle cx={r + 4} cy={r + 4} r={r} fill="#1e2130" stroke="#2a2d3a" strokeWidth={1} />
      {/* Cardinal ticks */}
      {[0, 90, 180, 270].map(a => {
        const ar = (a * Math.PI) / 180;
        return (
          <line key={a}
            x1={r + 4 + Math.cos(ar - Math.PI/2) * (r - 6)}
            y1={r + 4 + Math.sin(ar - Math.PI/2) * (r - 6)}
            x2={r + 4 + Math.cos(ar - Math.PI/2) * r}
            y2={r + 4 + Math.sin(ar - Math.PI/2) * r}
            stroke="#2a2d3a" strokeWidth={2}
          />
        );
      })}
      {/* Heading pointer */}
      <line
        x1={r + 4} y1={r + 4}
        x2={r + 4 + nx} y2={r + 4 + ny}
        stroke="#7F77DD" strokeWidth={2} strokeLinecap="round"
      />
      <circle cx={r + 4} cy={r + 4} r={2} fill="#7F77DD" />
      <text x={r + 4} y={r * 2 + 18} textAnchor="middle" fill="#555" fontSize={9} fontFamily="system-ui">
        {deg != null ? `${deg.toFixed(0)}°` : "—"}
      </text>
    </svg>
  );
}

export default function StateDisplay({ telemetry, stateColor }) {
  const current = telemetry?.state;

  return (
    <div style={CARD}>
      <h2 style={{ margin: "0 0 14px", fontSize: 12, opacity: 0.4, fontWeight: 500, letterSpacing: 1, textTransform: "uppercase" }}>
        State Machine
      </h2>

      {/* State flow */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {STATES.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 0.5,
              background: current === s ? STATE_COLORS[s] + "33" : "#1e2130",
              border: `1px solid ${current === s ? STATE_COLORS[s] : "#2a2d3a"}`,
              color: current === s ? STATE_COLORS[s] : "#555",
              transition: "all 0.3s ease",
            }}>
              {s}
            </div>
            {i < STATES.length - 1 && <span style={{ color: "#2a2d3a", fontSize: 10 }}>→</span>}
          </div>
        ))}
      </div>

      {/* Current state description */}
      <div style={{
        padding: "10px 14px",
        borderRadius: 8,
        background: stateColor + "11",
        border: `1px solid ${stateColor}33`,
        marginBottom: 16,
        fontSize: 12,
        color: stateColor,
        minHeight: 36,
      }}>
        {current ? STATE_DESC[current] : "Awaiting first telemetry frame…"}
      </div>

      {/* Attitude + stats row */}
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <AttitudeIndicator deg={telemetry?.attitude_deg} />
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { label: "Attitude",  value: telemetry?.attitude_deg != null ? `${telemetry.attitude_deg.toFixed(1)}°` : "—" },
            { label: "Temp",     value: telemetry?.temperature_c != null ? `${telemetry.temperature_c.toFixed(1)} °C` : "—" },
            { label: "Pressure", value: telemetry?.pressure_kpa != null ? `${telemetry.pressure_kpa.toFixed(1)} kPa` : "—" },
            { label: "Voltage",  value: telemetry?.battery_voltage != null ? `${telemetry.battery_voltage.toFixed(2)} V` : "—" },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "#1e2130", borderRadius: 6, padding: "8px 10px" }}>
              <div style={{ fontSize: 9, opacity: 0.4, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
