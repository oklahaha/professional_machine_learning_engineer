import assert from "node:assert/strict";
import { test } from "node:test";

import questions from "../data/questions.json" with { type: "json" };
import { DOMAINS, filterByDomain, getDomain } from "./domains.ts";

test("the six domains mirror the official exam guide", () => {
  assert.deepEqual(
    DOMAINS.map((d) => d.id),
    [1, 2, 3, 4, 5, 6],
  );
  // The published weights sum to ~101% (each is rounded); anything far off means a
  // section was mistranscribed.
  const total = DOMAINS.reduce((s, d) => s + d.weight, 0);
  assert.ok(total >= 99 && total <= 102, `weights sum to ${total}`);
});

test("filterByDomain narrows a run to the selected sections", () => {
  const order = [0, 1, 2, 3];
  const domainOf = (i: number) => [1, 2, 1, 3][i];
  assert.deepEqual(filterByDomain(order, [1], domainOf), [0, 2]);
  assert.deepEqual(filterByDomain(order, [2, 3], domainOf), [1, 3]);
  // preserves the run's order rather than regrouping by section
  assert.deepEqual(filterByDomain(order, [1, 2, 3], domainOf), [0, 1, 2, 3]);
});

test("filterByDomain never yields an empty run — an empty run crashes the card", () => {
  const order = [0, 1];
  const domainOf = () => 1;
  // no selection = no filter
  assert.deepEqual(filterByDomain(order, [], domainOf), order);
  // a selection that matches nothing falls back to the full run instead of emptying it
  assert.deepEqual(filterByDomain(order, [6], domainOf), order);
});

test("every question is assigned to exactly one real domain", () => {
  for (const q of questions) {
    assert.ok(
      Number.isInteger(q.domain) && getDomain(q.domain),
      `Q${q.id} has domain ${JSON.stringify(q.domain)}, which is not a section 1..6`,
    );
  }
});

test("no domain is empty — an empty section would filter to a dead run", () => {
  for (const d of DOMAINS) {
    const n = questions.filter((q) => q.domain === d.id).length;
    assert.ok(n > 0, `section ${d.id} (${d.name}) has no questions`);
  }
});
