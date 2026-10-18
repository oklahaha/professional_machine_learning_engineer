"use client";

import { useEffect, useId, useRef } from "react";
import type { Question } from "@/lib/questions";
import { parseNumberedSteps, parseReferences, splitCodeBlocks, splitExplanation } from "@/lib/format";
import { getDomain } from "@/lib/domains";

type Props = {
  question: Question;
  index: number; // 1-based position within the current run
  total: number;
  selected: string[]; // labels currently selected (multi-answer aware)
  revealed: boolean;
  onSelect: (label: string) => void;
  onCheck: () => void;
  onClear: () => void;
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
 * Options that spell out a procedure arrive as one run-on line ("1. Do X 2. Do Y").
 * Break them onto one line per step. Rendered with spans, not <ol>: this sits inside
 * the option <button>, which only accepts phrasing content.
 */
function OptionBody({ text }: { text: string }) {
  const list = parseNumberedSteps(text);
  if (!list) return <>{text}</>;

  return (
    <>
      {list.lead && <span className="mb-1.5 block">{list.lead}</span>}
      {list.steps.map((step, i) => (
        <span key={i} className="mt-1 flex gap-2 first:mt-0">
          <span className="shrink-0 font-display text-sm tabular-nums text-mist">{i + 1}.</span>
          <span>{step}</span>
        </span>
      ))}
    </>
  );
}

/**
 * The stem, plus any code listing it carries. A fenced listing renders as a scrollable
 * <pre> so its indentation survives; the prose around it keeps the heading styling, with
 * the first run as the <h2> so the card still has exactly one heading.
 */
function Stem({ text, id }: { text: string; id: string }) {
  const segments = splitCodeBlocks(text);
  const headingAt = segments.findIndex((seg) => seg.kind === "text");
  const prose =
    "whitespace-pre-line font-sans text-[17px] leading-relaxed text-paper sm:text-lg";

  return (
    <div className="space-y-3">
      {segments.map((seg, i) => {
        if (seg.kind === "code") {
          return (
            // Focusable and named: a listing wider than the card scrolls sideways, and keyboard
            // users can only scroll what they can focus.
            <pre
              key={i}
              tabIndex={0}
              role="region"
              aria-label="Code listing"
              className="overflow-x-auto rounded-md border border-signal/20 bg-ink/80 p-3 sm:p-4"
            >
              <code className="block font-mono text-[13px] leading-relaxed text-paperdim sm:text-sm">
                {seg.content}
              </code>
            </pre>
          );
        }
        return i === headingAt ? (
          <h2 key={i} id={id} className={prose}>
            {seg.content}
          </h2>
        ) : (
          <p key={i} className={prose}>
            {seg.content}
          </p>
        );
      })}
    </div>
  );
}

export default function QuestionCard({
  question,
  index,
  total,
  selected,
  revealed,
  onSelect,
  onCheck,
  onClear,
}: Props) {
  const correct = question.answers;
  const isMulti = correct.length > 1;
  const isCorrect = sameSet(selected, correct);
  const isCommunity = (question.source ?? "").startsWith("ExamTopics");
  const domain = getDomain(question.domain);
  const references = parseReferences(question.reference);
  const explanation = splitExplanation(question.explanation ?? "");
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
      {/* cell header — reads like a notebook cell label */}
      <div className="hud-strip flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 sm:px-6">
        <span className="font-display text-sm font-semibold tabular-nums text-signal">
          <span translate="no">Q{String(question.id).padStart(3, "0")}</span>
        </span>
        <span className="hud-label tabular-nums">
          {index} of {total}
        </span>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {/* One neutral accent for every section: green and red mean right/wrong in this
              app, so section identity must not borrow them. */}
          {domain && (
            <span
              title={`Exam guide section ${domain.id}: ${domain.title} (~${domain.weight}% of the exam) — ${domain.blurb}`}
              className="rounded-[3px] border border-linestrong bg-panel2/60 px-2 py-0.5 text-[13px] text-paperdim"
            >
              §{domain.id} {domain.name}
            </span>
          )}
          {isCommunity && (
            <span
              title="Correct answer sourced from the ExamTopics community vote"
              className="rounded-[3px] border border-iris/30 bg-iris/10 px-2 py-0.5 text-[13px] text-iris"
            >
              Community-voted
            </span>
          )}
          {question.needsReview ? (
            <span
              title={question.reviewNote ?? `Auto-extracted with possible defects: ${question.flags.join(", ")}`}
              className="flex items-center gap-1 rounded-[3px] border border-amber/30 bg-amber/10 px-2 py-0.5 text-[13px] text-amber"
            >
              ⚠ Needs review
            </span>
          ) : (
            <span className="hud-label">
              {isMulti ? `Select ${correct.length}` : "Single choice"}
            </span>
          )}
        </div>
      </div>

      <div className="p-5 sm:p-8">
        <Stem text={question.question} id={stemId} />

        {isMulti && (
          <p className="mt-3 font-display text-sm font-medium text-iris">Select all that apply</p>
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

            let row =
              "border-line bg-panel2/40 hover:border-signal/60 hover:bg-panel2/70";
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
                  data-label={opt.label}
                  // A radio group is one Tab stop (the chosen option, else the first); arrows move
                  // within it. Checkboxes stay one stop each.
                  tabIndex={isMulti ? undefined : i === rovingIndex ? 0 : -1}
                  onClick={() => onSelect(opt.label)}
                  className={`flex w-full items-start gap-3 rounded-md border px-3 py-3 text-left transition-colors duration-150 disabled:cursor-default ${row}`}
                >
                  <span
                    className={`mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] border font-display text-sm font-semibold transition-colors ${chip}`}
                  >
                    {opt.label}
                  </span>
                  <span
                    className={`pt-0.5 font-sans text-[15px] leading-relaxed sm:text-base ${
                      revealed && !isAnswer && !chosen ? "text-mist" : "text-paperdim"
                    }`}
                  >
                    {opt.text ? (
                      <OptionBody text={opt.text} />
                    ) : (
                      <em className="text-mist">option text unavailable in source</em>
                    )}
                  </span>
                  {revealed && isAnswer && (
                    <span className="ml-auto pl-2 pt-0.5 font-display text-base text-correct">
                      <span aria-hidden>✓</span>
                      <span className="sr-only">Correct answer</span>
                    </span>
                  )}
                  {revealed && chosen && !isAnswer && (
                    <span className="ml-auto pl-2 pt-0.5 font-display text-base text-wrong">
                      <span aria-hidden>✗</span>
                      <span className="sr-only">Your answer, incorrect</span>
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

        {revealed && (
          <div className="animate-verdict-in holo mt-6 rounded-md border-l-2 border-l-signal/70 p-5">
            <h3 className="mb-2 font-display text-base font-semibold text-signal">Explanation</h3>
            {/* One paragraph per option discussed (lib/format.ts), not one wall of text. */}
            <div className="space-y-3 font-sans text-[15px] leading-relaxed text-paperdim sm:text-base">
              {explanation.paragraphs.length > 0 ? (
                explanation.paragraphs.map((p, i) => <p key={i}>{p}</p>)
              ) : (
                <p>No explanation available for this question.</p>
              )}
            </div>
            {explanation.furtherReading.length > 0 && (
              <div className="mt-4">
                <h4 className="font-display text-sm font-semibold text-paperdim">Further reading</h4>
                {explanation.furtherReading.length > 1 ? (
                  <ul className="hud-label mt-1 list-disc space-y-0.5 pl-5">
                    {explanation.furtherReading.map((title, i) => (
                      <li key={i}>{title}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="hud-label mt-1 break-words">{explanation.furtherReading[0]}</p>
                )}
              </div>
            )}
            {domain && (
              <p className="hud-label mt-3">
                Exam guide §{domain.id}, {domain.title} (about {domain.weight}% of the exam):{" "}
                {domain.blurb}
              </p>
            )}
            {references.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-line pt-3">
                {references.map((url) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="hud-label break-all underline-offset-4 transition hover:text-signal hover:underline"
                    >
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {revealed && question.reviewNote && (
          <div className="animate-verdict-in mt-3 rounded-md border border-amber/30 border-l-2 border-l-amber/80 bg-amber/5 p-5">
            <h3 className="mb-2 font-display text-base font-semibold text-amber">⚠ Verify this answer yourself</h3>
            <p className="font-sans text-[15px] leading-relaxed text-paperdim sm:text-base">{question.reviewNote}</p>
          </div>
        )}
      </div>
    </section>
  );
}
