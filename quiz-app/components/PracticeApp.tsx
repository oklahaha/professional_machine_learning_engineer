"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { questions } from "@/lib/questions";
import { presentQuestion } from "@/lib/present";
import { DOMAINS, filterByDomain } from "@/lib/domains";
import DomainPanel, { type DomainStat } from "./DomainPanel";
import ModeSwitch from "./ModeSwitch";
import QuestionCard from "./QuestionCard";

const STORAGE_KEY = "pmle-practice-v3"; // v3: answers are label arrays (multi-answer)

type OrderMode = "sequential" | "shuffle";

type Answers = Record<number, string[]>; // questionId -> selected labels

type Persisted = {
  orderMode: OrderMode;
  order: number[]; // indices into `questions` — the FULL bank, before domain filtering
  pos: number;
  answers: Answers;
  shuffleOpts?: boolean; // shuffle answer options within each question
  optSeed?: number; // seed for the option permutation
  domains?: number[]; // exam-guide sections to drill; empty = all of them
};

// order-independent set equality — a question is correct iff the chosen labels
// exactly match its answer set (handles single- and multi-answer questions).
function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

function sequentialOrder(): number[] {
  return questions.map((_, i) => i);
}

function shuffledOrder(): number[] {
  const a = sequentialOrder();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function load(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Persisted;
    if (!Array.isArray(p.order) || p.order.length !== questions.length) return null;
    // guard against out-of-range indices from tampered/legacy data
    if (p.order.some((i) => typeof i !== "number" || i < 0 || i >= questions.length))
      return null;
    if (p.answers && typeof p.answers === "object") {
      // normalize any stray non-array values rather than trusting stored shape
      for (const k of Object.keys(p.answers)) {
        if (!Array.isArray(p.answers[Number(k)])) delete p.answers[Number(k)];
      }
    }
    // a stored filter naming a section that does not exist would hide questions forever
    if (p.domains && !Array.isArray(p.domains)) delete p.domains;
    if (p.domains) p.domains = p.domains.filter((d) => DOMAINS.some((x) => x.id === d));
    return p;
  } catch {
    return null;
  }
}

