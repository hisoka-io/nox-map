import { create } from "zustand";
import { isRetiredNode, type NetworkTotalsSnapshot } from "./networkStats";

export interface NodeInfo {
  id: string;
  address: string;
  role: number; // 1=Relay, 2=Exit, 3=Full
  layer: number; // 0=Entry, 1=Mix, 2=Exit
  admin_port: number;
  ingress_port: number;
  p2p_addr: string;
  status?: string; // "online" | "offline" | "deregistered"
  frozen?: boolean; // registered but barred from routing (NoxRegistry v2)
  registry_address?: string; // registry the indexer saw this node on
}

export interface NodeMetrics {
  activePeers: number;
  uptimeSeconds: number;
  healthStatus: number; // 0=unhealthy, 1=degraded, 2=healthy

  packetsReceived: number;
  packetsForwarded: number;
  dummyPacketsDropped: number;

  workerQueueDepth: number;
  mixQueueDepth: number;
  egressQueueDepth: number;
  ingestDropped: number;
  ingestDroppedBackpressure: number;

  coverLoopGenerated: number;
  coverDropGenerated: number;
  coverLoopDegraded: boolean;
  coverDropDegraded: boolean;
  coverErrors: number;

  cumulativeAuthorizedRevenueUsd: number;
  cumulativeCostUsd: number;
  cumulativeMaximumCostUsd: number;
  ethPending: number;
  profitableCount: number;
  unprofitableCount: number;

  exitPayloadsDispatched: number;
  exitReassemblerPending: number;
  exitEcho: number;
  exitHttp: number;
  exitRpc: number;
  exitBroadcast: number;
  exitEthereum: number;
  exitTraffic: number;
  ethTransactionsSubmitted: number;
  egressForwarded: number;
  egressExited: number;

  sphinxErrors: number;
  replayNew: number;
  replayDuplicate: number;
  p2pRateLimitDenied: number;

  topologyLayer0: number;
  topologyLayer1: number;
  topologyLayer2: number;

  chainLastBlock: number;
  chainErrors: number;

  processMem: number;
  processVmem: number;
  openFds: number;

  buildVersion: string;
  buildRole: string;

  ingressResponseBuffer: number;

  fecSuccess: number;
  fecError: number;
  fecEncodeSuccess: number;
  fecDecodeError: number;

  oracleFetchStale: number;

  latencyP50: number;
  latencyP95: number;
  latencyP99: number;

  peersConnectedTotal: number;
  peersDisconnectedTotal: number;

  eventBusPacketProcessed: number;
  eventBusPayloadDecrypted: number;
  eventBusSendPacket: number;
}

export type NodeStartedEvent = {
  kind: "node_started";
  timestamp: number;
  node_id?: string;
};
export type PeerConnectedEvent = {
  kind: "peer_connected";
  peer_id: string;
  node_id?: string;
  timestamp?: number;
};
export type PeerDisconnectedEvent = {
  kind: "peer_disconnected";
  peer_id: string;
  node_id?: string;
  timestamp?: number;
};
export type TopologyAddEvent = {
  kind: "topology_add";
  address: string;
  role: number;
  stake: string;
  node_id?: string;
  timestamp?: number;
};
export type TopologyRemoveEvent = {
  kind: "topology_remove";
  address: string;
  node_id?: string;
  timestamp?: number;
};
export type PacketProcessedEvent = {
  kind: "packet_processed";
  duration_ms: number;
  node_id?: string;
  timestamp?: number;
};

export type SseEvent =
  | NodeStartedEvent
  | PeerConnectedEvent
  | PeerDisconnectedEvent
  | TopologyAddEvent
  | TopologyRemoveEvent
  | PacketProcessedEvent;

export interface NodeReputation {
  address: string;
  score: number;
  streak: number;
  totalChecks: number;
  passedChecks: number;
}

export interface TopologyNode {
  address: string;
  role: number;
}

export type GlobeStyle = "night" | "day";

export interface DashboardState {
  nodes: NodeInfo[];
  clusterConnected: boolean;
  mockMode: boolean;
  selectedNodeId: string | null;
  globeStyle: GlobeStyle;

