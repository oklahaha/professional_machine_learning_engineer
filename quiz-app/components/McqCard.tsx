"use client";

import { courseLabel } from "@/lib/dsai";
import type { Mcq } from "@/lib/mcq";
import RichText from "./RichText";

type Props = {
  question: Mcq;
  unitLabel: string;
  index: number; // 1-based position within the current run
  total: number;
  selected: string[];
  revealed: boolean;
  hintShown: boolean;
  onSelect: (label: string) => void;
  onCheck: () => void;
  onClear: () => void;
  onHint: () => void; // toggles the hint open/closed
};

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/**
 * One DSAI multiple-choice question. Same cell vocabulary as the PMLE QuestionCard, but the
 * data is richer in two ways it is built around: a hint you can ask for before answering, and
 * an explanation on EVERY option — so after checking, each option says why it is right or
 * wrong, under the option itself, rather than one paragraph at the bottom.
 */
export default function McqCard({
  question,
  unitLabel,
  index,
  total,
  selected,
  revealed,
  hintShown,
  onSelect,
  onCheck,
  onClear,
  onHint,
}: Props) {
  const correct = question.answers;
  const isMulti = correct.length > 1;
  const isCorrect = sameSet(selected, correct);

  return (
    <section
      key={question.id}
      className="holo-card animate-cell-in overflow-hidden rounded-lg"
    >
      <div className="hud-strip flex items-center gap-2.5 px-4 py-2.5 sm:px-5">
        <span className="font-mono text-xs font-medium tracking-tight text-signal [text-shadow:0_0_8px_rgba(46,230,255,0.6)]">
          {courseLabel(question.course)}
        </span>
        <span className="font-mono text-[11px] text-mist">{unitLabel}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[11px] tabular-nums text-mist">
            {index}/{total}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-mist/60">
            {isMulti ? `select ${correct.length}` : "single choice"}
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <h2 className="whitespace-pre-line font-sans text-[15px] leading-relaxed text-paper sm:text-base">
          <RichText text={question.question} />
        </h2>

        {isMulti && (
          <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-iris/80">
            select all that apply
          </p>
        )}

        {question.hint && !revealed && (
          <div className="mt-4">
            <button
              type="button"
              onClick={onHint}
              aria-expanded={hintShown}
              className="rounded-[4px] border border-iris/40 bg-iris/10 px-2.5 py-1 font-mono text-[11px] text-iris transition hover:bg-iris/20 hover:shadow-[0_0_14px_-4px_rgba(168,139,255,0.8)]"
            >
              <span aria-hidden className="mr-1 inline-block transition-transform">
                {hintShown ? "▾" : "▸"}
              </span>
              {hintShown ? "hide hint" : "show hint"} <span className="text-iris/50">· h</span>
            </button>
            {hintShown && (
              <div className="animate-verdict-in mt-2 rounded-md border border-iris/30 border-l-2 border-l-iris/80 bg-iris/5 px-4 py-3">
                <p className="font-sans text-sm leading-relaxed text-paperdim">
                  <RichText text={question.hint} />
                </p>
              </div>
            )}
          </div>
        )}

        <ul className="mt-5 space-y-2">
          {question.options.map((opt) => {
            const chosen = selected.includes(opt.label);
            const isAnswer = correct.includes(opt.label);

            let row = "border-line bg-panel2/40 hover:border-signal/60 hover:bg-panel2/70 hover:shadow-[0_0_18px_-6px_rgba(46,230,255,0.55)]";
            let chip = "border-linestrong text-mist";
            if (revealed) {
              if (isAnswer) {
                row = "border-correct/70 bg-correct/[0.08] shadow-[0_0_20px_-8px_rgba(52,227,168,0.7)]";
                chip = "border-correct bg-correct text-ink";
              } else if (chosen) {
                row = "border-wrong/70 bg-wrong/[0.08]";
                chip = "border-wrong bg-wrong text-ink";
              } else {
                row = "border-line bg-panel2/20";
                chip = "border-linestrong text-mist";
              }
            } else if (chosen) {
              row = "border-signal bg-signal/[0.10] shadow-[0_0_20px_-6px_rgba(46,230,255,0.7)]";
              chip = "border-signal bg-signal text-ink";
            }

            return (
              <li key={opt.label}>
                <button
                  type="button"
                  disabled={revealed}
                  aria-pressed={chosen}
                  onClick={() => onSelect(opt.label)}
                  className={`flex w-full items-start gap-3 rounded-md border px-3 py-3 text-left transition-colors duration-150 disabled:cursor-default ${row}`}
                >
                  <span
                    className={`mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] border font-mono text-xs font-semibold transition-colors ${chip}`}
                  >
                    {opt.label}
                  </span>
                  <span className="min-w-0 flex-1 pt-0.5 font-sans text-sm leading-relaxed">
                    <span className={revealed && !isAnswer && !chosen ? "text-mist" : "text-paperdim"}>
                      <RichText text={opt.text} />
                    </span>
                    {revealed && opt.explanation && (
                      <span
                        className={`animate-verdict-in mt-2 block border-l-2 pl-3 text-[13px] leading-relaxed ${
                          isAnswer ? "border-correct/60 text-paperdim" : "border-linestrong text-mist"
                        }`}
                      >
                        <RichText text={opt.explanation} />
                      </span>
                    )}
                  </span>
                  {revealed && isAnswer && (
                    <span className="pl-2 pt-0.5 font-mono text-sm text-correct">✓</span>
                  )}
                  {revealed && chosen && !isAnswer && (
                    <span className="pl-2 pt-0.5 font-mono text-sm text-wrong">✗</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {!revealed ? (
            <button
              type="button"
              disabled={selected.length === 0}
              onClick={onCheck}
              className="btn-cyber btn-primary px-5 py-2.5 text-sm"
            >
              <span aria-hidden className="text-[11px]">▶</span>
              Check answer
            </button>
          ) : (
            <span
              className={`animate-verdict-in inline-flex items-center gap-2 rounded-md border px-3.5 py-2 font-mono text-sm font-semibold ${
                isCorrect
                  ? "border-correct/50 bg-correct/10 text-correct shadow-[0_0_18px_-6px_rgba(52,227,168,0.7)] [text-shadow:0_0_8px_rgba(52,227,168,0.6)]"
                  : "border-wrong/50 bg-wrong/10 text-wrong shadow-[0_0_18px_-6px_rgba(255,107,129,0.7)] [text-shadow:0_0_8px_rgba(255,107,129,0.6)]"
              }`}
            >
              {isCorrect ? "✓ Correct" : `✗ Incorrect · answer ${correct.join(", ")}`}
            </span>
          )}
          {revealed && (
            <button
              type="button"
              onClick={onClear}
              className="font-mono text-xs text-mist underline-offset-4 transition hover:text-paper hover:underline"
            >
              try again
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
