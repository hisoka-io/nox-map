import { useRef, useState, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useDashboardStore } from "../store/useDashboardStore";
import {
  GLOBE_RADIUS,
  NODE_POSITIONS,
  ARC_COLORS,
  latLonToVec3,
} from "./constants";

interface ArcData {
  id: number;
  curve: THREE.QuadraticBezierCurve3;
  color: string;
  birth: number;
  duration: number;
}

let arcIdCounter = 0;

function getNodePosition(nodeIdx: number): [number, number] | null {
  if (NODE_POSITIONS.length === 0) return null;
  return NODE_POSITIONS[nodeIdx % NODE_POSITIONS.length];
}

function createArc(
  fromNodeIdx: number,
  toNodeIdx: number,
  color: string,
  now: number,
): ArcData | null {
  if (fromNodeIdx === toNodeIdx) return null;
  const fromPos = getNodePosition(fromNodeIdx);
  const toPos = getNodePosition(toNodeIdx);
  if (!fromPos || !toPos) return null;

  const start = latLonToVec3(fromPos[0], fromPos[1], GLOBE_RADIUS * 1.01);
  const end = latLonToVec3(toPos[0], toPos[1], GLOBE_RADIUS * 1.01);

  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const dist = start.distanceTo(end);
  mid
    .normalize()
    .multiplyScalar(GLOBE_RADIUS * 1.25 + dist * 0.2 + Math.random() * 0.15);

  return {
    id: arcIdCounter++,
    curve: new THREE.QuadraticBezierCurve3(start, mid, end),
    color,
    birth: now,
    duration: 2.0 + Math.random() * 2.0,
  };
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function PacketArcs() {
  const [arcs, setArcs] = useState<ArcData[]>([]);
  const nodes = useDashboardStore((s) => s.nodes);
  const nodeEvents = useDashboardStore((s) => s.nodeEvents);
  const nodeMetrics = useDashboardStore((s) => s.nodeMetrics);

  const prevCountsRef = useRef(new Map<string, number>());
  const prevCoverRef = useRef(
    new Map<string, { loop: number; drop: number }>(),
  );

  useEffect(() => {
    if (nodes.length < 2) return;

    const now = performance.now() / 1000;
    const newArcs: ArcData[] = [];

    const byLayer: Map<number, number[]> = new Map();
    nodes.forEach((n, idx) => {
      const list = byLayer.get(n.layer) ?? [];
      list.push(idx);
      byLayer.set(n.layer, list);
    });

    for (const [nodeAddr, events] of nodeEvents) {
      const currentCount = events.length;

      // First sight of a node: seed the counter without spawning arcs so
      // the initial backlog from the indexer doesn't produce a burst.
      if (!prevCountsRef.current.has(nodeAddr)) {
        prevCountsRef.current.set(nodeAddr, currentCount);
        continue;
      }

      const prevCount = prevCountsRef.current.get(nodeAddr) ?? 0;
      if (currentCount <= prevCount) continue;

      const newCount = currentCount - prevCount;
      const nodeIdx = nodes.findIndex((n) => n.address === nodeAddr);
      if (nodeIdx === -1) continue;

      const node = nodes[nodeIdx];

      for (let i = 0; i < Math.min(newCount, 3); i++) {
        const evt = events[i];

        if (evt.kind === "packet_processed") {
          const prevLayerNodes = byLayer.get(node.layer - 1) ?? byLayer.get(node.layer) ?? [];
          const nextLayerNodes = byLayer.get(node.layer + 1) ?? byLayer.get(node.layer) ?? [];

          if (prevLayerNodes.length > 0) {
            const srcIdx = pickRandom(prevLayerNodes);
            const arc = createArc(srcIdx, nodeIdx, ARC_COLORS.real, now + i * 0.2);
            if (arc) newArcs.push(arc);
          }

          if (nextLayerNodes.length > 0 && Math.random() < 0.5) {
            const dstIdx = pickRandom(nextLayerNodes);
            const arc = createArc(nodeIdx, dstIdx, ARC_COLORS.real, now + 0.5 + i * 0.2);
            if (arc) newArcs.push(arc);
          }
        } else if (evt.kind === "peer_connected") {
          const otherIdx = Math.floor(Math.random() * nodes.length);
          if (otherIdx !== nodeIdx) {
            const arc = createArc(otherIdx, nodeIdx, ARC_COLORS.coverLoop, now);
            if (arc) newArcs.push(arc);
          }
        } else if (evt.kind === "peer_disconnected") {
          const otherIdx = Math.floor(Math.random() * nodes.length);
          if (otherIdx !== nodeIdx) {
            const arc = createArc(nodeIdx, otherIdx, ARC_COLORS.coverDrop, now);
            if (arc) newArcs.push(arc);
          }
        } else if (evt.kind === "topology_add") {
          const entryCandidates = byLayer.get(0) ?? [];
          if (entryCandidates.length > 0) {
            const srcIdx = pickRandom(entryCandidates);
            const arc = createArc(srcIdx, nodeIdx, ARC_COLORS.exitTx, now);
            if (arc) newArcs.push(arc);
          }
        }
      }

      prevCountsRef.current.set(nodeAddr, currentCount);
    }

    if (newArcs.length > 0) {
      setArcs((prev) => {
        const alive = prev.filter((a) => now - a.birth < a.duration + 0.5);
        return [...alive, ...newArcs].slice(-120);
      });
    }
  }, [nodeEvents, nodes]);

  // Cover traffic arcs are driven by real per-node coverLoopGenerated /
  // coverDropGenerated counter deltas reported by the backend. Source/dest
  // are picked symbolically because mixnet path unlinkability is by design —
  // the backend cannot (and must not) reveal the actual hop path.
  useEffect(() => {
    if (nodes.length < 2) return;

    const now = performance.now() / 1000;
    const newArcs: ArcData[] = [];

    for (const [addr, metrics] of nodeMetrics) {
      // First sight of a node: seed the counter without spawning arcs so
      // the initial counter values from the indexer don't produce a burst.
      if (!prevCoverRef.current.has(addr)) {
        prevCoverRef.current.set(addr, {
          loop: metrics.coverLoopGenerated,
          drop: metrics.coverDropGenerated,
        });
        continue;
      }

      const prev = prevCoverRef.current.get(addr)!;
      const loopDelta = metrics.coverLoopGenerated - prev.loop;
      const dropDelta = metrics.coverDropGenerated - prev.drop;

      const nodeIdx = nodes.findIndex((n) => n.address === addr);
      if (nodeIdx === -1) {
        prevCoverRef.current.set(addr, {
          loop: metrics.coverLoopGenerated,
          drop: metrics.coverDropGenerated,
        });
        continue;
      }

      // Cap arcs spawned per metric tick so a large counter jump on first
      // sight doesn't flood the scene.
      const loopArcs = Math.min(Math.max(loopDelta, 0), 3);
      const dropArcs = Math.min(Math.max(dropDelta, 0), 2);

      for (let i = 0; i < loopArcs; i++) {
        const otherIdx = Math.floor(Math.random() * nodes.length);
        const arc = createArc(
          nodeIdx,
          otherIdx,
          ARC_COLORS.coverLoop,
          now + i * 0.15,
        );
        if (arc) newArcs.push(arc);
      }
      for (let i = 0; i < dropArcs; i++) {
        const otherIdx = Math.floor(Math.random() * nodes.length);
        const arc = createArc(
          nodeIdx,
          otherIdx,
          ARC_COLORS.coverDrop,
          now + i * 0.15,
        );
        if (arc) newArcs.push(arc);
      }

      prevCoverRef.current.set(addr, {
        loop: metrics.coverLoopGenerated,
        drop: metrics.coverDropGenerated,
      });
    }

    if (newArcs.length > 0) {
      setArcs((prev) => {
        const alive = prev.filter((a) => now - a.birth < a.duration + 0.5);
        return [...alive, ...newArcs].slice(-120);
      });
    }
  }, [nodeMetrics, nodes]);

  return (
    <group>
      {arcs.map((arc) => (
        <AnimatedArc key={arc.id} arc={arc} />
      ))}
    </group>
  );
}

const TRAIL_SEGMENTS = 32;

interface ArcBuffers {
  positions: Float32Array;
  sampleVec: THREE.Vector3;
}

function AnimatedArc({ arc }: { arc: ArcData }) {
  const headRef = useRef<THREE.Mesh>(null);

  const buffers = useMemo<ArcBuffers>(() => ({
    positions: new Float32Array((TRAIL_SEGMENTS + 1) * 3),
    sampleVec: new THREE.Vector3(),
  }), []);

  const lineObj = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(buffers.positions, 3),
    );
    const material = new THREE.LineBasicMaterial({
      color: arc.color,
      transparent: true,
      opacity: 0.6,
    });
    const line = new THREE.Line(geometry, material);
    line.frustumCulled = false;
    return line;
  }, [arc.color, buffers.positions]);

  useEffect(() => {
    return () => {
      lineObj.geometry.dispose();
      (lineObj.material as THREE.LineBasicMaterial).dispose();
    };
  }, [lineObj]);

  useFrame(() => {
    const now = performance.now() / 1000;
    const t = (now - arc.birth) / arc.duration;

    if (t < 0 || t > 1) {
      lineObj.visible = false;
      if (headRef.current) headRef.current.visible = false;
      return;
    }

    const trailStart = Math.max(0, t - 0.25);
    const trailEnd = Math.min(t, 1);
    const { positions, sampleVec } = buffers;

    for (let i = 0; i <= TRAIL_SEGMENTS; i++) {
      const u = trailStart + (trailEnd - trailStart) * (i / TRAIL_SEGMENTS);
      arc.curve.getPoint(u, sampleVec);
      const idx = i * 3;
      positions[idx] = sampleVec.x;
      positions[idx + 1] = sampleVec.y;
      positions[idx + 2] = sampleVec.z;
    }

    const attr = lineObj.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    attr.needsUpdate = true;
    lineObj.geometry.computeBoundingSphere();
    lineObj.visible = true;

    const mat = lineObj.material as THREE.LineBasicMaterial;
    mat.opacity = t > 0.85 ? (1 - t) * 6.6 : 0.6;

    if (headRef.current) {
      arc.curve.getPoint(Math.min(t, 1), sampleVec);
      headRef.current.position.copy(sampleVec);
      headRef.current.visible = true;
      const headMat = headRef.current.material as THREE.MeshBasicMaterial;
      headMat.opacity = t > 0.85 ? (1 - t) * 6.6 : 1;
    }
  });

  return (
    <>
      <primitive object={lineObj} />
      <mesh ref={headRef}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshBasicMaterial color={arc.color} transparent opacity={1} />
      </mesh>
    </>
  );
}
