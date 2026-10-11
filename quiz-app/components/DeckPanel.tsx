"use client";

import { useState } from "react";
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
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);

  const totalDue = stats.reduce((s, d) => s + d.counts.due + d.counts.learning, 0);
  const active = stats.filter((d) => courseSelection(filter, d.course) !== "off");
  const narrowed = filter.units.length;

  const toggleExpanded = (course: string) =>
    setExpanded((e) => (e.includes(course) ? e.filter((c) => c !== course) : [...e, course]));

  return (
    <div className="mt-3 rounded-xl border border-line bg-panel/50">
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
          <span>decks</span>
          <span className="text-mist/50">
            {active.length === 0
              ? `all ${stats.length} courses`
              : `${active.length} course${active.length === 1 ? "" : "s"}${
                  narrowed > 0 ? ` · ${narrowed} unit${narrowed === 1 ? "" : "s"}` : ""
                }`}
          </span>
        </button>

        {!open && totalDue > 0 && (
          <span className="font-mono text-[10px] normal-case tracking-normal text-mist">
            <span className="tabular-nums text-signal">{totalDue}</span> waiting
          </span>
        )}

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
        <div className="border-t border-line/70 px-2 pb-2 pt-1.5">
          <div className="flex items-center gap-3 px-2.5 pb-1 font-mono text-[9px] uppercase tracking-widest text-mist/50">
            <span className="flex-1">course · learned</span>
            <span className="w-16 text-right">due / new</span>
            <span className="w-10 text-right">cards</span>
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
                  className={`flex items-center rounded-lg border transition ${
                    on
                      ? "border-signal/40 bg-signal/[0.08]"
                      : "border-transparent hover:border-line hover:bg-panel2/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onToggleCourse(d.course)}
                    aria-pressed={sel === "some" ? "mixed" : on}
                    title={`${d.label} — ${counts.mature}/${counts.total} mature (21+ day interval)`}
                    className="flex min-w-0 flex-1 items-center gap-3 px-2.5 py-2 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={`flex items-center gap-1.5 font-mono text-[11px] ${
                          on ? "text-paper" : "text-paperdim"
                        }`}
                      >
                        <span className="truncate">{d.label}</span>
                        {sel === "some" && (
                          <span className="shrink-0 text-[9px] uppercase tracking-widest text-signal/80">
                            partial
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-linestrong/40">
                        <span
                          className="block h-full rounded-full bg-iris transition-[width] duration-300"
                          style={{ width: `${learned}%` }}
                        />
                      </span>
                    </span>

                    <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums">
                      <span
                        className={counts.due + counts.learning > 0 ? "text-signal" : "text-mist/50"}
                      >
                        {counts.due + counts.learning}
                      </span>
                      <span className="text-mist/40"> / </span>
                      <span className={counts.fresh > 0 ? "text-paperdim" : "text-mist/50"}>
                        {counts.fresh}
                      </span>
                    </span>

                    <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-mist/70">
                      {counts.total}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleExpanded(d.course)}
                    aria-expanded={showUnits}
                    aria-label={`${showUnits ? "Hide" : "Show"} the ${d.units.length} units of ${d.label}`}
                    title={`${d.units.length} lectures / labs / tutorials`}
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
                      const c = u.counts;
                      return (
                        <button
                          key={u.unit}
                          type="button"
                          onClick={() => onToggleUnit(d.course, u.unit)}
                          aria-pressed={unitOn}
                          title={`${d.label} · ${u.label} — ${c.mature}/${c.total} mature`}
                          className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition ${
                            unitOn ? "bg-signal/[0.06]" : "hover:bg-panel2/40"
                          }`}
                        >
                          <span
                            aria-hidden
                            className={`shrink-0 font-mono text-[10px] ${
                              unitOn ? "text-signal" : "text-mist/40"
                            }`}
                          >
                            {unitOn ? "◆" : "◇"}
                          </span>
                          <span
                            className={`min-w-0 flex-1 truncate font-mono text-[11px] ${
                              unitOn ? "text-paperdim" : "text-mist"
                            }`}
                          >
                            {u.label}
                          </span>
                          <span className="w-16 shrink-0 text-right font-mono text-[11px] tabular-nums">
                            <span className={c.due + c.learning > 0 ? "text-signal" : "text-mist/50"}>
                              {c.due + c.learning}
                            </span>
                            <span className="text-mist/40"> / </span>
                            <span className={c.fresh > 0 ? "text-paperdim" : "text-mist/50"}>
                              {c.fresh}
                            </span>
                          </span>
                          <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-mist/70">
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
