import { useMemo, useRef, useState, useEffect } from "react";
import { useDashboardStore } from "../store/useDashboardStore";
import {
  averageReputation,
  computeHeadline,
  formatSince,
  isFrozenNode,
  isOnlineNode,
  networkUptimeSeconds,
} from "../store/networkStats";
import { FROZEN_COLOR } from "./constants";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

type NodeState = "online" | "frozen" | "offline";

const STATE_RANK: Record<NodeState, number> = { online: 0, frozen: 1, offline: 2 };

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
  }
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function StatsPanel() {
  const nodes = useDashboardStore((s) => s.nodes);
  const nodeMetrics = useDashboardStore((s) => s.nodeMetrics);
  const nodeEvents = useDashboardStore((s) => s.nodeEvents);
  const clusterCoverHealthy = useDashboardStore((s) => s.clusterCoverHealthy);
  const setSelectedNodeId = useDashboardStore((s) => s.setSelectedNodeId);
  const selectedNodeId = useDashboardStore((s) => s.selectedNodeId);

  const nodeReputation = useDashboardStore((s) => s.nodeReputation);
  const networkTotals = useDashboardStore((s) => s.networkTotals);
  const networkGenesisMs = useDashboardStore((s) => s.networkGenesisMs);

  // Every registered node is listed, so the count above the list matches it;
  // offline nodes (no metrics yet) and frozen nodes sort below online ones.
  const topNodes = useMemo(() => {
    return nodes
      .map((n) => {
        const state: NodeState = isFrozenNode(n)
          ? "frozen"
          : isOnlineNode(n)
            ? "online"
            : "offline";
        return {
          ...n,
          state,
          metrics: nodeMetrics.get(n.address),
          reputation: nodeReputation.get(n.address),
        };
      })
      .sort(
        (a, b) =>
          STATE_RANK[a.state] - STATE_RANK[b.state] ||
          (b.reputation?.score ?? 0) - (a.reputation?.score ?? 0),
      );
  }, [nodes, nodeMetrics, nodeReputation]);

  const stats = useMemo(() => {
    const all = Array.from(nodeMetrics.values());
    if (all.length === 0 && !networkTotals) return null;

    const headline = computeHeadline(nodeMetrics, networkTotals);

    const durations: number[] = [];
    for (const evts of nodeEvents.values()) {
      for (const e of evts) {
        if (e.kind === "packet_processed") {
          durations.push(e.duration_ms);
        }
      }
    }
    durations.sort((a, b) => a - b);

    return {
      latencyP50: percentile(durations, 50),
      latencyP95: percentile(durations, 95),
      latencyP99: percentile(durations, 99),
      coverLoop: headline.coverLoopGenerated,
      coverDrop: headline.coverDropGenerated,
      maxUptime: all.length > 0 ? Math.max(...all.map((m) => m.uptimeSeconds)) : 0,
      exitOps: headline.exitOps,
      exitEthereum: headline.exitEthereum,
    };
  }, [nodeMetrics, nodeEvents, networkTotals]);

  if (nodes.length === 0 || !stats) return null;

  const { average: avgReputation, count: reputationCount } = averageReputation(
    nodes,
    nodeReputation,
  );

  // Network uptime counts from the indexer's genesis (first node ever seen)
  // when it reports one; otherwise the longest-running node stands in.
  const uptimeSeconds =
    networkGenesisMs != null
      ? networkUptimeSeconds(networkGenesisMs, Date.now())
      : stats.maxUptime;
  const uptimeDetail = networkGenesisMs != null ? formatSince(networkGenesisMs) : undefined;

  const fmtMs = (n: number) => (n < 1 ? "<1" : String(Math.round(n)));
  const fmt = (n: number) =>
    n >= 1e6
      ? `${(n / 1e6).toFixed(1)}M`
      : n >= 1e3
        ? `${(n / 1e3).toFixed(1)}K`
        : n.toLocaleString();

  const handleNodeSelect = (address: string) => {
    setSelectedNodeId(address);
  };

  const handleNodeKeyDown = (e: ReactKeyboardEvent, address: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleNodeSelect(address);
    }
  };

  return (
    <aside
      aria-label="Network statistics"
      style={{
        position: "absolute",
        top: 100,
        right: 20,
        zIndex: 20,
        width: 340,
        pointerEvents: "auto",
      }}
    >
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontSize: "12px",
              letterSpacing: "0.25em",
              color: "rgba(255,255,255,0.45)",
              fontWeight: 500,
            }}
          >
            NODES
          </span>
          <span
            style={{
              fontSize: "13px",
              color: "rgba(255,255,255,0.3)",
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: 500,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {nodes.length}
          </span>
        </div>

        <ScrollableNodeList>
          {topNodes.map((n) => (
            <NodeRow
              key={n.address}
              id={n.id}
              layer={n.layer}
              score={n.reputation?.score ?? null}
              packets={n.metrics?.packetsReceived ?? 0}
              state={n.state}
              selected={n.address === selectedNodeId}
              onClick={() => handleNodeSelect(n.address)}
              onKeyDown={(e) => handleNodeKeyDown(e, n.address)}
            />
          ))}
        </ScrollableNodeList>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <MetricCard
          value={fmtMs(stats.latencyP50)}
          unit="ms"
          label="p50 latency"
          color={stats.latencyP50 < 100 ? "#00ff88" : "#f59e0b"}
        />
        <MetricCard
          value={clusterCoverHealthy ? "OK" : "LOW"}
          label="cover traffic"
          color={clusterCoverHealthy ? "#00ff88" : "#f59e0b"}
          detail={`${fmt(stats.coverLoop)} loop · ${fmt(stats.coverDrop)} drop`}
        />
        <MetricCard
          value={avgReputation != null ? String(avgReputation) : "—"}
          label="reputation"
          color={
            avgReputation == null
              ? "rgba(255,255,255,0.45)"
              : avgReputation >= 80
                ? "#00ff88"
                : avgReputation >= 50
                  ? "#f59e0b"
                  : "#ef4444"
          }
          detail={`avg across ${reputationCount} nodes`}
        />
        <MetricCard
          value={fmt(stats.exitOps)}
          label="exit operations"
          color="#a78bfa"
          detail={`${fmt(stats.exitEthereum)} web3 TXs`}
        />
        <MetricCard
          value={formatUptime(uptimeSeconds)}
          label="network uptime"
          color="#00ff88"
          detail={uptimeDetail}
        />
      </div>
    </aside>
  );
}

