"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { COURSES, UNIT_KEYS, cards, cardsForFilter, courseLabel, unitsForCourse } from "@/lib/cards";
import {
  EMPTY_FILTER,
  pruneFilter,
  toggleCourse as toggleCourseIn,
  toggleUnit as toggleUnitIn,
  type DeckFilter,
} from "@/lib/deck";
import {
  MAX_INTERVAL,
  MIN_EASE,
  STARTING_EASE,
  buildQueue,
  countCards,
  dayKey,
  previewIntervals,
  requeue,
  schedule,
  seedFrom,
  stateOf,
  type CardState,
  type Grade,
  type Phase,
  type States,
} from "@/lib/srs";
import DeckPanel, { type CourseStat } from "./DeckPanel";
import Flashcard from "./Flashcard";
import ModeSwitch from "./ModeSwitch";

// v1: SM-2 states keyed by the content-hash card id. Deliberately not the quiz's key —
// the two modes share a build, not a save file.
const STORAGE_KEY = "msc-cards-srs-v1";

const DEFAULT_LIMITS = { newPerDay: 20, reviewPerDay: 200 };
const EMPTY_DAY: DayLog = { newDone: 0, reviewsDone: 0 };

type DayLog = { newDone: number; reviewsDone: number };
type Limits = { newPerDay: number; reviewPerDay: number };

type Persisted = {
  version: 1;
  states: States;
  log: Record<string, DayLog>; // "YYYY-MM-DD" (local midnight) -> what was done that day
  limits: Limits;
  courses: string[]; // whole-course filter; empty = the whole deck
  units: string[]; // "COURSE::UNIT" selections narrowing their course; see lib/deck.ts
  shuffleSeed?: number; // 0/absent = deck order; added field, still version 1
};

const CARD_IDS = new Set(cards.map((c) => c.id));
const PHASES = new Set<Phase>(["new", "learning", "review", "relearning"]);

const clamp = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

/**
 * Stored scheduling state is never trusted: it can be months old, hand-edited in devtools, or
 * written by an earlier version of this file. Coerce every field into range rather than letting
 * a NaN interval or an unknown phase wedge the queue.
 */
function sanitizeState(v: unknown): CardState | null {
  if (!v || typeof v !== "object") return null;
  const s = v as Record<string, unknown>;
  if (typeof s.phase !== "string" || !PHASES.has(s.phase as Phase)) return null;
  return {
    phase: s.phase as Phase,
    step: clamp(s.step, 0, 16, 0),
    ease: clamp(s.ease, MIN_EASE, 5, STARTING_EASE),
    interval: clamp(s.interval, 0, MAX_INTERVAL, 0),
    reps: clamp(s.reps, 0, 1e6, 0),
    lapses: clamp(s.lapses, 0, 1e6, 0),
    due: clamp(s.due, 0, Number.MAX_SAFE_INTEGER, 0),
  };
}

function load(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Persisted>;

    const states: States = {};
    if (p.states && typeof p.states === "object") {
      for (const [id, v] of Object.entries(p.states)) {
        // Orphan: editing a card's Front changes its content hash, so this schedule no longer
        // belongs to any card in the deck. Drop it instead of carrying it forever.
        if (!CARD_IDS.has(id)) continue;
        const s = sanitizeState(v);
        if (s) states[id] = s;
      }
    }

    const log: Record<string, DayLog> = {};
    if (p.log && typeof p.log === "object") {
      for (const [k, v] of Object.entries(p.log)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !v || typeof v !== "object") continue;
        const d = v as Partial<DayLog>;
        log[k] = {
          newDone: clamp(d.newDone, 0, 1e6, 0),
          reviewsDone: clamp(d.reviewsDone, 0, 1e6, 0),
        };
      }
    }

    return {
      version: 1,
      states,
      log,
      limits: {
        newPerDay: clamp(p.limits?.newPerDay, 0, 9999, DEFAULT_LIMITS.newPerDay),
        reviewPerDay: clamp(p.limits?.reviewPerDay, 0, 9999, DEFAULT_LIMITS.reviewPerDay),
      },
      // A stored course or unit that no longer exists (an edited CSV) would hide the deck
      // behind a filter matching nothing. Prune it against what the bank actually has.
      ...pruneFilter(
        {
          courses: Array.isArray(p.courses) ? p.courses : [],
          units: Array.isArray(p.units) ? p.units : [],
        },
        COURSES,
        UNIT_KEYS,
      ),
      shuffleSeed:
        typeof p.shuffleSeed === "number" && Number.isInteger(p.shuffleSeed) && p.shuffleSeed > 0
          ? p.shuffleSeed >>> 0
          : 0,
    };
  } catch {
    return null;
  }
}

