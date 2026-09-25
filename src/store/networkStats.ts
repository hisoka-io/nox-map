import type { NodeInfo, NodeMetrics, NodeReputation } from "./useDashboardStore";
// Explicit .ts extensions let node's test runner load this module directly.
import { mapJsonToNodeMetrics } from "../hooks/useMetrics.ts";

/**
 * Lifetime counters shown in the headline cards and the bottom ticker.
 *
 * The indexer may report these as `network_totals` on `/v1/state` (camelCase
 * keys, snake_case tolerated). Unlike a sum over the current node list, those
 * totals keep counting traffic from nodes that have left the registry, so the
 * headline numbers do not drop when a node is deregistered or the network
 * moves to a new registry.
 */
export interface HeadlineTotals {
  packetsReceived: number;
  packetsForwarded: number;
  /** Echo + HTTP + RPC + broadcast exit payloads. */
  exitOps: number;
  exitEthereum: number;
  coverLoopGenerated: number;
  coverDropGenerated: number;
}

const HEADLINE_KEYS: (keyof HeadlineTotals)[] = [
  "packetsReceived",
  "packetsForwarded",
  "exitOps",
  "exitEthereum",
  "coverLoopGenerated",
  "coverDropGenerated",
];

const EXIT_OPS_PARTS = ["exitEcho", "exitHttp", "exitRpc", "exitBroadcast"];

/**
 * Indexer totals plus the per-node counters from the same `/v1/state`
 * response. Live per-node growth since that response is added on top, so the
 * counters keep ticking between polls.
 */
export interface NetworkTotalsSnapshot {
  /** A field missing here falls back to the live per-node sum. */
  totals: Partial<HeadlineTotals>;
  baseline: Map<string, HeadlineTotals>;
}

export function headlineFromMetrics(m: NodeMetrics): HeadlineTotals {
  return {
    packetsReceived: m.packetsReceived,
    packetsForwarded: m.packetsForwarded,
    exitOps: m.exitEcho + m.exitHttp + m.exitRpc + m.exitBroadcast,
    exitEthereum: m.exitEthereum,
    coverLoopGenerated: m.coverLoopGenerated,
    coverDropGenerated: m.coverDropGenerated,
  };
}

export function computeHeadline(
  nodeMetrics: Map<string, NodeMetrics>,
  snapshot: NetworkTotalsSnapshot | null,
): HeadlineTotals {
  const result: HeadlineTotals = {
    packetsReceived: 0,
    packetsForwarded: 0,
    exitOps: 0,
    exitEthereum: 0,
    coverLoopGenerated: 0,
    coverDropGenerated: 0,
  };

  for (const key of HEADLINE_KEYS) {
    result[key] = snapshot?.totals[key] ?? 0;
  }

  for (const [address, metrics] of nodeMetrics) {
    const live = headlineFromMetrics(metrics);
    const base = snapshot?.baseline.get(address);
    for (const key of HEADLINE_KEYS) {
      if (snapshot?.totals[key] === undefined) {
        result[key] += live[key];
      } else if (base) {
        // Nodes first seen after the snapshot are picked up by the next poll.
        result[key] += Math.max(0, live[key] - base[key]);
      }
    }
  }

  return result;
}

