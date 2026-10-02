import type {
  NodeInfo,
  NodeMetrics,
  SseEvent,
} from "../store/useDashboardStore";

const MOCK_NODE_INFOS: NodeInfo[] = [
  {
    id: "nox-0",
    address: "0xA1b2C3d4E5f6789012345678901234567890aB00",
    role: 1,
    layer: 0,
    admin_port: 9090,
    ingress_port: 8080,
    p2p_addr: "/ip4/127.0.0.1/tcp/43210",
  },
  {
    id: "nox-1",
    address: "0xA1b2C3d4E5f6789012345678901234567890aB01",
    role: 1,
    layer: 0,
    admin_port: 9091,
    ingress_port: 8081,
    p2p_addr: "/ip4/127.0.0.1/tcp/43211",
  },
  {
    id: "nox-2",
    address: "0xA1b2C3d4E5f6789012345678901234567890aB02",
    role: 1,
    layer: 0,
    admin_port: 9092,
    ingress_port: 8082,
    p2p_addr: "/ip4/127.0.0.1/tcp/43212",
  },
  {
    id: "nox-3",
    address: "0xA1b2C3d4E5f6789012345678901234567890aB03",
    role: 1,
    layer: 0,
    admin_port: 9093,
    ingress_port: 0,
    p2p_addr: "/ip4/127.0.0.1/tcp/43213",
  },
  {
    id: "nox-4",
    address: "0xA1b2C3d4E5f6789012345678901234567890aB04",
    role: 1,
    layer: 0,
    admin_port: 9094,
    ingress_port: 0,
    p2p_addr: "/ip4/127.0.0.1/tcp/43214",
  },
  {
    id: "nox-5",
    address: "0xA1b2C3d4E5f6789012345678901234567890aB05",
    role: 1,
    layer: 0,
    admin_port: 9095,
    ingress_port: 0,
    p2p_addr: "/ip4/127.0.0.1/tcp/43215",
  },
  {
    id: "nox-6",
    address: "0xB2c3D4e5F67890123456789012345678901bC06",
    role: 1,
    layer: 1,
    admin_port: 9096,
    ingress_port: 0,
    p2p_addr: "/ip4/127.0.0.1/tcp/43216",
  },
  {
    id: "nox-7",
    address: "0xB2c3D4e5F67890123456789012345678901bC07",
    role: 1,
    layer: 1,
    admin_port: 9097,
    ingress_port: 0,
    p2p_addr: "/ip4/127.0.0.1/tcp/43217",
  },
  {
    id: "nox-8",
    address: "0xB2c3D4e5F67890123456789012345678901bC08",
    role: 1,
    layer: 1,
    admin_port: 9098,
    ingress_port: 0,
    p2p_addr: "/ip4/127.0.0.1/tcp/43218",
  },
  {
    id: "nox-9",
    address: "0xB2c3D4e5F67890123456789012345678901bC09",
    role: 1,
    layer: 1,
    admin_port: 9099,
    ingress_port: 0,
    p2p_addr: "/ip4/127.0.0.1/tcp/43219",
  },
  {
    id: "nox-10",
    address: "0xB2c3D4e5F67890123456789012345678901bC10",
    role: 1,
    layer: 1,
    admin_port: 9100,
    ingress_port: 0,
    p2p_addr: "/ip4/127.0.0.1/tcp/43220",
  },
  {
    id: "nox-11",
    address: "0xC3d4E5f6789012345678901234567890cD11ab",
    role: 2,
    layer: 2,
    admin_port: 9101,
    ingress_port: 0,
    p2p_addr: "/ip4/127.0.0.1/tcp/43221",
  },
  {
    id: "nox-12",
    address: "0xC3d4E5f6789012345678901234567890cD12ab",
    role: 2,
    layer: 2,
    admin_port: 9102,
    ingress_port: 0,
    p2p_addr: "/ip4/127.0.0.1/tcp/43222",
  },
  {
    id: "nox-13",
    address: "0xC3d4E5f6789012345678901234567890cD13ab",
    role: 3,
    layer: 2,
    admin_port: 9103,
    ingress_port: 0,
    p2p_addr: "/ip4/127.0.0.1/tcp/43223",
  },
  {
    id: "nox-14",
    address: "0xC3d4E5f6789012345678901234567890cD14ab",
    role: 3,
    layer: 2,
    admin_port: 9104,
    ingress_port: 0,
    p2p_addr: "/ip4/127.0.0.1/tcp/43224",
  },
];

interface NodeSim {
  simTime: number;
  packetsReceived: number;
  packetsForwarded: number;
  coverLoop: number;
  coverDrop: number;
  revenue: number;
  cost: number;
  profitable: number;
  unprofitable: number;
}

const MOCK_START_TIME = Math.floor(Date.now() / 1000);

const nodeSims = new Map<string, NodeSim>(
  MOCK_NODE_INFOS.map((n) => [
    n.id,
    {
      simTime: 0,
      packetsReceived: 0,
      packetsForwarded: 0,
      coverLoop: 0,
      coverDrop: 0,
      revenue: 0,
      cost: 0,
      profitable: 0,
      unprofitable: 0,
    },
  ]),
);

