"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { questions } from "@/lib/questions";
import { presentQuestion } from "@/lib/present";
import { DOMAINS, filterByDomain } from "@/lib/domains";
import DomainPanel, { type DomainStat } from "./DomainPanel";
import { HomeLink } from "./ModeSwitch";
import StyleToggle from "./StyleToggle";
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

// Questions and options are always shuffled. An order or seed stored before that (from the old
// "In order" mode or with option shuffle off) is replaced once; the answers are kept.
function shuffledOrder(): number[] {
  const a = sequentialOrder();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Locale-aware, one decimal: "87.5" here, "87,5" in a comma-decimal locale.
const PERCENT = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) + 1;
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
  const [baseOrder, setBaseOrder] = useState<number[]>(sequentialOrder);
  const [rawPos, setPos] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [optSeed, setOptSeed] = useState(1);
  const [domainFilter, setDomainFilter] = useState<number[]>([]); // empty = every section
  const [hydrated, setHydrated] = useState(false);
  const [pending, setPending] = useState<string[]>([]);

  useEffect(() => {
    const p = load();
    const keepOrder = p?.orderMode === "shuffle";
    const ord = keepOrder ? p.order : shuffledOrder();
    let domains = p?.domains ?? [];
    let start = keepOrder ? Math.min(p.pos, ord.length - 1) : 0;

    // The URL wins over storage, so a shared link (?q=120&s=3,4) opens that question in that cut.
    // A linked question the linked sections would hide clears the filter rather than going missing.
    const url = new URLSearchParams(window.location.search);
    const s = url.get("s");
    if (s !== null) domains = s.split(",").map(Number).filter((d) => DOMAINS.some((x) => x.id === d));
    const qid = Number(url.get("q"));
    const at = url.has("q") ? ord.findIndex((i) => questions[i].id === qid) : -1;
    if (at >= 0) {
      let run = filterByDomain(ord, domains, (i) => questions[i].domain);
      if (!run.includes(ord[at])) {
        domains = [];
        run = ord;
      }
      start = run.indexOf(ord[at]);
    }

    setBaseOrder(ord);
    setAnswers(p?.answers ?? {});
    setOptSeed(p?.shuffleOpts && p.optSeed ? p.optSeed : randomSeed());
    setPos(start);
    setDomainFilter(domains);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const p: Persisted = {
      orderMode: "shuffle",
      order: baseOrder,
      pos: rawPos,
      answers,
      shuffleOpts: true,
      optSeed,
      domains: domainFilter,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      /* storage may be unavailable (private mode) — ignore */
    }
  }, [hydrated, baseOrder, rawPos, answers, optSeed, domainFilter]);

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

  // Mirror the current question and section cut into the URL, so the address bar is a link to
  // exactly this. replaceState, not push: stepping through questions must not flood history.
  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams({ q: String(q.id) });
    if (domainFilter.length > 0) params.set("s", domainFilter.join(","));
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  }, [hydrated, q.id, domainFilter]);

  const committed = answers[q.id] ?? null;
  const revealed = committed != null;
  // Option shuffle is a pure presentation transform: state/scoring below stay
  // in ORIGINAL-letter space; only the view is remapped to display labels.
  const view = useMemo(
    () => presentQuestion(q, true, optSeed),
    [q, optSeed],
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

  const check = useCallback(() => {
    if (pending.length !== q.answers.length) return; // a "choose two" needs both picks
    setAnswers((a) => ({ ...a, [q.id]: pending }));
  }, [pending, q]);

  // QuestionCard works in display-letter space; translate the click back to the
  // original option label before storing. Toggle for multi-answer, else replace.
  const select = useCallback(
    (displayLabel: string) => {
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
    },
    [revealed, view, q],
  );

  function clearCurrent() {
    setAnswers((a) => {
      const copy = { ...a };
      delete copy[q.id];
      return copy;
    });
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
    if (!window.confirm("Reset all progress and answers, and reshuffle?")) return;
    setAnswers({});
    setBaseOrder(shuffledOrder());
    setOptSeed(randomSeed());
    setPos(0);
    setPending([]);
  }

  // Keys, as in the DSAI quiz: A–E or 1–5 pick, Enter checks (and, once checked, moves on), ←/→ move. Enter on a focused
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
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hydrated, view, revealed, pending, pos, select, check, goto]);

  return (
    <div className="study-shell pb-6 sm:pb-12">
      {/* ── eval console header ─────────────────────────────── */}
      {/* No wrap: with only the style toggle on the right, it shares the title's row on a phone
          rather than taking a row of its own; the subtitle wraps instead. */}
      <header className="flex items-start justify-between gap-x-4 sm:gap-x-6">
        <div className="min-w-0">
          <HomeLink />
          <div className="mt-1.5 flex items-center gap-2.5">
            <span aria-hidden className="neon-glyph text-lg">◇</span>
            <h1 className="neon-title text-balance font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              <span translate="no">PMLE</span> Eval Console
            </h1>
          </div>
          <p className="hud-label mt-1">Google Professional Machine Learning Engineer</p>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:self-center">
          <StyleToggle />
        </div>
      </header>

      <div className="study-grid">

        <main id="main" className="study-main">
          {/* Until storage is read, the question on screen would be Q1, not where you left off. */}
          {!hydrated ? (
            // About a card's height, so the rail under it on a phone is not shoved down when the card lands.
            <div className="holo hud-label flex min-h-[75dvh] items-center justify-center rounded-lg p-10 text-center lg:min-h-[40rem]">
              Loading questions…
            </div>
          ) : (
            <QuestionCard
              question={view.question}
              index={pos + 1}
              total={order.length}
              selected={selectedDisplay}
              revealed={revealed}
              onSelect={select}
              onCheck={check}
              onClear={clearCurrent}
              onNext={pos < order.length - 1 ? () => goto(pos + 1) : undefined}
            />
          )}

          {/* desktop controls */}
          <nav className="mt-5 hidden items-center justify-between gap-3 text-sm sm:flex">
            <NavButton dir="prev" disabled={pos === 0} onClick={() => goto(pos - 1)} />
            <JumpControl pos={pos} total={order.length} onJump={goto} onReset={resetAll} />
            <NavButton dir="next" disabled={pos === order.length - 1} onClick={() => goto(pos + 1)} />
          </nav>
        </main>

        <aside className="study-rail" aria-label="Progress and filters">
          {/* accuracy readout — the metric this whole app computes */}
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
              <Stat label="correct" value={correctCount} tone="text-correct" />
              <Stat label="wrong" value={answeredCount - correctCount} tone="text-wrong" />
              <Stat label="seen" value={`${answeredCount}/${order.length}`} tone="text-paper" />
            </dl>
          </div>

          {/* per-domain scorecard — doubles as the section filter */}
          <div className="md:col-span-2">
            <DomainPanel
              stats={domainStats}
              selected={domainFilter}
              onToggle={toggleDomain}
              onClear={clearDomains}
            />
          </div>

          {/* coverage minimap — signature: the question bank as an eval set */}
          <Minimap
            className="md:col-start-2 md:row-start-1"
            order={order}
            pos={pos}
            answers={answers}
            onJump={goto}
          />
          {/* On a phone, Reset sits here under the stats, not in the bottom bar beside the arrows,
              where one stray tap would wipe every answer. */}
          <button
            type="button"
            onClick={resetAll}
            className="hud-label self-end rounded-lg px-2 py-1.5 text-mist transition hover:text-wrong sm:hidden"
          >
            Reset
          </button>
        </aside>
      </div>

      {/* mobile sticky controls */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-2 border-t border-signal/25 bg-ink/80 px-[max(1rem,env(safe-area-inset-left))] pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_30px_-12px_rgba(var(--glow-cyan),0.35)] backdrop-blur-md sm:hidden">
        <NavButton dir="prev" disabled={pos === 0} onClick={() => goto(pos - 1)} compact />
        <JumpControl pos={pos} total={order.length} onJump={goto} compact />
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
    <div className="flex flex-col-reverse">
      <dt className="hud-label">{label}</dt>
      <dd className={`hud-figure text-xl ${tone}`}>{value}</dd>
    </div>
  );
}

