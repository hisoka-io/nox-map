import { test } from "node:test";
import assert from "node:assert/strict";

import { ARC_CAPS, planArcs, type CounterSample } from "../src/store/arcPlan.ts";
import type { NodeMetrics } from "../src/store/useDashboardStore.ts";

function metrics(forwarded: number, extra: Partial<NodeMetrics> = {}): NodeMetrics {
  return {
    packetsForwarded: forwarded,
    coverLoopGenerated: 0,
    coverDropGenerated: 0,
    exitPayloadsDispatched: 0,
    ...extra,
  } as NodeMetrics;
}

test("first sight only records the counters", () => {
  const { next, spawns } = planArcs(new Map(), new Map([["0xa", metrics(5_000_000)]]));
  assert.deepEqual(spawns, []);
  assert.equal(next.get("0xa")?.relayed, 5_000_000);
});

test("counter growth spawns arcs per kind, capped per update", () => {
  const prev = planArcs(new Map(), new Map([["0xa", metrics(10)]])).next;
  const { spawns } = planArcs(
    prev,
    new Map([
      ["0xa", metrics(11, { coverLoopGenerated: 50, exitPayloadsDispatched: 2 })],
    ]),
  );
  assert.deepEqual(spawns, [
    { address: "0xa", kind: "relayed", count: 1 },
    { address: "0xa", kind: "coverLoop", count: ARC_CAPS.coverLoop },
    { address: "0xa", kind: "exit", count: 2 },
  ]);
});

test("a counter reset does not spawn arcs", () => {
  const prev = planArcs(new Map(), new Map([["0xa", metrics(100)]])).next;
  const { next, spawns } = planArcs(prev, new Map([["0xa", metrics(3)]]));
  assert.deepEqual(spawns, []);
  assert.equal(next.get("0xa")?.relayed, 3);
});

test("arcs keep coming however long the page stays open", () => {
  // The old event-count logic stalled once 200 events were buffered per node.
  let prev = new Map<string, CounterSample>();
  let forwarded = 0;
  let spawned = 0;
  for (let tick = 0; tick < 5_000; tick++) {
    forwarded += tick % 3 === 0 ? 1 : 0;
    const result = planArcs(prev, new Map([["0xa", metrics(forwarded)]]));
    prev = result.next;
    if (tick >= 4_000) spawned += result.spawns.length;
  }
  assert.ok(spawned > 300, `only ${spawned} arcs in the last 1000 updates`);
});
