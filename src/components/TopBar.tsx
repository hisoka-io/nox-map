import { useDashboardStore, GlobeStyle } from "../store/useDashboardStore";
import { chainInfo } from "../store/networkStats";
import { useNarrowViewport } from "../hooks/useNarrowViewport";

const GLOBE_STYLES: { value: GlobeStyle; label: string }[] = [
  { value: "night", label: "NIGHT" },
  { value: "day", label: "DAY" },
];

export function TopBar() {
  const mockMode = useDashboardStore((s) => s.mockMode);
  const connected = useDashboardStore((s) => s.clusterConnected);
  const globeStyle = useDashboardStore((s) => s.globeStyle);
  const setGlobeStyle = useDashboardStore((s) => s.setGlobeStyle);
  const chainId = useDashboardStore((s) => s.chainId);
  const verified = useDashboardStore((s) => s.registryVerified);
  const narrow = useNarrowViewport();
  const chain = chainId != null ? chainInfo(chainId) : null;

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
        padding: narrow ? "12px 12px" : "16px 24px",
        background: "rgba(5,10,5,0.92)",
        borderBottom: "1px solid rgba(0,255,136,0.1)",
        pointerEvents: "none",
      }}
    >
      <h1
        style={{
          fontSize: narrow ? "15px" : "18px",
          fontFamily: '"Space Grotesk", sans-serif',
          fontWeight: 600,
          color: "#fff",
          letterSpacing: narrow ? "0.12em" : "0.18em",
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
          left: narrow ? 12 : 24,
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
              padding: narrow ? "4px 6px" : "5px 10px",
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
      {connected && !mockMode && chain && (
        <span
          title={[
            `Registry on ${chain.name} (chain ${chainId})`,
            verified === true
              ? "Node list matches the registry's on-chain members"
              : verified === false
                ? "Node list could not be matched to the registry's on-chain members"
                : null,
          ]
            .filter(Boolean)
            .join(". ")}
          style={{
            position: "absolute",
            right: narrow ? 12 : 24,
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: narrow ? "10px" : "11px",
            color: chain.testnet === false ? "#00ff88" : "#f59e0b",
            fontWeight: 500,
            letterSpacing: "0.1em",
            padding: "3px 8px",
            border: `1px solid ${chain.testnet === false ? "rgba(0,255,136,0.3)" : "rgba(245,158,11,0.3)"}`,
            borderRadius: 3,
            pointerEvents: "auto",
          }}
        >
          {chain.testnet ? "TESTNET" : chain.testnet === false ? "MAINNET" : ""}
          {!narrow && (
            <span style={{ color: "rgba(255,255,255,0.5)" }}>
              {chain.testnet != null ? "· " : ""}
              {chain.name.toUpperCase()}
            </span>
          )}
          {!narrow && verified === true && (
            <span style={{ color: "#00ff88" }}>· VERIFIED</span>
          )}
          {!narrow && verified === false && (
            <span style={{ color: "#ef4444" }}>· UNVERIFIED</span>
          )}
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