const Minimap = memo(function Minimap({
  className = "",
  order,
  pos,
  answers,
  onJump,
}: {
  className?: string;
  order: number[];
  pos: number;
  answers: Answers;
  onJump: (n: number) => void;
}) {
  return (
    <div className={`holo rounded-lg px-4 py-3 ${className}`}>
      <div className="hud-label mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span>Coverage of {order.length} questions</span>
        <span className="flex items-center gap-2.5">
          <Legend color="bg-correct" text="right" />
          <Legend color="bg-wrong" text="wrong" />
          <Legend color="bg-linestrong" text="unseen" />
        </span>
      </div>
      {/* Pointer shortcut to any question. Kept out of the tab sequence (the
          full bank of cells would bury the answer options) — the Jump input is
          the keyboard-accessible path to any question. Cells grow on a touch
          screen, where 8px is no target. content-visibility clips painting to this
          box, so it carries 4px of padding (cancelled by the negative margin) for
          the current cell's ring and the hover zoom to draw into. */}
      <div
        className="-m-1 flex flex-wrap gap-[3px] p-1 [@media(pointer:coarse)]:gap-1 [contain-intrinsic-size:auto_10rem] [content-visibility:auto]"
        role="group"
        aria-label="Question coverage map"
      >
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
              className={`h-2 w-2 rounded-[2px] [@media(pointer:coarse)]:h-3 [@media(pointer:coarse)]:w-3 transition-transform hover:scale-150 ${tone} ${
                isCurrent ? "ring-2 ring-signal ring-offset-1 ring-offset-ink shadow-[0_0_8px_2px_rgba(var(--glow-cyan),0.7)]" : ""
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
    <span className="flex items-center gap-1.5">
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
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={compact ? (isNext ? "Next question" : "Previous question") : undefined}
      className={`${base} ${style} ${size}`}
    >
      {compact ? (isNext ? "→" : "←") : isNext ? "Next →" : "← Previous"}
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
  onReset?: () => void; // omitted in the phone bar
  compact?: boolean;
}) {
  // What is being typed, until Enter or leaving the field commits it. Jumping on every keystroke
  // would visit Q1 and Q12 on the way to Q120 (dropping a half-made selection at each), and a
  // controlled field that only ever shows `pos` cannot even be cleared to type a new number.
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