function ScrollableNodeList({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setCanScroll(el.scrollHeight > el.clientHeight);
    check();
    const observer = new MutationObserver(check);
    observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={scrollRef}
        style={{
          maxHeight: 260,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {children}
      </div>
      {canScroll && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 32,
            background: "linear-gradient(transparent, rgba(5,10,5,0.95))",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 80) return "#00ff88";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

function NodeRow({
  id,
  layer,
  score,
  packets,
  state,
  selected,
  onClick,
  onKeyDown,
}: {
  id: string;
  layer: number;
  score: number | null;
  packets: number;
  state: NodeState;
  selected: boolean;
  onClick: () => void;
  onKeyDown: (e: ReactKeyboardEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const dotColor =
    state === "frozen"
      ? FROZEN_COLOR
      : layer === 0
        ? "#00ff88"
        : layer === 1
          ? "#38bdf8"
          : "#f97316";
  const repPct = score != null ? score : 0;
  const repColor = score != null ? scoreColor(score) : "rgba(255,255,255,0.2)";
  const isActive = hovered || selected;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "7px 4px",
        cursor: "pointer",
        borderRadius: 4,
        background: selected
          ? "rgba(0,255,136,0.04)"
          : hovered
            ? "rgba(255,255,255,0.03)"
            : "transparent",
        borderLeft: selected ? "2px solid #00ff88" : "2px solid transparent",
        opacity: state === "offline" && !isActive ? 0.55 : 1,
        transition: "background 0.15s, border-color 0.15s, opacity 0.15s",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 5,
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: "14px",
            color: isActive
              ? "rgba(255,255,255,0.85)"
              : "rgba(255,255,255,0.6)",
            fontWeight: 500,
            transition: "color 0.15s",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: dotColor,
              flexShrink: 0,
            }}
          />
          {id}
          {state !== "online" && (
            <span
              style={{
                fontSize: "10px",
                letterSpacing: "0.1em",
                fontWeight: 500,
                color: state === "frozen" ? FROZEN_COLOR : "rgba(255,255,255,0.4)",
                border: `1px solid ${state === "frozen" ? `${FROZEN_COLOR}55` : "rgba(255,255,255,0.15)"}`,
                borderRadius: 3,
                padding: "1px 5px",
              }}
            >
              {state === "frozen" ? "FROZEN" : "OFFLINE"}
            </span>
          )}
        </span>
        <span
          style={{
            fontSize: "13px",
            fontFamily: '"Space Grotesk", sans-serif',
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            color: score != null ? repColor : "rgba(255,255,255,0.4)",
          }}
        >
          {score != null ? Math.round(score) : packets.toLocaleString()}
        </span>
      </div>

      <div
        style={{
          height: 2,
          background: "rgba(255,255,255,0.04)",
          borderRadius: 1,
          overflow: "hidden",
          marginLeft: 14,
        }}
      >
        <div
          style={{
            width: `${repPct}%`,
            height: "100%",
            background: repColor,
            opacity: 0.5,
            borderRadius: 1,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

function MetricCard({
  value,
  unit,
  label,
  color,
  detail,
}: {
  value: string;
  unit?: string;
  label: string;
  color: string;
  detail?: string;
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        background: "rgba(5,10,5,0.55)",
        border: "1px solid rgba(255,255,255,0.04)",
        borderRadius: 5,
      }}
    >
      <div
        style={{
          fontSize: "24px",
          fontWeight: 700,
          fontFamily: '"Space Grotesk", sans-serif',
          color,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {value}
        {unit && (
          <span
            style={{
              fontSize: "13px",
              fontWeight: 400,
              color: "rgba(255,255,255,0.25)",
              marginLeft: 3,
            }}
          >
            {unit}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: "12px",
          color: "rgba(255,255,255,0.3)",
          fontWeight: 400,
          marginTop: 6,
        }}
      >
        {label}
      </div>
      {detail && (
        <div
          style={{
            fontSize: "11px",
            color: "rgba(255,255,255,0.2)",
            fontWeight: 400,
            marginTop: 4,
          }}
        >
          {detail}
        </div>
      )}
    </div>
  );
}
