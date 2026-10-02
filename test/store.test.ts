import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_METRICS,
  useDashboardStore,
  type NodeInfo,
  type NodeMetrics,
} from "../src/store/useDashboardStore.ts";
import { readNetworkSnapshot } from "../src/store/networkStats.ts";

const initialState = useDashboardStore.getInitialState();
const store = () => useDashboardStore.getState();

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

function metrics(packetsReceived: number): NodeMetrics {
  return { ...DEFAULT_METRICS, packetsReceived };
}

function addresses(): string[] {
  return store().nodes.map((n) => n.address);
}

function snapshot(indexer: Record<string, unknown> | undefined) {
  return readNetworkSnapshot(indexer ? { indexer } : {}, Date.now());
}

beforeEach(() => {
  useDashboardStore.setState(initialState, true);
});

test("setNodes lists nodes in address order whatever order they arrive in", () => {
  store().setNodes([node("0xc"), node("0xa"), node("0xb")]);
  assert.deepEqual(addresses(), ["0xa", "0xb", "0xc"]);

  store().setNodes([node("0xb"), node("0xc"), node("0xa")]);
  assert.deepEqual(addresses(), ["0xa", "0xb", "0xc"]);
});

test("a node leaving the list takes its metrics and selection with it", () => {
  store().setNodes([node("0xa"), node("0xgone")]);
  store().setNodeMetrics("0xa", metrics(1));
  store().setNodeMetrics("0xgone", metrics(2));
  store().addNodeEvent("0xgone", { kind: "node_started", timestamp: 1 });
  store().setSelectedNodeId("0xgone");

  store().setNodes([node("0xa"), node("0xgone", { status: "deregistered" })]);

  assert.deepEqual(addresses(), ["0xa"]);
  assert.deepEqual([...store().nodeMetrics.keys()], ["0xa"]);
  assert.equal(store().nodeEvents.has("0xgone"), false);
  assert.equal(store().selectedNodeId, null);
});

test("per-node updates for unlisted nodes are ignored", () => {
  store().setNodes([node("0xa")]);

  store().setNodeMetrics("0xstale", metrics(5));
  store().addNodeEvent("0xstale", { kind: "node_started", timestamp: 1 });

  assert.equal(store().nodeMetrics.size, 0);
  assert.equal(store().nodeEvents.size, 0);
});

test("the layer comes from the on-chain role, not the reported layer", () => {
  // Live registry nodes; every one was reported at layer 0 by the indexer.
  store().setNodes([
    node("0x03a42846c18b99c453a49d7fce69f336f865c48b", { role: 2, layer: 0 }),
    node("0x074a13b271b73eb5c0c44e2037d035e7eef4a462", { role: 1, layer: 0 }),
    node("0x8C9FB3E9FE537067C8430480F80A4A5B9A12BE1A", { role: 1, layer: 0 }),
  ]);
  const layers = Object.fromEntries(store().nodes.map((n) => [n.address.slice(0, 10), n.layer]));
  assert.equal(layers["0x03a42846"], 2);
  // Addresses are normalized to lowercase; relays split across layers 0 and 1.
  assert.equal(layers["0x8c9fb3e9"], 1);
  assert.equal(layers["0x074a13b2"], 0);
});

test("per-packet events are not kept; node and peer events are", () => {
  store().setNodes([node("0xa")]);
  store().addNodeEvent("0xa", { kind: "packet_processed", duration_ms: 42, node_address: "0xa" });
  store().addNodeEvent("0xa", { kind: "something_new" });
  store().addNodeEvent("0xa", null);
  assert.equal(store().nodeEvents.size, 0);

  store().addNodeEvent("0xA", { kind: "peer_connected", peer_id: "12D3KooWabc", timestamp: 5 });
  store().addNodeEvent("0xa", { kind: "peer_connected", peer_id: "12D3KooWabc", timestamp: 5 });
  assert.equal(store().nodeEvents.get("0xa")?.length, 1);
});

test("metric updates record relayed packets and exit payloads as activity", () => {
  store().setNodes([node("0xa")]);
  store().setNodeMetrics("0xa", { ...DEFAULT_METRICS, packetsForwarded: 100, exitPayloadsDispatched: 7 });
  // The first sample only sets the baseline.
  assert.equal(store().activity.length, 0);

  store().setNodeMetrics("0xa", { ...DEFAULT_METRICS, packetsForwarded: 104, exitPayloadsDispatched: 8 });
  store().setNodeMetrics("0xa", { ...DEFAULT_METRICS, packetsForwarded: 104, exitPayloadsDispatched: 8 });
  // A restart resets the counters; that is not traffic.
  store().setNodeMetrics("0xa", { ...DEFAULT_METRICS, packetsForwarded: 3, exitPayloadsDispatched: 0 });

  // Nor is a jump of millions when lifetime totals are rebased.
  store().setNodeMetrics("0xa", { ...DEFAULT_METRICS, packetsForwarded: 5_000_000 });
  store().setNodeMetrics("0xa", { ...DEFAULT_METRICS, packetsForwarded: 3 });

  assert.equal(store().activity.length, 1);
  assert.deepEqual(
    { ...store().activity[0], timestamp: 0 },
    { address: "0xa", relayed: 4, exits: 1, timestamp: 0 },
  );

  // Activity is bounded however long the page stays open.
  for (let i = 1; i <= 500; i++) {
    store().setNodeMetrics("0xa", { ...DEFAULT_METRICS, packetsForwarded: 3 + i });
  }
  assert.ok(store().activity.length <= 40);
  assert.equal(store().activity[0].relayed, 1);
});

test("an empty list is held until the indexer reports it is live", () => {
  store().setNodes([node("0xa"), node("0xb")]);

  // Today's indexer reports no phase; a redeployed one starts syncing.
  store().setNodes([]);
  assert.deepEqual(addresses(), ["0xa", "0xb"]);
  store().setNetworkSnapshot(snapshot({ phase: "syncing", registry_address: "0xnew" }));
  store().setNodes([]);
  assert.deepEqual(addresses(), ["0xa", "0xb"]);

  // The first non-empty list replaces the held one straight away.
  store().setNodes([node("0xc")]);
  assert.deepEqual(addresses(), ["0xc"]);

  // Once live, an empty registry really is empty.
  store().setNetworkSnapshot(snapshot({ phase: "live", registry_address: "0xnew" }));
  store().setNodes([]);
  assert.deepEqual(addresses(), []);
});
