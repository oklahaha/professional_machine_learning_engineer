"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EMPTY_FILTER,
  filterCards,
  pruneFilter,
  toggleCourse as toggleCourseIn,
  toggleUnit as toggleUnitIn,
  unitKey,
  type DeckFilter,
} from "@/lib/deck";
import { courseLabel } from "@/lib/dsai";
import {
  MCQ_BY_ID,
  MCQ_COURSES,
  MCQ_ORDER,
  MCQ_UNITS,
  MCQ_UNIT_KEYS,
  mcqUnitsForCourse,
  mcqs,
  type Mcq,
} from "@/lib/mcq";
import { presentMcq } from "@/lib/mcq-present";
import McqCard from "./McqCard";
import ModeSwitch, { HomeLink } from "./ModeSwitch";
import StyleToggle from "./StyleToggle";
import QuizDeckPanel, { type QuizCourseStat, type Score } from "./QuizDeckPanel";

// Its own key: shares nothing with the PMLE quiz (pmle-practice-v3) or the DSAI flashcards'
// SRS state (msc-cards-srs-v1). Answers are keyed by content-hash id, so a rebuilt bank keeps them.
const STORAGE_KEY = "dsai-mcq-v1";

type OrderMode = "sequential" | "shuffle";
type Answers = Record<string, string[]>; // question id -> committed labels

type Persisted = {
  version: 1;
  orderMode: OrderMode;
  order: string[]; // ids over the FULL bank; the filter is a cut of it, like PMLE's domains
  pos: number;
  answers: Answers;
  courses: string[];
  units: string[];
  shuffleOpts?: boolean; // shuffle answer options within each question (added field, still v1)
  optSeed?: number;
};

// Locale-aware, one decimal: "87.5" here, "87,5" in a comma-decimal locale.
const PERCENT = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const UNIT_LABEL = new Map(MCQ_UNITS.map((u) => [unitKey(u.course, u.unit), u.label]));

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

// Questions and options are always shuffled. An order or seed stored before that (from the old
// "In order" mode or with option shuffle off) is replaced once; the answers are kept.
function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) + 1;
}

function shuffled(ids: string[]): string[] {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Stored state can predate the current bank: a deck added, a question edited (new hash). Keep
 * the stored order for ids that still exist, append any new ones, drop orphaned answers.
 */
function load(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Persisted>;

    const stored = Array.isArray(p.order) ? p.order.filter((id) => MCQ_BY_ID.has(id)) : [];
    const seen = new Set(stored);
    const order = [...new Set(stored), ...MCQ_ORDER.filter((id) => !seen.has(id))];

    const answers: Answers = {};
    if (p.answers && typeof p.answers === "object") {
      for (const [id, v] of Object.entries(p.answers)) {
        if (MCQ_BY_ID.has(id) && Array.isArray(v) && v.every((x) => typeof x === "string"))
          answers[id] = v;
      }
    }

    return {
      version: 1,
      orderMode: p.orderMode === "shuffle" ? "shuffle" : "sequential",
      order,
      pos: typeof p.pos === "number" && Number.isFinite(p.pos) ? p.pos : 0,
      answers,
      shuffleOpts: p.shuffleOpts === true,
      optSeed:
        typeof p.optSeed === "number" && Number.isInteger(p.optSeed) && p.optSeed > 0 ? p.optSeed : 1,
      ...pruneFilter(
        {
          courses: Array.isArray(p.courses) ? p.courses : [],
          units: Array.isArray(p.units) ? p.units : [],
        },
        MCQ_COURSES,
        MCQ_UNIT_KEYS,
      ),
    };
  } catch {
    return null;
  }
}

function scoreOf(items: Mcq[], answers: Answers): Score {
  let answered = 0;
  let correct = 0;
  for (const q of items) {
    const a = answers[q.id];
    if (!a) continue;
    answered++;
    if (sameSet(a, q.answers)) correct++;
  }
  return { total: items.length, answered, correct };
}

