import { useEffect, useRef } from "react";
import { useDashboardStore, DEFAULT_METRICS } from "../store/useDashboardStore";
import { isFrozenNode } from "../store/networkStats";
import { FROZEN_COLOR, ROLE_LABELS, LAYER_LABELS } from "./constants";

function reputationColor(score: number): string {
  if (score >= 80) return "#00ff88";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

/** Smart USD formatting: shows enough precision for any magnitude */
function fmtUsd(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs === 0) return "$0.00";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (abs >= 1) return `${sign}$${abs.toFixed(2)}`;
  if (abs >= 0.01) return `${sign}$${abs.toFixed(3)}`;
  if (abs >= 0.0001) return `${sign}$${abs.toFixed(5)}`;
  return `${sign}$${abs.toExponential(2)}`;
}

function statusInfo(healthStatus: number) {
  if (healthStatus === 2) return { label: "Healthy", color: "#00ff88" };
  if (healthStatus === 1) return { label: "Degraded", color: "#f59e0b" };
  return { label: "Unhealthy", color: "#ef4444" };
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function layerColor(layer: number): string {
  if (layer === 0) return "#00ff88";
  if (layer === 1) return "#38bdf8";
  return "#f97316";
}

export function NodeDetail() {
  const selectedNodeId = useDashboardStore((s) => s.selectedNodeId);
  const nodes = useDashboardStore((s) => s.nodes);
  const nodeMetrics = useDashboardStore((s) => s.nodeMetrics);
  const nodeReputation = useDashboardStore((s) => s.nodeReputation);
  const setSelectedNodeId = useDashboardStore((s) => s.setSelectedNodeId);

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedNodeId) return;
    dialogRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedNodeId(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodeId, setSelectedNodeId]);

  if (!selectedNodeId) return null;

  const node = nodes.find((n) => n.address === selectedNodeId);
  if (!node) return null;

  const m = nodeMetrics.get(selectedNodeId) ?? DEFAULT_METRICS;
  const rep = nodeReputation.get(selectedNodeId);
  const status = statusInfo(m.healthStatus);
  const lColor = layerColor(node.layer);

  return (
    <>
      <div
        onClick={() => setSelectedNodeId(null)}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 39,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          pointerEvents: "auto",
        }}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-label={`Node details for ${node.id}`}
        tabIndex={-1}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 40,
          width: 420,
          background: "#0a0f0a",
          borderLeft: "1px solid rgba(255,255,255,0.06)",
          pointerEvents: "auto",
          display: "flex",
          flexDirection: "column",
          outline: "none",
        }}
      >
        <div style={{ padding: "24px 24px 18px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: 600,
                  fontFamily: '"Space Grotesk", sans-serif',
                  color: "rgba(255,255,255,0.9)",
                  margin: 0,
                }}
              >
                {node.id}
              </h2>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 10,
                }}
              >
                <Tag color={lColor}>{LAYER_LABELS[node.layer]}</Tag>
                <Tag color="rgba(255,255,255,0.4)">{ROLE_LABELS[node.role]}</Tag>
                <Tag color={status.color}>{status.label}</Tag>
                {isFrozenNode(node) && (
                  <Tag color={FROZEN_COLOR}>Frozen</Tag>
                )}
              </div>
            </div>
            <button
              aria-label="Close node details"
              onClick={() => setSelectedNodeId(null)}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.25)",
                cursor: "pointer",
                fontSize: "20px",
                padding: "4px 8px",
                fontFamily: "inherit",
                lineHeight: 1,
                borderRadius: 3,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "rgba(255,255,255,0.6)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "rgba(255,255,255,0.25)")
              }
            >
              ×
            </button>
          </div>

          <div
            style={{
              fontSize: "11px",
              color: "rgba(255,255,255,0.18)",
              fontFamily: '"JetBrains Mono", monospace',
              wordBreak: "break-all",
              lineHeight: 1.6,
              marginTop: 12,
            }}
          >
            {node.address}
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 24px" }} />

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 24px 28px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: rep ? "1fr 1fr 1fr" : "1fr 1fr",
              gap: 1,
              background: "rgba(255,255,255,0.03)",
              borderRadius: 6,
              overflow: "hidden",
              marginBottom: 28,
            }}
          >
            {rep && (
              <HeroMetric
                value={Math.round(rep.score)}
                label="reputation"
                color={reputationColor(rep.score)}
              />
            )}
            <HeroMetric
              value={m.activePeers}
              label="peers"
              color="rgba(255,255,255,0.7)"
            />
            <HeroMetric
              value={formatUptime(m.uptimeSeconds)}
              label="uptime"
              color="rgba(255,255,255,0.7)"
            />
          </div>

          <Section title="PACKETS">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
              <MiniStat value={m.packetsReceived.toLocaleString()} label="received" color="#38bdf8" />
              <MiniStat value={m.packetsForwarded.toLocaleString()} label="forwarded" color="rgba(255,255,255,0.6)" />
              <MiniStat value={m.dummyPacketsDropped.toLocaleString()} label="dropped" color="rgba(255,255,255,0.35)" />
            </div>
          </Section>

          <Section title="COVER TRAFFIC">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 14 }}>
              <MiniStat value={m.coverLoopGenerated.toLocaleString()} label="loop" color="#00ff88" />
              <MiniStat value={m.coverDropGenerated.toLocaleString()} label="drop" color="#f59e0b" />
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              <StatusPill label="Loop" ok={!m.coverLoopDegraded} />
              <StatusPill label="Drop" ok={!m.coverDropDegraded} />
            </div>
          </Section>

          {rep && (
            <Section title="REPUTATION">
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    height: 4,
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${rep.score}%`,
                      height: "100%",
                      background: reputationColor(rep.score),
                      borderRadius: 2,
                      transition: "width 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                    }}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
                <MiniStat
                  value={rep.totalChecks > 0 ? `${((rep.passedChecks / rep.totalChecks) * 100).toFixed(0)}%` : "—"}
                  label="uptime"
                  color="rgba(255,255,255,0.6)"
                />
                <MiniStat value={String(rep.streak)} label="streak" color="rgba(255,255,255,0.6)" />
                <MiniStat value={`${rep.passedChecks}/${rep.totalChecks}`} label="checks" color="rgba(255,255,255,0.6)" />
              </div>
            </Section>
          )}

          {node.role >= 2 && (
            <>
              <Section title="EXIT OPERATIONS">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
                  <MiniStat value={m.exitPayloadsDispatched.toLocaleString()} label="total" color="#a78bfa" />
                  <MiniStat value={m.exitHttp.toLocaleString()} label="HTTP" color="#38bdf8" />
                  <MiniStat value={m.exitRpc.toLocaleString()} label="RPC" color="#38bdf8" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginTop: 12 }}>
                  <MiniStat value={m.exitEcho.toLocaleString()} label="echo" color="rgba(255,255,255,0.6)" />
                  <MiniStat value={m.exitBroadcast.toLocaleString()} label="TX broadcast" color="#a78bfa" />
                  <MiniStat value={m.exitEthereum.toLocaleString()} label="paid TX" color="#22c55e" />
                </div>
              </Section>

              <Section title="ECONOMICS">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
                  <MiniStat value={fmtUsd(m.cumulativeAuthorizedRevenueUsd)} label="authorized revenue" color="#22c55e" />
                  <MiniStat value={fmtUsd(m.cumulativeCostUsd)} label="planned cost" color="#ef4444" />
                  <MiniStat value={fmtUsd(m.cumulativeMaximumCostUsd)} label="max authorized" color="#f59e0b" />
                  <MiniStat
                    value={fmtUsd(m.cumulativeAuthorizedRevenueUsd - m.cumulativeCostUsd)}
                    label="planned margin"
                    color={m.cumulativeAuthorizedRevenueUsd >= m.cumulativeCostUsd ? "#22c55e" : "#ef4444"}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginTop: 12 }}>
                  <MiniStat value={String(m.profitableCount)} label="profitable" color="#22c55e" />
                  <MiniStat value={String(m.unprofitableCount)} label="unprofitable" color={m.unprofitableCount > 0 ? "#ef4444" : "rgba(255,255,255,0.6)"} />
                  <MiniStat value={String(m.ethTransactionsSubmitted)} label="submitted" color="rgba(255,255,255,0.6)" />
                </div>
                {m.ethPending > 0 && (
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)", marginTop: 12 }}>
                    {m.ethPending} ETH pending
                  </div>
                )}
              </Section>
            </>
          )}

          <div
            style={{
              marginTop: 8,
              paddingTop: 16,
              borderTop: "1px solid rgba(255,255,255,0.04)",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "11px",
              color: "rgba(255,255,255,0.18)",
              fontFamily: '"JetBrains Mono", monospace',
            }}
          >
            <span>{m.buildVersion}</span>
            <span>Layer {node.layer}</span>
          </div>
        </div>
      </div>
    </>
  );
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: "11px",
        fontWeight: 500,
        letterSpacing: "0.08em",
        color,
        background: `${color}0a`,
        border: `1px solid ${color}22`,
        borderRadius: 3,
        padding: "3px 8px",
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  );
}

function HeroMetric({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <div style={{ background: "#0a0f0a", padding: "18px 14px", textAlign: "center" }}>
      <div
        style={{
          fontSize: "26px",
          fontWeight: 600,
          fontFamily: '"Space Grotesk", sans-serif',
          color,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", marginTop: 8 }}>
        {label}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: "11px", letterSpacing: "0.2em", color: "rgba(255,255,255,0.3)", marginBottom: 12, fontWeight: 500 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function MiniStat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: "17px",
          fontWeight: 600,
          fontFamily: '"Space Grotesk", sans-serif',
          color,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", marginTop: 6 }}>
        {label}
      </div>
    </div>
  );
}

function StatusPill({ label, ok }: { label: string; ok: boolean }) {
  const color = ok ? "#00ff88" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
      <div style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {label}
      <span style={{ color, fontWeight: 500, fontSize: "11px", letterSpacing: "0.05em" }}>
        {ok ? "OK" : "DEGRADED"}
      </span>
    </div>
  );
}
