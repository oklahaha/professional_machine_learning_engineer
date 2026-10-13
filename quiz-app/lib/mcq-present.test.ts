import assert from "node:assert/strict";
import { test } from "node:test";

import { presentMcq } from "./mcq-present.ts";

// Synthetic question: these tests describe the transform, not the bank.
const q = {
  id: "a1b2c3d4e5f6",
  options: ["A", "B", "C", "D"].map((label) => ({
    label,
    text: `text ${label}`,
    explanation: `why ${label}`,
  })),
  answers: ["C"],
};

test("no shuffle returns the question untouched", () => {
  const v = presentMcq(q, false, 42);
  assert.equal(v.question, q);
  assert.deepEqual(v.displayToOrig, { A: "A", B: "B", C: "C", D: "D" });
});

test("shuffle relabels by position and keeps each explanation with its option", () => {
  const v = presentMcq(q, true, 42);
  assert.deepEqual(
    v.question.options.map((o) => o.label),
    ["A", "B", "C", "D"],
  );
  for (const o of v.question.options) {
    const orig = v.displayToOrig[o.label];
    assert.equal(o.text, `text ${orig}`);
    assert.equal(o.explanation, `why ${orig}`);
  }
});

test("the answer follows its option", () => {
  for (let seed = 1; seed < 50; seed++) {
    const v = presentMcq(q, true, seed);
    const [shown] = v.question.answers;
    assert.equal(v.question.options.find((o) => o.label === shown)?.text, "text C");
    assert.equal(v.displayToOrig[shown], "C");
  }
});

test("deterministic for a seed, and seeds actually vary the arrangement", () => {
  const texts = (seed: number) => presentMcq(q, true, seed).question.options.map((o) => o.text).join();
  assert.equal(texts(7), texts(7));
  const seen = new Set(Array.from({ length: 30 }, (_, i) => texts(i + 1)));
  assert.ok(seen.size > 1);
});

test("does not mutate the source question", () => {
  presentMcq(q, true, 99);
  assert.deepEqual(q.answers, ["C"]);
  assert.equal(q.options[0].label, "A");
});
