"use client";

import { useEffect, useRef, useState } from "react";
import type { Card } from "@/lib/cards";
import { courseLabel } from "@/lib/cards";
import { splitCodeBlocks } from "@/lib/format";
import { GRADES, GRADE_LABEL, type CardState, type Grade } from "@/lib/srs";
import RichText from "./RichText";

type Props = {
  card: Card;
  state: CardState;
  queueLeft: number; // cards still in today's queue, including this one
  revealed: boolean;
  previews: Record<Grade, string>;
  onReveal: () => void;
  onGrade: (grade: Grade) => void;
};

/**
 * Where the card sits in its life. Deliberately not green/red: those mean "you got it right /
 * wrong" on the grade buttons below, and a card being new carries no such verdict.
 */
const PHASE_CHIP: Record<CardState["phase"], { label: string; tone: string }> = {
  new: { label: "New", tone: "border-iris/30 bg-iris/10 text-iris" },
  learning: { label: "Learning", tone: "border-amber/30 bg-amber/10 text-amber" },
  relearning: { label: "Relearning", tone: "border-amber/30 bg-amber/10 text-amber" },
  review: { label: "Review", tone: "border-linestrong bg-panel2/60 text-paperdim" },
};

/**
 * Again is a wrong answer and Good is a right one, so those two keep the app's green/red.
 * Hard and Easy are shadings either side and take the neutral accents.
 */
const GRADE_TONE: Record<Grade, string> = {
  1: "border-wrong/50 bg-wrong/10 text-wrong hover:bg-wrong/20",
  2: "border-amber/40 bg-amber/10 text-amber hover:bg-amber/20",
  3: "border-correct/50 bg-correct/10 text-correct hover:bg-correct/20",
  4: "border-iris/40 bg-iris/10 text-iris hover:bg-iris/20",
};

const EASE = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Card text, with any fenced listing kept as a scrollable <pre> — the prose is
 * whitespace-pre-line, which is the only reason indentation would otherwise survive.
 * The CSVs carry no fences today; this costs nothing and means a future deck with a code
 * snippet renders properly instead of collapsing. Inline `code` and $math$ go through RichText.
 */
function Body({ text, className }: { text: string; className: string }) {
  const segments = splitCodeBlocks(text);
  return (
    <div className="space-y-3">
      {segments.map((seg, i) =>
        seg.kind === "code" ? (
          <pre
            key={i}
            className="overflow-x-auto rounded-md border border-signal/20 bg-ink/80 p-3 sm:p-4"
          >
            <code className="block font-mono text-[13px] leading-relaxed text-paperdim sm:text-sm">
              {seg.content}
            </code>
          </pre>
        ) : (
          <p key={i} className={className}>
            <RichText text={seg.content} />
          </p>
        ),
      )}
    </div>
  );
}

