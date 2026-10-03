import { useMemo } from "react";
import {
  useDashboardStore,
  type ActivityEntry,
  type SseEvent,
} from "../store/useDashboardStore";
import { useNarrowViewport } from "../hooks/useNarrowViewport";

const EVENT_COLORS: Record<string, string> = {
  activity: "#38bdf8",
  peer_connected: "#00ff88",
  peer_disconnected: "#f59e0b",
  topology_add: "#a78bfa",
  topology_remove: "#ef4444",
  node_started: "#22c55e",
};

const MAX_ROWS = 10;
const MAX_NODE_EVENTS = 5;

function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

function formatEventCompact(e: SseEvent): string {
  switch (e.kind) {
    case "peer_connected":
      return "Peer connected";
    case "peer_disconnected":
      return "Peer disconnected";
    case "topology_add":
      return "Relayer registered";
    case "topology_remove":
      return "Relayer removed";
    case "node_started":
      return "Node started";
  }
}

function formatEventDetail(e: SseEvent, nodeId: string): string {
  switch (e.kind) {
    case "peer_connected":
      return `${String(e.peer_id).slice(0, 16)}... → ${nodeId}`;
    case "peer_disconnected":
      return `${String(e.peer_id).slice(0, 16)}... ← ${nodeId}`;
    case "topology_add":
      return `${String(e.address).slice(0, 12)}... stake: ${String(e.stake).slice(0, 8)}`;
    case "topology_remove":
      return `${String(e.address).slice(0, 12)}...`;
    case "node_started":
      return nodeId;
  }
}

function formatActivity(a: ActivityEntry): string {
  if (a.relayed > 0 && a.exits > 0) {
    return `${a.relayed.toLocaleString()} relayed · ${a.exits.toLocaleString()} exited`;
  }
  if (a.relayed > 0) return `Relayed ${plural(a.relayed, "packet", "packets")}`;
  return `Exited ${plural(a.exits, "payload", "payloads")}`;
}

function findNodeId(
  addr: string,
  nodes: { id: string; address: string }[],
): string {
  return nodes.find((n) => n.address === addr)?.id ?? addr.slice(0, 10);
}

interface Row {
  key: string;
  nodeAddr: string;
  ts: number;
  color: string;
  text: string;
  detail: string;
}

/**
 * Recent network activity: node and peer events as they arrive, and traffic
 * counted from each node's counters between metric updates (packets are not
 * listed one by one).
 */
export function EventFeed() {
  const nodeEvents = useDashboardStore((s) => s.nodeEvents);
  const activity = useDashboardStore((s) => s.activity);
  const nodes = useDashboardStore((s) => s.nodes);
  const narrow = useNarrowViewport();

  const events = useMemo(() => {
    const important: Row[] = [];
    for (const [addr, evts] of nodeEvents) {
      const nid = findNodeId(addr, nodes);
      evts.forEach((e, i) => {
        important.push({
          key: `${addr}-${e.kind}-${e.timestamp}-${i}`,
          nodeAddr: addr,
          ts: typeof e.timestamp === "number" ? e.timestamp : 0,
          color: EVENT_COLORS[e.kind] ?? "rgba(255,255,255,0.3)",
          text: formatEventCompact(e),
          detail: formatEventDetail(e, nid),
        });
      });
    }
    important.sort((a, b) => b.ts - a.ts);

    const traffic: Row[] = activity.map((a, i) => {
      const nid = findNodeId(a.address, nodes);
      const text = formatActivity(a);
      return {
        key: `activity-${a.address}-${a.timestamp}-${i}`,
        nodeAddr: a.address,
        ts: a.timestamp,
        color: a.relayed > 0 ? EVENT_COLORS.activity : "#a78bfa",
        text,
        detail: `${nid}: ${plural(a.relayed, "packet", "packets")} relayed, ${plural(a.exits, "exit payload", "exit payloads")} since its previous update`,
      };
    });

    const result = important.slice(0, MAX_NODE_EVENTS);
    result.push(...traffic.slice(0, MAX_ROWS - result.length));
    result.sort((a, b) => b.ts - a.ts);
    return result;
  }, [nodeEvents, activity, nodes]);

  if (narrow) return null;

  if (events.length === 0) return null;

  return (
    <aside
      aria-label="Live network events"
      style={{
        position: "absolute",
        top: 100,
        left: 20,
        zIndex: 20,
        width: 300,
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "#00ff88",
            boxShadow: "0 0 8px rgba(0,255,136,0.5)",
            animation: "pulse 2s infinite",
          }}
        />
        <span
          style={{
            fontSize: "12px",
            letterSpacing: "0.25em",
            color: "rgba(255,255,255,0.4)",
            fontWeight: 500,
          }}
        >
          LIVE
        </span>
      </div>

      <div
        role="log"
        aria-live="polite"
        style={{ display: "flex", flexDirection: "column", gap: 0 }}
      >
        {events.map((item, i) => {
          const color = item.color;
          const nid = findNodeId(item.nodeAddr, nodes);
          const text = item.text;

          return (
            <div
              key={item.key}
              title={item.detail}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 0",
                opacity: 1 - i * 0.06,
                borderBottom: "1px solid rgba(255,255,255,0.03)",
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  flex: 1,
                  fontSize: "13px",
                  color: "rgba(255,255,255,0.55)",
                  fontWeight: 400,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {text}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  color: "rgba(255,255,255,0.25)",
                  flexShrink: 0,
                }}
              >
                {nid}
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
