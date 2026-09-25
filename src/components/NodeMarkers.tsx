import { useRef, useState, useCallback, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { useDashboardStore } from "../store/useDashboardStore";
import { isFrozenNode } from "../store/networkStats";
import {
  GLOBE_RADIUS,
  NODE_POSITIONS,
  FROZEN_COLOR,
  LAYER_COLORS,
  LAYER_LABELS,
  ROLE_LABELS,
  latLonToVec3,
} from "./constants";

const FROZEN_MARKER_COLOR = new THREE.Color(FROZEN_COLOR);

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function NodeMarkers() {
  const nodes = useDashboardStore((s) => s.nodes);
  const nodeMetrics = useDashboardStore((s) => s.nodeMetrics);
  const setSelectedNodeId = useDashboardStore((s) => s.setSelectedNodeId);

  const nodeData = useMemo(
    () =>
      nodes.map((node, i) => {
        const pos = NODE_POSITIONS[i % NODE_POSITIONS.length];
        const frozen = isFrozenNode(node);
        return {
          node,
          frozen,
          vec: latLonToVec3(pos[0], pos[1], GLOBE_RADIUS * 1.01),
          color: frozen ? FROZEN_MARKER_COLOR : (LAYER_COLORS[node.layer] ?? LAYER_COLORS[0]),
        };
      }),
    [nodes],
  );

  return (
    <group>
      {nodeData.map(({ node, frozen, vec, color }) => {
        const metrics = nodeMetrics.get(node.address);
        return (
          <NodePoint
            key={node.address}
            position={vec}
            color={color}
            nodeId={node.id}
            nodeAddress={node.address}
            layer={node.layer}
            role={node.role}
            frozen={frozen}
            isActive={!frozen && metrics ? metrics.healthStatus >= 1 : false}
            packetsRecv={metrics?.packetsReceived ?? 0}
            setSelectedNodeId={setSelectedNodeId}
          />
        );
      })}
    </group>
  );
}

interface NodePointProps {
  position: THREE.Vector3;
  color: THREE.Color;
  nodeId: string;
  nodeAddress: string;
  layer: number;
  role: number;
  frozen: boolean;
  isActive: boolean;
  packetsRecv: number;
  setSelectedNodeId: (id: string) => void;
}

function NodePoint({
  position,
  color,
  nodeId,
  nodeAddress,
  layer,
  role,
  frozen,
  isActive,
  packetsRecv,
  setSelectedNodeId,
}: NodePointProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const outerGlowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const handleClick = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      setSelectedNodeId(nodeAddress);
    },
    [nodeAddress, setSelectedNodeId],
  );

  const handlePointerOver = useCallback(() => {
    setHovered(true);
    document.body.style.cursor = "pointer";
  }, []);

  const handlePointerOut = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = "default";
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pulse =
      prefersReducedMotion
        ? isActive ? 1 : 0.6
        : isActive
          ? 1 + Math.sin(t * 2.5 + position.x * 10) * 0.25
          : 0.6;

    if (meshRef.current) {
      meshRef.current.scale.setScalar(hovered ? 1.8 : pulse);
    }
    if (glowRef.current) {
      glowRef.current.scale.setScalar(prefersReducedMotion ? 2 : pulse * 2);
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = isActive
        ? prefersReducedMotion ? 0.25 : 0.25 + Math.sin(t * 2) * 0.1
        : 0.08;
    }
    if (outerGlowRef.current) {
      outerGlowRef.current.scale.setScalar(prefersReducedMotion ? 4 : pulse * 4);
      (outerGlowRef.current.material as THREE.MeshBasicMaterial).opacity =
        isActive ? (prefersReducedMotion ? 0.06 : 0.06 + Math.sin(t * 1.5) * 0.03) : 0.02;
    }
  });

  const hexColor = `#${color.getHexString()}`;

  return (
    <group position={position}>
      <mesh ref={outerGlowRef}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.06} />
      </mesh>

      <mesh ref={glowRef}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} />
      </mesh>

      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {hovered && (
        <Html
          position={[0, 0.1, 0]}
          center
          style={{
            pointerEvents: "none",
            whiteSpace: "nowrap",
            fontFamily: '"JetBrains Mono", monospace',
            background: "rgba(5,10,5,0.9)",
            border: `1px solid ${hexColor}33`,
            borderRadius: "4px",
            padding: "6px 10px",
            zIndex: 100,
          }}
        >
          <div style={{ fontSize: "13px", color: hexColor, fontWeight: 500 }}>
            {nodeId}
          </div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", fontWeight: 400, marginTop: 2 }}>
            {LAYER_LABELS[layer]} &middot; {ROLE_LABELS[role]}
            {frozen && <> &middot; FROZEN</>}
          </div>
          <div style={{ fontSize: "12px", fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
            {packetsRecv.toLocaleString()} pkts
          </div>
        </Html>
      )}
    </group>
  );
}