export default function Flashcard({
  card,
  state,
  queueLeft,
  revealed,
  previews,
  onReveal,
  onGrade,
}: Props) {
  const phase = PHASE_CHIP[state.phase];
  // `revealed` (owned by the parent) is "this card has been answered" — it unlocks grading and
  // never goes back. `peekFront` is only which face is showing once it has: clicking a revealed
  // card turns it back over to re-read the question. The parent keys this component by card id,
  // so a new card always starts face-down.
  const [peekFront, setPeekFront] = useState(false);
  const showBack = revealed && !peekFront;

  // On a phone the card sits under the rail, so the grade buttons that appear on reveal land below
  // the screen. Scroll just enough to show them ("nearest" does nothing if they already are).
  const gradesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!revealed) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gradesRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [revealed]);

  function flip() {
    if (!revealed) onReveal();
    else setPeekFront((v) => !v);
  }

  // A focused card turns over on space/Enter, revealed or not. The window-level shortcut in
  // FlashcardApp skips key presses aimed at a [role=button], so this never fires twice.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      flip();
    }
  }

  // A one-line answer (a term, a formula, a call signature) is set at the question's size, so it
  // reads as the answer rather than as a caption lost in the middle of an empty card.
  const shortBack = card.back.length <= 80 && !card.back.includes("\n");

  // Where the card stands in its schedule, said in full on the answer side: a tooltip alone
  // would hide it from touch and keyboard users.
  const schedule =
    state.phase === "review"
      ? `${state.interval}-day interval, ease ${EASE.format(state.ease)}, ${state.lapses} ${
          state.lapses === 1 ? "lapse" : "lapses"
        }`
      : "Still on the short learning steps";

  const header = (side: "question" | "answer") => (
    <div className="hud-strip flex items-center gap-3 px-4 py-3 sm:px-6">
      <span translate="no" className="font-display text-sm font-semibold text-signal">
        {courseLabel(card.course)}
      </span>
      <span className="hud-label min-w-0 truncate">
        {card.unit.replace(/_/g, " ")}
        {card.topic && ` · ${card.topic}`}
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <span
          title={schedule}
          className={`rounded-[3px] border px-2 py-0.5 text-[13px] ${phase.tone}`}
        >
          {phase.label}
        </span>
        <span className="hud-label tabular-nums">
          {side === "question" ? `${queueLeft} left` : "Answer"}
        </span>
      </div>
    </div>
  );

  // Both faces share one grid cell, so the card is as tall as the taller face and does not
  // jump when it turns over.
  const face =
    "holo-card holo-solid col-start-1 row-start-1 flex flex-col overflow-hidden rounded-lg [backface-visibility:hidden]";

  return (
    <section className="animate-cell-in">
      <div className="[perspective:1600px]">
        <div
          role="button"
          tabIndex={0}
          onClick={flip}
          onKeyDown={onKeyDown}
          className="grid cursor-pointer rounded-lg outline-none transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] [transform-style:preserve-3d] focus-visible:ring-2 focus-visible:ring-signal/60 motion-reduce:transition-none"
          style={{ transform: showBack ? "rotateY(180deg)" : "none" }}
        >
          {/* No aria-label: it would replace the card's content as its name, and a screen reader
              would announce the hint but never the question. The name comes from the visible face
              (the hidden one is aria-hidden), led by this hint. */}
          <span className="sr-only">
            {showBack ? "Answer side, activate to see the question again." : "Question side, activate to see the answer."}
          </span>
          <div className={face} aria-hidden={showBack}>
            {header("question")}
            <div className="flex min-h-[16rem] flex-1 flex-col justify-center p-6 sm:min-h-[18rem] sm:p-10">
              <Body
                text={card.front}
                className="whitespace-pre-line text-center font-display text-xl font-medium leading-snug tracking-tight text-paper [text-wrap:balance] sm:text-[26px]"
              />
            </div>
            <div className="hud-label border-t border-signal/15 px-4 py-2.5 text-center">
              {revealed ? "Tap to flip back" : "Tap the card or press space to flip"}
            </div>
          </div>

          <div className={`${face} [transform:rotateY(180deg)]`} aria-hidden={!showBack}>
            {header("answer")}
            <div className="flex min-h-[16rem] flex-1 flex-col justify-center p-6 sm:min-h-[18rem] sm:p-10">
              <Body
                text={card.back}
                className={`whitespace-pre-line text-center text-paper ${
                  shortBack
                    ? "font-display text-xl font-medium leading-snug tracking-tight [text-wrap:balance] sm:text-[26px]"
                    : "font-sans text-[17px] leading-relaxed [text-wrap:pretty] sm:text-xl"
                }`}
              />
            </div>
            <div className="hud-label border-t border-signal/15 px-4 py-2.5 text-center">
              {schedule}. Tap to see the question.
            </div>
          </div>
        </div>
      </div>

      {/* The interval on each button is the scheduler run four times — it cannot drift
          from what actually happens when you click. Grading stays available whichever face
          is up: flipping back to re-read the question must not cost you the grade. */}
      {revealed && (
        <div ref={gradesRef} className="animate-verdict-in mt-5 grid scroll-mb-4 grid-cols-2 gap-2 sm:grid-cols-4">
          {GRADES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onGrade(g)}
              title={`Key ${g}`}
              className={`flex flex-col items-center gap-0.5 rounded-md border px-3 py-3 font-display transition hover:-translate-y-0.5 active:translate-y-0 ${GRADE_TONE[g]}`}
            >
              <span className="text-base font-semibold">{GRADE_LABEL[g]}</span>
              <span className="text-[13px] tabular-nums opacity-80">
                {previews[g]} · {g}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
