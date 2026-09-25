import * as THREE from "three";

export const GLOBE_RADIUS = 1.4;

export const LAYER_COLORS: Record<number, THREE.Color> = {
  0: new THREE.Color("#00ff88"), // Entry
  1: new THREE.Color("#38bdf8"), // Mix
  2: new THREE.Color("#f97316"), // Exit
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

export const ARC_COLORS = {
  real: "#38bdf8",
  coverLoop: "#00ff88",
  coverDrop: "#f59e0b",
  exitTx: "#a78bfa",
};

// TODO: currently we are hardcoding location, this should be fixed asap
// according to the real location from nodes when we are going to mainnet
export const NODE_POSITIONS: [number, number][] = [
  [40.7, -74.0], // nox-0:  New York
  [34.0, -118.2], // nox-1:  Los Angeles
  [51.5, -0.1], // nox-2:  London
  [19.08, 72.88], // nox-3:  Mumbai
  [-23.5, -46.6], // nox-4:  Sao Paulo
  [25.7, -100.3], // nox-5:  Monterrey
  [52.5, 13.4], // nox-6:  Berlin
  [55.8, 37.6], // nox-7:  Moscow
  [35.7, 139.7], // nox-8:  Tokyo
  [1.35, 103.8], // nox-9:  Singapore
  [28.6, 77.2], // nox-10: Delhi
  [-33.9, 151.2], // nox-11: Sydney
  [25.3, 55.3], // nox-12: Dubai
  [39.9, 116.4], // nox-13: Beijing
  [-34.6, -58.4], // nox-14: Buenos Aires
  [48.9, 2.35], // nox-15: Paris
];

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