  nodeMetrics: Map<string, NodeMetrics>;
  nodeEvents: Map<string, SseEvent[]>;
  nodeMetricsReachable: Map<string, boolean>;
  nodeSseConnected: Map<string, boolean>;

  topology: Map<string, TopologyNode>;
  nodeReputation: Map<string, NodeReputation>;
  clusterCoverHealthy: boolean;

  networkTotals: NetworkTotalsSnapshot | null;
  networkGenesisMs: number | null;
  registryAddress: string | null;

  setNodes: (nodes: NodeInfo[]) => void;
  setNetworkSnapshot: (snapshot: {
    totals: NetworkTotalsSnapshot | null;
    genesisMs: number | null;
    registryAddress: string | null;
  }) => void;
  setClusterConnected: (c: boolean) => void;
  setMockMode: (m: boolean) => void;
  setSelectedNodeId: (id: string | null) => void;
  setNodeMetrics: (nodeId: string, m: NodeMetrics) => void;
  addNodeEvent: (nodeId: string, e: SseEvent) => void;
  setNodeReputation: (rankings: NodeReputation[]) => void;
  setGlobeStyle: (style: GlobeStyle) => void;
  setNodeMetricsReachable: (nodeId: string, r: boolean) => void;
  setNodeSseConnected: (nodeId: string, c: boolean) => void;
}

export const DEFAULT_METRICS: NodeMetrics = {
  activePeers: 0,
  uptimeSeconds: 0,
  healthStatus: 0,
  packetsReceived: 0,
  packetsForwarded: 0,
  dummyPacketsDropped: 0,
  workerQueueDepth: 0,
  mixQueueDepth: 0,
  egressQueueDepth: 0,
  ingestDropped: 0,
  ingestDroppedBackpressure: 0,
  coverLoopGenerated: 0,
  coverDropGenerated: 0,
  coverLoopDegraded: false,
  coverDropDegraded: false,
  coverErrors: 0,
  cumulativeAuthorizedRevenueUsd: 0,
  cumulativeCostUsd: 0,
  cumulativeMaximumCostUsd: 0,
  ethPending: 0,
  profitableCount: 0,
  unprofitableCount: 0,
  exitPayloadsDispatched: 0,
  exitReassemblerPending: 0,
  exitEcho: 0,
  exitHttp: 0,
  exitRpc: 0,
  exitBroadcast: 0,
  exitEthereum: 0,
  exitTraffic: 0,
  ethTransactionsSubmitted: 0,
  egressForwarded: 0,
  egressExited: 0,
  sphinxErrors: 0,
  replayNew: 0,
  replayDuplicate: 0,
  p2pRateLimitDenied: 0,
  topologyLayer0: 0,
  topologyLayer1: 0,
  topologyLayer2: 0,
  chainLastBlock: 0,
  chainErrors: 0,
  processMem: 0,
  processVmem: 0,
  openFds: 0,
  buildVersion: "unknown",
  buildRole: "unknown",
  ingressResponseBuffer: 0,
  fecSuccess: 0,
  fecError: 0,
  fecEncodeSuccess: 0,
  fecDecodeError: 0,
  oracleFetchStale: 0,
  latencyP50: 0,
  latencyP95: 0,
  latencyP99: 0,
  peersConnectedTotal: 0,
  peersDisconnectedTotal: 0,
  eventBusPacketProcessed: 0,
  eventBusPayloadDecrypted: 0,
  eventBusSendPacket: 0,
};

const MAX_EVENTS = 200;

function pickListed<V>(map: Map<string, V>, listed: Set<string>): Map<string, V> {
  const next = new Map<string, V>();
  for (const [address, value] of map) {
    if (listed.has(address)) next.set(address, value);
  }
  return next.size === map.size ? map : next;
}

