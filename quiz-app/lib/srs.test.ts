import assert from "node:assert/strict";
import { test } from "node:test";

import type { Card } from "./cards.ts";
import {
  DAY,
  EASY_INTERVAL,
  GRADUATING_INTERVAL,
  LEARNING_STEPS,
  MINUTE,
  MIN_EASE,
  RELEARN_STEPS,
  buildQueue,
  countCards,
  dayKey,
  formatInterval,
  initialState,
  isDue,
  previewIntervals,
  requeue,
  schedule,
  startOfLocalDay,
  type CardState,
  type Grade,
  type States,
} from "./srs.ts";

// A fixed clock, mid-morning so nothing lands on a day boundary by accident.
const NOW = new Date(2026, 0, 15, 10, 0, 0).getTime();

// fuzzSeed 0 throughout: the tests assert exact intervals, and fuzz is deliberately
// off-by-design in that case (see applyFuzz).
const grade = (s: CardState, g: Grade, at = NOW) => schedule(s, g, at);

function run(grades: Grade[], at = NOW): CardState {
  return grades.reduce((s, g) => schedule(s, g, at), initialState());
}

const card = (id: string, course = "COM6001", unit = "L01"): Card => ({
  id,
  front: `front ${id}`,
  back: `back ${id}`,
  course,
  unit,
  topic: "t",
  tag: `${course}::${unit}::t`,
  deck: `${course}_${unit}`,
});

test("a new card walks the learning steps before reaching the day scale", () => {
  const s0 = initialState();
  assert.equal(s0.phase, "new");

  const s1 = grade(s0, 3); // Good
  assert.equal(s1.phase, "learning");
  assert.equal(s1.step, 1);
  assert.equal(s1.due, NOW + LEARNING_STEPS[1] * MINUTE);

  const s2 = grade(s1, 3); // Good again — past the last step, so it graduates
  assert.equal(s2.phase, "review");
  assert.equal(s2.interval, GRADUATING_INTERVAL);
  // Reviews are day-granular: due at the START of the target day, not 24h from now.
  assert.equal(s2.due, startOfLocalDay(NOW) + GRADUATING_INTERVAL * DAY);
});

test("Easy on a new card skips the learning steps entirely", () => {
  const s = grade(initialState(), 4);
  assert.equal(s.phase, "review");
  assert.equal(s.interval, EASY_INTERVAL);
});

test("Again restarts the learning steps; Hard repeats the current one", () => {
  const atStep1 = run([3]);
  assert.equal(atStep1.step, 1);

  const again = grade(atStep1, 1);
  assert.equal(again.phase, "learning");
  assert.equal(again.step, 0);
  assert.equal(again.due, NOW + LEARNING_STEPS[0] * MINUTE);

  const hard = grade(atStep1, 2);
  assert.equal(hard.step, 1, "Hard holds the step rather than advancing");
  assert.equal(hard.due, NOW + LEARNING_STEPS[1] * MINUTE);
});

test("review intervals compound by the ease factor", () => {
  const graduated = run([3, 3]); // interval 1, ease 2.5
  assert.equal(graduated.interval, 1);
  assert.equal(graduated.ease, 2.5);

  const r1 = grade(graduated, 3);
  assert.equal(r1.interval, 3); // 1 * 2.5 = 2.5 → 3
  assert.equal(r1.ease, 2.5, "Good leaves ease alone");

  const r2 = grade(r1, 3);
  assert.equal(r2.interval, 8); // 3 * 2.5 = 7.5 → 8

  const r3 = grade(r2, 3);
  assert.equal(r3.interval, 20); // 8 * 2.5
});

test("Hard and Easy bend the interval and the ease in opposite directions", () => {
  const base: CardState = { ...initialState(), phase: "review", interval: 10, reps: 3 };

  const hard = grade(base, 2);
  assert.equal(hard.interval, 12); // 10 * 1.2
  assert.equal(hard.ease, 2.35); // 2.5 - 0.15

  const easy = grade(base, 4);
  assert.equal(easy.interval, 33); // 10 * 2.5 * 1.3 = 32.5 → 33
  assert.equal(easy.ease, 2.65); // 2.5 + 0.15
});

