import type { NodeMetrics } from "./useDashboardStore";

/**
 * Packet arcs are driven by growth in each node's counters between metric
 * updates, so they keep animating for as long as the counters move, however
 * long the tab stays open. Sources and destinations are drawn symbolically:
 * the mixnet does not reveal real paths.
 */
export type ArcKind = "relayed" | "coverLoop" | "coverDrop" | "exit";

export type CounterSample = Record<ArcKind, number>;

/** Most arcs of each kind spawned for one node per metric update. */
export const ARC_CAPS: Record<ArcKind, number> = {
  relayed: 3,
  coverLoop: 3,
  coverDrop: 2,
  exit: 2,
};

const KINDS = Object.keys(ARC_CAPS) as ArcKind[];

export function sampleCounters(m: NodeMetrics): CounterSample {
  return {
    relayed: m.packetsForwarded,
    coverLoop: m.coverLoopGenerated,
    coverDrop: m.coverDropGenerated,
    exit: m.exitPayloadsDispatched,
  };
}

export interface ArcSpawn {
  address: string;
  kind: ArcKind;
  count: number;
}

/**
 * Compares the current counters with the previous sample of each node.
 * A node seen for the first time is only sampled, so the indexer's lifetime
 * totals do not produce a burst. A counter that went down (node restart) is
 * resampled without spawning arcs.
 */
export function planArcs(
  previous: Map<string, CounterSample>,
  metrics: Map<string, NodeMetrics>,
): { next: Map<string, CounterSample>; spawns: ArcSpawn[] } {
  const next = new Map<string, CounterSample>();
  const spawns: ArcSpawn[] = [];

  for (const [address, m] of metrics) {
    const current = sampleCounters(m);
    next.set(address, current);
    const before = previous.get(address);
    if (!before) continue;

    for (const kind of KINDS) {
      const delta = current[kind] - before[kind];
      if (!(delta > 0)) continue;
      spawns.push({ address, kind, count: Math.min(Math.ceil(delta), ARC_CAPS[kind]) });
    }
  }

  return { next, spawns };
}
