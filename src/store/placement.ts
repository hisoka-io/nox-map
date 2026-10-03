/**
 * Where each node is drawn on the globe.
 *
 * The indexer geolocates each node's public IP and reports `latitude` and
 * `longitude`. Those are used whenever present. Nodes at the same site (for
 * example several nodes in one cloud region) are spread on a small spiral
 * around it so each stays visible and clickable.
 *
 * A node without a location (an older or GeoIP-less indexer reports 0,0 or
 * nothing) is drawn at a stand-in city instead, and the map says so.
 */

export interface GeoNode {
  address: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface Placement {
  /** [latitude, longitude] by node address. */
  positions: Map<string, [number, number]>;
  /** Nodes drawn at their GeoIP location. */
  geoCount: number;
  /** Nodes drawn at a stand-in city because no location is known. */
  illustrativeCount: number;
  /** Distinct GeoIP sites among the located nodes. */
  siteCount: number;
}

/** Stand-in positions for nodes whose location is unknown. Not real locations. */
export const ILLUSTRATIVE_POSITIONS: [number, number][] = [
  [40.7, -74.0], // New York
  [51.5, -0.1], // London
  [35.7, 139.7], // Tokyo
  [1.35, 103.8], // Singapore
  [-23.5, -46.6], // Sao Paulo
  [52.5, 13.4], // Berlin
  [19.08, 72.88], // Mumbai
  [-33.9, 151.2], // Sydney
  [34.0, -118.2], // Los Angeles
  [25.3, 55.3], // Dubai
  [48.9, 2.35], // Paris
  [43.7, -79.4], // Toronto
  [37.6, 127.0], // Seoul
  [-26.2, 28.0], // Johannesburg
  [19.4, -99.1], // Mexico City
  [59.3, 18.1], // Stockholm
];

/** Spacing of co-located nodes, in degrees of arc. */
const SPREAD_DEG = 2.4;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** The node's GeoIP location, or null when it is missing or a placeholder. */
export function nodeGeo(node: GeoNode): [number, number] | null {
  const lat = node.latitude;
  const lon = node.longitude;
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  // The indexer reports 0,0 when it has no GeoIP result.
  if (lat === 0 && lon === 0) return null;
  return [lat, lon];
}

function siteKey([lat, lon]: [number, number]): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

/** Offset of the i-th node of a site of `count` nodes. */
function spread(
  [lat, lon]: [number, number],
  i: number,
  count: number,
): [number, number] {
  if (count <= 1) return [lat, lon];
  const r = SPREAD_DEG * Math.sqrt(i + 0.5);
  const theta = i * GOLDEN_ANGLE;
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
 */
export function placeNodes(nodes: GeoNode[]): Placement {
  const positions = new Map<string, [number, number]>();
  const sites = new Map<string, { at: [number, number]; members: string[] }>();
  const unlocated: string[] = [];

  for (const node of nodes) {
    const geo = nodeGeo(node);
    if (!geo) {
      unlocated.push(node.address);
      continue;
    }
    const key = siteKey(geo);
    const site = sites.get(key) ?? { at: geo, members: [] };
    site.members.push(node.address);
    sites.set(key, site);
  }

  for (const { at, members } of sites.values()) {
    members.forEach((address, i) => {
      positions.set(address, spread(at, i, members.length));
    });
  }

  unlocated.forEach((address, i) => {
    positions.set(address, ILLUSTRATIVE_POSITIONS[i % ILLUSTRATIVE_POSITIONS.length]);
  });

  return {
    positions,
    geoCount: nodes.length - unlocated.length,
    illustrativeCount: unlocated.length,
    siteCount: sites.size,
  };
}

/** One line for the map legend describing where the markers come from. */
export function placementNote(p: Placement): string {
  const total = p.geoCount + p.illustrativeCount;
  if (total === 0) return "";
  if (p.illustrativeCount === 0) {
    const sites = p.siteCount === 1 ? "1 site" : `${p.siteCount} sites`;
    return `Locations: IP geolocation, approximate (${sites}); co-located nodes are spread apart`;
  }
  if (p.geoCount === 0) {
    return "Locations are illustrative, not where the nodes run";
  }
  return `Locations: IP geolocation, approximate; ${p.illustrativeCount} of ${total} illustrative`;
}
