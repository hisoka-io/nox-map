import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PLACEMENT_NOTE,
  WORLD_POSITIONS,
  placeNodes,
  placementNote,
} from "../src/store/placement.ts";

function node(i: number, geo: { latitude?: number; longitude?: number } = {}) {
  return { address: `0x${i.toString(16).padStart(40, "0")}`, ...geo };
}

/** Great-circle distance in degrees. */
function arcDeg(a: [number, number], b: [number, number]): number {
  const r = Math.PI / 180;
  const cos =
    Math.sin(a[0] * r) * Math.sin(b[0] * r) +
    Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.cos((a[1] - b[1]) * r);
  return Math.acos(Math.min(1, Math.max(-1, cos))) / r;
}

function assertApart(points: [number, number][], minDeg: number) {
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      assert.ok(
        arcDeg(points[i], points[j]) > minDeg,
        `points ${i} and ${j} overlap (${arcDeg(points[i], points[j]).toFixed(2)} deg)`,
      );
    }
  }
}

test("the city list has 16+ distinct, well separated cities", () => {
  assert.ok(WORLD_POSITIONS.length >= 16);
  assertApart(WORLD_POSITIONS, 3);
});

test("each node gets its own city in store order", () => {
  const nodes = Array.from({ length: 10 }, (_, i) => node(i));
  const p = placeNodes(nodes);

  assert.equal(p.count, 10);
  nodes.forEach((n, i) => {
    assert.deepEqual(p.positions.get(n.address), WORLD_POSITIONS[i]);
  });

  // Same input order, same positions.
  assert.deepEqual(placeNodes(nodes).positions, p.positions);
});

test("GeoIP coordinates do not move a node", () => {
  const p = placeNodes([
    node(1, { latitude: 39.0469, longitude: -77.4903 }),
    node(2, { latitude: 39.0469, longitude: -77.4903 }),
  ]);
  assert.deepEqual(p.positions.get(node(1).address), WORLD_POSITIONS[0]);
  assert.deepEqual(p.positions.get(node(2).address), WORLD_POSITIONS[1]);
});

test("more nodes than cities still get distinct, separate markers", () => {
  const nodes = Array.from({ length: WORLD_POSITIONS.length * 3 }, (_, i) => node(i));
  const points = nodes.map((n) => placeNodes(nodes).positions.get(n.address)!);
  assertApart(points, 1.5);
  for (const [lat, lon] of points) {
    assert.ok(Math.abs(lat) <= 90 && Math.abs(lon) <= 180, `${lat},${lon} out of range`);
  }
});

test("placementNote shows the display-layout caption when nodes exist", () => {
  assert.equal(placementNote(placeNodes([node(1)])), PLACEMENT_NOTE);
  assert.equal(PLACEMENT_NOTE, "Display layout · global node rollout planned");
  assert.equal(placementNote(placeNodes([])), "");
});