function jitter(base: number, range: number): number {
  return base + (Math.random() - 0.5) * range;
}

export function generateMockNodeMetrics(
  nodeId: string,
  idx: number,
): NodeMetrics {
  const sim = nodeSims.get(nodeId) ?? {
    simTime: 0,
    packetsReceived: 0,
    packetsForwarded: 0,
    coverLoop: 0,
    coverDrop: 0,
    revenue: 0,
    cost: 0,
    profitable: 0,
    unprofitable: 0,
  };

  sim.simTime += 5;

  const node = MOCK_NODE_INFOS[idx] ?? MOCK_NODE_INFOS[0];
  const layerMult = node.layer === 0 ? 1.4 : node.layer === 1 ? 1.0 : 0.7;
  const isBurst = Math.random() < 0.12;
  const packetDelta = isBurst
    ? Math.floor(jitter(120, 60) * layerMult)
    : Math.floor(jitter(25, 15) * layerMult);

  sim.packetsReceived += packetDelta;
  sim.packetsForwarded += Math.floor(packetDelta * jitter(0.85, 0.1));

  const coverDelta = Math.floor(jitter(8, 4));
  sim.coverLoop += Math.floor(coverDelta * 0.6);
  sim.coverDrop += Math.floor(coverDelta * 0.4);

  if (node.role >= 2) {
    const txCount = Math.floor(Math.random() * 3);
    for (let i = 0; i < txCount; i++) {
      if (Math.random() < 0.82) {
        sim.revenue += jitter(150, 80);
        sim.cost += jitter(60, 30);
        sim.profitable++;
      } else {
        sim.revenue += jitter(30, 20);
        sim.cost += jitter(80, 40);
        sim.unprofitable++;
      }
    }
  }

  const coverDegraded = Math.random() < 0.03;
  nodeSims.set(nodeId, sim);

  return {
    activePeers: MOCK_NODE_INFOS.length - 1,
    uptimeSeconds: sim.simTime,
    nodeStartTime: MOCK_START_TIME,
    healthStatus: coverDegraded ? 1 : 2,
    packetsReceived: sim.packetsReceived,
    packetsForwarded: sim.packetsForwarded,
    coverLoopGenerated: sim.coverLoop,
    coverDropGenerated: sim.coverDrop,
    coverLoopDegraded: coverDegraded,
    coverDropDegraded: false,
    cumulativeAuthorizedRevenueUsd: Math.round(sim.revenue) / 100,
    cumulativeCostUsd: Math.round(sim.cost) / 100,
    cumulativeMaximumCostUsd: Math.round(sim.cost * 1.2) / 100,
    ethPending: Math.floor(Math.random() * 3),
    profitableCount: sim.profitable,
    unprofitableCount: sim.unprofitable,
    exitPayloadsDispatched: node.role >= 2 ? Math.floor(sim.packetsForwarded * 0.15) : 0,
    exitEcho: node.role >= 2 ? Math.floor(sim.packetsForwarded * 0.03) : 0,
    exitHttp: node.role >= 2 ? Math.floor(sim.packetsForwarded * 0.05) : 0,
    exitRpc: node.role >= 2 ? Math.floor(sim.packetsForwarded * 0.02) : 0,
    exitBroadcast: node.role >= 2 ? Math.floor(sim.packetsForwarded * 0.01) : 0,
    exitEthereum: 0,
    ethTransactionsSubmitted: 0,
    buildVersion: "0.1.0-mock",
  };
}

export function generateMockEvents(
  count: number = 3,
  nodeId?: string,
): SseEvent[] {
  const events: SseEvent[] = [];

  const nowSec = Math.floor(Date.now() / 1000);

  for (let i = 0; i < count; i++) {
    const roll = Math.random();
    const sourceNode =
      MOCK_NODE_INFOS[Math.floor(Math.random() * MOCK_NODE_INFOS.length)];
    const eventNodeId = nodeId ?? sourceNode.address;
    const ts = nowSec;

    if (roll < 0.75) {
      const kind = Math.random() < 0.6 ? "peer_connected" : "peer_disconnected" as const;
      events.push({
        kind,
        peer_id: `12D3KooW${sourceNode.address.slice(2, 14)}`,
        node_id: eventNodeId,
        timestamp: ts,
      } as SseEvent);
    } else {
      events.push({
        kind: "topology_add",
        address: sourceNode.address,
        role: sourceNode.role,
        stake: "1000000000000000000",
        node_id: eventNodeId,
        timestamp: ts,
      } as SseEvent);
    }
  }

  return events;
}

export function generateMockReputation(nodes: NodeInfo[]) {
  return nodes.map((n, i) => {
    const base = 95 - i * 4;
    const score = Math.max(20, Math.min(100, base + (Math.random() - 0.5) * 6));
    const totalChecks = 200 + Math.floor(Math.random() * 100);
    const passedChecks = Math.floor(totalChecks * (score / 100));
    return {
      address: n.address,
      score: Math.round(score * 10) / 10,
      streak: score > 70 ? Math.floor(Math.random() * 50) + 10 : Math.floor(Math.random() * 5),
      totalChecks,
      passedChecks,
    };
  });
}

export function getMockClusterNodes(): NodeInfo[] {
  return MOCK_NODE_INFOS;
}
