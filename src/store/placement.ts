/**
 * Where each node is drawn on the globe.
 *
 * Markers use a display layout: each node gets its own city from
 * WORLD_POSITIONS, in the store's address-sorted order, so the globe shows the
 * network spread worldwide and every marker stays visible and clickable. The
 * positions are a layout for the map, and the legend says so.
 */

export interface PlacedNode {
  address: string;
}

export interface Placement {
  /** [latitude, longitude] by node address. */
  positions: Map<string, [number, number]>;
  /** Number of nodes placed. */
  count: number;
}

/**
 * Display cities, well spread and far enough apart that markers never touch.
 * The first sixteen keep the original map layout order.
 */
export const WORLD_POSITIONS: [number, number][] = [
  [40.7, -74.0], // New York
  [34.0, -118.2], // Los Angeles
  [51.5, -0.1], // London
  [19.08, 72.88], // Mumbai
  [-23.5, -46.6], // Sao Paulo
  [25.7, -100.3], // Monterrey
  [52.5, 13.4], // Berlin
  [55.8, 37.6], // Moscow
  [35.7, 139.7], // Tokyo
  [1.35, 103.8], // Singapore
  [28.6, 77.2], // Delhi
  [-33.9, 151.2], // Sydney
  [25.3, 55.3], // Dubai
  [39.9, 116.4], // Beijing
  [-34.6, -58.4], // Buenos Aires
  [48.9, 2.35], // Paris
  [43.7, -79.4], // Toronto
  [37.6, 127.0], // Seoul
  [-26.2, 28.0], // Johannesburg
  [59.3, 18.1], // Stockholm
  [6.5, 3.4], // Lagos
  [-1.3, 36.8], // Nairobi
  [41.0, 29.0], // Istanbul
  [-6.2, 106.8], // Jakarta
  [-36.8, 174.8], // Auckland
  [-33.4, -70.6], // Santiago
];

/** Step between candidate spots around a city, in degrees of arc. */
const SPREAD_STEP_DEG = 2.4;
/** Closest two markers may sit, in degrees of arc. */
const MIN_SEPARATION_DEG = 2;
/** Candidate spots tried around a city before taking the last one. */
const MAX_SPREAD_CANDIDATES = 256;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Great-circle distance in degrees. */
function arcDeg(a: [number, number], b: [number, number]): number {
  const r = Math.PI / 180;
  const cos =
    Math.sin(a[0] * r) * Math.sin(b[0] * r) +
    Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.cos((a[1] - b[1]) * r);
  return Math.acos(Math.min(1, Math.max(-1, cos))) / r;
}

/** The k-th spot on a golden-angle spiral around a city. */
function spiralSpot([lat, lon]: [number, number], k: number): [number, number] {
  const r = SPREAD_STEP_DEG * Math.sqrt(k);
  const theta = k * GOLDEN_ANGLE;
  const dLat = r * Math.cos(theta);
  const dLon = (r * Math.sin(theta)) / Math.max(Math.cos((lat * Math.PI) / 180), 0.2);
  const outLat = Math.max(-89, Math.min(89, lat + dLat));
  let outLon = lon + dLon;
  if (outLon > 180) outLon -= 360;
  if (outLon < -180) outLon += 360;
  return [outLat, outLon];
}

/**
 * Places every node. The result only depends on the order of `nodes`, which
 * the store keeps sorted by address, so positions are stable between updates.
 * Once every city is taken, further nodes go to the first free spot on a
 * spiral around a city, clear of every marker already placed.
 */
export function placeNodes(nodes: PlacedNode[]): Placement {
  const positions = new Map<string, [number, number]>();
  const placed: [number, number][] = [];

  nodes.forEach((node, i) => {
    const city = WORLD_POSITIONS[i % WORLD_POSITIONS.length];
    let spot = city;
    if (i >= WORLD_POSITIONS.length) {
      for (let k = 1; k <= MAX_SPREAD_CANDIDATES; k++) {
        spot = spiralSpot(city, k);
        if (placed.every((p) => arcDeg(p, spot) > MIN_SEPARATION_DEG)) break;
      }
    }
    placed.push(spot);
    positions.set(node.address, spot);
  });

  return { positions, count: nodes.length };
}

/** Legend caption describing the marker positions. */
export const PLACEMENT_NOTE = "Display layout · global node rollout planned";

/** One line for the map legend describing where the markers come from. */
export function placementNote(p: Placement): string {
  return p.count === 0 ? "" : PLACEMENT_NOTE;
}
