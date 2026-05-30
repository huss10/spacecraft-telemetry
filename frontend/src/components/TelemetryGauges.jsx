const CARD = {
  background: "#161920",
  borderRadius: 10,
  border: "1px solid #2a2d3a",
  padding: "18px 20px",
};

const GAUGES = [
  { key: "temperature_c",  label: "Temperature",  unit: "°C", min: 0,   max: 80,  warn: 45, crit: 60,  color: "#E8593C" },
  { key: "pressure_kpa",   label: "Pressure",     unit: "kPa", min: 50, max: 120, warn: 85, crit: 72,  color: "#378ADD", low: true },
  { key: "battery_voltage",label: "Bus Voltage",  unit: "V",  min: 22,  max: 30,  warn: 26, crit: 24.5,color: "#1D9E75", low: true },
  { key: "attitude_deg",   label: "Attitude (Yaw)", unit: "°", min: 0, max: 360, warn: null,crit: null, color: "#7F77DD" },
];

function Sparkline({ data, color, min, max }) {
  if (data.length < 2) return null;
  const W = 80, H = 28;
  const norm = v => H - ((v - min) / (max - min)) * H;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${norm(v)}`).join(" ");
  return (
    <svg width={W} height={H} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.8}/>
    </svg>
  );
}

function Gauge({ cfg, value, sparkValues }) {
  if (value == null) return null;
  const pct = Math.max(0, Math.min(1, (value - cfg.min) / (cfg.max - cfg.min)));
  const bad = cfg.crit != null && (cfg.low ? value <= cfg.crit : value >= cfg.crit);
  const warn = !bad && cfg.warn != null && (cfg.low ? value <= cfg.warn : value >= cfg.warn);
  const barColor = bad ? "#E24B4A" : warn ? "#BA7517" : cfg.color;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #1e2130" }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 11, opacity: 0.5, textTransform: "uppercase", letterSpacing: 0.5 }}>{cfg.label}</span>
          <span style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: barColor }}>
            {value.toFixed(1)}<span style={{ fontSize: 10, opacity: 0.6 }}> {cfg.unit}</span>
          </span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: "#2a2d3a", overflow: "hidden" }}>
          <div style={{ width: `${pct * 100}%`, height: "100%", background: barColor, borderRadius: 2, transition: "width 0.5s ease" }} />
        </div>
      </div>
      <Sparkline data={sparkValues} color={barColor} min={cfg.min} max={cfg.max} />
    </div>
  );
}

export default function TelemetryGauges({ telemetry, history }) {
  return (
    <div style={CARD}>
      <h2 style={{ margin: "0 0 14px", fontSize: 12, opacity: 0.4, fontWeight: 500, letterSpacing: 1, textTransform: "uppercase" }}>
        Sensor Readouts
      </h2>
      {GAUGES.map(cfg => (
        <Gauge
          key={cfg.key}
          cfg={cfg}
          value={telemetry?.[cfg.key] ?? null}
          sparkValues={history.map(h => h[cfg.key])}
        />
      ))}
    </div>
  );
}
