// Explicit .ts extension so node's test runner can load this module.
import { sha256 } from "./sha256.ts";

export const ROLE_RELAY = 1;
export const ROLE_EXIT = 2;
export const ROLE_FULL = 3;

const encoder = new TextEncoder();

/**
 * The mix layer a node routes in, derived from its on-chain role and address.
 * This is the rule the Nox topology manager and the indexer's
 * `primary_layer_for_role` use:
 *
 * - Exit (role 2): layer 2.
 * - Relay (role 1): first byte of SHA-256(lowercase address) mod 2.
 * - Anything else (Full): first byte of SHA-256(lowercase address) mod 3.
 *
 * The map uses it instead of the `layer` field reported for each node, which
 * can come from a single node's possibly stale view of the topology.
 */
export function routingLayer(role: number, address: string): number {
  if (role === ROLE_EXIT) return 2;
  const first = sha256(encoder.encode(address.toLowerCase()))[0];
  return role === ROLE_RELAY ? first % 2 : first % 3;
}
