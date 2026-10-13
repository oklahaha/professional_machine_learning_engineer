"use client";

import { useState } from "react";
import { courseSelection, isUnitOn, type DeckFilter } from "@/lib/deck";

export type Score = { total: number; answered: number; correct: number };

export type QuizUnitStat = { unit: string; label: string; score: Score };
export type QuizCourseStat = { course: string; label: string; score: Score; units: QuizUnitStat[] };

type Props = {
  stats: QuizCourseStat[];
  filter: DeckFilter;
  onToggleCourse: (course: string) => void;
  onToggleUnit: (course: string, unit: string) => void;
  onClear: () => void;
};

// Where accuracy turns from red to green. Same 70% bar the PMLE scorecard uses (PASS_MARK in
// lib/domains.ts) — not imported, because the two sources share no code.
const PASS = 70;

const pct = (s: Score) => (s.answered > 0 ? Math.round((100 * s.correct) / s.answered) : null);

/**
 * Per-course and per-unit score for the DSAI multiple-choice bank, doubling as its filter —
 * the same two-level selection as the flashcards' DeckPanel (lib/deck.ts), with a quiz's
 * columns: accuracy and how much of the unit you have answered. The bar is coverage, not a
 * verdict, so it takes the neutral iris accent; only the accuracy figure is green/red.
 */
export default function QuizDeckPanel({ stats, filter, onToggleCourse, onToggleUnit, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);

  const active = stats.filter((d) => courseSelection(filter, d.course) !== "off");
  const narrowed = filter.units.length;

  const toggleExpanded = (course: string) =>
    setExpanded((e) => (e.includes(course) ? e.filter((c) => c !== course) : [...e, course]));

  return (
    <div className="holo mt-3 rounded-lg">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-mist transition hover:text-paper"
        >
          <span aria-hidden className={`transition-transform ${open ? "rotate-90" : ""}`}>
            ›
          </span>
          <span>courses</span>
          <span className="text-mist/50">
            {active.length === 0
              ? `all ${stats.length} courses`
              : `${active.length} course${active.length === 1 ? "" : "s"}${
                  narrowed > 0 ? ` · ${narrowed} unit${narrowed === 1 ? "" : "s"}` : ""
                }`}
          </span>
        </button>
        {active.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="font-mono text-[10px] uppercase tracking-widest text-mist/70 transition hover:text-paper"
          >
            clear
          </button>
        )}
      </div>

      {open && (
        <div className="border-t border-signal/15 px-2 pb-2 pt-1.5">
          <div className="flex items-center gap-3 px-2.5 pb-1 font-mono text-[9px] uppercase tracking-widest text-mist/50">
            <span className="flex-1">course · answered</span>
            <span className="w-12 text-right">acc</span>
            <span className="w-14 text-right">done</span>
          </div>

          {stats.map((d) => {
            const sel = courseSelection(filter, d.course);
            const on = sel !== "off";
            const showUnits = expanded.includes(d.course);
            return (
              <div key={d.course}>
                {/* Two sibling controls, never nested: the row picks, the chevron expands. */}
                <div
                  className={`flex items-center rounded-md border transition ${
                    on ? "border-signal/50 bg-signal/[0.08] shadow-[inset_0_0_16px_-6px_rgba(46,230,255,0.6)]" : "border-transparent hover:border-line hover:bg-panel2/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onToggleCourse(d.course)}
                    aria-pressed={sel === "some" ? "mixed" : on}
                    className="flex min-w-0 flex-1 items-center gap-3 px-2.5 py-2 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className={`flex items-center gap-1.5 font-mono text-[11px] ${on ? "text-paper" : "text-paperdim"}`}>
                        <span className="truncate">{d.label}</span>
                        {sel === "some" && (
                          <span className="shrink-0 text-[9px] uppercase tracking-widest text-signal/80">partial</span>
                        )}
                      </span>
                      <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-linestrong/40">
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-iris to-plasma shadow-[0_0_8px_rgba(168,139,255,0.8)] transition-[width] duration-300"
                          style={{ width: `${(100 * d.score.answered) / Math.max(1, d.score.total)}%` }}
                        />
                      </span>
                    </span>
                    <ScoreCells score={d.score} />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleExpanded(d.course)}
                    aria-expanded={showUnits}
                    aria-label={`${showUnits ? "Hide" : "Show"} the ${d.units.length} units of ${d.label}`}
                    className="self-stretch px-2 font-mono text-[11px] text-mist/60 transition hover:text-paper"
                  >
                    <span aria-hidden className={`block transition-transform ${showUnits ? "rotate-90" : ""}`}>
                      ›
                    </span>
                  </button>
                </div>

                {showUnits && (
                  <div className="mb-1 ml-3 border-l border-line/70 pl-1.5">
                    {d.units.map((u) => {
                      const unitOn = isUnitOn(filter, d.course, u.unit);
                      return (
                        <button
                          key={u.unit}
                          type="button"
                          onClick={() => onToggleUnit(d.course, u.unit)}
                          aria-pressed={unitOn}
                          className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition ${
                            unitOn ? "bg-signal/[0.06]" : "hover:bg-panel2/40"
                          }`}
                        >
                          <span aria-hidden className={`shrink-0 font-mono text-[10px] ${unitOn ? "text-signal" : "text-mist/40"}`}>
                            {unitOn ? "◆" : "◇"}
                          </span>
                          <span className={`min-w-0 flex-1 truncate font-mono text-[11px] ${unitOn ? "text-paperdim" : "text-mist"}`}>
                            {u.label}
                          </span>
                          <ScoreCells score={u.score} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ScoreCells({ score }: { score: Score }) {
  const acc = pct(score);
  return (
    <>
      <span
        className={`w-12 shrink-0 text-right font-mono text-xs tabular-nums ${
          acc === null ? "text-mist/50" : acc >= PASS ? "text-correct" : "text-wrong"
        }`}
      >
        {acc === null ? "—" : `${acc}%`}
      </span>
      <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-mist/70">
        {score.answered}/{score.total}
      </span>
    </>
  );
}