export default function FlashcardApp() {
  const [states, setStates] = useState<States>({});
  const [log, setLog] = useState<Record<string, DayLog>>({});
  const [limits, setLimits] = useState<Limits>(DEFAULT_LIMITS);
  const [filter, setFilter] = useState<DeckFilter>(EMPTY_FILTER);
  const [shuffleSeed, setShuffleSeed] = useState(0); // 0 = deck order
  const [queue, setQueue] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [showLimits, setShowLimits] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // Session clock. Stays 0 until hydration so the server render and the first client render
  // agree — what is "due" depends on the wall clock, which the server cannot know.
  const [now, setNow] = useState(0);

  const deck = useMemo(() => cardsForFilter(filter), [filter]);

  const fill = useCallback(
    (s: States, l: Record<string, DayLog>, lim: Limits, d: typeof cards, at: number, seed = shuffleSeed) => {
      const today = l[dayKey(at)] ?? EMPTY_DAY;
      return buildQueue(
        d,
        s,
        { ...lim, newDone: today.newDone, reviewsDone: today.reviewsDone, shuffleSeed: seed },
        at,
      );
    },
    [shuffleSeed],
  );

  useEffect(() => {
    const p = load();
    const at = Date.now();
    const s = p?.states ?? {};
    const l = p?.log ?? {};
    const lim = p?.limits ?? DEFAULT_LIMITS;
    const f: DeckFilter = { courses: p?.courses ?? [], units: p?.units ?? [] };
    setStates(s);
    setLog(l);
    setLimits(lim);
    setFilter(f);
    setShuffleSeed(p?.shuffleSeed ?? 0);
    setNow(at);
    setQueue(fill(s, l, lim, cardsForFilter(f), at, p?.shuffleSeed ?? 0));
    setHydrated(true);
    // Mount-only: `fill` changes identity with the seed, and re-running this would reload storage.
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const p: Persisted = {
      version: 1,
      states,
      log,
      limits,
      courses: filter.courses,
      units: filter.units,
      shuffleSeed,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      /* storage may be unavailable (private mode) — ignore */
    }
  }, [hydrated, states, log, limits, filter, shuffleSeed]);

  // Nothing left right now, but a learning step is a minute away: poll gently so the queue
  // refills itself instead of stranding the user on the "done" panel. Only runs while empty.
  useEffect(() => {
    if (!hydrated || queue.length > 0) return;
    const t = setInterval(() => {
      const at = Date.now();
      const next = fill(states, log, limits, deck, at);
      if (next.length > 0) {
        setQueue(next);
        setNow(at);
      }
    }, 30_000);
    return () => clearInterval(t);
  }, [hydrated, queue.length, states, log, limits, deck, fill]);

  const today = log[dayKey(now)] ?? EMPTY_DAY;
  const currentId = queue[0];
  const card = currentId ? cards.find((c) => c.id === currentId) : undefined;
  const cardState = currentId ? stateOf(states, currentId) : null;

  const previews = useMemo(
    () =>
      card && cardState
        ? previewIntervals(cardState, now, seedFrom(card.id))
        : ({ 1: "", 2: "", 3: "", 4: "" } as Record<Grade, string>),
    [card, cardState, now],
  );

  const counts = useMemo(() => countCards(deck, states, now), [deck, states, now]);

  const courseStats = useMemo<CourseStat[]>(
    () =>
      COURSES.map((course) => ({
        course,
        label: courseLabel(course),
        counts: countCards(
          cards.filter((c) => c.course === course),
          states,
          now,
        ),
        units: unitsForCourse(course).map((u) => ({
          unit: u.unit,
          label: u.label,
          counts: countCards(
            cards.filter((c) => c.course === course && c.unit === u.unit),
            states,
            now,
          ),
        })),
      })),
    [states, now],
  );

  const grade = useCallback(
    (g: Grade) => {
      const id = queue[0];
      if (!id) return;
      const at = Date.now();
      const prev = stateOf(states, id);
      const next = schedule(prev, g, at, seedFrom(id));

      const nextStates = { ...states, [id]: next };
      const key = dayKey(at);
      const before = log[key] ?? EMPTY_DAY;
      // Only the first sight of a card counts as "new" and only a day-scale answer counts as a
      // "review" — climbing the learning steps must not eat the daily review allowance.
      const nextLog = {
        ...log,
        [key]: {
          newDone: before.newDone + (prev.phase === "new" ? 1 : 0),
          reviewsDone: before.reviewsDone + (prev.phase === "review" ? 1 : 0),
        },
      };

      const stillLearning = next.phase === "learning" || next.phase === "relearning";
      let nextQueue = stillLearning ? requeue(queue, id) : queue.filter((x) => x !== id);
      if (nextQueue.length === 0) nextQueue = fill(nextStates, nextLog, limits, deck, at);

      setStates(nextStates);
      setLog(nextLog);
      setQueue(nextQueue);
      setRevealed(false);
      setNow(at);
    },
    [queue, states, log, limits, deck, fill],
  );

  // Anki's keys: space reveals, 1–4 grade. Ignored while typing in the limit inputs.
  useEffect(() => {
    if (!hydrated) return;
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (!queue[0]) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
        return;
      }
      if (revealed && e.key >= "1" && e.key <= "4") {
        e.preventDefault();
        grade(Number(e.key) as Grade);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hydrated, revealed, queue, grade]);

  const applyLimits = useCallback(
    (next: Limits) => {
      const at = Date.now();
      setLimits(next);
      setNow(at);
      setQueue(fill(states, log, next, deck, at));
    },
    [states, log, deck, fill],
  );

  // Any filter change re-cuts the deck, so the queue is rebuilt from scratch — a half-graded
  // card from the old cut must not survive into the new one.
  const applyFilter = useCallback(
    (next: DeckFilter) => {
      const at = Date.now();
      setFilter(next);
      setRevealed(false);
      setNow(at);
      setQueue(fill(states, log, limits, cardsForFilter(next), at));
    },
    [states, log, limits, fill],
  );

  const toggleCourse = useCallback(
    (course: string) => applyFilter(toggleCourseIn(filter, course)),
    [filter, applyFilter],
  );

  const toggleUnit = useCallback(
    (course: string, unit: string) => applyFilter(toggleUnitIn(filter, course, unit)),
    [filter, applyFilter],
  );

  const clearFilter = useCallback(() => applyFilter(EMPTY_FILTER), [applyFilter]);

  function resetAll() {
    if (!window.confirm("Forget every card's review history and start over?")) return;
    const at = Date.now();
    setStates({});
    setLog({});
    setRevealed(false);
    setNow(at);
    setQueue(fill({}, {}, limits, deck, at));
  }

  // Turning shuffle on picks a fresh seed (a new order); off returns to deck order. Either way
  // the queue is rebuilt, so the card on screen may change.
  function toggleShuffle() {
    const seed = shuffleSeed ? 0 : (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
    const at = Date.now();
    setShuffleSeed(seed);
    setRevealed(false);
    setNow(at);
    setQueue(fill(states, log, limits, deck, at, seed));
  }

  function checkAgain() {
    const at = Date.now();
    setNow(at);
    setQueue(fill(states, log, limits, deck, at));
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pb-10 pt-5 sm:pt-8">
      <header className="mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span aria-hidden className="text-signal">◆</span>
              <h1 className="font-display text-lg font-semibold tracking-tight text-paper sm:text-xl">
                DSAI Flashcards
              </h1>
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-mist">
              data science &amp; ai · spaced repetition
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <ModeSwitch source="dsai" />
            <button
              onClick={toggleShuffle}
              aria-pressed={shuffleSeed !== 0}
              title="Study cards in random order instead of deck order"
              className={`rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition ${
                shuffleSeed
                  ? "border-signal/40 bg-signal/15 text-signal"
                  : "border-line bg-panel/60 text-mist hover:text-paper"
              }`}
            >
              ⤨ shuffle
            </button>
            <button
              onClick={() => setShowLimits((s) => !s)}
              aria-pressed={showLimits}
              title="Daily new-card and review limits"
              className={`rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition ${
                showLimits
                  ? "border-signal/40 bg-signal/15 text-signal"
                  : "border-line bg-panel/60 text-mist hover:text-paper"
              }`}
            >
              ⚙ limits
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-end gap-5 rounded-xl border border-line bg-panel/50 px-4 py-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-mist">
              queue
            </div>
            <div className="font-mono text-3xl font-semibold leading-none tracking-tight text-signal tabular-nums">
              {hydrated ? queue.length : <span className="text-mist">—</span>}
            </div>
          </div>
          <dl className="mb-0.5 grid grid-cols-4 gap-x-4 font-mono text-xs sm:gap-x-5">
            <Stat label="due" value={counts.due} tone="text-paper" />
            <Stat label="new" value={counts.fresh} tone="text-iris" />
            <Stat label="learning" value={counts.learning} tone="text-amber" />
            <Stat label="mature" value={`${counts.mature}/${counts.total}`} tone="text-paperdim" />
          </dl>
        </div>

        {showLimits && (
          <div className="animate-verdict-in mt-3 flex flex-wrap items-center gap-4 rounded-xl border border-line bg-panel/50 px-4 py-3 font-mono text-[11px] text-mist">
            <LimitInput
              label="new / day"
              value={limits.newPerDay}
              onChange={(v) => applyLimits({ ...limits, newPerDay: v })}
            />
            <LimitInput
              label="reviews / day"
              value={limits.reviewPerDay}
              onChange={(v) => applyLimits({ ...limits, reviewPerDay: v })}
            />
            <span className="ml-auto tabular-nums text-mist/70">
              today: {today.newDone} new · {today.reviewsDone} reviews
            </span>
            <button
              onClick={resetAll}
              className="rounded-lg px-2 py-1.5 uppercase tracking-widest text-mist/70 transition hover:text-wrong"
            >
              reset
            </button>
          </div>
        )}

        <DeckPanel
          stats={courseStats}
          filter={filter}
          onToggleCourse={toggleCourse}
          onToggleUnit={toggleUnit}
          onClear={clearFilter}
        />
      </header>

      {!hydrated ? (
        <div className="rounded-2xl border border-line bg-panel/50 p-10 text-center font-mono text-xs text-mist">
          loading deck…
        </div>
      ) : card && cardState ? (
        <Flashcard
          key={card.id}
          card={card}
          state={cardState}
          queueLeft={queue.length}
          revealed={revealed}
          previews={previews}
          onReveal={() => setRevealed(true)}
          onGrade={grade}
        />
      ) : (
        <Done
          counts={counts}
          today={today}
          onCheckAgain={checkAgain}
          onMoreNew={() => applyLimits({ ...limits, newPerDay: limits.newPerDay + 10 })}
          canAddNew={counts.fresh > 0}
        />
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-widest text-mist">{label}</dt>
      <dd className={`text-base font-semibold tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
}

function LimitInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="uppercase tracking-widest">{label}</span>
      <input
        type="number"
        min={0}
        max={9999}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onChange(Math.min(9999, Math.max(0, n)));
        }}
        className="w-16 rounded-lg border border-line bg-panel px-2 py-1.5 text-center font-mono text-sm text-paper tabular-nums focus:border-signal"
      />
    </label>
  );
}

function Done({
  counts,
  today,
  onCheckAgain,
  onMoreNew,
  canAddNew,
}: {
  counts: ReturnType<typeof countCards>;
  today: DayLog;
  onCheckAgain: () => void;
  onMoreNew: () => void;
  canAddNew: boolean;
}) {
  return (
    <section className="animate-cell-in rounded-2xl border border-line bg-panel/80 p-8 text-center">
      <div className="font-mono text-[11px] uppercase tracking-widest text-signal/80">
        // queue empty
      </div>
      <h2 className="mt-3 font-display text-xl font-semibold text-paper">
        Nothing left for today
      </h2>
      <p className="mx-auto mt-2 max-w-sm font-sans text-sm leading-relaxed text-mist">
        {today.newDone + today.reviewsDone > 0
          ? `You did ${today.reviewsDone} review${today.reviewsDone === 1 ? "" : "s"} and introduced ${today.newDone} new card${today.newDone === 1 ? "" : "s"}.`
          : "Everything scheduled for today is already done."}{" "}
        {counts.fresh > 0
          ? `${counts.fresh} card${counts.fresh === 1 ? "" : "s"} in this deck are still unseen — they are held back by the daily new-card limit.`
          : "Every card in this deck has been introduced."}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onCheckAgain}
          className="rounded-xl border border-line bg-panel/60 px-4 py-2 font-mono text-sm text-paperdim transition hover:border-linestrong hover:text-paper"
        >
          check again
        </button>
        {canAddNew && (
          <button
            onClick={onMoreNew}
            className="rounded-xl border border-signal/40 bg-signal/10 px-4 py-2 font-mono text-sm text-signal transition hover:bg-signal/20"
          >
            + 10 new cards
          </button>
        )}
      </div>
    </section>
  );
}