test("a Hard answer on a 1-day interval still moves forward", () => {
  // 1 * 1.2 rounds back to 1 — without the floor the card would be stuck at a day forever.
  const base: CardState = { ...initialState(), phase: "review", interval: 1 };
  assert.equal(grade(base, 2).interval, 2);
});

test("Again on a review lapses it into relearning and resets the interval", () => {
  const base: CardState = { ...initialState(), phase: "review", interval: 40, ease: 2.5, reps: 8 };
  const lapsed = grade(base, 1);

  assert.equal(lapsed.phase, "relearning");
  assert.equal(lapsed.lapses, 1);
  assert.equal(lapsed.ease, 2.3, "a lapse costs 0.20 of ease");
  assert.equal(lapsed.interval, 1, "the old 40-day spacing is not restored on graduation");
  assert.equal(lapsed.due, NOW + RELEARN_STEPS[0] * MINUTE);

  const back = grade(lapsed, 3);
  assert.equal(back.phase, "review");
  assert.equal(back.interval, 1);
});

test("ease never falls below the floor", () => {
  let s: CardState = { ...initialState(), phase: "review", interval: 5, ease: MIN_EASE };
  for (let i = 0; i < 5; i++) s = grade(s, 2); // Hard, repeatedly
  assert.equal(s.ease, MIN_EASE);
});

test("previewIntervals says exactly what each button will do", () => {
  const s = run([3, 3]); // a review card, interval 1
  const preview = previewIntervals(s, NOW);
  for (const g of [1, 2, 3, 4] as Grade[]) {
    assert.equal(preview[g], formatInterval(schedule(s, g, NOW), NOW), `grade ${g}`);
  }
  assert.equal(preview[1], "10m", "Again drops it to the relearning step");
  assert.equal(preview[2], "2d");
});

test("formatInterval switches units as the spacing grows", () => {
  const review = (interval: number): CardState => ({ ...initialState(), phase: "review", interval });
  assert.equal(formatInterval(review(6), NOW), "6d");
  assert.equal(formatInterval(review(45), NOW), "1.5mo");
  assert.equal(formatInterval(review(730), NOW), "2.0y");
  assert.equal(formatInterval({ ...initialState(), phase: "learning", due: NOW + 30_000 }, NOW), "<1m");
});

test("isDue is day-granular for reviews and minute-precise for learning", () => {
  const laterToday: CardState = { ...initialState(), phase: "review", interval: 1, due: NOW + 6 * 3600_000 };
  assert.ok(isDue(laterToday, NOW), "a review landing today is due today");

  const tomorrow: CardState = { ...initialState(), phase: "review", interval: 1, due: startOfLocalDay(NOW) + DAY };
  assert.ok(!isDue(tomorrow, NOW));
  assert.ok(isDue(tomorrow, NOW + DAY));

  const step: CardState = { ...initialState(), phase: "learning", due: NOW + 10 * MINUTE };
  assert.ok(!isDue(step, NOW), "a learning step must actually elapse");
  assert.ok(isDue(step, NOW + 10 * MINUTE));
});

test("buildQueue respects the daily limits and counts what is already done", () => {
  const deck = Array.from({ length: 50 }, (_, i) => card(`c${i}`));
  const states: States = {};

  const q = buildQueue(deck, states, { newPerDay: 5, reviewPerDay: 200, newDone: 0, reviewsDone: 0 }, NOW);
  assert.equal(q.length, 5);

  const resumed = buildQueue(deck, states, { newPerDay: 5, reviewPerDay: 200, newDone: 3, reviewsDone: 0 }, NOW);
  assert.equal(resumed.length, 2, "re-opening mid-day resumes rather than restarting");

  const done = buildQueue(deck, states, { newPerDay: 5, reviewPerDay: 200, newDone: 9, reviewsDone: 0 }, NOW);
  assert.equal(done.length, 0, "an over-run limit clamps to zero rather than going negative");
});

