import { useRef, useState, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useDashboardStore, type NodeInfo } from "../store/useDashboardStore";
import { planArcs, type ArcKind, type CounterSample } from "../store/arcPlan";
import { isOnlineNode } from "../store/networkStats";
import { useNodePlacement } from "../hooks/useNodePlacement";
import { GLOBE_RADIUS, ARC_COLORS, latLonToVec3 } from "./constants";

interface ArcData {
  id: number;
  curve: THREE.QuadraticBezierCurve3;
  color: string;
  birth: number;
  duration: number;
}

const MAX_ARCS = 120;

let arcIdCounter = 0;

function createArc(
  from: [number, number] | undefined,
  to: [number, number] | undefined,
  color: string,
  now: number,
): ArcData | null {
  if (!from || !to) return null;
  if (from[0] === to[0] && from[1] === to[1]) return null;

  const start = latLonToVec3(from[0], from[1], GLOBE_RADIUS * 1.01);
  const end = latLonToVec3(to[0], to[1], GLOBE_RADIUS * 1.01);

  // Lift scales with distance, so arcs between co-located nodes stay low.
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const dist = start.distanceTo(end);
  mid
    .normalize()
    .multiplyScalar(GLOBE_RADIUS * 1.03 + dist * 0.3 + Math.random() * 0.05);

  return {
    id: arcIdCounter++,
    curve: new THREE.QuadraticBezierCurve3(start, mid, end),
    color,
    birth: now,
    duration: 2.0 + Math.random() * 2.0,
  };
}

function pickOther(candidates: string[], self: string): string | undefined {
  const others = candidates.filter((a) => a !== self);
  if (others.length === 0) return undefined;
  return others[Math.floor(Math.random() * others.length)];
}

/** Symbolic endpoints for one arc; real paths are not observable by design. */
function endpoints(
  kind: ArcKind,
  node: NodeInfo,
  byLayer: Map<number, string[]>,
  all: string[],
): [string, string] | null {
  const self = node.address;
  let peer: string | undefined;
  switch (kind) {
    case "relayed":
      // Forwarded to the next layer; an exit's forwarded packets came from the mix layer.
      if (node.layer >= 2) {
        peer = pickOther(byLayer.get(1) ?? all, self);
        return peer ? [peer, self] : null;
      }
      peer = pickOther(byLayer.get(node.layer + 1) ?? all, self);
      return peer ? [self, peer] : null;
    case "exit":
      peer = pickOther(byLayer.get(1) ?? all, self);
      return peer ? [peer, self] : null;
    case "coverLoop":
    case "coverDrop":
      peer = pickOther(all, self);
      return peer ? [self, peer] : null;
  }
}

export function PacketArcs() {
  const [arcs, setArcs] = useState<ArcData[]>([]);
  const nodes = useDashboardStore((s) => s.nodes);
  const nodeMetrics = useDashboardStore((s) => s.nodeMetrics);
  const placement = useNodePlacement();

  const prevCountersRef = useRef(new Map<string, CounterSample>());

  useEffect(() => {
    const { next, spawns } = planArcs(prevCountersRef.current, nodeMetrics);
    prevCountersRef.current = next;

    const routable = nodes.filter(isOnlineNode);
    if (routable.length < 2 || spawns.length === 0) return;

    const byAddress = new Map(routable.map((n) => [n.address, n]));
    const byLayer = new Map<number, string[]>();
    for (const n of routable) {
      const list = byLayer.get(n.layer) ?? [];
      list.push(n.address);
      byLayer.set(n.layer, list);
    }
    const all = routable.map((n) => n.address);

    const now = performance.now() / 1000;
    const newArcs: ArcData[] = [];
    for (const { address, kind, count } of spawns) {
      const node = byAddress.get(address);
      if (!node) continue;
      for (let i = 0; i < count; i++) {
        const ends = endpoints(kind, node, byLayer, all);
        if (!ends) continue;
        const arc = createArc(
          placement.positions.get(ends[0]),
          placement.positions.get(ends[1]),
          ARC_COLORS[kind],
          now + i * 0.2,
        );
        if (arc) newArcs.push(arc);
      }
    }

    if (newArcs.length > 0) {
      setArcs((prev) => {
        const alive = prev.filter((a) => now - a.birth < a.duration + 0.5);
        return [...alive, ...newArcs].slice(-MAX_ARCS);
      });
    }
  }, [nodeMetrics, nodes, placement]);

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
