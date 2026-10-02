import { create } from "zustand";
// Explicit .ts extension so node's test runner can load the store.
import {
  isRetiredNode,
  type NetworkSnapshot,
  type NetworkTotalsSnapshot,
} from "./networkStats.ts";
import { routingLayer } from "./layers.ts";

export interface NodeInfo {
  id: string;
  address: string;
  role: number; // on-chain role: 1=Relay, 2=Exit, 3=Full
  /**
   * Mix layer, 0=Entry, 1=Mix, 2=Exit. The store derives it from the on-chain
   * role and address (see routingLayer) rather than trusting the reported value.
   */
  layer: number;
  admin_port: number;
  ingress_port: number;
  p2p_addr: string;
  status?: string; // "online" | "offline" | "deregistered"
  frozen?: boolean; // registered but barred from routing (NoxRegistry v2)
  latitude?: number | null; // GeoIP of the node's public IP; 0,0 when unknown
  longitude?: number | null;
}

export interface NodeMetrics {
  activePeers: number;
  /** Lifetime online time banked by the indexer across restarts. */
  uptimeSeconds: number;
  /** Unix seconds when the node process started; 0 when unknown. */
  nodeStartTime: number;
  healthStatus: number; // 0=unhealthy, 1=degraded, 2=healthy

  packetsReceived: number;
  packetsForwarded: number;

  coverLoopGenerated: number;
  coverDropGenerated: number;
  coverLoopDegraded: boolean;
  coverDropDegraded: boolean;

  cumulativeAuthorizedRevenueUsd: number;
  cumulativeCostUsd: number;
  cumulativeMaximumCostUsd: number;
  ethPending: number;
  profitableCount: number;
  unprofitableCount: number;

  exitPayloadsDispatched: number;
  exitEcho: number;
  exitHttp: number;
  exitRpc: number;
  exitBroadcast: number;
  exitEthereum: number;
  ethTransactionsSubmitted: number;

  /** Empty when the node does not report it. */
  buildVersion: string;
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
export type SseEvent =
  | NodeStartedEvent
  | PeerConnectedEvent
  | PeerDisconnectedEvent
  | TopologyAddEvent
  | TopologyRemoveEvent;

/** Event kinds the map lists. Per-packet events are ignored. */
const LISTED_EVENT_KINDS = new Set<string>([
  "node_started",
  "peer_connected",
  "peer_disconnected",
  "topology_add",
  "topology_remove",
]);

/** Traffic a node reported between two metric updates. */
export interface ActivityEntry {
  address: string;
  relayed: number;
  exits: number;
  /** Unix seconds. */
  timestamp: number;
}

export interface NodeReputation {
  address: string;
  score: number;
  streak: number;
  totalChecks: number;
  passedChecks: number;
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
  activity: ActivityEntry[];

  nodeReputation: Map<string, NodeReputation>;
  clusterCoverHealthy: boolean;

  networkTotals: NetworkTotalsSnapshot | null;
  networkGenesisMs: number | null;
  registryAddress: string | null;
  indexerPhase: string | null;
  chainId: number | null;
  registryVerified: boolean | null;

