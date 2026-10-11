/**
 * SM-2 spaced repetition, as Anki implements it — the scheduling core for the flashcard mode.
 *
 * Every function here is pure and takes `now` explicitly: no Date.now(), no storage, no React.
 * That is what makes the whole scheduler testable against a fixed clock (lib/srs.test.ts), and
 * it keeps the server and client renders from disagreeing about what is due.
 */
import type { Card } from "./cards";

export type Grade = 1 | 2 | 3 | 4; // Again · Hard · Good · Easy

export const GRADES: Grade[] = [1, 2, 3, 4];

export const GRADE_LABEL: Record<Grade, string> = {
  1: "Again",
  2: "Hard",
  3: "Good",
  4: "Easy",
};

/**
 * "new" has never been seen; "learning" is climbing the minute-scale steps for the first time;
 * "review" is on the day-scale interval; "relearning" is climbing back after a lapse.
 */
export type Phase = "new" | "learning" | "review" | "relearning";

export type CardState = {
  phase: Phase;
  step: number; // index into LEARNING_STEPS / RELEARN_STEPS
  ease: number; // multiplier applied to the interval on a Good answer
  interval: number; // days — meaningful once phase is "review"
  reps: number;
  lapses: number;
  due: number; // epoch ms; learning steps are minute-precise, reviews land on local midnight
};

export type States = Record<string, CardState>;

export const MINUTE = 60_000;
export const DAY = 86_400_000;

export const LEARNING_STEPS = [1, 10]; // minutes
export const RELEARN_STEPS = [10]; // minutes
export const GRADUATING_INTERVAL = 1; // days, after the last learning step
export const EASY_INTERVAL = 4; // days, when a new card is graded Easy straight away
export const STARTING_EASE = 2.5;
export const MIN_EASE = 1.3;
export const HARD_MULT = 1.2;
export const EASY_BONUS = 1.3;
export const LAPSE_MULT = 0; // a lapsed card restarts at the 1-day floor
export const MAX_INTERVAL = 3650; // 10 years
export const MATURE_INTERVAL = 21; // days — Anki's mature/young boundary

const EASE_DELTA: Record<Grade, number> = { 1: -0.2, 2: -0.15, 3: 0, 4: 0.15 };

export function initialState(): CardState {
  return { phase: "new", step: 0, ease: STARTING_EASE, interval: 0, reps: 0, lapses: 0, due: 0 };
}

export function stateOf(states: States, id: string): CardState {
  return states[id] ?? initialState();
}

export function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfLocalDay(ms: number): number {
  return startOfLocalDay(ms) + DAY - 1;
}

/** Local-midnight day bucket for the daily new/review counters. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Deterministic interval fuzz, so two cards graded the same way on the same day don't stay
 * welded together forever. Seeded off the card id rather than Math.random: the same card
 * always fuzzes the same way, which keeps reloads stable and tests reproducible.
 */
function fuzzRange(interval: number): number {
  if (interval < 3) return 0;
  if (interval < 7) return 1;
  if (interval < 21) return Math.max(1, Math.round(interval * 0.15));
  return Math.max(1, Math.round(interval * 0.05));
}

