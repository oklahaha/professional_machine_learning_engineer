"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import McqCard from "./McqCard";
import ModeSwitch from "./ModeSwitch";
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
};

const UNIT_LABEL = new Map(MCQ_UNITS.map((u) => [unitKey(u.course, u.unit), u.label]));

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
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
  const [orderMode, setOrderMode] = useState<OrderMode>("sequential");
  const [baseOrder, setBaseOrder] = useState<string[]>(MCQ_ORDER);
  const [rawPos, setPos] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [filter, setFilter] = useState<DeckFilter>(EMPTY_FILTER);
  const [pending, setPending] = useState<string[]>([]);
  const [hintShown, setHintShown] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const p = load();
    if (p) {
      setOrderMode(p.orderMode);
      setBaseOrder(p.order);
      setPos(p.pos);
      setAnswers(p.answers);
      setFilter({ courses: p.courses, units: p.units });
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const p: Persisted = {
      version: 1,
      orderMode,
      order: baseOrder,
      pos: rawPos,
      answers,
      courses: filter.courses,
      units: filter.units,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      /* storage may be unavailable (private mode) — ignore */
    }
  }, [hydrated, orderMode, baseOrder, rawPos, answers, filter]);

  // The run being walked: the persisted order narrowed to the filter. Never empty — an empty
  // cut falls back to the whole bank, so `order[pos]` always resolves.
  const order = useMemo(
    () => filterCards(baseOrder.map((id) => MCQ_BY_ID.get(id)!), filter).map((x) => x.id),
    [baseOrder, filter],
  );

  const pos = Math.min(Math.max(rawPos, 0), order.length - 1);
  const q = MCQ_BY_ID.get(order[pos])!;
  const committed = answers[q.id] ?? null;
  const revealed = committed != null;
  const selected = revealed ? committed : pending;

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

  const select = useCallback(
    (label: string) => {
      if (revealed) return;
      const multi = q.answers.length > 1;
      setPending((prev) =>
        multi ? (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]) : [label],
      );
    },
    [revealed, q],
  );

  const check = useCallback(() => {
    if (pending.length === 0) return;
    setAnswers((a) => ({ ...a, [q.id]: pending }));
  }, [pending, q.id]);

  function clearCurrent() {
    setAnswers((a) => {
      const copy = { ...a };
      delete copy[q.id];
      return copy;
    });
    setPending([]);
  }

  function setMode(mode: OrderMode) {
    setOrderMode(mode);
    setBaseOrder(mode === "shuffle" ? shuffled(MCQ_ORDER) : MCQ_ORDER);
    goto(0);
  }

  // A filter change re-cuts the run, so restart at its first question.
  const applyFilter = useCallback((next: DeckFilter) => {
    setFilter(next);
    setPos(0);
    setPending([]);
    setHintShown(false);
  }, []);

  function resetAll() {
    if (!window.confirm("Clear every DSAI multiple-choice answer?")) return;
    setAnswers({});
    goto(0);
  }

  // Keys: A–D or 1–4 pick, Enter checks, ←/→ move, h shows the hint.
  useEffect(() => {
    if (!hydrated) return;
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const labels = q.options.map((o) => o.label);
      const byLetter = labels.find((l) => l.toLowerCase() === k);
      const byNumber = /^[1-9]$/.test(k) ? labels[Number(k) - 1] : undefined;
      if (!revealed && (byLetter || byNumber)) {
        e.preventDefault();
        select((byLetter ?? byNumber)!);
      } else if (k === "enter" && !revealed && pending.length > 0) {
        e.preventDefault();
        check();
      } else if (k === "arrowright") goto(pos + 1);
      else if (k === "arrowleft") goto(pos - 1);
      else if (k === "h" && q.hint) setHintShown(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hydrated, q, revealed, pending, pos, select, check, goto]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pb-28 pt-5 sm:pb-10 sm:pt-8">
      <header className="mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span aria-hidden className="text-signal">◆</span>
              <h1 className="font-display text-lg font-semibold tracking-tight text-paper sm:text-xl">
                DSAI Quiz
              </h1>
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-mist">
              data science &amp; ai · multiple choice
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <ModeSwitch source="dsai" />
            <div className="flex items-center gap-0.5 rounded-lg border border-line bg-panel/60 p-0.5 font-mono text-[11px]">
              {(["sequential", "shuffle"] as OrderMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-md px-2.5 py-1.5 transition ${
                    orderMode === m ? "bg-signal/15 text-signal" : "text-mist hover:text-paper"
                  }`}
                >
                  {m === "sequential" ? "seq" : "shuffle"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-end gap-5 rounded-xl border border-line bg-panel/50 px-4 py-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-mist">accuracy</div>
            <div className="font-mono text-3xl font-semibold leading-none tracking-tight text-signal tabular-nums">
              {accuracy === null ? (
                <span className="text-mist">n/a</span>
              ) : (
                <>
                  {accuracy.toFixed(1)}
                  <span className="ml-0.5 text-lg text-signal/60">%</span>
                </>
              )}
            </div>
          </div>
          <dl className="mb-0.5 grid grid-cols-3 gap-x-5 font-mono text-xs">
            <Stat label="correct" value={run.correct} tone="text-correct" />
            <Stat label="wrong" value={run.answered - run.correct} tone="text-wrong" />
            <Stat label="seen" value={`${run.answered}/${run.total}`} tone="text-paper" />
          </dl>
        </div>

        <QuizDeckPanel
          stats={courseStats}
          filter={filter}
          onToggleCourse={(c) => applyFilter(toggleCourseIn(filter, c))}
          onToggleUnit={(c, u) => applyFilter(toggleUnitIn(filter, c, u))}
          onClear={() => applyFilter(EMPTY_FILTER)}
        />

        <Coverage items={runItems} pos={pos} answers={answers} onJump={goto} />
      </header>

      {!hydrated ? (
        <div className="rounded-2xl border border-line bg-panel/50 p-10 text-center font-mono text-xs text-mist">
          loading questions…
        </div>
      ) : (
        <McqCard
          question={q}
          unitLabel={UNIT_LABEL.get(unitKey(q.course, q.unit)) ?? q.unit}
          index={pos + 1}
          total={order.length}
          selected={selected}
          revealed={revealed}
          hintShown={hintShown}
          onSelect={select}
          onCheck={check}
          onClear={clearCurrent}
          onHint={() => setHintShown(true)}
        />
      )}

      <nav className="mt-5 hidden items-center justify-between gap-3 font-mono text-sm sm:flex">
        <NavButton dir="prev" disabled={pos === 0} onClick={() => goto(pos - 1)} />
        <span className="flex items-center gap-3 text-[11px] text-mist">
          <span className="tabular-nums">
            {pos + 1} / {order.length}
          </span>
          <button
            onClick={resetAll}
            className="rounded-lg px-2 py-1.5 uppercase tracking-widest text-mist/70 transition hover:text-wrong"
          >
            reset
          </button>
        </span>
        <NavButton dir="next" disabled={pos === order.length - 1} onClick={() => goto(pos + 1)} />
      </nav>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-2 border-t border-line bg-ink/95 px-4 py-3 font-mono backdrop-blur sm:hidden">
        <NavButton dir="prev" disabled={pos === 0} onClick={() => goto(pos - 1)} compact />
        <span className="flex items-center gap-2 text-[11px] text-mist">
          <span className="tabular-nums">
            {pos + 1}/{order.length}
          </span>
          <button onClick={resetAll} className="rounded-lg px-2 py-1.5 uppercase tracking-widest text-mist/70">
            reset
          </button>
        </span>
        <NavButton dir="next" disabled={pos === order.length - 1} onClick={() => goto(pos + 1)} compact />
      </nav>
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

function Coverage({
  items,
  pos,
  answers,
  onJump,
}: {
  items: Mcq[];
  pos: number;
  answers: Answers;
  onJump: (n: number) => void;
}) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-mist">
        coverage · {items.length} items
      </div>
      {/* Pointer shortcut only (out of the tab order); ←/→ are the keyboard path. */}
      <div className="flex flex-wrap gap-[3px]" role="group" aria-label="Question coverage map">
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
              aria-label={`Go to question ${i + 1}`}
              className={`h-2 w-2 rounded-[2px] transition-transform hover:scale-150 ${tone} ${
                i === pos ? "ring-2 ring-signal ring-offset-1 ring-offset-ink" : ""
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
  const style = isNext
    ? "border-signal/40 bg-signal/10 text-signal hover:bg-signal/20"
    : "border-line bg-panel/60 text-paperdim hover:border-linestrong hover:text-paper";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-30 ${style} ${
        compact ? "px-4 py-2.5" : "px-4 py-2"
      }`}
    >
      {compact ? (isNext ? "→" : "←") : isNext ? "next →" : "← prev"}
    </button>
  );
}
