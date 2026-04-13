import { useMemo } from "react";
import { useDashboardStore, type SseEvent } from "../store/useDashboardStore";

const EVENT_COLORS: Record<string, string> = {
  packet_processed: "#38bdf8",
  peer_connected: "#00ff88",
  peer_disconnected: "#f59e0b",
  topology_add: "#a78bfa",
  topology_remove: "#ef4444",
  node_started: "#22c55e",
};

function formatEventCompact(e: SseEvent): string {
  switch (e.kind) {
    case "packet_processed":
      return `Packet mixed ${e.duration_ms}ms`;
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
    case "packet_processed":
      return `${nodeId} — mixed in ${e.duration_ms}ms`;
    case "peer_connected":
      return `${e.peer_id.slice(0, 16)}... → ${nodeId}`;
    case "peer_disconnected":
      return `${e.peer_id.slice(0, 16)}... ← ${nodeId}`;
    case "topology_add":
      return `${e.address.slice(0, 12)}... stake: ${e.stake.slice(0, 8)}`;
    case "topology_remove":
      return `${e.address.slice(0, 12)}...`;
    case "node_started":
      return nodeId;
  }
}

function findNodeId(
  addr: string,
  nodes: { id: string; address: string }[],
): string {
  return nodes.find((n) => n.address === addr)?.id ?? addr.slice(0, 10);
}

export function EventFeed() {
  const nodeEvents = useDashboardStore((s) => s.nodeEvents);
  const nodes = useDashboardStore((s) => s.nodes);


  const events = useMemo(() => {
    type Entry = { event: SseEvent; nodeAddr: string; ts: number };
    const important: Entry[] = [];
    const packets: Entry[] = [];

    for (const [addr, evts] of nodeEvents) {
      for (const e of evts) {
        const ts =
          "timestamp" in e && typeof e.timestamp === "number"
            ? e.timestamp
            : Date.now() / 1000;
        const entry = { event: e, nodeAddr: addr, ts };

        if (e.kind === "packet_processed") {
          if (packets.length < 20) packets.push(entry);
        } else {
          important.push(entry);
        }
      }
    }

    important.sort((a, b) => b.ts - a.ts);
    packets.sort((a, b) => b.ts - a.ts);

    const result: Entry[] = [];
    const maxImportant = Math.min(important.length, 5);
    for (let i = 0; i < maxImportant; i++) result.push(important[i]);

    const remaining = 10 - result.length;
    for (let i = 0; i < Math.min(packets.length, remaining); i++) {
      result.push(packets[i]);
    }

    result.sort((a, b) => b.ts - a.ts);
    return result;
  }, [nodeEvents]);

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
          const e = item.event;
          const color = EVENT_COLORS[e.kind] ?? "rgba(255,255,255,0.3)";
          const nid = findNodeId(item.nodeAddr, nodes);
          const text = formatEventCompact(e);
          const detail = formatEventDetail(e, nid);

          return (
            <div
              key={`${item.nodeAddr}-${e.kind}-${i}`}
              title={detail}
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
            </div>
          );
        })}
      </div>
    </aside>
  );
}