test("buildQueue puts elapsed learning steps first and never repeats a card", () => {
  const deck = [card("new1"), card("due1"), card("learn1"), card("later")];
  const states: States = {
    due1: { ...initialState(), phase: "review", interval: 3, due: startOfLocalDay(NOW) },
    learn1: { ...initialState(), phase: "learning", step: 1, due: NOW - MINUTE },
    later: { ...initialState(), phase: "review", interval: 9, due: startOfLocalDay(NOW) + 5 * DAY },
  };

  const q = buildQueue(deck, states, { newPerDay: 20, reviewPerDay: 200, newDone: 0, reviewsDone: 0 }, NOW);
  assert.equal(q[0], "learn1", "time-sensitive steps lead");
  assert.ok(!q.includes("later"), "a card due next week is not in today's queue");
  assert.equal(new Set(q).size, q.length, "no card appears twice");
  assert.deepEqual([...q].sort(), ["due1", "learn1", "new1"]);
});

test("buildQueue mixes new cards through the reviews instead of queueing them last", () => {
  const deck = [
    ...Array.from({ length: 6 }, (_, i) => card(`r${i}`)),
    ...Array.from({ length: 3 }, (_, i) => card(`n${i}`)),
  ];
  const states: States = {};
  for (let i = 0; i < 6; i++) {
    states[`r${i}`] = { ...initialState(), phase: "review", interval: 4, due: startOfLocalDay(NOW) };
  }

  const q = buildQueue(deck, states, { newPerDay: 20, reviewPerDay: 200, newDone: 0, reviewsDone: 0 }, NOW);
  assert.equal(q.length, 9);
  const firstNew = q.findIndex((id) => id.startsWith("n"));
  assert.ok(firstNew < 6, `a new card should appear early, got index ${firstNew}`);
});

test("countCards splits the deck the way the deck panel reports it", () => {
  const deck = [card("a"), card("b"), card("c"), card("d")];
  const states: States = {
    b: { ...initialState(), phase: "review", interval: 30, due: startOfLocalDay(NOW) },
    c: { ...initialState(), phase: "relearning", due: NOW + MINUTE },
    d: { ...initialState(), phase: "review", interval: 5, due: startOfLocalDay(NOW) + 9 * DAY },
  };

  const counts = countCards(deck, states, NOW);
  assert.equal(counts.total, 4);
  assert.equal(counts.fresh, 1);
  assert.equal(counts.learning, 1);
  assert.equal(counts.due, 1, "only b lands today");
  assert.equal(counts.mature, 1, "30 days is mature, 5 is not");
});

test("requeue puts a learning card back a few cards later, never next", () => {
  const q = ["a", "b", "c", "d", "e"];
  assert.deepEqual(requeue(q, "a", 3), ["b", "c", "d", "a", "e"]);
  // and it clamps rather than falling off the end of a short queue
  assert.deepEqual(requeue(["a", "b"], "a", 3), ["b", "a"]);
  assert.deepEqual(requeue(["a"], "a", 3), ["a"]);
});

test("dayKey buckets on local midnight", () => {
  assert.equal(dayKey(new Date(2026, 0, 15, 23, 59, 59).getTime()), "2026-01-15");
  assert.equal(dayKey(new Date(2026, 0, 16, 0, 0, 1).getTime()), "2026-01-16");
});

test("the graduating interval is never fuzzed — the Easy button promises exactly 4 days", () => {
  // Fuzz on graduation would make the preview on the button disagree with what the click does.
  for (const seed of [1, 99, 12345, 0xbeef]) {
    assert.equal(schedule(initialState(), 4, NOW, seed).interval, EASY_INTERVAL, `seed ${seed}`);
    assert.equal(run([3]).step, 1);
    assert.equal(schedule(run([3]), 3, NOW, seed).interval, GRADUATING_INTERVAL, `seed ${seed}`);
  }
});

test("fuzz is deterministic per card and keeps intervals sane", () => {
  const base: CardState = { ...initialState(), phase: "review", interval: 30, ease: 2.5 };
  const a1 = schedule(base, 3, NOW, 12345);
  const a2 = schedule(base, 3, NOW, 12345);
  assert.equal(a1.interval, a2.interval, "the same card fuzzes the same way every time");

  const unfuzzed = schedule(base, 3, NOW).interval; // 75
  assert.ok(
    Math.abs(a1.interval - unfuzzed) <= Math.max(1, Math.round(unfuzzed * 0.05)),
    `fuzz stayed within range: ${a1.interval} vs ${unfuzzed}`,
  );
});
