import { useMemo } from "react";
import { useDashboardStore } from "../store/useDashboardStore";
import { averagePeers, computeHeadline, isOnlineNode } from "../store/networkStats";
import { placementNote } from "../store/placement";
import { useNodePlacement } from "../hooks/useNodePlacement";
import { useNarrowViewport } from "../hooks/useNarrowViewport";
import { ARC_COLORS, ARC_LABELS } from "./constants";

interface TickerCategory {
  label: string;
  value: string;
  color: string;
}

const ARC_LEGEND = (Object.keys(ARC_LABELS) as (keyof typeof ARC_LABELS)[]).map((kind) => ({
  label: ARC_LABELS[kind],
  color: ARC_COLORS[kind],
}));

const ARC_NOTE = "Arcs follow live traffic counters; their endpoints are illustrative, as routes are private";

export function BottomTicker() {
  const nodeMetrics = useDashboardStore((s) => s.nodeMetrics);
  const networkTotals = useDashboardStore((s) => s.networkTotals);
  const onlineCount = useDashboardStore(
    (s) => s.nodes.filter(isOnlineNode).length,
  );
  const registeredCount = useDashboardStore(
    (s) => s.nodes.filter((n) => n.status !== "deregistered").length,
  );
  const placement = useNodePlacement();
  const narrow = useNarrowViewport();
  const note = placementNote(placement);

  const categories = useMemo((): TickerCategory[] => {
    const all = Array.from(nodeMetrics.values());
    if (all.length === 0 && !networkTotals) return [];

    const fmt = (n: number) =>
      n >= 1e6
        ? `${(n / 1e6).toFixed(1)}M`
        : n >= 1e3
          ? `${(n / 1e3).toFixed(1)}K`
          : n.toLocaleString();

    const headline = computeHeadline(nodeMetrics, networkTotals);
    // Peers is a live gauge, so it always comes from the current nodes.
    const avgPeers = averagePeers(all);

    return [
      { label: "RECEIVED", value: fmt(headline.packetsReceived), color: "#38bdf8" },
      { label: "FORWARDED", value: fmt(headline.packetsForwarded), color: "#00ff88" },
      { label: "PEERS/NODE", value: avgPeers != null ? String(avgPeers) : "—", color: "#f59e0b" },
      { label: "EXIT OPS", value: fmt(headline.exitOps), color: "#a78bfa" },
      { label: "WEB3 TXs", value: fmt(headline.exitEthereum), color: "#22c55e" },
      { label: "NODES ONLINE", value: `${onlineCount}/${registeredCount}`, color: "#22c55e" },
    ];
  }, [nodeMetrics, networkTotals, onlineCount, registeredCount]);

  if (categories.length === 0) return null;

  return (
    <footer
      aria-label="Network metrics summary"
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {note && (
        <div
          title={ARC_NOTE}
          style={{
            textAlign: "center",
            fontSize: "11px",
            color: "rgba(255,255,255,0.35)",
            padding: "4px 12px",
            background: "rgba(5,10,5,0.55)",
            letterSpacing: "0.04em",
          }}
        >
          {note}
          {!narrow && <> · {ARC_NOTE}</>}
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          gap: narrow ? "4px 14px" : 24,
          padding: "5px 8px",
          background: "rgba(5,10,5,0.7)",
          borderTop: "1px solid rgba(0,255,136,0.05)",
        }}
      >
        {ARC_LEGEND.map((item) => (
          <div
            key={item.label}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: item.color,
              }}
            />
            <span
              style={{
                fontSize: "12px",
                color: "rgba(255,255,255,0.45)",
                fontWeight: 400,
                letterSpacing: "0.08em",
              }}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          rowGap: 6,
          minHeight: 64,
          padding: narrow ? "8px 4px" : 0,
          background: "rgba(5,10,5,0.92)",
          borderTop: "1px solid rgba(0,255,136,0.08)",
          position: "relative",
        }}
      >
        {categories.map((cat, i) => (
          <div
            key={cat.label}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: narrow ? "0 8px" : "0 18px",
              borderRight:
                !narrow && i < categories.length - 1
                  ? "1px solid rgba(0,255,136,0.06)"
                  : "none",
            }}
          >
            <div
              style={{
                fontSize: narrow ? "15px" : "20px",
                fontWeight: 700,
                fontFamily: '"Space Grotesk", sans-serif',
                color: cat.color,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {cat.value}
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "rgba(255,255,255,0.4)",
                fontWeight: 400,
                letterSpacing: "0.1em",
                marginTop: 3,
              }}
            >
              {cat.label}
            </div>
          </div>
        ))}

        {!narrow && (
        <a
          href="https://github.com/hisoka-io/nox"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View source on GitHub"
          style={{
            position: "absolute",
            right: 20,
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "rgba(255,255,255,0.75)",
            textDecoration: "none",
            pointerEvents: "auto",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.75)")}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          <span style={{ fontSize: "16px", fontWeight: 600, letterSpacing: "0.02em" }}>
            hisoka-io
          </span>
        </a>
        )}
      </div>
    </footer>
  );
}
