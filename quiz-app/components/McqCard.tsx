"use client";

import { useEffect, useId, useRef } from "react";
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

const ARROW_STEP: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

/**
 * Arrow keys inside the options, as a radio group expects: they move focus to the next option
 * (wrapping), and for a single answer the selection follows the focus. The quiz's own ←/→
 * question navigation skips key presses from inside `[data-options]`.
 */
function moveWithinOptions(
  e: React.KeyboardEvent<HTMLUListElement>,
  isMulti: boolean,
  onSelect: (label: string) => void,
) {
  const step = ARROW_STEP[e.key];
  if (!step) return;
  const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
  const at = items.indexOf(document.activeElement as HTMLButtonElement);
  if (at < 0) return;
  e.preventDefault();
  const next = items[(at + step + items.length) % items.length];
  next.focus();
  if (!isMulti) onSelect(next.dataset.label!);
}

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
  const stemId = useId();
  const firstChosen = question.options.findIndex((o) => selected.includes(o.label));
  const rovingIndex = firstChosen >= 0 ? firstChosen : 0;
  // A "choose two" is checked only once two are picked: checking with one would score it wrong
  // for a slip of the hand, not for a wrong answer.
  const ready = selected.length === correct.length;
  const remaining = correct.length - selected.length;

  // Check answer and Try again each remove the button you pressed, which would drop keyboard
  // focus to <body> and send the next Tab back to the top of the page. Hand it on instead: to the
  // verdict once checked, to the options once cleared. Only after a press — never on load.
  const handOff = useRef(false);
  const verdictRef = useRef<HTMLSpanElement>(null);
  const optionsRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!handOff.current) return;
    handOff.current = false;
    if (revealed) verdictRef.current?.focus();
    else optionsRef.current?.querySelector<HTMLButtonElement>("button")?.focus(); // cleared: the first is the tab stop
  }, [revealed]);

  return (
    <section
      key={question.id}
      className="holo-card animate-cell-in overflow-hidden rounded-lg"
    >
      <div className="hud-strip flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 sm:px-6">
        <span translate="no" className="font-display text-sm font-semibold text-signal">
          {courseLabel(question.course)}
        </span>
        <span className="hud-label">{unitLabel}</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="hud-label tabular-nums">
            {index} of {total}
          </span>
          <span className="hud-label">
            {isMulti ? `Select ${correct.length}` : "Single choice"}
          </span>
        </div>
      </div>

      <div className="p-5 sm:p-8">
        <h2 id={stemId} className="whitespace-pre-line font-sans text-[17px] leading-relaxed text-paper sm:text-lg">
          <RichText text={question.question} />
        </h2>

        {isMulti && (
          <p className="mt-3 font-display text-sm font-medium text-iris">Select all that apply</p>
        )}

        {question.hint && !revealed && (
          <div className="mt-4">
            <button
              type="button"
              onClick={onHint}
              aria-expanded={hintShown}
              className="rounded-[4px] border border-iris/40 bg-iris/10 px-3 py-1.5 font-display text-sm font-medium text-iris transition hover:bg-iris/20"
            >
              <span aria-hidden className="mr-1 inline-block transition-transform">
                {hintShown ? "▾" : "▸"}
              </span>
              {hintShown ? "Hide hint" : "Show hint"} <span className="text-iris">(H)</span>
            </button>
            {/* Live, so opening the hint reads it out without moving focus. */}
            <div aria-live="polite">
              {hintShown && (
                <div className="animate-verdict-in mt-2 rounded-md border border-iris/30 border-l-2 border-l-iris/80 bg-iris/5 px-4 py-3">
                  <p className="font-sans text-[15px] leading-relaxed text-paperdim sm:text-base">
                    <RichText text={question.hint} />
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* A radio group for a single answer, checkboxes for a "choose two". */}
        <ul
          role={isMulti ? "group" : "radiogroup"}
          aria-labelledby={stemId}
          data-options
          ref={optionsRef}
          onKeyDown={(e) => moveWithinOptions(e, isMulti, onSelect)}
          className="mt-5 space-y-2"
        >
          {question.options.map((opt, i) => {
            const chosen = selected.includes(opt.label);
            const isAnswer = correct.includes(opt.label);
            // The option's name is its letter and text; its explanation, once shown, is the
            // description. Left to the default, the whole paragraph became the radio's name.
            const ids = {
              chip: `${stemId}c${opt.label}`,
              text: `${stemId}t${opt.label}`,
              mark: `${stemId}m${opt.label}`, // the spoken verdict: "Correct answer" / "Your answer, incorrect"
              why: `${stemId}w${opt.label}`,
            };
            const marked = revealed && (isAnswer || chosen);
            const explained = revealed && !!opt.explanation;

            let row = "border-line bg-panel2/40 hover:border-signal/60 hover:bg-panel2/70";
            let chip = "border-linestrong text-mist";
            if (revealed) {
              if (isAnswer) {
                row = "border-correct/70 bg-correct/[0.08] shadow-[0_0_20px_-8px_rgba(var(--glow-correct),0.7)]";
                chip = "border-correct bg-correct text-ink";
              } else if (chosen) {
                row = "border-wrong/70 bg-wrong/[0.08]";
                chip = "border-wrong bg-wrong text-ink";
              } else {
                row = "border-line bg-panel2/20";
                chip = "border-linestrong text-mist";
              }
            } else if (chosen) {
              row = "border-signal bg-signal/[0.10] shadow-[0_0_20px_-6px_rgba(var(--glow-cyan),0.7)]";
              chip = "border-signal bg-signal text-ink";
            }

            return (
              <li key={opt.label} role="none">
                <button
                  type="button"
                  disabled={revealed}
                  role={isMulti ? "checkbox" : "radio"}
                  aria-checked={chosen}
                  aria-labelledby={`${ids.chip} ${ids.text}${marked ? ` ${ids.mark}` : ""}`}
                  aria-describedby={explained ? ids.why : undefined}
                  data-label={opt.label}
                  // A radio group is one Tab stop (the chosen option, else the first); arrows move
                  // within it. Checkboxes stay one stop each.
                  tabIndex={isMulti ? undefined : i === rovingIndex ? 0 : -1}
                  onClick={() => onSelect(opt.label)}
                  className={`flex w-full items-start gap-3 rounded-md border px-3 py-3 text-left transition-colors duration-150 disabled:cursor-default ${row}`}
                >
                  <span
                    id={ids.chip}
                    className={`mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] border font-display text-sm font-semibold transition-colors ${chip}`}
                  >
                    {opt.label}
                  </span>
                  <span className="min-w-0 flex-1 pt-0.5 font-sans text-[15px] leading-relaxed sm:text-base">
                    <span id={ids.text} className={revealed && !isAnswer && !chosen ? "text-mist" : "text-paperdim"}>
                      <RichText text={opt.text} />
                    </span>
                    {explained && (
                      <span
                        id={ids.why}
                        className={`animate-verdict-in mt-2 block border-l-2 pl-3 text-[15px] leading-relaxed ${
                          isAnswer ? "border-correct/60 text-paperdim" : "border-linestrong text-mist"
                        }`}
                      >
                        <RichText text={opt.explanation} />
                      </span>
                    )}
                  </span>
                  {revealed && isAnswer && (
                    <span className="pl-2 pt-0.5 font-display text-base text-correct">
                      <span aria-hidden>✓</span>
                      <span id={ids.mark} className="sr-only">Correct answer</span>
                    </span>
                  )}
                  {revealed && chosen && !isAnswer && (
                    <span className="pl-2 pt-0.5 font-display text-base text-wrong">
                      <span aria-hidden>✗</span>
                      <span id={ids.mark} className="sr-only">Your answer, incorrect</span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {!revealed && (
            <button
              type="button"
              disabled={!ready}
              onClick={() => {
                handOff.current = true;
                onCheck();
              }}
              className="btn-cyber btn-primary px-6 py-3 text-base"
            >
              <span aria-hidden className="text-[13px]">▶</span>
              Check answer
            </button>
          )}
          {/* Says why the button is not ready yet, rather than leaving a dead control. */}
          {!revealed && !ready && (
            <span className="hud-label">
              {!isMulti
                ? "Pick an answer to check it"
                : remaining > 0
                  ? `Pick ${remaining} more to check`
                  : `Pick only ${correct.length} to check`}
            </span>
          )}
          {/* A live region that exists before the verdict does, so a screen reader announces
              the verdict the moment it appears. */}
          <span role="status">
            {revealed && (
              <span
                ref={verdictRef}
                tabIndex={-1}
                className={`animate-verdict-in inline-flex items-center gap-2 rounded-md border px-4 py-2 font-display text-base font-semibold ${
                  isCorrect
                    ? "border-correct/50 bg-correct/10 text-correct"
                    : "border-wrong/50 bg-wrong/10 text-wrong"
                }`}
              >
                <span aria-hidden>{isCorrect ? "✓" : "✗"}</span>
                {isCorrect ? "Correct" : `Incorrect. The answer is ${correct.join(", ")}`}
              </span>
            )}
          </span>
          {revealed && (
            <button
              type="button"
              onClick={() => {
                handOff.current = true;
                onClear();
              }}
              className="hud-label underline-offset-4 transition hover:text-paper hover:underline"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
