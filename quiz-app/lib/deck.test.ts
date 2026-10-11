import assert from "node:assert/strict";
import { test } from "node:test";

import {
  EMPTY_FILTER,
  courseSelection,
  filterCards,
  isUnitOn,
  pruneFilter,
  toggleCourse,
  toggleUnit,
  type DeckFilter,
} from "./deck.ts";

// Synthetic deck: these tests describe the filter, not the bank, so adding a CSV must never
// break them (same rule as lib/srs.test.ts).
const card = (course: string, unit: string, n: number) => ({
  id: `${course}-${unit}-${n}`,
  front: "q",
  back: "a",
  course,
  unit,
  topic: "t",
  tag: `${course}::${unit}::t`,
  deck: `${course}_${unit}`,
});

const DECK = [
  card("C1", "L01", 1),
  card("C1", "L02", 2),
  card("C1", "Lab1", 3),
  card("C2", "Ch1", 4),
  card("C2", "Tut1", 5),
];

const ids = (f: DeckFilter) => filterCards(DECK, f).map((c) => c.id);

test("an empty filter is the whole deck", () => {
  assert.deepEqual(ids(EMPTY_FILTER), DECK.map((c) => c.id));
});

test("a course selection takes every unit of that course", () => {
  assert.deepEqual(ids({ courses: ["C1"], units: [] }), ["C1-L01-1", "C1-L02-2", "C1-Lab1-3"]);
});

test("a unit selection narrows its course to that unit alone", () => {
  assert.deepEqual(ids({ courses: [], units: ["C1::Lab1"] }), ["C1-Lab1-3"]);
});

test("units and whole courses combine across courses", () => {
  assert.deepEqual(ids({ courses: ["C2"], units: ["C1::L02"] }), [
    "C1-L02-2",
    "C2-Ch1-4",
    "C2-Tut1-5",
  ]);
});

test("picking a unit of a whole course replaces the whole-course selection", () => {
  const f = toggleUnit({ courses: ["C1"], units: [] }, "C1", "L01");
  assert.deepEqual(f, { courses: [], units: ["C1::L01"] });
  assert.deepEqual(ids(f), ["C1-L01-1"]);
});

test("unpicking the last unit leaves the course off, not whole", () => {
  const f = toggleUnit({ courses: [], units: ["C1::L01"] }, "C1", "L01");
  assert.deepEqual(f, EMPTY_FILTER);
});

test("toggling a narrowed course off clears its units too", () => {
  const f = toggleCourse({ courses: ["C2"], units: ["C1::L01", "C1::L02"] }, "C1");
  assert.deepEqual(f, { courses: ["C2"], units: [] });
});

test("courseSelection reports off / all / some", () => {
  const f: DeckFilter = { courses: ["C2"], units: ["C1::L01"] };
  assert.equal(courseSelection(f, "C1"), "some");
  assert.equal(courseSelection(f, "C2"), "all");
  assert.equal(courseSelection(f, "C3"), "off");
});

test("a whole course reports every one of its units as on", () => {
  const f: DeckFilter = { courses: ["C1"], units: [] };
  assert.equal(isUnitOn(f, "C1", "Lab1"), true);
  assert.equal(isUnitOn(f, "C2", "Ch1"), false);
});

test("a narrowed course reports only the picked units as on", () => {
  const f: DeckFilter = { courses: [], units: ["C1::L01"] };
  assert.equal(isUnitOn(f, "C1", "L01"), true);
  assert.equal(isUnitOn(f, "C1", "L02"), false);
});

test("a filter that matches nothing falls back to the whole deck", () => {
  // The course still exists but its units were renamed by a CSV edit.
  assert.deepEqual(ids({ courses: [], units: ["C1::Gone"] }), DECK.map((c) => c.id));
});

test("pruneFilter drops courses and units the deck no longer has", () => {
  const f = pruneFilter({ courses: ["C1", "C9"], units: ["C2::Ch1", "C2::Gone"] }, ["C1", "C2"], [
    "C1::L01",
    "C2::Ch1",
  ]);
  assert.deepEqual(f, { courses: ["C1"], units: ["C2::Ch1"] });
});