export default function DsaiQuizApp() {
  const [baseOrder, setBaseOrder] = useState<string[]>(MCQ_ORDER);
  const [rawPos, setPos] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [filter, setFilter] = useState<DeckFilter>(EMPTY_FILTER);
  const [pending, setPending] = useState<string[]>([]);
  const [hintShown, setHintShown] = useState(false);
  const [optSeed, setOptSeed] = useState(1);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const p = load();
    const keepOrder = p?.orderMode === "shuffle";
    const ord = keepOrder ? p.order : shuffled(MCQ_ORDER);
    let f: DeckFilter = p ? { courses: p.courses, units: p.units } : EMPTY_FILTER;
    let start = keepOrder ? p.pos : 0;

    // The URL wins over storage, so a shared link (?q=<id>&c=COM6001&u=COM6002::Lecture_1) opens
    // that question in that cut. A linked question the cut would hide clears the filter instead.
    const url = new URLSearchParams(window.location.search);
    if (url.has("c") || url.has("u")) {
      const list = (k: string) => (url.get(k) ?? "").split(",").filter(Boolean);
      f = pruneFilter({ courses: list("c"), units: list("u") }, MCQ_COURSES, MCQ_UNIT_KEYS);
    }
    const qid = url.get("q");
    if (qid && MCQ_BY_ID.has(qid)) {
      const cut = (fl: DeckFilter) => filterCards(ord.map((id) => MCQ_BY_ID.get(id)!), fl).map((x) => x.id);
      let run = cut(f);
      if (!run.includes(qid)) {
        f = EMPTY_FILTER;
        run = cut(f);
      }
      start = run.indexOf(qid);
    }

    setBaseOrder(ord);
    if (p) setAnswers(p.answers);
    setOptSeed(p?.shuffleOpts ? p.optSeed! : randomSeed());
    setPos(start);
    setFilter(f);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const p: Persisted = {
      version: 1,
      orderMode: "shuffle",
      order: baseOrder,
      pos: rawPos,
      answers,
      courses: filter.courses,
      units: filter.units,
      shuffleOpts: true,
      optSeed,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      /* storage may be unavailable (private mode) — ignore */
    }
  }, [hydrated, baseOrder, rawPos, answers, filter, optSeed]);

  // The run being walked: the persisted order narrowed to the filter. Never empty — an empty
  // cut falls back to the whole bank, so `order[pos]` always resolves.
  const order = useMemo(
    () => filterCards(baseOrder.map((id) => MCQ_BY_ID.get(id)!), filter).map((x) => x.id),
    [baseOrder, filter],
  );

  const pos = Math.min(Math.max(rawPos, 0), order.length - 1);
  const q = MCQ_BY_ID.get(order[pos])!;

  // Moving to another question while scrolled down (the phone's → sits at the bottom, under the
  // option explanations) would leave the new stem above the screen, and on a phone the card sits
  // below the rail. Bring its top into view, but only if it is off-screen, and never on load.
  const shownId = useRef<string | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    const first = shownId.current === null;
    shownId.current = q.id;
    if (first) return;
    const card = document.getElementById("main");
    if (!card || card.getBoundingClientRect().top >= 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    card.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }, [hydrated, q.id]);

  // Mirror the current question and the course/unit cut into the URL, so the address bar is a
  // link to exactly this. replaceState, not push: stepping through must not flood history.
  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams({ q: q.id });
    if (filter.courses.length > 0) params.set("c", filter.courses.join(","));
    if (filter.units.length > 0) params.set("u", filter.units.join(","));
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  }, [hydrated, q.id, filter]);

  const committed = answers[q.id] ?? null;
  const revealed = committed != null;
  // Option shuffle is a pure presentation transform: answers/pending/scoring stay in
  // ORIGINAL-label space; only the card sees display labels.
  const view = useMemo(() => presentMcq(q, true, optSeed), [q, optSeed]);
  const selected = (revealed ? committed : pending).map((l) => view.origToDisplay[l]).filter(Boolean);

  const runItems = useMemo(() => order.map((id) => MCQ_BY_ID.get(id)!), [order]);
  const run = useMemo(() => scoreOf(runItems, answers), [runItems, answers]);
  const accuracy = run.answered > 0 ? Math.round((run.correct / run.answered) * 1000) / 10 : null;

  // Over the full bank regardless of the filter: this is what you read to decide what to drill.
  const courseStats = useMemo<QuizCourseStat[]>(
    () =>
      MCQ_COURSES.map((course) => ({
        course,
        label: courseLabel(course),
        score: scoreOf(
          mcqs.filter((x) => x.course === course),
          answers,
        ),
        units: mcqUnitsForCourse(course).map((u) => ({
          unit: u.unit,
          label: u.label,
          score: scoreOf(
            mcqs.filter((x) => x.course === course && x.unit === u.unit),
            answers,
          ),
        })),
      })),
    [answers],
  );

  const goto = useCallback(
    (next: number) => {
      setPos(Math.max(0, Math.min(order.length - 1, next)));
      setPending([]);
      setHintShown(false);
    },
    [order.length],
  );

  // Takes a DISPLAY label (what the card and keys see) and stores the original one.
  const select = useCallback(
    (displayLabel: string) => {
      if (revealed) return;
      const label = view.displayToOrig[displayLabel] ?? displayLabel;
      const multi = q.answers.length > 1;
      setPending((prev) =>
        multi ? (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]) : [label],
      );
    },
    [revealed, q, view],
  );

  const check = useCallback(() => {
    if (pending.length !== q.answers.length) return; // a "choose two" needs both picks
    setAnswers((a) => ({ ...a, [q.id]: pending }));
  }, [pending, q]);

  function clearCurrent() {
    setAnswers((a) => {
      const copy = { ...a };
      delete copy[q.id];
      return copy;
    });
    setPending([]);
  }

  // A filter change re-cuts the run, so restart at its first question.
  const applyFilter = useCallback((next: DeckFilter) => {
    setFilter(next);
    setPos(0);
    setPending([]);
    setHintShown(false);
  }, []);

  function resetAll() {
    if (!window.confirm("Clear every DSAI multiple-choice answer, and reshuffle?")) return;
    setAnswers({});
    setBaseOrder(shuffled(MCQ_ORDER));
    setOptSeed(randomSeed());
    goto(0);
  }

  // Keys: A–D or 1–4 pick, Enter checks (and, once checked, moves on), ←/→ move, h toggles the hint. Enter on a focused
  // button is that button's own click, so the shortcut leaves it alone.
  useEffect(() => {
    if (!hydrated) return;
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const labels = view.question.options.map((o) => o.label);
      const byLetter = labels.find((l) => l.toLowerCase() === k);
      const byNumber = /^[1-9]$/.test(k) ? labels[Number(k) - 1] : undefined;
      if (!revealed && (byLetter || byNumber)) {
        e.preventDefault();
        select((byLetter ?? byNumber)!);
      } else if (k === "enter" && !revealed && pending.length === q.answers.length && !el?.closest("button, a")) {
        e.preventDefault();
        check();
      } else if (k === "enter" && revealed && !el?.closest("button, a")) {
        // Enter checks, then Enter again moves on: the whole loop works from the keyboard.
        e.preventDefault();
        goto(pos + 1);
      } else if ((k === "arrowright" || k === "arrowleft") && el?.closest("[data-options], pre")) {
        // inside the answer options ←/→ move between options, inside a code listing they scroll it
      } else if (k === "arrowright") goto(pos + 1);
      else if (k === "arrowleft") goto(pos - 1);
      else if (k === "h" && q.hint && !revealed) setHintShown((v) => !v);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hydrated, q, view, revealed, pending, pos, select, check, goto]);

  return (
    <div className="study-shell pb-6 sm:pb-12">
      {/* On desktop the header takes the study grid's columns, so the mode switch lines up with the
          card's left edge and the style toggle with its right. */}
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-x-8">
        <div>
          <HomeLink />
          <div className="mt-1.5 flex items-center gap-2.5">
            <span aria-hidden className="neon-glyph text-lg">◆</span>
            <h1 className="neon-title text-balance font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              <span translate="no">DSAI</span> Quiz
            </h1>
          </div>
          <p className="hud-label mt-1">Data Science &amp; AI, multiple choice</p>
        </div>

        {/* On a phone this row wraps under the title and spans it: mode switch left, style toggle
            at the right edge. */}
        <div className="flex flex-wrap items-center gap-2 self-center max-sm:w-full max-sm:justify-between lg:justify-between">
          <div className="seg">
            <ModeSwitch source="dsai" />
          </div>
          <StyleToggle />
        </div>
      </header>

      <div className="study-grid">

        <main id="main" className="study-main scroll-mt-4">
          {!hydrated ? (
            // About a card's height, so the rail under it on a phone is not shoved down when the card lands.
            <div className="holo hud-label flex min-h-[75dvh] items-center justify-center rounded-lg p-10 text-center lg:min-h-[40rem]">
              Loading questions…
            </div>
          ) : (
            <McqCard
              question={view.question}
              unitLabel={UNIT_LABEL.get(unitKey(q.course, q.unit)) ?? q.unit}
              index={pos + 1}
              total={order.length}
              selected={selected}
              revealed={revealed}
              hintShown={hintShown}
              onSelect={select}
              onCheck={check}
              onClear={clearCurrent}
              onNext={pos < order.length - 1 ? () => goto(pos + 1) : undefined}
              onHint={() => setHintShown((v) => !v)}
            />
          )}

          <nav className="mt-5 hidden items-center justify-between gap-3 text-sm sm:flex">
            <NavButton dir="prev" disabled={pos === 0} onClick={() => goto(pos - 1)} />
            <JumpControl pos={pos} total={order.length} onJump={goto} onReset={resetAll} />
            <NavButton dir="next" disabled={pos === order.length - 1} onClick={() => goto(pos + 1)} />
          </nav>
        </main>

        {/* Below lg the rail (score, courses, coverage) comes first and the question under it, as in
            PMLE; the markup keeps the card first, so the skip link and reading order reach it first. */}
        <aside className="study-rail max-lg:order-first" aria-label="Progress and filters">
          {/* One line even at the widest figures ("100.0%", "521/521") down to a 360px phone: no
              wrap, and the stats size to their own content — equal grid columns each took the
              width of "521/521" and pushed the line over. */}
          <div className="holo flex items-end justify-between gap-x-3 rounded-lg px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex shrink-0 flex-col-reverse">
              <div className="hud-label">accuracy</div>
              <div className="readout hud-figure text-[28px] leading-none sm:text-[32px]">
                {accuracy === null ? (
                  <span className="text-2xl text-mist">n/a</span>
                ) : (
                  <>
                    {PERCENT.format(accuracy)}
                    <span className="ml-0.5 text-lg text-signal/60">%</span>
                  </>
                )}
              </div>
            </div>
            <dl className="mb-0.5 flex gap-x-3 sm:gap-x-4">
              <Stat label="correct" value={run.correct} tone="text-correct" />
              <Stat label="wrong" value={run.answered - run.correct} tone="text-wrong" />
              <Stat label="seen" value={`${run.answered}/${run.total}`} tone="text-paper" />
            </dl>
          </div>

          <div className="md:col-span-2">
            <QuizDeckPanel
              stats={courseStats}
              filter={filter}
              onToggleCourse={(c) => applyFilter(toggleCourseIn(filter, c))}
              onToggleUnit={(c, u) => applyFilter(toggleUnitIn(filter, c, u))}
              onClear={() => applyFilter(EMPTY_FILTER)}
            />
          </div>

          <Coverage className="md:col-start-2 md:row-start-1" items={runItems} pos={pos} answers={answers} onJump={goto} />
        </aside>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-2 border-t border-signal/25 bg-ink/80 px-[max(1rem,env(safe-area-inset-left))] pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_30px_-12px_rgba(var(--glow-cyan),0.35)] backdrop-blur-md sm:hidden">
        <NavButton dir="prev" disabled={pos === 0} onClick={() => goto(pos - 1)} compact />
        <JumpControl pos={pos} total={order.length} onJump={goto} onReset={resetAll} compact />
        <NavButton dir="next" disabled={pos === order.length - 1} onClick={() => goto(pos + 1)} compact />
      </nav>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="hud-label">{label}</dt>
      <dd className={`hud-figure text-xl ${tone}`}>{value}</dd>
    </div>
  );
}

