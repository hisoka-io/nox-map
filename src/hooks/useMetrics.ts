import type { NodeMetrics } from "../store/useDashboardStore";

export function mapJsonToNodeMetrics(json: Record<string, unknown>): NodeMetrics {
  return {
    activePeers: numberMetric(json, "activePeers"),
    uptimeSeconds: numberMetric(json, "uptimeSeconds"),
    healthStatus: numberMetric(json, "healthStatus"),

    packetsReceived: numberMetric(json, "packetsReceived"),
    packetsForwarded: numberMetric(json, "packetsForwarded"),
    dummyPacketsDropped: numberMetric(json, "dummyPacketsDropped"),

    workerQueueDepth: numberMetric(json, "workerQueueDepth"),
    mixQueueDepth: numberMetric(json, "mixQueueDepth"),
    egressQueueDepth: numberMetric(json, "egressQueueDepth"),
    ingestDropped: numberMetric(json, "ingestDropped"),
    ingestDroppedBackpressure: numberMetric(json, "ingestDroppedBackpressure"),

    coverLoopGenerated: numberMetric(json, "coverLoopGenerated"),
    coverDropGenerated: numberMetric(json, "coverDropGenerated"),
    coverLoopDegraded: booleanMetric(json, "coverLoopDegraded"),
    coverDropDegraded: booleanMetric(json, "coverDropDegraded"),
    coverErrors: numberMetric(json, "coverErrors"),

    cumulativeAuthorizedRevenueUsd: numberMetric(json, "cumulativeAuthorizedRevenueUsd"),
    cumulativeCostUsd: numberMetric(json, "cumulativeCostUsd"),
    cumulativeMaximumCostUsd: numberMetric(json, "cumulativeMaximumCostUsd"),
    ethPending: numberMetric(json, "ethPending"),
    profitableCount: numberMetric(json, "profitableCount"),
    unprofitableCount: numberMetric(json, "unprofitableCount"),

    exitPayloadsDispatched: numberMetric(json, "exitPayloadsDispatched"),
    exitReassemblerPending: numberMetric(json, "exitReassemblerPending"),
    exitEcho: numberMetric(json, "exitEcho"),
    exitHttp: numberMetric(json, "exitHttp"),
    exitRpc: numberMetric(json, "exitRpc"),
    exitBroadcast: numberMetric(json, "exitBroadcast"),
    exitEthereum: numberMetric(json, "exitEthereum"),
    exitTraffic: numberMetric(json, "exitTraffic"),
    ethTransactionsSubmitted: numberMetric(json, "ethTransactionsSubmitted"),
    egressForwarded: numberMetric(json, "egressForwarded"),
    egressExited: numberMetric(json, "egressExited"),

    sphinxErrors: numberMetric(json, "sphinxErrors"),
    replayNew: numberMetric(json, "replayNew"),
    replayDuplicate: numberMetric(json, "replayDuplicate"),
    p2pRateLimitDenied: numberMetric(json, "p2pRateLimitDenied"),

    topologyLayer0: numberMetric(json, "topologyLayer0"),
    topologyLayer1: numberMetric(json, "topologyLayer1"),
    topologyLayer2: numberMetric(json, "topologyLayer2"),

    chainLastBlock: numberMetric(json, "chainLastBlock"),
    chainErrors: numberMetric(json, "chainErrors"),

    processMem: numberMetric(json, "processMem"),
    processVmem: numberMetric(json, "processVmem"),
    openFds: numberMetric(json, "openFds"),

    buildVersion: stringMetric(json, "buildVersion"),
    buildRole: stringMetric(json, "buildRole"),

    ingressResponseBuffer: numberMetric(json, "ingressResponseBuffer"),

    fecSuccess:
      optionalNumberMetric(json, "fecSuccess") ??
      numberMetric(json, "fecEncodeSuccess") + numberMetric(json, "fecDecodeSuccess"),
    fecError:
      optionalNumberMetric(json, "fecError") ??
      numberMetric(json, "fecEncodeError") + numberMetric(json, "fecDecodeError"),
    fecEncodeSuccess: numberMetric(json, "fecEncodeSuccess"),
    fecDecodeError: numberMetric(json, "fecDecodeError"),

    oracleFetchStale: numberMetric(json, "oracleFetchStale"),

    latencyP50: numberMetric(json, "latencyP50"),
    latencyP95: numberMetric(json, "latencyP95"),
    latencyP99: numberMetric(json, "latencyP99"),

    peersConnectedTotal: numberMetric(json, "peersConnectedTotal"),
    peersDisconnectedTotal: numberMetric(json, "peersDisconnectedTotal"),

    eventBusPacketProcessed: numberMetric(json, "eventBusPacketProcessed"),
    eventBusPayloadDecrypted: numberMetric(json, "eventBusPayloadDecrypted"),
    eventBusSendPacket: numberMetric(json, "eventBusSendPacket"),
  };
}

function optionalNumberMetric(
  json: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = json[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function numberMetric(json: Record<string, unknown>, key: string): number {
  return optionalNumberMetric(json, key) ?? 0;
}

function booleanMetric(json: Record<string, unknown>, key: string): boolean {
  const value = json[key];
  return typeof value === "boolean" ? value : numberMetric(json, key) >= 1;
}

function stringMetric(json: Record<string, unknown>, key: string): string {
  const value = json[key];
  return typeof value === "string" && value.length > 0 ? value : "unknown";
}
