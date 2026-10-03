import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ILLUSTRATIVE_POSITIONS,
  nodeGeo,
  placeNodes,
  placementNote,
} from "../src/store/placement.ts";

const ASHBURN = { latitude: 39.0469, longitude: -77.4903 };

function located(i: number, geo: { latitude?: unknown; longitude?: unknown } = ASHBURN) {
  return { address: `0x${i.toString(16).padStart(40, "0")}`, ...geo } as {
    address: string;
    latitude?: number;
    longitude?: number;
  };
}

/** Great-circle distance in degrees. */
function arcDeg(a: [number, number], b: [number, number]): number {
  const r = Math.PI / 180;
  const cos =
    Math.sin(a[0] * r) * Math.sin(b[0] * r) +
    Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.cos((a[1] - b[1]) * r);
  return Math.acos(Math.min(1, Math.max(-1, cos))) / r;
}

test("nodeGeo rejects missing, invalid and 0,0 locations", () => {
  assert.deepEqual(nodeGeo(located(1)), [39.0469, -77.4903]);
  assert.equal(nodeGeo(located(1, {})), null);
  assert.equal(nodeGeo(located(1, { latitude: 0, longitude: 0 })), null);
  assert.equal(nodeGeo(located(1, { latitude: 91, longitude: 0 })), null);
  assert.equal(nodeGeo(located(1, { latitude: "39", longitude: "-77" })), null);
  assert.equal(nodeGeo(located(1, { latitude: NaN, longitude: 3 })), null);
});

test("co-located nodes stay near their site but apart from each other", () => {
  const nodes = Array.from({ length: 10 }, (_, i) => located(i));
  const p = placeNodes(nodes);

  assert.equal(p.geoCount, 10);
  assert.equal(p.illustrativeCount, 0);
  assert.equal(p.siteCount, 1);

  const points = nodes.map((n) => p.positions.get(n.address)!);
  for (const pt of points) {
    assert.ok(arcDeg(pt, [ASHBURN.latitude, ASHBURN.longitude]) < 8, `${pt} drifted`);
  }
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      assert.ok(arcDeg(points[i], points[j]) > 1.5, `nodes ${i} and ${j} overlap`);
    }
  }

  // Same input order, same positions.
  assert.deepEqual(placeNodes(nodes).positions, p.positions);
});

test("a lone node sits exactly at its location", () => {
  const p = placeNodes([located(1), located(2, { latitude: 19.07, longitude: 72.89 })]);
  assert.deepEqual(p.positions.get(located(2).address), [19.07, 72.89]);
  assert.equal(p.siteCount, 2);
});

test("without GeoIP the stand-in positions are used and labelled", () => {
  const nodes = [located(1, {}), located(2, { latitude: 0, longitude: 0 })];
  const p = placeNodes(nodes);
  assert.equal(p.illustrativeCount, 2);
  assert.deepEqual(p.positions.get(nodes[0].address), ILLUSTRATIVE_POSITIONS[0]);
  assert.deepEqual(p.positions.get(nodes[1].address), ILLUSTRATIVE_POSITIONS[1]);
  assert.match(placementNote(p), /illustrative/i);
});

test("placementNote says where the positions come from", () => {
  assert.match(placementNote(placeNodes([located(1), located(2)])), /IP geolocation.*1 site/);
  assert.match(placementNote(placeNodes([located(1), located(2, {})])), /1 of 2 illustrative/);
  assert.equal(placementNote(placeNodes([])), "");
});
