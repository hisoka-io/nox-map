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
  averagePeers,
  chainInfo,
  formatDuration,
  processUptimeSeconds,
  networkUptime,
  networkUptimeSeconds,
  parseGenesisMs,
  parseNetworkTotals,
  readNetworkSnapshot,
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

test("network uptime never drops below the longest-running node", () => {
  // Production on 2026-09-24: the indexer's genesis estimate (first uptime
  // check) is 2026-04-10, but fleet nodes have banked 170d 14h of uptime.
  const now = Date.UTC(2026, 8, 24, 18, 11);
  const genesis = 1_775_782_807_018;
  const maxNodeUptime = 14_742_660.4;

  const uptime = networkUptime(genesis, maxNodeUptime, now);
  assert.equal(uptime.seconds, 14_742_660);
  assert.equal(uptime.sinceMs, now - 14_742_660_000);
  assert.equal(formatSince(uptime.sinceMs!), "since Apr 2026");

  // Genesis wins once it is older than every node's uptime.
  assert.deepEqual(networkUptime(genesis, 60, genesis + 3_600_000), {
    seconds: 3_600,
    sinceMs: genesis,
  });
  // Without a genesis the longest-running node stands in, with no start date.
  assert.deepEqual(networkUptime(null, 90.7, now), { seconds: 90, sinceMs: null });
});

test("readNetworkSnapshot reads the indexer's sync status and totals baseline", () => {
  const now = Date.UTC(2026, 8, 24);
  const snapshot = readNetworkSnapshot(
    {
      metrics: { "0xa": { packetsReceived: 10, exitEcho: 1, exitHttp: 2 } },
      network_totals: { packetsReceived: 500, exitEcho: 4 },
      network_genesis_ms: Date.UTC(2026, 3, 7),
      indexer: { phase: "live", verified: true, registry_address: "0xnew" },
    },
    now,
  );

  assert.equal(snapshot.registryAddress, "0xnew");
  assert.equal(snapshot.indexerPhase, "live");
  assert.equal(snapshot.verified, true);
  assert.equal(snapshot.chainId, null);
  assert.equal(snapshot.genesisMs, Date.UTC(2026, 3, 7));
  assert.deepEqual(snapshot.totals?.totals, { packetsReceived: 500, exitOps: 4 });
  assert.equal(snapshot.totals?.baseline.get("0xa")?.packetsReceived, 10);
  assert.equal(snapshot.totals?.baseline.get("0xa")?.exitOps, 3);

  // A top-level registry address takes precedence over the sync status.
  assert.equal(
    readNetworkSnapshot({ registry_address: "0xtop", indexer: { registry_address: "0xnew" } }, now)
      .registryAddress,
    "0xtop",
  );

  // Today's indexer sends none of these fields.
  assert.deepEqual(readNetworkSnapshot({ nodes: [], metrics: {} }, now), {
    totals: null,
    genesisMs: null,
    registryAddress: null,
    indexerPhase: null,
    chainId: null,
    verified: null,
  });
  assert.equal(
    readNetworkSnapshot({ indexer: { registry_address: "", phase: "starting" } }, now)
      .registryAddress,
    null,
  );
});

test("readNetworkSnapshot reads the chain and verification flag", () => {
  const now = Date.UTC(2026, 9, 2);
  const live = readNetworkSnapshot(
    { indexer: { phase: "live", chain_id: 421614, verified: false } },
    now,
  );
  assert.equal(live.chainId, 421614);
  assert.equal(live.verified, false);

  for (const chain_id of [0, -1, 1.5, "421614", null]) {
    assert.equal(readNetworkSnapshot({ indexer: { chain_id } }, now).chainId, null);
  }
  assert.equal(readNetworkSnapshot({ indexer: { verified: "yes" } }, now).verified, null);
});

test("chainInfo names the registry chain and flags testnets", () => {
  assert.deepEqual(chainInfo(421614), { name: "Arbitrum Sepolia", testnet: true });
  assert.deepEqual(chainInfo(42161), { name: "Arbitrum One", testnet: false });
  assert.deepEqual(chainInfo(5000), { name: "Chain 5000", testnet: null });
});

test("node classification", () => {
  assert.equal(isRetiredNode(node("0x1", { status: "deregistered" })), true);
  assert.equal(isRetiredNode(node("0x1", { status: "offline" })), false);
  assert.equal(isRetiredNode(node("0x1")), false);

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

test("averagePeers counts each node once instead of summing both ends", () => {
  const withPeers = (activePeers: number) => ({ activePeers }) as NodeMetrics;
  assert.equal(averagePeers([withPeers(12), withPeers(12), withPeers(9)]), 11);
  assert.equal(averagePeers([]), null);
});

test("processUptimeSeconds reads the node start time in seconds or milliseconds", () => {
  const now = Date.UTC(2026, 9, 2, 12);
  const start = Date.UTC(2026, 8, 25, 2, 31) / 1000;
  assert.equal(processUptimeSeconds(start, now), (now / 1000) - start);
  assert.equal(processUptimeSeconds(start * 1000, now), (now / 1000) - start);
  assert.equal(processUptimeSeconds(0, now), null);
  assert.equal(processUptimeSeconds(now / 1000 + 60, now), null);
});

test("formatDuration switches to days past 24 hours", () => {
  assert.equal(formatDuration(42), "42s");
  assert.equal(formatDuration(600), "10m");
  assert.equal(formatDuration(3_600 + 300), "1h 5m");
  // Lifetime uptime used to render as "4267h 19m".
  assert.equal(formatDuration(15_362_370), "177d 19h");
  assert.equal(formatDuration(86_400 * 3), "3d");
});