export default function PracticeApp() {
  const [orderMode, setOrderMode] = useState<OrderMode>("sequential");
  const [baseOrder, setBaseOrder] = useState<number[]>(sequentialOrder);
  const [rawPos, setPos] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [shuffleOpts, setShuffleOpts] = useState(false);
  const [optSeed, setOptSeed] = useState(1);
  const [domainFilter, setDomainFilter] = useState<number[]>([]); // empty = every section
  const [hydrated, setHydrated] = useState(false);
  const [pending, setPending] = useState<string[]>([]);

  useEffect(() => {
    const p = load();
    if (p) {
      setOrderMode(p.orderMode);
      setBaseOrder(p.order);
      setPos(Math.min(p.pos, p.order.length - 1));
      setAnswers(p.answers ?? {});
      setShuffleOpts(p.shuffleOpts ?? false);
      setOptSeed(p.optSeed ?? 1);
      setDomainFilter(p.domains ?? []);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const p: Persisted = {
      orderMode,
      order: baseOrder,
      pos: rawPos,
      answers,
      shuffleOpts,
      optSeed,
      domains: domainFilter,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      /* storage may be unavailable (private mode) — ignore */
    }
  }, [hydrated, orderMode, baseOrder, rawPos, answers, shuffleOpts, optSeed, domainFilter]);

  // The run the user is actually walking: the persisted order, narrowed to the selected
  // exam sections. filterByDomain guarantees a non-empty result, so `order[pos]` is always
  // a real question.
  const order = useMemo(
    () => filterByDomain(baseOrder, domainFilter, (i) => questions[i].domain),
    [baseOrder, domainFilter],
  );

  // Clamp on read: `order` shrinks the moment a filter is applied, and rawPos may point
  // past the end of the new run.
  const pos = Math.min(Math.max(rawPos, 0), order.length - 1);

  const q = questions[order[pos]];
  const committed = answers[q.id] ?? null;
  const revealed = committed != null;
  // Option shuffle is a pure presentation transform: state/scoring below stay
  // in ORIGINAL-letter space; only the view is remapped to display labels.
  const view = useMemo(
    () => presentQuestion(q, shuffleOpts, optSeed),
    [q, shuffleOpts, optSeed],
  );
  const selectedOrig = revealed ? committed : pending;
  const selectedDisplay = selectedOrig
    .map((l) => view.origToDisplay[l])
    .filter(Boolean);

  // Scoped to the current run, not the whole bank: while drilling one section, the headline
  // accuracy should be that section's accuracy. The per-domain table below is the global view.
  const { answeredCount, correctCount } = useMemo(() => {
    let answered = 0;
    let correct = 0;
    for (const i of order) {
      const item = questions[i];
      const labels = answers[item.id];
      if (!labels) continue;
      answered++;
      if (sameSet(labels, item.answers)) correct++;
    }
    return { answeredCount: answered, correctCount: correct };
  }, [order, answers]);

  const accuracy =
    answeredCount > 0 ? Math.round((correctCount / answeredCount) * 1000) / 10 : null;

  // Always over the FULL bank, regardless of the active filter — this is the readout you
  // consult to decide what to drill next, so it must not be narrowed by what you're drilling.
  const domainStats = useMemo<DomainStat[]>(() => {
    const stats = new Map(
      DOMAINS.map((d) => [d.id, { total: 0, answered: 0, correct: 0 }]),
    );
    for (const item of questions) {
      const s = stats.get(item.domain);
      if (!s) continue;
      s.total++;
      const labels = answers[item.id];
      if (!labels) continue;
      s.answered++;
      if (sameSet(labels, item.answers)) s.correct++;
    }
    return DOMAINS.map((d) => {
      const s = stats.get(d.id)!;
      return {
        ...d,
        ...s,
        accuracy: s.answered > 0 ? Math.round((s.correct / s.answered) * 100) : null,
      };
    });
  }, [answers]);

  // stable so the memoized Minimap doesn't re-render on unrelated state changes
  const goto = useCallback(
    (next: number) => {
      setPos(Math.max(0, Math.min(order.length - 1, next)));
      setPending([]);
    },
    [order.length],
  );

  function check() {
    if (pending.length === 0) return;
    setAnswers((a) => ({ ...a, [q.id]: pending }));
  }

  // QuestionCard works in display-letter space; translate the click back to the
  // original option label before storing. Toggle for multi-answer, else replace.
  function select(displayLabel: string) {
    if (revealed) return;
    const label = view.displayToOrig[displayLabel] ?? displayLabel;
    const multi = q.answers.length > 1;
    setPending((prev) =>
      multi
        ? prev.includes(label)
          ? prev.filter((l) => l !== label)
          : [...prev, label]
        : [label],
    );
  }

  function toggleShuffleOpts() {
    const next = !shuffleOpts;
    setShuffleOpts(next);
    if (next) setOptSeed((s) => ((s * 1103515245 + 12345) >>> 0) || 1); // fresh arrangement
    setPending([]);
  }

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
    setBaseOrder(mode === "shuffle" ? shuffledOrder() : sequentialOrder());
    setPos(0);
    setPending([]);
  }

  // Toggling a section re-cuts the run, so restart at its first question. Deselecting the
  // last active section clears the filter rather than leaving nothing to answer.
  const toggleDomain = useCallback((id: number) => {
    setDomainFilter((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
    setPos(0);
    setPending([]);
  }, []);

  const clearDomains = useCallback(() => {
    setDomainFilter([]);
    setPos(0);
    setPending([]);
  }, []);

  function resetAll() {
    if (!window.confirm("Reset all progress and answers?")) return;
    setAnswers({});
    setPos(0);
    setPending([]);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pb-28 pt-5 sm:pb-10 sm:pt-8">
      {/* ── eval console header ─────────────────────────────── */}
      <header className="mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span aria-hidden className="neon-glyph animate-float">◇</span>
              <h1 className="neon-title font-display text-lg font-semibold tracking-tight sm:text-xl">
                PMLE Eval Console
              </h1>
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-mist">
              google · professional machine learning engineer
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <ModeSwitch source="pmle" />
            {/* order mode toggle */}
            <div className="seg">
              {(["sequential", "shuffle"] as OrderMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  aria-pressed={orderMode === m}
                  className="seg-item"
                >
                  {m === "sequential" ? "seq" : "shuffle"}
                </button>
              ))}
            </div>
            {/* shuffle answer options toggle */}
            <button
              onClick={toggleShuffleOpts}
              aria-pressed={shuffleOpts}
              title="Shuffle the answer options within each question"
              className="chip-toggle"
            >
              ⤨ options
            </button>
          </div>
        </div>

        {/* accuracy readout — the metric this whole app computes */}
        <div className="holo mt-4 flex items-end gap-5 rounded-lg px-4 py-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-mist">
              accuracy
            </div>
            <div className="readout font-mono text-3xl font-semibold leading-none tracking-tight tabular-nums">
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
            <Stat label="correct" value={correctCount} tone="text-correct" />
            <Stat label="wrong" value={answeredCount - correctCount} tone="text-wrong" />
            <Stat label="seen" value={`${answeredCount}/${order.length}`} tone="text-paper" />
          </dl>
        </div>

        {/* per-domain scorecard — doubles as the section filter */}
        <DomainPanel
          stats={domainStats}
          selected={domainFilter}
          onToggle={toggleDomain}
          onClear={clearDomains}
        />

        {/* coverage minimap — signature: the question bank as an eval set */}
        <Minimap
          order={order}
          pos={pos}
          answers={answers}
          onJump={goto}
        />
      </header>

      <QuestionCard
        question={view.question}
        index={pos + 1}
        total={order.length}
        selected={selectedDisplay}
        revealed={revealed}
        onSelect={select}
        onCheck={check}
        onClear={clearCurrent}
      />

      {/* desktop controls */}
      <nav className="mt-5 hidden items-center justify-between gap-3 font-mono text-sm sm:flex">
        <NavButton dir="prev" disabled={pos === 0} onClick={() => goto(pos - 1)} />
        <JumpControl pos={pos} total={order.length} onJump={goto} onReset={resetAll} />
        <NavButton dir="next" disabled={pos === order.length - 1} onClick={() => goto(pos + 1)} />
      </nav>

      {/* mobile sticky controls */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-2 border-t border-signal/25 bg-ink/80 px-4 py-3 font-mono shadow-[0_-10px_30px_-12px_rgba(46,230,255,0.35)] backdrop-blur-md sm:hidden">
        <NavButton dir="prev" disabled={pos === 0} onClick={() => goto(pos - 1)} compact />
        <JumpControl pos={pos} total={order.length} onJump={goto} onReset={resetAll} compact />
        <NavButton dir="next" disabled={pos === order.length - 1} onClick={() => goto(pos + 1)} compact />
      </nav>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: string;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-widest text-mist">{label}</dt>
      <dd className={`text-base font-semibold tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
}

const Minimap = memo(function Minimap({
  order,
  pos,
  answers,
  onJump,
}: {
  order: number[];
  pos: number;
  answers: Answers;
  onJump: (n: number) => void;
}) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-mist">
        <span>coverage · {order.length} items</span>
        <span className="flex items-center gap-2.5">
          <Legend color="bg-correct" text="right" />
          <Legend color="bg-wrong" text="wrong" />
          <Legend color="bg-linestrong" text="unseen" />
        </span>
      </div>
      {/* Pointer shortcut to any question. Kept out of the tab sequence (the
          full bank of cells would bury the answer options) — the Jump input is
          the keyboard-accessible path to any question. */}
      <div className="flex flex-wrap gap-[3px]" role="group" aria-label="Question coverage map">
        {order.map((qi, i) => {
          const item = questions[qi];
          const labels = answers[item.id];
          const answered = labels != null;
          const right = answered && sameSet(labels, item.answers);
          const isCurrent = i === pos;
          let tone = "bg-linestrong/50 hover:bg-linestrong";
          if (answered) tone = right ? "bg-correct" : "bg-wrong";
          return (
            <button
              key={item.id}
              type="button"
              tabIndex={-1}
              onClick={() => onJump(i)}
              title={`Q${item.id}${answered ? (right ? " · correct" : " · wrong") : ""}`}
              aria-label={`Go to question ${i + 1}`}
              className={`h-2 w-2 rounded-[2px] transition-transform hover:scale-150 ${tone} ${
                isCurrent ? "ring-2 ring-signal ring-offset-1 ring-offset-ink shadow-[0_0_8px_2px_rgba(46,230,255,0.7)]" : ""
              }`}
            />
          );
        })}
      </div>
    </div>
  );
});

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <span className="flex items-center gap-1 normal-case tracking-normal">
      <span className={`h-2 w-2 rounded-[2px] ${color}`} />
      {text}
    </span>
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
  const base = "btn-cyber";
  const style = isNext ? "btn-neon" : "btn-ghost";
  const size = compact ? "px-4 py-2.5" : "px-4 py-2";
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${style} ${size}`}>
      {compact ? (isNext ? "→" : "←") : isNext ? "next →" : "← prev"}
    </button>
  );
}

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
  onReset: () => void;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-mist">
      {!compact && <span className="uppercase tracking-widest">jump</span>}
      <input
        type="number"
        min={1}
        max={total}
        value={pos + 1}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onJump(n - 1);
        }}
        className="field w-14 px-2 py-1.5 text-center text-sm tabular-nums"
        aria-label="Jump to question number"
      />
      {!compact && <span className="text-mist/50">/ {total}</span>}
      <button
        onClick={onReset}
        className={`rounded-lg px-2 py-1.5 uppercase tracking-widest text-mist/70 transition hover:text-wrong ${
          compact ? "" : "ml-1"
        }`}
      >
        reset
      </button>
    </div>
  );
}
