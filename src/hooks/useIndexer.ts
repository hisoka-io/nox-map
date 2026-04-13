import { useEffect, useRef } from "react";
import { useDashboardStore, type NodeInfo, type SseEvent } from "../store/useDashboardStore";
import { mapJsonToNodeMetrics } from "./useMetrics";
import { apiConfig } from "../config/api";
import {
  getMockClusterNodes,
  generateMockNodeMetrics,
  generateMockEvents,
  generateMockReputation,
} from "../data/mockDataProvider";

const INDEXER_BASE = apiConfig.baseUrl;
const INDEXER_REST_URL = `${INDEXER_BASE}/v1/state`;
const INDEXER_REPUTATION_URL = `${INDEXER_BASE}/v1/reputation`;
const INDEXER_WS_URL = `${INDEXER_BASE.replace(/^http/, "ws")}/v1/live`;

const MOCK_METRICS_MS = 5_000;
const MOCK_EVENTS_MS = 2_000;
const REPUTATION_POLL_MS = 30_000;

export function useIndexer(): void {
  const setNodes = useDashboardStore((s) => s.setNodes);
  const setClusterConnected = useDashboardStore((s) => s.setClusterConnected);
  const setNodeMetrics = useDashboardStore((s) => s.setNodeMetrics);
  const addNodeEvent = useDashboardStore((s) => s.addNodeEvent);
  const setNodeMetricsReachable = useDashboardStore((s) => s.setNodeMetricsReachable);
  const setNodeSseConnected = useDashboardStore((s) => s.setNodeSseConnected);
  const setNodeReputation = useDashboardStore((s) => s.setNodeReputation);
  const mockMode = useDashboardStore((s) => s.mockMode);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!mockMode) return;

    const nodes = getMockClusterNodes();
    setNodes(nodes);
    setClusterConnected(true);

    for (const n of nodes) {
      addNodeEvent(n.address, {
        kind: "node_started",
        timestamp: Math.floor(Date.now() / 1000),
        node_id: n.address,
      });
      setNodeSseConnected(n.address, true);
    }

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      setNodeMetrics(n.address, generateMockNodeMetrics(n.id, i));
      setNodeMetricsReachable(n.address, true);
    }

    setNodeReputation(generateMockReputation(nodes));

    const metricsId = setInterval(() => {
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        setNodeMetrics(n.address, generateMockNodeMetrics(n.id, i));
        setNodeMetricsReachable(n.address, true);
      }
    }, MOCK_METRICS_MS);

    const eventsId = setInterval(() => {
      for (const n of nodes) {
        const count = Math.floor(Math.random() * 4) + 1;
        for (const e of generateMockEvents(count, n.address)) {
          addNodeEvent(n.address, e);
        }
      }
    }, MOCK_EVENTS_MS);

    const reputationId = setInterval(() => {
      setNodeReputation(generateMockReputation(nodes));
    }, REPUTATION_POLL_MS);

    return () => {
      clearInterval(metricsId);
      clearInterval(eventsId);
      clearInterval(reputationId);
    };
  }, [mockMode, setNodes, setClusterConnected, setNodeMetrics, addNodeEvent, setNodeMetricsReachable, setNodeSseConnected, setNodeReputation]);

  useEffect(() => {
    if (mockMode) return;

    let cancelled = false;

    async function fetchInitialState() {
      try {
        const resp = await fetch(INDEXER_REST_URL);
        if (!resp.ok) throw new Error("Could not fetch indexer state");
        const data = await resp.json();

        if (cancelled) return;

        const nodes: NodeInfo[] = data.nodes || [];
        setNodes(nodes);
        setClusterConnected(true);

        for (const [address, metricsData] of Object.entries(data.metrics ?? {})) {
          setNodeMetrics(address, mapJsonToNodeMetrics(metricsData as Record<string, unknown>));
          setNodeMetricsReachable(address, true);
          setNodeSseConnected(address, true);
        }

        if (Array.isArray(data.reputation)) {
          setNodeReputation(data.reputation.map((r: Record<string, unknown>) => ({
            address: r.address as string,
            score: (r.score as number) ?? 100,
            streak: (r.streak as number) ?? 0,
            totalChecks: (r.total_checks as number) ?? 0,
            passedChecks: (r.passed_checks as number) ?? 0,
          })));
        }

        for (const e of data.recent_events ?? []) {
          const addr = e.node_address ?? e.node_id;
          if (addr) addNodeEvent(addr, e as SseEvent);
        }
      } catch (e) {
        if (!cancelled) setClusterConnected(false);
        if (import.meta.env.DEV) {
          console.error("Failed to load initial indexer state", e);
        }
      }
    }

    fetchInitialState().then(() => connectWs());

    const reputationPollId = setInterval(async () => {
      if (cancelled) return;
      try {
        const resp = await fetch(INDEXER_REPUTATION_URL);
        if (!resp.ok) return;
        const data = await resp.json();
        if (cancelled || !Array.isArray(data.ranking)) return;
        setNodeReputation(data.ranking.map((r: Record<string, unknown>) => ({
          address: r.address as string,
          score: (r.score as number) ?? 100,
          streak: (r.streak as number) ?? 0,
          totalChecks: (r.total_checks as number) ?? 0,
          passedChecks: (r.passed_checks as number) ?? 0,
        })));
      } catch {}
    }, REPUTATION_POLL_MS);

    function connectWs() {
      if (cancelled) return;

      const ws = new WebSocket(INDEXER_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
         setClusterConnected(true);
      };

      ws.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data);

          if (parsed.type === "METRICS") {
            const address = parsed.node_address;
            setNodeMetrics(address, mapJsonToNodeMetrics(parsed.payload));
            setNodeMetricsReachable(address, true);
          } else if (parsed.type === "EVENT") {
            const ev = parsed.payload;
            const address = ev.node_address ?? ev.node_id ?? "unknown";
            addNodeEvent(address, ev as SseEvent);
          } else if (parsed.type === "CLUSTER") {
            setNodes(parsed.payload.nodes || []);
            setClusterConnected(true);
          } else if (parsed.type === "NODE_STATE") {
            const address = parsed.node_id;
            if (address) {
              setNodeSseConnected(address, true);
            }
          }
        } catch {}
      };

      ws.onclose = () => {
        if (!cancelled) {
          setClusterConnected(false);
          setTimeout(connectWs, 3000);
        }
      };

      ws.onerror = () => {
         if (!cancelled) {
            setClusterConnected(false);
         }
      }
    }

    return () => {
      cancelled = true;
      clearInterval(reputationPollId);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [mockMode, setNodes, setClusterConnected, setNodeMetrics, addNodeEvent, setNodeMetricsReachable, setNodeSseConnected, setNodeReputation]);
}