function readNumber(json: Record<string, unknown>, key: string): number | undefined {
  const snake = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  for (const k of [key, snake]) {
    const value = json[k];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

/** Parses `/v1/state.network_totals`; returns null when absent (older indexer). */
export function parseNetworkTotals(raw: unknown): Partial<HeadlineTotals> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const json = raw as Record<string, unknown>;
  const totals: Partial<HeadlineTotals> = {};

  for (const key of HEADLINE_KEYS) {
    const value = readNumber(json, key);
    if (value !== undefined) totals[key] = value;
  }

  if (totals.exitOps === undefined) {
    const parts = EXIT_OPS_PARTS.map((k) => readNumber(json, k));
    if (parts.some((v) => v !== undefined)) {
      totals.exitOps = parts.reduce<number>((a, v) => a + (v ?? 0), 0);
    }
  }

  return Object.keys(totals).length > 0 ? totals : null;
}

/** The network-wide fields of `/v1/state`; every field is null on older indexers. */
export interface NetworkSnapshot {
  totals: NetworkTotalsSnapshot | null;
  genesisMs: number | null;
  /** The registry the indexer follows. */
  registryAddress: string | null;
  /** `.indexer.phase`: "starting", "syncing", "retrying" or "live". */
  indexerPhase: string | null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Reads the optional network-wide fields of a `/v1/state` response. The
 * totals baseline comes from the same response's `metrics`, so live growth is
 * measured from the point the totals describe.
 */
export function readNetworkSnapshot(
  data: Record<string, unknown>,
  nowMs: number,
): NetworkSnapshot {
  const parsed = parseNetworkTotals(data.network_totals);
  let totals: NetworkTotalsSnapshot | null = null;
  if (parsed) {
    const baseline = new Map<string, HeadlineTotals>();
    const metrics = (data.metrics ?? {}) as Record<string, Record<string, unknown>>;
    for (const [address, json] of Object.entries(metrics)) {
      baseline.set(address, headlineFromMetrics(mapJsonToNodeMetrics(json)));
    }
    totals = { totals: parsed, baseline };
  }

  // The indexer reports the registry it follows inside its sync status.
  const indexer =
    data.indexer && typeof data.indexer === "object"
      ? (data.indexer as Record<string, unknown>)
      : {};

  return {
    totals,
    genesisMs: parseGenesisMs(data.network_genesis_ms, nowMs),
    registryAddress: readString(data.registry_address) ?? readString(indexer.registry_address),
    indexerPhase: readString(indexer.phase),
  };
}

/**
 * Parses `/v1/state.network_genesis_ms` (tolerating unix seconds). Returns
 * null when absent, invalid or in the future.
 */
export function parseGenesisMs(raw: unknown, nowMs: number): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return null;
  const ms = raw < 1e11 ? raw * 1000 : raw;
  return ms <= nowMs ? ms : null;
}

export function networkUptimeSeconds(genesisMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - genesisMs) / 1000));
}

/**
 * Network uptime, counted from the indexer's genesis but never below the
 * longest-running node. Genesis is estimated from uptime-check history, which
 * starts after the first node did, while a node's banked uptime is a lower
 * bound on the network's age. Without a genesis the longest-running node
 * stands in, and there is no start date to show.
 */
export function networkUptime(
  genesisMs: number | null,
  maxNodeUptimeSeconds: number,
  nowMs: number,
): { seconds: number; sinceMs: number | null } {
  const nodeSeconds = Math.max(0, Math.floor(maxNodeUptimeSeconds));
  if (genesisMs == null) return { seconds: nodeSeconds, sinceMs: null };
  const seconds = Math.max(networkUptimeSeconds(genesisMs, nowMs), nodeSeconds);
  return { seconds, sinceMs: nowMs - seconds * 1000 };
}

export function formatSince(genesisMs: number): string {
  const label = new Date(genesisMs).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `since ${label}`;
}

/** Registered but barred from routing by the registry (NoxRegistry v2). */
export function isFrozenNode(node: NodeInfo): boolean {
  return node.frozen === true || node.status === "frozen";
}

export function isOnlineNode(node: NodeInfo): boolean {
  return (!node.status || node.status === "online") && !isFrozenNode(node);
}

/**
 * Deregistered, or known to belong to a registry other than the one the
 * indexer currently follows. Such nodes are dropped from the map entirely.
 */
export function isRetiredNode(node: NodeInfo, registryAddress: string | null): boolean {
  if (node.status === "deregistered") return true;
  return (
    !!registryAddress &&
    !!node.registry_address &&
    node.registry_address.toLowerCase() !== registryAddress.toLowerCase()
  );
}

/** Average reputation over the listed nodes only. */
export function averageReputation(
  nodes: NodeInfo[],
  reputation: Map<string, NodeReputation>,
): { average: number | null; count: number } {
  const scores: number[] = [];
  for (const n of nodes) {
    const r = reputation.get(n.address);
    if (r) scores.push(r.score);
  }
  if (scores.length === 0) return { average: null, count: 0 };
  const sum = scores.reduce((a, b) => a + b, 0);
  return { average: Math.round(sum / scores.length), count: scores.length };
}
