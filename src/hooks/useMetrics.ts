import type { NodeMetrics } from "../store/useDashboardStore";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapJsonToNodeMetrics(json: Record<string, any>): NodeMetrics {
  return {
    activePeers: json.activePeers ?? 0,
    uptimeSeconds: json.uptimeSeconds ?? 0,
    healthStatus: json.healthStatus ?? 0,

    packetsReceived: json.packetsReceived ?? 0,
    packetsForwarded: json.packetsForwarded ?? 0,
    dummyPacketsDropped: json.dummyPacketsDropped ?? 0,

    workerQueueDepth: json.workerQueueDepth ?? 0,
    mixQueueDepth: json.mixQueueDepth ?? 0,
    egressQueueDepth: json.egressQueueDepth ?? 0,
    ingestDropped: json.ingestDropped ?? 0,
    ingestDroppedBackpressure: json.ingestDroppedBackpressure ?? 0,

    coverLoopGenerated: json.coverLoopGenerated ?? 0,
    coverDropGenerated: json.coverDropGenerated ?? 0,
    coverLoopDegraded:
      typeof json.coverLoopDegraded === "boolean"
        ? json.coverLoopDegraded
        : (json.coverLoopDegraded ?? 0) >= 1,
    coverDropDegraded:
      typeof json.coverDropDegraded === "boolean"
        ? json.coverDropDegraded
        : (json.coverDropDegraded ?? 0) >= 1,
    coverErrors: json.coverErrors ?? 0,

    cumulativeRevenueUsd: json.cumulativeRevenueUsd ?? 0,
    cumulativeCostUsd: json.cumulativeCostUsd ?? 0,
    ethPending: json.ethPending ?? 0,
    profitableCount: json.profitableCount ?? 0,
    unprofitableCount: json.unprofitableCount ?? 0,

    exitPayloadsDispatched: json.exitPayloadsDispatched ?? 0,
    exitReassemblerPending: json.exitReassemblerPending ?? 0,
    exitEcho: json.exitEcho ?? 0,
    exitHttp: json.exitHttp ?? 0,
    exitRpc: json.exitRpc ?? 0,
    exitBroadcast: json.exitBroadcast ?? 0,
    exitEthereum: json.exitEthereum ?? 0,
    exitTraffic: json.exitTraffic ?? 0,
    ethTransactionsSubmitted: json.ethTransactionsSubmitted ?? 0,
    egressForwarded: json.egressForwarded ?? 0,
    egressExited: json.egressExited ?? 0,

    sphinxErrors: json.sphinxErrors ?? 0,
    replayNew: json.replayNew ?? 0,
    replayDuplicate: json.replayDuplicate ?? 0,
    p2pRateLimitDenied: json.p2pRateLimitDenied ?? 0,

    topologyLayer0: json.topologyLayer0 ?? 0,
    topologyLayer1: json.topologyLayer1 ?? 0,
    topologyLayer2: json.topologyLayer2 ?? 0,

    chainLastBlock: json.chainLastBlock ?? 0,
    chainErrors: json.chainErrors ?? 0,

    processMem: json.processMem ?? 0,
    processVmem: json.processVmem ?? 0,
    openFds: json.openFds ?? 0,

    buildVersion: json.buildVersion || "unknown",
    buildRole: json.buildRole || "unknown",

    ingressResponseBuffer: json.ingressResponseBuffer ?? 0,

    fecSuccess:
      json.fecSuccess ??
      (json.fecEncodeSuccess ?? 0) + (json.fecDecodeSuccess ?? 0),
    fecError:
      json.fecError ??
      (json.fecEncodeError ?? 0) + (json.fecDecodeError ?? 0),
    fecEncodeSuccess: json.fecEncodeSuccess ?? 0,
    fecDecodeError: json.fecDecodeError ?? 0,

    oracleFetchStale: json.oracleFetchStale ?? 0,

    latencyP50: json.latencyP50 ?? 0,
    latencyP95: json.latencyP95 ?? 0,
    latencyP99: json.latencyP99 ?? 0,

    peersConnectedTotal: json.peersConnectedTotal ?? 0,
    peersDisconnectedTotal: json.peersDisconnectedTotal ?? 0,

    eventBusPacketProcessed: json.eventBusPacketProcessed ?? 0,
    eventBusPayloadDecrypted: json.eventBusPayloadDecrypted ?? 0,
    eventBusSendPacket: json.eventBusSendPacket ?? 0,
  };
}
