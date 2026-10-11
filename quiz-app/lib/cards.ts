import raw from "@/data/cards.json";
import { filterCards, unitKey, type DeckFilter } from "./deck";
import { deriveUnits, type Unit } from "./dsai";

export { COURSE_TITLES, courseLabel, type Unit } from "./dsai";

/**
 * One flashcard, built from the Anki-export CSVs by `npm run cards`.
 *
 * `id` is a content hash, NOT a row number — see scripts/build-cards.mjs. Spaced-repetition
 * state is stored against it, so it has to survive a rebuild after a new deck is dropped in.
 */
export type Card = {
  id: string; // 12 hex chars, stable across rebuilds
  front: string;
  back: string;
  course: string; // "COM6001"
  unit: string; // "Lecture_1", "Module_2A"… from the file name (or an Anki tag's code)
  topic: string; // "" for the DSAI CSVs, which carry no tags; an Anki tag's topic otherwise
  tag: string; // "COM6001::Lecture_1", or "COURSE::UNIT::topic" when the row had a tag
  deck: string; // source file stem, "COM6001_Lecture_1"
};

export const cards: Card[] = raw as Card[];

/**
 * Courses and units are DERIVED from the data, never hardcoded. That is the whole reason a new
 * CSV dropped into DSAI/ needs no code change: it simply appears here after the next `npm run cards`.
 */
export const COURSES: string[] = [...new Set(cards.map((c) => c.course))].sort();

/** Units per course — derived, like COURSES. See lib/dsai.ts. */
export const UNITS: Unit[] = deriveUnits(cards);

export const UNIT_KEYS: string[] = UNITS.map((u) => unitKey(u.course, u.unit));

export function unitsForCourse(course: string): Unit[] {
  return UNITS.filter((u) => u.course === course);
}

/** The slice of the bank the queue is built from. See lib/deck.ts for the filter's semantics. */
export function cardsForFilter(filter: DeckFilter): Card[] {
  return filterCards(cards, filter);
}
