/**
 * What the two DSAI study modes — flashcards (lib/cards.ts) and multiple choice
 * (lib/mcq.ts) — share: both are built from the same DSAI/ folder, one file per deck named
 * COURSE_Unit, so they file their items under the same courses and units.
 *
 * Data-free on purpose. Importing this must not drag one bank into the other's bundle.
 */
import { unitKey, type Filed } from "./deck";

export type Unit = {
  course: string;
  unit: string; // "Lecture_1", "Module_2A"… what the filter stores
  label: string; // "Lecture 1", "Module 2A"… what the UI shows
  count: number;
};

/**
 * Units (lectures, chapters, modules) per course, DERIVED from the data — never hardcoded, so
 * a new file dropped into DSAI/ shows up in the filter after the next rebuild by itself.
 *
 * A unit taken from the file name ("Lecture_1") just needs its underscores spaced out. A unit
 * that came from an Anki tag only carries a code ("Lab1"), so the readable label is the
 * source file stem with the course prefix stripped; a unit spanning two decks keeps its code.
 */
export function deriveUnits(items: (Filed & { deck: string })[]): Unit[] {
  const seen = new Map<string, { course: string; unit: string; decks: Set<string>; count: number }>();
  for (const c of items) {
    const key = unitKey(c.course, c.unit);
    const hit = seen.get(key);
    if (hit) {
      hit.count++;
      hit.decks.add(c.deck);
    } else {
      seen.set(key, { course: c.course, unit: c.unit, decks: new Set([c.deck]), count: 1 });
    }
  }
  return [...seen.values()]
    .map(({ course, unit, decks, count }) => ({
      course,
      unit,
      label: unitLabel(course, unit, decks),
      count,
    }))
    .sort(
      (a, b) =>
        a.course.localeCompare(b.course) ||
        a.label.localeCompare(b.label, undefined, { numeric: true }),
    );
}

export function unitLabel(course: string, unit: string, decks: Set<string>): string {
  if (unit.includes("_")) return unit.replace(/_/g, " ");
  if (decks.size !== 1) return unit;
  const stem = [...decks][0];
  const tail = stem.startsWith(course) ? stem.slice(course.length) : stem;
  const label = tail.replace(/^[_\- ]+/, "").replace(/_/g, " ").trim();
  return label || unit;
}

/**
 * Human names for the course codes. The source files carry no course titles, so nothing is
 * invented here — fill these in and the UI picks them up; a missing entry falls back to the code.
 */
export const COURSE_TITLES: Record<string, string> = {};

export function courseLabel(course: string): string {
  return COURSE_TITLES[course] ?? course;
}
