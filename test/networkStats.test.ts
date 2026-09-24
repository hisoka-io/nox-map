import { test } from "node:test";
import assert from "node:assert/strict";

import {
  averageReputation,
  computeHeadline,
  formatSince,
  headlineFromMetrics,
  isFrozenNode,
  isOnlineNode,
  isRetiredNode,
  networkUptimeSeconds,
  parseGenesisMs,
  parseNetworkTotals,
} from "../src/store/networkStats.ts";
import type { NodeInfo, NodeMetrics } from "../src/store/useDashboardStore.ts";

// Only the counters the headline reads; the rest of NodeMetrics is unused here.
function metrics(values: Partial<NodeMetrics>): NodeMetrics {
  return {
    packetsReceived: 0,
    packetsForwarded: 0,
    exitEcho: 0,
    exitHttp: 0,
    exitRpc: 0,
    exitBroadcast: 0,
    exitEthereum: 0,
    coverLoopGenerated: 0,
    coverDropGenerated: 0,
    ...values,
  } as NodeMetrics;
}

function node(address: string, extra: Partial<NodeInfo> = {}): NodeInfo {
  return {
    id: `nox-${address.slice(2, 10)}`,
    address,
    role: 1,
    layer: 0,
    admin_port: 15001,
    ingress_port: 15002,
    p2p_addr: "",
    status: "online",
    ...extra,
  };
}

test("without network totals the headline is the per-node sum", () => {
  const live = new Map([
    ["0xa", metrics({ packetsReceived: 10, exitEcho: 1, exitHttp: 2, exitEthereum: 1 })],
    ["0xb", metrics({ packetsReceived: 5, exitRpc: 3, exitBroadcast: 4, coverLoopGenerated: 7 })],
  ]);

  assert.deepEqual(computeHeadline(live, null), {
    packetsReceived: 15,
    packetsForwarded: 0,
    exitOps: 10,
    exitEthereum: 1,
    coverLoopGenerated: 7,
    coverDropGenerated: 0,
  });
});

test("network totals win and live growth since the snapshot is added", () => {
  const baseline = new Map([
    ["0xa", headlineFromMetrics(metrics({ packetsReceived: 100, packetsForwarded: 50 }))],
  ]);
  const live = new Map([
    ["0xa", metrics({ packetsReceived: 130, packetsForwarded: 40 })],
    // First seen after the snapshot: only counted once the next poll lands.
    ["0xnew", metrics({ packetsReceived: 999 })],
  ]);

  const headline = computeHeadline(live, {
    totals: { packetsReceived: 5_000, packetsForwarded: 4_000 },
    baseline,
  });

  assert.equal(headline.packetsReceived, 5_030);
  // A counter that went backwards never lowers the total.
  assert.equal(headline.packetsForwarded, 4_000);
});

test("a field missing from network totals falls back to the per-node sum", () => {
  const live = new Map([
    ["0xa", metrics({ exitEthereum: 2 })],
    ["0xb", metrics({ exitEthereum: 3 })],
  ]);

  const headline = computeHeadline(live, {
    totals: { packetsReceived: 1 },
    baseline: new Map(),
  });

  assert.equal(headline.exitEthereum, 5);
  assert.equal(headline.packetsReceived, 1);
});

test("parseNetworkTotals reads camelCase, snake_case and derives exit ops", () => {
  assert.equal(parseNetworkTotals(undefined), null);
  assert.equal(parseNetworkTotals([]), null);
  assert.equal(parseNetworkTotals({}), null);
  assert.equal(parseNetworkTotals({ packetsReceived: "12" }), null);

  assert.deepEqual(
    parseNetworkTotals({
      packetsReceived: 12,
      packets_forwarded: 11,
      exitEcho: 1,
      exit_http: 2,
      exitRpc: 3,
      coverLoopGenerated: 4,
    }),
    { packetsReceived: 12, packetsForwarded: 11, exitOps: 6, coverLoopGenerated: 4 },
  );

  assert.equal(parseNetworkTotals({ exitOps: 9, exitEcho: 1 })?.exitOps, 9);
});

test("parseGenesisMs accepts ms or seconds and rejects future or junk values", () => {
  const now = Date.UTC(2026, 8, 24);
  const genesis = Date.UTC(2026, 3, 3);

  assert.equal(parseGenesisMs(genesis, now), genesis);
  assert.equal(parseGenesisMs(genesis / 1000, now), genesis);
  assert.equal(parseGenesisMs(now + 60_000, now), null);
  assert.equal(parseGenesisMs(undefined, now), null);
  assert.equal(parseGenesisMs(0, now), null);
  assert.equal(parseGenesisMs("1775174400000", now), null);
});

test("network uptime counts from genesis", () => {
  const genesis = Date.UTC(2026, 3, 3);
  assert.equal(networkUptimeSeconds(genesis, genesis + 90_500), 90);
  assert.equal(networkUptimeSeconds(genesis, genesis - 1), 0);
  assert.equal(formatSince(genesis), "since Apr 2026");
});

test("node classification", () => {
  const registry = "0xABC";

  assert.equal(isRetiredNode(node("0x1", { status: "deregistered" }), null), true);
  assert.equal(isRetiredNode(node("0x1", { status: "offline" }), null), false);
  assert.equal(isRetiredNode(node("0x1", { registry_address: "0xabc" }), registry), false);
  assert.equal(isRetiredNode(node("0x1", { registry_address: "0xdef" }), registry), true);
  // Registry filtering only applies when both sides report an address.
  assert.equal(isRetiredNode(node("0x1", { registry_address: "0xdef" }), null), false);
  assert.equal(isRetiredNode(node("0x1"), registry), false);

  assert.equal(isOnlineNode(node("0x1")), true);
  assert.equal(isOnlineNode(node("0x1", { status: undefined })), true);
  assert.equal(isOnlineNode(node("0x1", { status: "offline" })), false);
  assert.equal(isOnlineNode(node("0x1", { frozen: true })), false);
  assert.equal(isFrozenNode(node("0x1", { frozen: true })), true);
  assert.equal(isFrozenNode(node("0x1", { status: "frozen" })), true);
  assert.equal(isFrozenNode(node("0x1", { frozen: false })), false);
});

test("reputation average covers listed nodes only", () => {
  const rep = (address: string, score: number) => ({
    address,
    score,
    streak: 0,
    totalChecks: 0,
    passedChecks: 0,
  });
  const reputation = new Map([
    ["0x1", rep("0x1", 100)],
    ["0x2", rep("0x2", 90)],
    ["0xgone", rep("0xgone", 0)],
  ]);

  assert.deepEqual(averageReputation([node("0x1"), node("0x2"), node("0x3")], reputation), {
    average: 95,
    count: 2,
  });
  assert.deepEqual(averageReputation([], reputation), { average: null, count: 0 });
});
