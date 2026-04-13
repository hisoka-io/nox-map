import { useDashboardStore, GlobeStyle } from "../store/useDashboardStore";

const GLOBE_STYLES: { value: GlobeStyle; label: string }[] = [
  { value: "night", label: "NIGHT" },
  { value: "day", label: "DAY" },
];

export function TopBar() {
  const mockMode = useDashboardStore((s) => s.mockMode);
  const connected = useDashboardStore((s) => s.clusterConnected);
  const globeStyle = useDashboardStore((s) => s.globeStyle);
  const setGlobeStyle = useDashboardStore((s) => s.setGlobeStyle);

  return (
    <header
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px 24px",
        background: "rgba(5,10,5,0.92)",
        borderBottom: "1px solid rgba(0,255,136,0.1)",
        pointerEvents: "none",
      }}
    >
      <h1
        style={{
          fontSize: "18px",
          fontFamily: '"Space Grotesk", sans-serif',
          fontWeight: 600,
          color: "#fff",
          letterSpacing: "0.18em",
          margin: 0,
        }}
      >
        NOX
        <span
          style={{
            fontWeight: 400,
            color: "rgba(255,255,255,0.4)",
            marginLeft: 8,
          }}
        >
          MIXNET
        </span>
      </h1>

      <div
        style={{
          position: "absolute",
          left: 24,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          gap: 4,
          pointerEvents: "auto",
        }}
      >
        {GLOBE_STYLES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setGlobeStyle(value)}
            style={{
              fontSize: "10px",
              fontFamily: '"JetBrains Mono", monospace',
              fontWeight: globeStyle === value ? 600 : 400,
              color: globeStyle === value ? "#00ff88" : "rgba(255,255,255,0.3)",
              background: globeStyle === value ? "rgba(0,255,136,0.08)" : "transparent",
              border: `1px solid ${globeStyle === value ? "rgba(0,255,136,0.3)" : "rgba(255,255,255,0.1)"}`,
              borderRadius: 3,
              padding: "5px 10px",
              cursor: "pointer",
              letterSpacing: "0.1em",
              transition: "color 0.15s, background 0.15s, border-color 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {mockMode && (
        <span
          style={{
            position: "absolute",
            right: 24,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "11px",
            color: "#a78bfa",
            fontWeight: 500,
            letterSpacing: "0.1em",
            padding: "3px 8px",
            border: "1px solid rgba(167,139,250,0.3)",
            borderRadius: 3,
          }}
        >
          MOCK
        </span>
      )}
      {!connected && !mockMode && (
        <span
          style={{
            position: "absolute",
            right: 24,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "11px",
            color: "#f59e0b",
            fontWeight: 500,
            letterSpacing: "0.1em",
            padding: "3px 8px",
            border: "1px solid rgba(245,158,11,0.3)",
            borderRadius: 3,
          }}
        >
          CONNECTING
        </span>
      )}
    </header>
  );
}
