import raw from "@/data/dsai-questions.json";
import { filterCards, unitKey, type DeckFilter } from "./deck";
import { deriveUnits, type Unit } from "./dsai";

/**
 * One DSAI multiple-choice question, built from DSAI/*.json by `npm run mcq`.
 *
 * Unlike the PMLE bank, every option carries its own explanation — why it is right or wrong —
 * and the question carries a hint to show before answering. `id` is a content hash (see
 * scripts/build-mcq.mjs), so stored answers survive a rebuild after a new deck lands.
 */
export type McqOption = {
  label: string; // "A".."D"
  text: string;
  explanation: string; // may be "" — one source option has none
};

export type Mcq = {
  id: string; // 12 hex chars, stable across rebuilds
  question: string;
  options: McqOption[];
  answers: string[]; // correct option labels
  hint: string;
  course: string; // "COM6001"
  unit: string; // "Lecture_1" — same course/unit as the deck's flashcards
  deck: string; // source file stem
};

export const mcqs: Mcq[] = raw as Mcq[];

export const MCQ_COURSES: string[] = [...new Set(mcqs.map((q) => q.course))].sort();
export const MCQ_UNITS: Unit[] = deriveUnits(mcqs);
export const MCQ_UNIT_KEYS: string[] = MCQ_UNITS.map((u) => unitKey(u.course, u.unit));

export function mcqUnitsForCourse(course: string): Unit[] {
  return MCQ_UNITS.filter((u) => u.course === course);
}

/** Bank order: course, then unit in reading order, then source order within the deck. */
export const MCQ_ORDER: string[] = (() => {
  const rank = new Map(MCQ_UNIT_KEYS.map((k, i) => [k, i]));
  return mcqs
    .map((q, i) => ({ q, i }))
    .sort(
      (a, b) =>
        (rank.get(unitKey(a.q.course, a.q.unit)) ?? 0) -
          (rank.get(unitKey(b.q.course, b.q.unit)) ?? 0) || a.i - b.i,
    )
    .map(({ q }) => q.id);
})();

export const MCQ_BY_ID: Map<string, Mcq> = new Map(mcqs.map((q) => [q.id, q]));

export function mcqsForFilter(filter: DeckFilter): Mcq[] {
  return filterCards(mcqs, filter);
}
