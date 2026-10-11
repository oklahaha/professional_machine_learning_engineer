"use client";

import type { Question } from "@/lib/questions";
import { parseNumberedSteps, parseReferences, splitCodeBlocks } from "@/lib/format";
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
          <span className="shrink-0 font-mono text-xs text-mist">{i + 1}.</span>
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
function Stem({ text }: { text: string }) {
  const segments = splitCodeBlocks(text);
  const headingAt = segments.findIndex((seg) => seg.kind === "text");
  const prose =
    "whitespace-pre-line font-sans text-[15px] leading-relaxed text-paper sm:text-base";

  return (
    <div className="space-y-3">
      {segments.map((seg, i) => {
        if (seg.kind === "code") {
          return (
            <pre
              key={i}
              className="overflow-x-auto rounded-xl border border-line bg-ink2/70 p-3 sm:p-4"
            >
              <code className="block font-mono text-[12px] leading-relaxed text-paperdim sm:text-[13px]">
                {seg.content}
              </code>
            </pre>
          );
        }
        return i === headingAt ? (
          <h2 key={i} className={prose}>
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

  return (
    <section
      key={question.id}
      className="animate-cell-in overflow-hidden rounded-2xl border border-line bg-panel/80 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_20px_50px_-30px_rgba(0,0,0,0.9)] backdrop-blur-sm"
    >
      {/* cell header — reads like a notebook cell label */}
      <div className="flex items-center gap-2.5 border-b border-line/70 bg-ink2/60 px-4 py-2.5 sm:px-5">
        <span className="font-mono text-xs font-medium tracking-tight text-signal">
          Q{String(question.id).padStart(3, "0")}
        </span>
        <span className="font-mono text-[11px] text-mist">
          {index}/{total}
        </span>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {/* One neutral accent for every section: green and red mean right/wrong in this
              app, so section identity must not borrow them. */}
          {domain && (
            <span
              title={`Exam guide section ${domain.id}: ${domain.title} (~${domain.weight}% of the exam) — ${domain.blurb}`}
              className="rounded-full border border-linestrong bg-panel2/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-paperdim"
            >
              §{domain.id} {domain.name}
            </span>
          )}
          {isCommunity && (
            <span
              title="Correct answer sourced from the ExamTopics community vote"
              className="rounded-full border border-iris/30 bg-iris/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-iris"
            >
              community-voted
            </span>
          )}
          {question.needsReview ? (
            <span
              title={question.reviewNote ?? `Auto-extracted with possible defects: ${question.flags.join(", ")}`}
              className="flex items-center gap-1 rounded-full border border-amber/30 bg-amber/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-amber"
            >
              ⚠ review
            </span>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-widest text-mist/60">
              {isMulti ? `select ${correct.length}` : "single choice"}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <Stem text={question.question} />

        {isMulti && (
          <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-iris/80">
            select all that apply
          </p>
        )}

        <ul className="mt-5 space-y-2">
          {question.options.map((opt) => {
            const chosen = selected.includes(opt.label);
            const isAnswer = correct.includes(opt.label);

            let row =
              "border-line bg-panel2/40 hover:border-signal/50 hover:bg-panel2";
            let chip = "border-linestrong text-mist";
            if (revealed) {
              if (isAnswer) {
                row = "border-correct/70 bg-correct/[0.08]";
                chip = "border-correct bg-correct text-ink";
              } else if (chosen) {
                row = "border-wrong/70 bg-wrong/[0.08]";
                chip = "border-wrong bg-wrong text-ink";
              } else {
                row = "border-line bg-panel2/20 opacity-55";
                chip = "border-linestrong text-mist";
              }
            } else if (chosen) {
              row = "border-signal bg-signal/[0.10]";
              chip = "border-signal bg-signal text-ink";
            }

            return (
              <li key={opt.label}>
                <button
                  type="button"
                  disabled={revealed}
                  aria-pressed={chosen}
                  onClick={() => onSelect(opt.label)}
                  className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors duration-150 disabled:cursor-default ${row}`}
                >
                  <span
                    className={`mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-md border font-mono text-xs font-semibold transition-colors ${chip}`}
                  >
                    {opt.label}
                  </span>
                  <span className="pt-0.5 font-sans text-sm leading-relaxed text-paperdim">
                    {opt.text ? (
                      <OptionBody text={opt.text} />
                    ) : (
                      <em className="text-mist">option text unavailable in source</em>
                    )}
                  </span>
                  {revealed && isAnswer && (
                    <span className="ml-auto pl-2 pt-0.5 font-mono text-sm text-correct">
                      ✓
                    </span>
                  )}
                  {revealed && chosen && !isAnswer && (
                    <span className="ml-auto pl-2 pt-0.5 font-mono text-sm text-wrong">
                      ✗
                    </span>
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
              className="group inline-flex items-center gap-2 rounded-xl bg-signal px-5 py-2.5 font-mono text-sm font-semibold text-ink shadow-[0_8px_24px_-12px_rgba(61,224,180,0.7)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-linestrong disabled:text-mist disabled:shadow-none"
            >
              <span aria-hidden className="text-[11px]">▶</span>
              Check answer
            </button>
          ) : (
            <span
              className={`animate-verdict-in inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 font-mono text-sm font-semibold ${
                isCorrect
                  ? "border-correct/40 bg-correct/10 text-correct"
                  : "border-wrong/40 bg-wrong/10 text-wrong"
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

        {revealed && (
          <div className="animate-verdict-in mt-5 rounded-xl border border-line bg-ink2/60 p-4">
            <div className="mb-2 font-mono text-[11px] uppercase tracking-widest text-signal/80">
              // explanation
            </div>
            <p className="whitespace-pre-line font-sans text-sm leading-relaxed text-paperdim">
              {question.explanation || "No explanation available for this question."}
            </p>
            {references.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-line pt-3">
                {references.map((url) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all font-mono text-[11px] text-mist underline-offset-4 transition hover:text-signal hover:underline"
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
          <div className="animate-verdict-in mt-3 rounded-xl border border-amber/30 bg-amber/5 p-4">
            <div className="mb-2 font-mono text-[11px] uppercase tracking-widest text-amber/90">
              ⚠ verify this answer yourself
            </div>
            <p className="font-sans text-sm leading-relaxed text-paperdim">{question.reviewNote}</p>
          </div>
        )}
      </div>
    </section>
  );
}
