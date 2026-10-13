"use client";

import { useState } from "react";
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
  new: { label: "new", tone: "border-iris/30 bg-iris/10 text-iris" },
  learning: { label: "learning", tone: "border-amber/30 bg-amber/10 text-amber" },
  relearning: { label: "relearning", tone: "border-amber/30 bg-amber/10 text-amber" },
  review: { label: "review", tone: "border-linestrong bg-panel2/60 text-paperdim" },
};

/**
 * Again is a wrong answer and Good is a right one, so those two keep the app's green/red.
 * Hard and Easy are shadings either side and take the neutral accents.
 */
const GRADE_TONE: Record<Grade, string> = {
  1: "border-wrong/50 bg-wrong/10 text-wrong hover:bg-wrong/20 hover:shadow-[0_0_18px_-4px_rgba(255,107,129,0.7)]",
  2: "border-amber/40 bg-amber/10 text-amber hover:bg-amber/20 hover:shadow-[0_0_18px_-4px_rgba(255,181,71,0.7)]",
  3: "border-correct/50 bg-correct/10 text-correct hover:bg-correct/20 hover:shadow-[0_0_18px_-4px_rgba(52,227,168,0.7)]",
  4: "border-iris/40 bg-iris/10 text-iris hover:bg-iris/20 hover:shadow-[0_0_18px_-4px_rgba(168,139,255,0.7)]",
};

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
            className="overflow-x-auto rounded-md border border-signal/20 bg-ink/80 p-3 shadow-[inset_0_0_24px_-12px_rgba(46,230,255,0.35)] sm:p-4"
          >
            <code className="block font-mono text-[12px] leading-relaxed text-paperdim sm:text-[13px]">
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

  function flip() {
    if (!revealed) onReveal();
    else setPeekFront((v) => !v);
  }

  // Unrevealed, the window-level handler already turns space/Enter into a reveal; handling it
  // here too would fire twice. Once revealed, a focused card flips on the same keys.
  function onKeyDown(e: React.KeyboardEvent) {
    if (revealed && (e.key === " " || e.key === "Enter")) {
      e.preventDefault();
      flip();
    }
  }

  const header = (side: "question" | "answer") => (
    <div className="hud-strip flex items-center gap-2.5 px-4 py-2.5 sm:px-5">
      <span className="font-mono text-xs font-medium tracking-tight text-signal [text-shadow:0_0_8px_rgba(46,230,255,0.6)]">
        {courseLabel(card.course)}
      </span>
      <span className="min-w-0 truncate font-mono text-[11px] text-mist">
        {card.unit.replace(/_/g, " ")}
        {card.topic && ` · ${card.topic}`}
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <span
          title={
            state.phase === "review"
              ? `Interval ${state.interval}d · ease ${state.ease.toFixed(2)} · ${state.lapses} lapse(s)`
              : "Still on the short learning steps"
          }
          className={`rounded-[3px] border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${phase.tone}`}
        >
          {phase.label}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-mist/60 tabular-nums">
          {side === "question" ? `${queueLeft} left` : "answer"}
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
          aria-label={showBack ? "Answer side — click to see the question" : "Question side — click to see the answer"}
          className="grid cursor-pointer rounded-lg outline-none transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] [transform-style:preserve-3d] focus-visible:ring-2 focus-visible:ring-signal/60 motion-reduce:transition-none"
          style={{ transform: showBack ? "rotateY(180deg)" : "none" }}
        >
          <div className={face} aria-hidden={showBack}>
            {header("question")}
            <div className="flex min-h-[15rem] flex-1 flex-col justify-center p-5 sm:min-h-[17rem] sm:p-8">
              <Body
                text={card.front}
                className="whitespace-pre-line text-center font-sans text-[17px] font-medium leading-relaxed text-paper sm:text-lg"
              />
            </div>
            <div className="border-t border-signal/15 px-4 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-mist/70">
              {revealed ? "tap to flip back" : "tap card to flip · space"}
            </div>
          </div>

          <div className={`${face} [transform:rotateY(180deg)]`} aria-hidden={!showBack}>
            {header("answer")}
            <div className="flex min-h-[15rem] flex-1 flex-col justify-center p-5 sm:min-h-[17rem] sm:p-8">
              <div className="mb-3 text-center font-mono text-[11px] uppercase tracking-widest text-signal/80">
                // answer
              </div>
              <Body
                text={card.back}
                className="whitespace-pre-line text-center font-sans text-sm leading-relaxed text-paperdim sm:text-[15px]"
              />
            </div>
            <div className="border-t border-signal/15 px-4 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-mist/70">
              tap to see the question
            </div>
          </div>
        </div>
      </div>

      {/* The interval on each button is the scheduler run four times — it cannot drift
          from what actually happens when you click. Grading stays available whichever face
          is up: flipping back to re-read the question must not cost you the grade. */}
      {revealed && (
        <div className="animate-verdict-in mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {GRADES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onGrade(g)}
              className={`flex flex-col items-center gap-0.5 rounded-md border px-3 py-2.5 font-mono transition hover:-translate-y-0.5 ${GRADE_TONE[g]}`}
            >
              <span className="text-sm font-semibold">{GRADE_LABEL[g]}</span>
              <span className="text-[11px] tabular-nums opacity-70">{previews[g]}</span>
              <span className="text-[9px] uppercase tracking-widest opacity-50">{g}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