function Coverage({
  className = "",
  items,
  pos,
  answers,
  onJump,
}: {
  className?: string;
  items: Mcq[];
  pos: number;
  answers: Answers;
  onJump: (n: number) => void;
}) {
  return (
    <div className={`holo rounded-lg px-4 py-3 ${className}`}>
      <div className="hud-label mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span>Coverage of {items.length} questions</span>
        <span className="flex items-center gap-2.5">
          <Legend color="bg-correct" text="right" />
          <Legend color="bg-wrong" text="wrong" />
          <Legend color="bg-linestrong" text="unseen" />
        </span>
      </div>
      {/* Pointer shortcut only (out of the tab order); the Jump field is the keyboard and
          screen-reader path to any question. Cells grow on a touch screen, where 8px is no target.
          content-visibility clips painting to this box, so it carries 4px of padding (cancelled by
          the negative margin) for the current cell's ring and the hover zoom to draw into. */}
      <div
        className="-m-1 flex flex-wrap gap-[3px] p-1 [@media(pointer:coarse)]:gap-1 [contain-intrinsic-size:auto_10rem] [content-visibility:auto]"
        role="group"
        aria-label="Question coverage map"
      >
        {items.map((item, i) => {
          const labels = answers[item.id];
          const answered = labels != null;
          const right = answered && sameSet(labels, item.answers);
          let tone = "bg-linestrong/50 hover:bg-linestrong";
          if (answered) tone = right ? "bg-correct" : "bg-wrong";
          return (
            <button
              key={item.id}
              type="button"
              tabIndex={-1}
              onClick={() => onJump(i)}
              title={`Question ${i + 1}${answered ? (right ? " · correct" : " · wrong") : ""}`}
              aria-label={`Go to question ${i + 1}`}
              className={`h-2 w-2 rounded-[2px] [@media(pointer:coarse)]:h-3 [@media(pointer:coarse)]:w-3 transition-transform hover:scale-150 ${tone} ${
                i === pos ? "ring-2 ring-signal ring-offset-1 ring-offset-ink shadow-[0_0_8px_2px_rgba(var(--glow-cyan),0.7)]" : ""
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

function NavButton({
  dir,
  disabled,
  onClick,
  compact,
}: {
  dir: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  const isNext = dir === "next";
  const style = isNext ? "btn-neon" : "btn-ghost";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={compact ? (isNext ? "Next question" : "Previous question") : undefined}
      className={`btn-cyber ${style} ${
        compact ? "px-4 py-2.5" : "px-4 py-2"
      }`}
    >
      {compact ? (isNext ? "→" : "←") : isNext ? "Next →" : "← Previous"}
    </button>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-[2px] ${color}`} />
      {text}
    </span>
  );
}

/** DSAI's own copy of the PMLE jump field (the two sources share no components). */
function JumpControl({
  pos,
  total,
  onJump,
  onReset,
  compact,
}: {
  pos: number;
  total: number;
  onJump: (n: number) => void;
  onReset?: () => void;
  compact?: boolean;
}) {
  // Committed on Enter or leaving the field, never per keystroke: typing 120 must not visit
  // questions 1 and 12 on the way, and the field must be clearable to type a new number.
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft === null) return;
    const n = parseInt(draft, 10);
    if (!Number.isNaN(n)) onJump(n - 1);
    setDraft(null);
  }

  return (
    <div className="hud-label flex items-center gap-2">
      {!compact && <span>Jump to</span>}
      <input
        type="text"
        pattern="[0-9]*"
        name="jump"
        inputMode="numeric"
        autoComplete="off"
        enterKeyHint="go"
        value={draft ?? pos + 1}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") setDraft(null);
        }}
        className="field w-[4.5rem] px-2 py-1.5 text-center text-sm tabular-nums"
        aria-label="Jump to question number"
      />
      {!compact && <span className="text-mist">/ {total}</span>}
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="ml-1 rounded-lg px-2 py-1.5 text-mist transition hover:text-wrong"
        >
          Reset
        </button>
      )}
    </div>
  );
}
