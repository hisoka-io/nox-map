import * as THREE from "three";

export const GLOBE_RADIUS = 1.4;

export const LAYER_HEX: Record<number, string> = {
  0: "#00ff88", // Entry
  1: "#38bdf8", // Mix
  2: "#f97316", // Exit
};

export const LAYER_COLORS: Record<number, THREE.Color> = {
  0: new THREE.Color(LAYER_HEX[0]),
  1: new THREE.Color(LAYER_HEX[1]),
  2: new THREE.Color(LAYER_HEX[2]),
};

// Registered but barred from routing by the registry.
export const FROZEN_COLOR = "#7dd3fc";

export const LAYER_LABELS: Record<number, string> = {
  0: "ENTRY",
  1: "MIX",
  2: "EXIT",
};

export const ROLE_LABELS: Record<number, string> = {
  1: "Relay",
  2: "Exit",
  3: "Full",
};

/** Arc colours by the counter that drives them (see store/arcPlan.ts). */
export const ARC_COLORS = {
  relayed: "#38bdf8",
  coverLoop: "#00ff88",
  coverDrop: "#f59e0b",
  exit: "#a78bfa",
};

export const ARC_LABELS = {
  relayed: "Relayed Packet",
  coverLoop: "Cover Loop",
  coverDrop: "Cover Drop",
  exit: "Exit Payload",
};

export function latLonToVec3(
  lat: number,
  lon: number,
  radius: number,
): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}
