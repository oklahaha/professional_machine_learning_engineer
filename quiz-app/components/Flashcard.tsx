"use client";

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
  1: "border-wrong/50 bg-wrong/10 text-wrong hover:bg-wrong/20",
  2: "border-amber/40 bg-amber/10 text-amber hover:bg-amber/20",
  3: "border-correct/50 bg-correct/10 text-correct hover:bg-correct/20",
  4: "border-iris/40 bg-iris/10 text-iris hover:bg-iris/20",
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
            className="overflow-x-auto rounded-xl border border-line bg-ink2/70 p-3 sm:p-4"
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

  return (
    <section
      key={card.id}
      className="animate-cell-in overflow-hidden rounded-2xl border border-line bg-panel/80 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_20px_50px_-30px_rgba(0,0,0,0.9)] backdrop-blur-sm"
    >
      <div className="flex items-center gap-2.5 border-b border-line/70 bg-ink2/60 px-4 py-2.5 sm:px-5">
        <span className="font-mono text-xs font-medium tracking-tight text-signal">
          {courseLabel(card.course)}
        </span>
        <span className="font-mono text-[11px] text-mist">
          {card.unit.replace(/_/g, " ")}
          {card.topic && ` · ${card.topic}`}
        </span>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <span
            title={
              state.phase === "review"
                ? `Interval ${state.interval}d · ease ${state.ease.toFixed(2)} · ${state.lapses} lapse(s)`
                : "Still on the short learning steps"
            }
            className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${phase.tone}`}
          >
            {phase.label}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-mist/60 tabular-nums">
            {queueLeft} left
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <Body
          text={card.front}
          className="whitespace-pre-line font-sans text-[17px] font-medium leading-relaxed text-paper sm:text-lg"
        />

        {!revealed ? (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onReveal}
              className="inline-flex items-center gap-2 rounded-xl bg-signal px-5 py-2.5 font-mono text-sm font-semibold text-ink shadow-[0_8px_24px_-12px_rgba(61,224,180,0.7)] transition hover:brightness-110"
            >
              <span aria-hidden className="text-[11px]">▶</span>
              Show answer
            </button>
            <span className="font-mono text-[11px] text-mist/70">
              space
            </span>
          </div>
        ) : (
          <>
            <div className="animate-verdict-in mt-5 rounded-xl border border-line bg-ink2/60 p-4">
              <div className="mb-2 font-mono text-[11px] uppercase tracking-widest text-signal/80">
                // answer
              </div>
              <Body
                text={card.back}
                className="whitespace-pre-line font-sans text-sm leading-relaxed text-paperdim sm:text-[15px]"
              />
            </div>

            {/* The interval on each button is the scheduler run four times — it cannot drift
                from what actually happens when you click. */}
            <div className="animate-verdict-in mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {GRADES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => onGrade(g)}
                  className={`flex flex-col items-center gap-0.5 rounded-xl border px-3 py-2.5 font-mono transition ${GRADE_TONE[g]}`}
                >
                  <span className="text-sm font-semibold">{GRADE_LABEL[g]}</span>
                  <span className="text-[11px] tabular-nums opacity-70">{previews[g]}</span>
                  <span className="text-[9px] uppercase tracking-widest opacity-50">{g}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