  setNodes: (nodes: NodeInfo[]) => void;
  setNetworkSnapshot: (snapshot: NetworkSnapshot) => void;
  setClusterConnected: (c: boolean) => void;
  setMockMode: (m: boolean) => void;
  setSelectedNodeId: (id: string | null) => void;
  setNodeMetrics: (nodeId: string, m: NodeMetrics) => void;
  addNodeEvent: (nodeId: string, e: unknown) => void;
  setNodeReputation: (rankings: NodeReputation[]) => void;
  setGlobeStyle: (style: GlobeStyle) => void;
}

export const DEFAULT_METRICS: NodeMetrics = {
  activePeers: 0,
  uptimeSeconds: 0,
  nodeStartTime: 0,
  healthStatus: 0,
  packetsReceived: 0,
  packetsForwarded: 0,
  coverLoopGenerated: 0,
  coverDropGenerated: 0,
  coverLoopDegraded: false,
  coverDropDegraded: false,
  cumulativeAuthorizedRevenueUsd: 0,
  cumulativeCostUsd: 0,
  cumulativeMaximumCostUsd: 0,
  ethPending: 0,
  profitableCount: 0,
  unprofitableCount: 0,
  exitPayloadsDispatched: 0,
  exitEcho: 0,
  exitHttp: 0,
  exitRpc: 0,
  exitBroadcast: 0,
  exitEthereum: 0,
  ethTransactionsSubmitted: 0,
  buildVersion: "",
};

const MAX_EVENTS = 50;
const MAX_ACTIVITY = 40;

function pickListed<V>(map: Map<string, V>, listed: Set<string>): Map<string, V> {
  const next = new Map<string, V>();
  for (const [address, value] of map) {
    if (listed.has(address)) next.set(address, value);
  }
  return next.size === map.size ? map : next;
}

// Plain code-unit order, as the indexer sorts `/v1/state.nodes`.
function byAddress(a: NodeInfo, b: NodeInfo): number {
  return a.address < b.address ? -1 : a.address > b.address ? 1 : 0;
}

function isCoverHealthy(metrics: Map<string, NodeMetrics>): boolean {
  for (const m of metrics.values()) {
    if (m.coverLoopDegraded || m.coverDropDegraded) return false;
  }
  return true;
}

// A jump this large between two updates is a counter rebase (e.g. the
// indexer re-banking lifetime totals), not traffic.
const MAX_ACTIVITY_STEP = 50_000;

function growth(after: number, before: number): number {
  const d = after - before;
  return d > 0 && d <= MAX_ACTIVITY_STEP ? Math.round(d) : 0;
}

function normalizeNode(n: NodeInfo): NodeInfo {
  const address = String(n.address ?? "").toLowerCase();
  return { ...n, address, layer: routingLayer(Number(n.role), address) };
}

export const useDashboardStore = create<DashboardState>((set) => ({
  nodes: [],
  clusterConnected: false,
  mockMode: false,
  selectedNodeId: null,
  globeStyle: "day",

  nodeMetrics: new Map(),
  nodeEvents: new Map(),
  activity: [],

  nodeReputation: new Map(),
  clusterCoverHealthy: true,

  networkTotals: null,
  networkGenesisMs: null,
  registryAddress: null,
  indexerPhase: null,
  chainId: null,
  registryVerified: null,

  // Deregistered nodes are dropped, and per-node state for any node that
  // leaves the list is cleared so it no longer feeds sums or averages.
  setNodes: (incoming) =>
    set((state) => {
      const nodes = incoming
        .filter((n) => n && typeof n.address === "string" && !isRetiredNode(n))
        .map(normalizeNode)
        // Positions are assigned in list order, and the indexer's REST and
        // WebSocket lists arrive in different orders.
        .sort(byAddress);

      // During its first sync of a new registry the indexer reports no nodes.
      // Keep the current list until it is live instead of blanking the map.
      if (nodes.length === 0 && state.nodes.length > 0 && state.indexerPhase !== "live") {
        return {};
      }

      const listed = new Set(nodes.map((n) => n.address));
      const nodeMetrics = pickListed(state.nodeMetrics, listed);
      return {
        nodes,
        nodeMetrics,
        nodeEvents: pickListed(state.nodeEvents, listed),
        activity: state.activity.filter((a) => listed.has(a.address)),
        clusterCoverHealthy: isCoverHealthy(nodeMetrics),
        selectedNodeId:
          state.selectedNodeId && listed.has(state.selectedNodeId)
            ? state.selectedNodeId
            : null,
      };
    }),
  setNetworkSnapshot: ({ totals, genesisMs, registryAddress, indexerPhase, chainId, verified }) =>
    set({
      networkTotals: totals,
      networkGenesisMs: genesisMs,
      registryAddress,
      indexerPhase,
      chainId,
      registryVerified: verified,
    }),
  setGlobeStyle: (style) => set({ globeStyle: style }),
  setClusterConnected: (c) => set({ clusterConnected: c }),
  setMockMode: (m) => set({ mockMode: m }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setNodeReputation: (rankings) =>
    set(() => {
      const map = new Map<string, NodeReputation>();
      for (const r of rankings) map.set(r.address.toLowerCase(), r);
      return { nodeReputation: map };
    }),

  setNodeMetrics: (nodeId, m) =>
    set((state) => {
      const address = nodeId.toLowerCase();
      // Metrics for a node outside the list (e.g. a deregistered node the
      // indexer still scrapes) would leak into the headline sums.
      if (!state.nodes.some((n) => n.address === address)) return {};

      const newMetrics = new Map(state.nodeMetrics).set(address, m);
      const update: Partial<DashboardState> = {
        nodeMetrics: newMetrics,
        clusterCoverHealthy: isCoverHealthy(newMetrics),
      };

      const before = state.nodeMetrics.get(address);
      if (before) {
        const relayed = growth(m.packetsForwarded, before.packetsForwarded);
        const exits = growth(m.exitPayloadsDispatched, before.exitPayloadsDispatched);
        if (relayed > 0 || exits > 0) {
          const entry: ActivityEntry = {
            address,
            relayed,
            exits,
            timestamp: Math.floor(Date.now() / 1000),
          };
          update.activity = [entry, ...state.activity].slice(0, MAX_ACTIVITY);
        }
      }

      return update;
    }),

  addNodeEvent: (nodeId, raw) =>
    set((state) => {
      if (!raw || typeof raw !== "object") return {};
      const kind = (raw as { kind?: unknown }).kind;
      if (typeof kind !== "string" || !LISTED_EVENT_KINDS.has(kind)) return {};

      const address = nodeId.toLowerCase();
      if (!state.nodes.some((n) => n.address === address)) return {};

      const e = { ...(raw as SseEvent) };
      if (typeof e.timestamp !== "number") e.timestamp = Math.floor(Date.now() / 1000);

      const existing = state.nodeEvents.get(address) ?? [];
      // Skip an event already among the most recent ones (REST backlog and
      // WebSocket can overlap).
      const key = JSON.stringify(e);
      if (existing.slice(0, 20).some((prev) => JSON.stringify(prev) === key)) return {};

      const nodeEvents = new Map(state.nodeEvents);
      nodeEvents.set(address, [e, ...existing].slice(0, MAX_EVENTS));
      return { nodeEvents };
    }),
}));
