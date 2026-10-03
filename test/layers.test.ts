import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";

import { sha256 } from "../src/store/sha256.ts";
import { routingLayer } from "../src/store/layers.ts";

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

test("sha256 matches node:crypto across block boundaries", () => {
  for (let len = 0; len <= 200; len++) {
    const input = randomBytes(len);
    assert.equal(
      hex(sha256(new Uint8Array(input))),
      createHash("sha256").update(input).digest("hex"),
      `length ${len}`,
    );
  }
  assert.equal(
    hex(sha256(new TextEncoder().encode("abc"))),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

// Role and layer of each node in the indexer's chain-derived /seed/topology,
// Arbitrum Sepolia NoxRegistry, 2026-10-02.
const SEED_TOPOLOGY: [string, number, number][] = [
  ["0x03a42846c18b99c453a49d7fce69f336f865c48b", 2, 2],
  ["0x074a13b271b73eb5c0c44e2037d035e7eef4a462", 1, 0],
  ["0x1efa385556a6e8643df0033048ba1dd67ec43f93", 2, 2],
  ["0x3e98ee4572741fd932e031ac60e79f7c012758be", 1, 1],
  ["0x6774ca4baf6fff84f02898a3dee4299ed1f5ab4e", 2, 2],
  ["0x74486dc1ac551e5cd3f4eef80727cc9d50d3abe9", 1, 0],
  ["0x862d6b1105bde9d64dc5182fe3cd9d09f6f37463", 1, 1],
  ["0x8c9fb3e9fe537067c8430480f80a4a5b9a12be1a", 1, 1],
  ["0xbeb31ac0c57b3765cb855fa02081eadb9edb2426", 1, 0],
  ["0xf8681a0acb60effcd9c169226e6f9c1ae9dd7894", 1, 1],
];

test("routingLayer reproduces the chain-derived topology", () => {
  for (const [address, role, layer] of SEED_TOPOLOGY) {
    assert.equal(routingLayer(role, address), layer, address);
    assert.equal(routingLayer(role, address.toUpperCase().replace("0X", "0x")), layer);
  }
});

test("routingLayer: exits are layer 2, full nodes use all three layers", () => {
  const full = new Set<number>();
  for (let i = 0; i < 64; i++) {
    const address = `0x${i.toString(16).padStart(40, "0")}`;
    assert.equal(routingLayer(2, address), 2);
    assert.ok([0, 1].includes(routingLayer(1, address)));
    full.add(routingLayer(3, address));
  }
  assert.deepEqual([...full].sort(), [0, 1, 2]);
});