function isCoverHealthy(metrics: Map<string, NodeMetrics>): boolean {
  for (const m of metrics.values()) {
    if (m.coverLoopDegraded || m.coverDropDegraded) return false;
  }
  return true;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  nodes: [],
  clusterConnected: false,
  mockMode: false,
  selectedNodeId: null,
  globeStyle: "day",

  nodeMetrics: new Map(),
  nodeEvents: new Map(),
  nodeMetricsReachable: new Map(),
  nodeSseConnected: new Map(),

  topology: new Map(),
  nodeReputation: new Map(),
  clusterCoverHealthy: true,

  networkTotals: null,
  networkGenesisMs: null,
  registryAddress: null,

  // Deregistered nodes are dropped, and per-node state for any node that
  // leaves the list is cleared so it no longer feeds sums or averages.
  setNodes: (incoming) =>
    set((state) => {
      const nodes = incoming.filter((n) => !isRetiredNode(n, state.registryAddress));
      const listed = new Set(nodes.map((n) => n.address));
      const nodeMetrics = pickListed(state.nodeMetrics, listed);
      return {
        nodes,
        nodeMetrics,
        nodeMetricsReachable: pickListed(state.nodeMetricsReachable, listed),
        nodeSseConnected: pickListed(state.nodeSseConnected, listed),
        clusterCoverHealthy: isCoverHealthy(nodeMetrics),
        selectedNodeId:
          state.selectedNodeId && listed.has(state.selectedNodeId)
            ? state.selectedNodeId
            : null,
      };
    }),
  setNetworkSnapshot: ({ totals, genesisMs, registryAddress }) =>
    set({ networkTotals: totals, networkGenesisMs: genesisMs, registryAddress }),
  setGlobeStyle: (style) => set({ globeStyle: style }),
  setClusterConnected: (c) => set({ clusterConnected: c }),
  setMockMode: (m) => set({ mockMode: m }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setNodeReputation: (rankings) =>
    set(() => {
      const map = new Map<string, NodeReputation>();
      for (const r of rankings) map.set(r.address, r);
      return { nodeReputation: map };
    }),

  setNodeMetrics: (nodeId, m) =>
    set((state) => {
      // Metrics for a node outside the list (e.g. a deregistered node the
      // indexer still scrapes) would leak into the headline sums.
      if (!state.nodes.some((n) => n.address === nodeId)) return {};

      const newMetrics = new Map(state.nodeMetrics).set(nodeId, m);
      const newReachable = new Map(state.nodeMetricsReachable).set(nodeId, true);

      return {
        nodeMetrics: newMetrics,
        nodeMetricsReachable: newReachable,
        clusterCoverHealthy: isCoverHealthy(newMetrics),
      };
    }),

  addNodeEvent: (nodeId, e) =>
    set((state) => {
      if (!("timestamp" in e) || typeof e.timestamp !== "number") {
        (e as { timestamp?: number }).timestamp = Math.floor(Date.now() / 1000);
      }
      const existing = state.nodeEvents.get(nodeId) ?? [];

      // Dedup: skip if a matching event already exists in recent window
      const isDuplicate = existing.slice(0, 20).some(
        (prev) =>
          prev.kind === e.kind && JSON.stringify(prev) === JSON.stringify(e),
      );
      if (isDuplicate) return {};

      const newEvents = [e, ...existing].slice(0, MAX_EVENTS);
      state.nodeEvents.set(nodeId, newEvents);
      const newNodeEvents = new Map(state.nodeEvents);

      let newTopology = state.topology;
      if (e.kind === "topology_add") {
        state.topology.set(e.address, { address: e.address, role: e.role });
        newTopology = new Map(state.topology);
      } else if (e.kind === "topology_remove") {
        state.topology.delete(e.address);
        newTopology = new Map(state.topology);
      }

      return {
        nodeEvents: newNodeEvents,
        topology: newTopology,
      };
    }),

  setNodeMetricsReachable: (nodeId, r) =>
    set((state) => {
      if (!state.nodes.some((n) => n.address === nodeId)) return {};
      return { nodeMetricsReachable: new Map(state.nodeMetricsReachable).set(nodeId, r) };
    }),

  setNodeSseConnected: (nodeId, c) =>
    set((state) => {
      if (!state.nodes.some((n) => n.address === nodeId)) return {};
      return { nodeSseConnected: new Map(state.nodeSseConnected).set(nodeId, c) };
    }),
}));
