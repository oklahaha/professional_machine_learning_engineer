"use client";

import { useEffect, useId, useState } from "react";
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
  // Open where the desktop rail has room for it, shut on a phone. Until you toggle it, CSS makes
  // that call (`auto` below), so the server render is already laid out right and nothing moves
  // when the page hydrates; opening it from an effect pushed the rest of the rail down.
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const bodyId = useId();
  const [wide, setWide] = useState(false); // only for aria-expanded, which moves nothing
  useEffect(() => setWide(window.matchMedia("(min-width: 1024px)").matches), []);
  const open = userOpen ?? wide;
  const auto = userOpen === null;
  const [expanded, setExpanded] = useState<string[]>([]);

  const active = stats.filter((d) => courseSelection(filter, d.course) !== "off");
  const narrowed = filter.units.length;

  const toggleExpanded = (course: string) =>
    setExpanded((e) => (e.includes(course) ? e.filter((c) => c !== course) : [...e, course]));

  return (
    <div className="holo rounded-lg">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setUserOpen(!open)}
          aria-expanded={open}
          aria-controls={auto || open ? bodyId : undefined}
          className="flex flex-1 items-center gap-2 font-display text-sm font-medium text-paperdim transition hover:text-paper"
        >
          <span
            aria-hidden
            className={`transition-transform ${auto ? "lg:rotate-90" : open ? "rotate-90" : ""}`}
          >
            ›
          </span>
          <span>Courses</span>
          <span className="hud-label">
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
            className="hud-label px-1 transition hover:text-paper"
          >
            Clear
          </button>
        )}
      </div>

      {(auto || open) && (
        <div id={bodyId} className={`border-t border-signal/15 px-2 pb-2 pt-2 ${auto ? "hidden lg:block" : ""}`}>
          {/* Column heads for the eye; each row names its figures in sr-only words (see ScoreCells), so
              its accessible name is what it shows, which voice control can say. */}
          <div aria-hidden className="hud-label flex items-center gap-3 px-2.5 pb-1">
            <span className="flex-1">Course and coverage</span>
            <span className="w-12 text-right">Score</span>
            <span className="w-16 text-right">Done</span>
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
                    on ? "border-signal/50 bg-signal/[0.08]" : "border-transparent hover:border-line hover:bg-panel2/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onToggleCourse(d.course)}
                    aria-pressed={sel === "some" ? "mixed" : on}
                    className="flex min-w-0 flex-1 items-center gap-3 px-2.5 py-2 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className={`flex items-center gap-1.5 font-sans text-sm ${on ? "text-paper" : "text-paperdim"}`}>
                        <span translate="no" className="truncate">{d.label}</span>
                        {sel === "some" && (
                          <span className="shrink-0 text-[13px] text-signal/80">some units</span>
                        )}
                      </span>
                      <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-linestrong/40">
                        <span
                          className="block h-full origin-left bg-iris transition-transform duration-300"
                          style={{ transform: `scaleX(${d.score.answered / Math.max(1, d.score.total)})` }}
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
                    className="self-stretch px-3 text-base text-mist transition hover:text-paper"
                  >
                    <span aria-hidden className={`block transition-transform ${showUnits ? "rotate-90" : ""}`}>
                      ›
                    </span>
                  </button>
                </div>

                {showUnits && (
                  <div className="mb-1 ml-3 border-l border-line/70 pl-2">
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
                          <span aria-hidden className={`shrink-0 text-[13px] ${unitOn ? "text-signal" : "text-mist"}`}>
                            {unitOn ? "◆" : "◇"}
                          </span>
                          <span className={`min-w-0 flex-1 truncate font-sans text-sm ${unitOn ? "text-paper" : "text-paperdim"}`}>
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
        className={`hud-figure w-12 shrink-0 text-right text-sm ${
          acc === null ? "text-mist" : acc >= PASS ? "text-correct" : "text-wrong"
        }`}
      >
        {acc === null ? (
          <span aria-hidden>—</span>
        ) : (
          <>
            {acc}%<span className="sr-only"> correct,</span>
          </>
        )}
      </span>
      <span className="hud-label w-16 shrink-0 text-right tabular-nums">
        {score.answered}/{score.total}
        <span className="sr-only"> answered</span>
      </span>
    </>
  );
}
