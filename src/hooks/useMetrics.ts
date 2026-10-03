import type { NodeMetrics } from "../store/useDashboardStore";

/**
 * Reads the per-node metrics the indexer serves in `/v1/state.metrics` and in
 * WebSocket `METRICS` messages. Only the fields the map shows are kept; a
 * missing field reads as 0 (or empty).
 */
export function mapJsonToNodeMetrics(json: Record<string, unknown>): NodeMetrics {
  return {
    activePeers: numberMetric(json, "activePeers"),
    uptimeSeconds: numberMetric(json, "uptimeSeconds"),
    nodeStartTime: numberMetric(json, "nodeStartTime"),
    healthStatus: numberMetric(json, "healthStatus"),

    packetsReceived: numberMetric(json, "packetsReceived"),
    packetsForwarded: numberMetric(json, "packetsForwarded"),

    coverLoopGenerated: numberMetric(json, "coverLoopGenerated"),
    coverDropGenerated: numberMetric(json, "coverDropGenerated"),
    coverLoopDegraded: booleanMetric(json, "coverLoopDegraded"),
    coverDropDegraded: booleanMetric(json, "coverDropDegraded"),

    cumulativeAuthorizedRevenueUsd: numberMetric(json, "cumulativeAuthorizedRevenueUsd"),
    cumulativeCostUsd: numberMetric(json, "cumulativeCostUsd"),
    cumulativeMaximumCostUsd: numberMetric(json, "cumulativeMaximumCostUsd"),
    ethPending: numberMetric(json, "ethPending"),
    profitableCount: numberMetric(json, "profitableCount"),
    unprofitableCount: numberMetric(json, "unprofitableCount"),

    exitPayloadsDispatched: numberMetric(json, "exitPayloadsDispatched"),
    exitEcho: numberMetric(json, "exitEcho"),
    exitHttp: numberMetric(json, "exitHttp"),
    exitRpc: numberMetric(json, "exitRpc"),
    exitBroadcast: numberMetric(json, "exitBroadcast"),
    exitEthereum: numberMetric(json, "exitEthereum"),
    ethTransactionsSubmitted: numberMetric(json, "ethTransactionsSubmitted"),

    buildVersion: stringMetric(json, "buildVersion"),
  };
}

function numberMetric(json: Record<string, unknown>, key: string): number {
  const value = json[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function booleanMetric(json: Record<string, unknown>, key: string): boolean {
  const value = json[key];
  return typeof value === "boolean" ? value : numberMetric(json, key) >= 1;
}

function stringMetric(json: Record<string, unknown>, key: string): string {
  const value = json[key];
  return typeof value === "string" ? value.trim() : "";
}
