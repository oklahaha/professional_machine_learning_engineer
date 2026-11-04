import assert from "node:assert/strict";
import { test } from "node:test";

import { parsePractice } from "./practice-store.ts";

const isDomain = (d: number) => d >= 1 && d <= 6;
const saved = (over: object = {}) =>
  JSON.stringify({ orderMode: "shuffle", order: [2, 0, 1], pos: 1, answers: { 7: ["B"] }, domains: [3], ...over });

test("a state that fits the bank is kept whole", () => {
  const p = parsePractice(saved(), 3, isDomain)!;
  assert.equal(p.orderMode, "shuffle");
  assert.deepEqual(p.order, [2, 0, 1]);
  assert.equal(p.pos, 1);
  assert.deepEqual(p.answers, { 7: ["B"] });
  assert.deepEqual(p.domains, [3]);
});

test("a state from a smaller bank keeps its answers and drops only the order", () => {
  const p = parsePractice(saved(), 4, isDomain)!;
  assert.equal(p.orderMode, undefined, "the caller must reshuffle");
  assert.deepEqual(p.answers, { 7: ["B"] });
  assert.deepEqual(p.domains, [3]);
});

test("tampered order, pos, answers and domains are coerced, not trusted", () => {
  const p = parsePractice(saved({ order: [0, 0, 1], pos: "x", answers: { 1: "A", 2: [3] }, domains: [9, 2] }), 3, isDomain)!;
  assert.equal(p.orderMode, undefined);
  assert.equal(p.pos, 0);
  assert.deepEqual(p.answers, {});
  assert.deepEqual(p.domains, [2]);
});

test("unreadable storage is ignored", () => {
  assert.equal(parsePractice("{oops", 3, isDomain), null);
  assert.equal(parsePractice("null", 3, isDomain), null);
});