function applyFuzz(interval: number, seed: number): number {
  const r = fuzzRange(interval);
  if (r === 0 || seed === 0) return interval;
  // same LCG as lib/present.ts — one step is plenty for a ±r pick
  const s = (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
  const delta = (s % (2 * r + 1)) - r;
  return Math.max(1, interval + delta);
}

/** A string seed (a card id) folded into the 32-bit space the fuzz LCG wants. */
export function seedFrom(id: string, salt = 0): number {
  let h = 0x811c9dc5 ^ salt;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0 || 1;
}

const clampEase = (e: number) => Math.max(MIN_EASE, Math.round(e * 100) / 100);
const clampInterval = (i: number) => Math.min(MAX_INTERVAL, Math.max(1, Math.round(i)));

/** Reviews are day-granular: a card due "in 1 day" becomes available at tomorrow's midnight. */
function dueInDays(now: number, days: number): number {
  return startOfLocalDay(now) + days * DAY;
}

/**
 * Leave the learning steps for the day scale. The graduating interval is NOT fuzzed — a card
 * graded Easy is promised 4 days and must get exactly 4 days, or the button lies. Fuzz belongs
 * on review answers, where the point is to stop cards clumping decades out.
 */
function graduate(state: CardState, now: number, days: number): CardState {
  const interval = clampInterval(days);
  return { ...state, phase: "review", step: 0, interval, due: dueInDays(now, interval) };
}

/**
 * The scheduler. Returns the card's next state — it never mutates the one passed in.
 *
 * `fuzzSeed` should be derived from the card id (see seedFrom); 0 disables fuzz, which is what
 * the tests use so that intervals are exact.
 */
export function schedule(state: CardState, grade: Grade, now: number, fuzzSeed = 0): CardState {
  const next: CardState = { ...state, reps: state.reps + 1 };
  const seed = fuzzSeed === 0 ? 0 : (fuzzSeed ^ Math.imul(state.reps + 1, 2654435761)) >>> 0;

  if (state.phase === "review") {
    if (grade === 1) {
      // Lapse: ease drops, the card falls back to the minute-scale relearning steps, and its
      // interval is reset to the floor so graduating does not restore the old spacing.
      return {
        ...next,
        phase: "relearning",
        step: 0,
        ease: clampEase(state.ease + EASE_DELTA[1]),
        interval: clampInterval(Math.max(1, state.interval * LAPSE_MULT)),
        lapses: state.lapses + 1,
        due: now + RELEARN_STEPS[0] * MINUTE,
      };
    }
    const ease = clampEase(state.ease + EASE_DELTA[grade]);
    const base =
      grade === 2
        ? state.interval * HARD_MULT
        : grade === 3
          ? state.interval * state.ease
          : state.interval * state.ease * EASY_BONUS;
    // Always move forward by at least a day, or a 1-day interval graded Hard would never grow.
    const interval = clampInterval(applyFuzz(Math.max(state.interval + 1, Math.round(base)), seed));
    return { ...next, ease, interval, due: dueInDays(now, interval) };
  }

  const relearning = state.phase === "relearning";
  const steps = relearning ? RELEARN_STEPS : LEARNING_STEPS;
  const phase: Phase = relearning ? "relearning" : "learning";

  if (grade === 1) {
    return { ...next, phase, step: 0, due: now + steps[0] * MINUTE };
  }
  if (grade === 4) {
    // Easy on a new card jumps straight to the day scale; on a relearning card it restores the
    // post-lapse interval rather than the pre-lapse one.
    return graduate(next, now, relearning ? Math.max(1, state.interval) : EASY_INTERVAL);
  }
  if (grade === 2) {
    // Hard repeats the current step instead of advancing.
    const step = Math.min(state.step, steps.length - 1);
    return { ...next, phase, step, due: now + steps[step] * MINUTE };
  }
  const step = state.step + 1;
  if (step >= steps.length) {
    return graduate(next, now, relearning ? Math.max(1, state.interval) : GRADUATING_INTERVAL);
  }
  return { ...next, phase, step, due: now + steps[step] * MINUTE };
}

/** Human-readable spacing, in Anki's vocabulary: "<1m", "10m", "3d", "2.1mo". */
export function formatInterval(state: CardState, now: number): string {
  if (state.phase === "review") {
    const d = state.interval;
    if (d < 30) return `${d}d`;
    if (d < 365) return `${(d / 30).toFixed(1)}mo`;
    return `${(d / 365).toFixed(1)}y`;
  }
  // Compare before rounding: 30 seconds must read "<1m", not round up to a minute it has not earned.
  const mins = Math.max(0, (state.due - now) / MINUTE);
  if (mins < 1) return "<1m";
  const m = Math.round(mins);
  if (m < 60) return `${m}m`;
  return `${Math.round(m / 60)}h`;
}

/**
 * What each button would do, shown on the buttons themselves. This is the thing that makes a
 * flashcard app read as Anki — and it is just the scheduler run four times, so the preview can
 * never drift from what actually happens on click.
 */
export function previewIntervals(
  state: CardState,
  now: number,
  fuzzSeed = 0,
): Record<Grade, string> {
  const out = {} as Record<Grade, string>;
  for (const g of GRADES) out[g] = formatInterval(schedule(state, g, now, fuzzSeed), now);
  return out;
}

export function isDue(state: CardState, now: number): boolean {
  if (state.phase === "new") return true;
  // Reviews are day-granular, so anything landing today counts as due today; learning steps
  // are minute-precise and must actually have elapsed.
  if (state.phase === "review") return state.due <= endOfLocalDay(now);
  return state.due <= now;
}

export function isMature(state: CardState): boolean {
  return state.phase === "review" && state.interval >= MATURE_INTERVAL;
}

export type Counts = {
  total: number;
  fresh: number; // never studied
  learning: number; // in learning/relearning, whether or not the step has elapsed
  due: number; // reviews landing today
  mature: number;
};

export function countCards(deck: Card[], states: States, now: number): Counts {
  const counts: Counts = { total: deck.length, fresh: 0, learning: 0, due: 0, mature: 0 };
  for (const c of deck) {
    const s = states[c.id];
    if (!s || s.phase === "new") {
      counts.fresh++;
      continue;
    }
    if (s.phase === "review") {
      if (s.due <= endOfLocalDay(now)) counts.due++;
      if (isMature(s)) counts.mature++;
    } else counts.learning++;
  }
  return counts;
}

export type QueueOptions = {
  newPerDay: number;
  reviewPerDay: number;
  newDone: number; // already introduced today
  reviewsDone: number; // already reviewed today
};

/**
 * The study queue for right now: elapsed learning steps first (they are the most time-sensitive),
 * then today's reviews with new cards mixed evenly through them — studying 40 reviews before the
 * first new card is technically correct and miserable in practice.
 *
 * Daily limits are counted against what has already been done today, so re-opening the app
 * mid-day resumes rather than restarts.
 */
export function buildQueue(deck: Card[], states: States, opts: QueueOptions, now: number): string[] {
  const learningIds: string[] = [];
  const reviews: string[] = [];
  const fresh: string[] = [];

  for (const c of deck) {
    const s = states[c.id];
    if (!s || s.phase === "new") {
      fresh.push(c.id);
    } else if (s.phase === "review") {
      if (s.due <= endOfLocalDay(now)) reviews.push(c.id);
    } else if (s.due <= now) {
      learningIds.push(c.id);
    }
  }

  learningIds.sort((a, b) => states[a].due - states[b].due);
  reviews.sort((a, b) => states[a].due - states[b].due);

  const reviewCap = Math.max(0, opts.reviewPerDay - opts.reviewsDone);
  const newCap = Math.max(0, opts.newPerDay - opts.newDone);
  const dueReviews = reviews.slice(0, reviewCap);
  const newCards = fresh.slice(0, newCap);

  if (newCards.length === 0) return [...learningIds, ...dueReviews];
  if (dueReviews.length === 0) return [...learningIds, ...newCards];

  const mixed: string[] = [];
  const stride = dueReviews.length / newCards.length;
  let taken = 0;
  dueReviews.forEach((id, i) => {
    mixed.push(id);
    while (taken < newCards.length && (taken + 1) * stride <= i + 1) mixed.push(newCards[taken++]);
  });
  while (taken < newCards.length) mixed.push(newCards[taken++]);

  return [...learningIds, ...mixed];
}

/**
 * Where a card that is still in learning goes back into the queue. Anki shows it again after a
 * few other cards rather than immediately — seeing the same card twice in a row teaches the
 * screen, not the fact.
 */
export const LEARN_AHEAD_GAP = 3;

export function requeue(queue: string[], id: string, gap = LEARN_AHEAD_GAP): string[] {
  const rest = queue.filter((x) => x !== id);
  const at = Math.min(gap, rest.length);
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}
