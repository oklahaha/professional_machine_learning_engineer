/**
 * The deck filter: which slice of the flashcard bank the queue is built from.
 *
 * Pure and data-free — it takes the deck as an argument and imports nothing, so it is
 * testable against synthetic cards (lib/deck.test.ts) the way lib/srs.ts is.
 *
 * A filter is two selections, not one: whole courses, and individual units ("COM6001::Lab1")
 * that NARROW their course. So `{courses: ["COM6002"], units: ["COM6001::Lab1"]}` reads as
 * "all of COM6002, plus just Lab 1 of COM6001". A unit selection implies its course is active,
 * which is why the two lists are never contradictory: selecting a unit of an already-whole
 * course replaces the whole-course selection rather than sitting inside it.
 */

/** Anything filed under a course and unit — a flashcard, or a DSAI multiple-choice question. */
export type Filed = { course: string; unit: string };

export type DeckFilter = {
  courses: string[]; // whole-course selections
  units: string[]; // "COURSE::UNIT" — narrows its course to the listed units
};

export const EMPTY_FILTER: DeckFilter = { courses: [], units: [] };

/** How a course is represented in the filter: untouched, whole, or narrowed to some units. */
export type CourseSelection = "off" | "all" | "some";

export function unitKey(course: string, unit: string): string {
  return `${course}::${unit}`;
}

export function courseOf(key: string): string {
  return key.slice(0, key.indexOf("::"));
}

export function isEmptyFilter(f: DeckFilter): boolean {
  return f.courses.length === 0 && f.units.length === 0;
}

export function courseSelection(f: DeckFilter, course: string): CourseSelection {
  if (f.units.some((k) => courseOf(k) === course)) return "some";
  return f.courses.includes(course) ? "all" : "off";
}

/** Is this unit in the current cut — either picked directly, or swept in by its whole course? */
export function isUnitOn(f: DeckFilter, course: string, unit: string): boolean {
  const sel = courseSelection(f, course);
  if (sel === "all") return true;
  if (sel === "off") return false;
  return f.units.includes(unitKey(course, unit));
}

/**
 * Toggling the course itself is all-or-nothing: a course that is on in any form (whole, or
 * narrowed to a couple of units) switches off completely, taking its unit selections with it.
 */
export function toggleCourse(f: DeckFilter, course: string): DeckFilter {
  if (courseSelection(f, course) === "off") {
    return { courses: [...f.courses, course], units: f.units };
  }
  return {
    courses: f.courses.filter((c) => c !== course),
    units: f.units.filter((k) => courseOf(k) !== course),
  };
}

/**
 * Toggling a unit narrows its course. Picking one unit of a whole course means "just this
 * one", so the whole-course selection is dropped; unpicking the last unit leaves the course
 * off entirely rather than silently reverting to all of it.
 */
export function toggleUnit(f: DeckFilter, course: string, unit: string): DeckFilter {
  const key = unitKey(course, unit);
  if (f.units.includes(key)) {
    return { courses: f.courses, units: f.units.filter((k) => k !== key) };
  }
  return {
    courses: f.courses.filter((c) => c !== course),
    units: [...f.units, key],
  };
}

/** Drop selections that no longer exist in the deck (an edited CSV, a stale stored filter). */
export function pruneFilter(f: DeckFilter, courses: string[], unitKeys: string[]): DeckFilter {
  return {
    courses: f.courses.filter((c) => courses.includes(c)),
    units: f.units.filter((k) => unitKeys.includes(k)),
  };
}

export function filterCards<T extends Filed>(deck: T[], f: DeckFilter): T[] {
  if (isEmptyFilter(f)) return deck;

  // A course with unit selections is restricted to them; a course selected whole has no entry
  // here and passes every unit.
  const narrowed = new Map<string, Set<string>>();
  for (const key of f.units) {
    const course = courseOf(key);
    const set = narrowed.get(course);
    if (set) set.add(key);
    else narrowed.set(course, new Set([key]));
  }

  const whole = new Set(f.courses);
  const cut = deck.filter((c) => {
    const units = narrowed.get(c.course);
    if (units) return units.has(unitKey(c.course, c.unit));
    return whole.has(c.course);
  });

  // A filter naming something that no longer exists would leave nothing to study. Fall back to
  // the whole deck rather than an empty queue — `buildQueue` must always have cards to walk.
  return cut.length > 0 ? cut : deck;
}
