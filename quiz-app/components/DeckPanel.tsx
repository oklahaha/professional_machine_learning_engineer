"use client";

import { useEffect, useState } from "react";
import { courseSelection, isUnitOn, type DeckFilter } from "@/lib/deck";
import type { Counts } from "@/lib/srs";

export type UnitStat = {
  unit: string; // "Lab1" — the tag's code, what the filter stores
  label: string; // "Lab 1" — what the deck file calls it
  counts: Counts;
};

export type CourseStat = {
  course: string;
  label: string; // course title if one is set, else the code
  counts: Counts;
  units: UnitStat[];
};

type Props = {
  stats: CourseStat[];
  filter: DeckFilter;
  onToggleCourse: (course: string) => void;
  onToggleUnit: (course: string, unit: string) => void;
  onClear: () => void;
};

/**
 * Per-course progress, doubling as the deck filter — the readout that tells you which course
 * you are behind on is the control that lets you drill it. Each course opens onto its units
 * (lectures, labs, tutorials), so a session can be narrowed to "just Lab 1".
 *
 * Colour here is NOT the app's green/red: those mean Again/Good on the grade buttons. Maturity
 * is progress, not a verdict, so the bar takes the neutral iris accent and the counts take the
 * accent that matches their urgency.
 */
export default function DeckPanel({
  stats,
  filter,
  onToggleCourse,
  onToggleUnit,
  onClear,
}: Props) {
  // Open where the desktop rail has room for it, shut on a phone. Until you toggle it, CSS makes
  // that call (`auto` below), so the server render is already laid out right and nothing moves
  // when the page hydrates; opening it from an effect pushed the rest of the rail down.
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const [wide, setWide] = useState(false); // only for aria-expanded, which moves nothing
  useEffect(() => setWide(window.matchMedia("(min-width: 1024px)").matches), []);
  const open = userOpen ?? wide;
  const auto = userOpen === null;
  const [expanded, setExpanded] = useState<string[]>([]);

  const totalDue = stats.reduce((s, d) => s + d.counts.due + d.counts.learning, 0);
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
          className="flex flex-1 items-center gap-2 font-display text-sm font-medium text-paperdim transition hover:text-paper"
        >
          <span
            aria-hidden
            className={`transition-transform ${auto ? "lg:rotate-90" : open ? "rotate-90" : ""}`}
          >
            ›
          </span>
          <span>Decks</span>
          <span className="hud-label">
            {active.length === 0
              ? `all ${stats.length} courses`
              : `${active.length} course${active.length === 1 ? "" : "s"}${
                  narrowed > 0 ? ` · ${narrowed} unit${narrowed === 1 ? "" : "s"}` : ""
                }`}
          </span>
        </button>

        {(auto || !open) && totalDue > 0 && (
          <span className={`hud-label ${auto ? "lg:hidden" : ""}`}>
            <span className="tabular-nums text-signal">{totalDue}</span> waiting
          </span>
        )}

        {active.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="hud-label px-1 transition hover:text-paper"
          >
            clear
          </button>
        )}
      </div>

      {(auto || open) && (
        <div className={`border-t border-signal/15 px-2 pb-2 pt-2 ${auto ? "hidden lg:block" : ""}`}>
          {/* Column heads for the eye; each row's aria-label says the same in words. */}
          <div aria-hidden className="hud-label flex items-center gap-3 px-2.5 pb-1">
            <span className="flex-1">Course and maturity</span>
            <span className="w-20 text-right">Due / new</span>
            <span className="w-12 text-right">Cards</span>
          </div>

          {stats.map((d) => {
            const sel = courseSelection(filter, d.course);
            const on = sel !== "off";
            const showUnits = expanded.includes(d.course);
            const { counts } = d;
            const learned = counts.total > 0 ? (100 * counts.mature) / counts.total : 0;
            return (
              <div key={d.course}>
                {/* Two controls, never nested: the row picks the course, the chevron opens its
                    units. A button inside a button is invalid HTML and breaks keyboard use. */}
                <div
                  className={`flex items-center rounded-md border transition ${
                    on
                      ? "border-signal/50 bg-signal/[0.08]"
                      : "border-transparent hover:border-line hover:bg-panel2/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onToggleCourse(d.course)}
                    aria-pressed={sel === "some" ? "mixed" : on}
                    aria-label={`${d.label}${sel === "some" ? ", some units" : ""}: ${countsLabel(counts)}`}
                    title={`${d.label} — ${counts.mature}/${counts.total} mature (21+ day interval)`}
                    className="flex min-w-0 flex-1 items-center gap-3 px-2.5 py-2 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={`flex items-center gap-1.5 font-sans text-sm ${
                          on ? "text-paper" : "text-paperdim"
                        }`}
                      >
                        <span translate="no" className="truncate">{d.label}</span>
                        {sel === "some" && (
                          <span className="shrink-0 text-[13px] text-signal/80">some units</span>
                        )}
                      </span>
                      <span
                        aria-hidden
                        className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-linestrong/40"
                      >
                        <span
                          className="block h-full origin-left bg-iris transition-transform duration-300"
                          style={{ transform: `scaleX(${learned / 100})` }}
                        />
                      </span>
                    </span>

                    <span className="hud-figure w-20 shrink-0 text-right text-sm">
                      <span
                        className={counts.due + counts.learning > 0 ? "text-signal" : "text-mist"}
                      >
                        {counts.due + counts.learning}
                      </span>
                      <span className="text-mist"> / </span>
                      <span className={counts.fresh > 0 ? "text-paperdim" : "text-mist"}>
                        {counts.fresh}
                      </span>
                    </span>

                    <span className="hud-label w-12 shrink-0 text-right tabular-nums">
                      {counts.total}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleExpanded(d.course)}
                    aria-expanded={showUnits}
                    aria-label={`${showUnits ? "Hide" : "Show"} the ${d.units.length} units of ${d.label}`}
                    title={`${d.units.length} lectures / labs / tutorials`}
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
                      const c = u.counts;
                      return (
                        <button
                          key={u.unit}
                          type="button"
                          onClick={() => onToggleUnit(d.course, u.unit)}
                          aria-pressed={unitOn}
                          aria-label={`${u.label}: ${countsLabel(c)}`}
                          title={`${d.label} · ${u.label} — ${c.mature}/${c.total} mature`}
                          className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition ${
                            unitOn ? "bg-signal/[0.06]" : "hover:bg-panel2/40"
                          }`}
                        >
                          <span
                            aria-hidden
                            className={`shrink-0 text-[13px] ${
                              unitOn ? "text-signal" : "text-mist"
                            }`}
                          >
                            {unitOn ? "◆" : "◇"}
                          </span>
                          <span
                            className={`min-w-0 flex-1 truncate font-sans text-sm ${
                              unitOn ? "text-paper" : "text-paperdim"
                            }`}
                          >
                            {u.label}
                          </span>
                          <span className="hud-figure w-20 shrink-0 text-right text-sm">
                            <span className={c.due + c.learning > 0 ? "text-signal" : "text-mist"}>
                              {c.due + c.learning}
                            </span>
                            <span className="text-mist"> / </span>
                            <span className={c.fresh > 0 ? "text-paperdim" : "text-mist"}>
                              {c.fresh}
                            </span>
                          </span>
                          <span className="hud-label w-12 shrink-0 text-right tabular-nums">
                            {c.total}
                          </span>
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

/** A row's figures in words, for its aria-label: the column heads are for the eye only. */
function countsLabel(c: Counts) {
  return `${c.due + c.learning} due, ${c.fresh} new, ${c.mature} of ${c.total} cards mature`;
}
