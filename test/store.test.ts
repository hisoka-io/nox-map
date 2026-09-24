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
  store().setNodeSseConnected("0xgone", true);
  store().setSelectedNodeId("0xgone");

  store().setNodes([node("0xa"), node("0xgone", { status: "deregistered" })]);

  assert.deepEqual(addresses(), ["0xa"]);
  assert.deepEqual([...store().nodeMetrics.keys()], ["0xa"]);
  assert.deepEqual([...store().nodeMetricsReachable.keys()], ["0xa"]);
  assert.equal(store().nodeSseConnected.has("0xgone"), false);
  assert.equal(store().selectedNodeId, null);
});

test("per-node updates for unlisted nodes are ignored", () => {
  store().setNodes([node("0xa")]);

  store().setNodeMetrics("0xstale", metrics(5));
  store().setNodeMetricsReachable("0xstale", true);
  store().setNodeSseConnected("0xstale", true);

  assert.equal(store().nodeMetrics.size, 0);
  assert.equal(store().nodeMetricsReachable.size, 0);
  assert.equal(store().nodeSseConnected.size, 0);
});

test("nodes from another registry are dropped once the snapshot names one", () => {
  store().setNetworkSnapshot(snapshot({ phase: "live", registry_address: "0xNEW" }));
  store().setNodes([
    node("0xa", { registry_address: "0xnew" }),
    node("0xb", { registry_address: "0xold" }),
    node("0xc"),
  ]);
  assert.deepEqual(addresses(), ["0xa", "0xc"]);
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
