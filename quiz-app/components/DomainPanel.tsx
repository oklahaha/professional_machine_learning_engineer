"use client";

import { useState } from "react";
import { DOMAINS, PASS_MARK, type Domain } from "@/lib/domains";

export type DomainStat = Domain & {
  total: number;
  answered: number;
  correct: number;
  accuracy: number | null; // null until you have answered one question in the section
};

type Props = {
  stats: DomainStat[];
  selected: number[]; // empty = every section
  onToggle: (id: number) => void;
  onClear: () => void;
};

// Sections are not colour-coded — colour means score, and only score. See lib/domains.ts.
const scoreTone = (accuracy: number | null) =>
  accuracy === null ? "text-mist" : accuracy >= PASS_MARK ? "text-correct" : "text-wrong";

const barTone = (accuracy: number | null) =>
  accuracy === null ? "bg-linestrong" : accuracy >= PASS_MARK ? "bg-correct" : "bg-wrong";

/**
 * The six exam-guide sections: how you score in each, and how much the real exam weights it.
 * Every row is also the filter — clicking a section narrows the run to it, so the readout that
 * tells you where you are weak is the control that lets you drill it.
 *
 * Collapsed by default (six rows would push the question below the fold on a phone); the
 * summary line still surfaces the weakest section, which is the one number worth glancing at.
 */
export default function DomainPanel({ stats, selected, onToggle, onClear }: Props) {
  const [open, setOpen] = useState(false);

  // "weakest" is only meaningful once a section has enough answers to not be noise.
  const weakest = stats
    .filter((d) => d.accuracy !== null && d.answered >= 3)
    .sort((a, b) => a.accuracy! - b.accuracy!)[0];

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
          <span>exam sections</span>
          <span className="text-mist/50">
            {selected.length === 0 ? `all ${DOMAINS.length}` : `${selected.length} selected`}
          </span>
        </button>

        {weakest && !open && (
          <span className="font-mono text-[10px] normal-case tracking-normal text-mist">
            weakest §{weakest.id}{" "}
            <span className={`tabular-nums ${scoreTone(weakest.accuracy)}`}>
              {weakest.accuracy}%
            </span>
          </span>
        )}

        {selected.length > 0 && (
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
            <span className="flex-1">section · your accuracy</span>
            <span>seen</span>
            <span className="w-10 text-right">exam</span>
          </div>

          {stats.map((d) => {
            const on = selected.includes(d.id);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onToggle(d.id)}
                aria-pressed={on}
                title={`${d.title} — ${d.blurb}`}
                className={`flex w-full items-center gap-3 rounded-md border px-2.5 py-2 text-left transition ${
                  on
                    ? "border-signal/50 bg-signal/[0.08] shadow-[inset_0_0_16px_-6px_rgba(46,230,255,0.6)]"
                    : "border-transparent hover:border-line hover:bg-panel2/40"
                }`}
              >
                <span
                  className={`w-6 shrink-0 font-mono text-[11px] font-semibold ${
                    on ? "text-signal" : "text-mist"
                  }`}
                >
                  §{d.id}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate font-mono text-[11px] ${
                      on ? "text-paper" : "text-paperdim"
                    }`}
                  >
                    {d.name}
                  </span>
                  <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-linestrong/40">
                    <span
                      className={`block h-full rounded-full transition-[width] duration-300 ${barTone(d.accuracy)}`}
                      style={{ width: `${d.accuracy ?? 0}%` }}
                    />
                  </span>
                </span>

                <span className="shrink-0 text-right font-mono">
                  <span className={`block text-xs tabular-nums ${scoreTone(d.accuracy)}`}>
                    {d.accuracy === null ? "—" : `${d.accuracy}%`}
                  </span>
                  <span className="block text-[10px] tabular-nums text-mist">
                    {d.answered}/{d.total}
                  </span>
                </span>

                <span
                  title={`This section is ~${d.weight}% of the real exam`}
                  className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-mist/70"
                >
                  ~{d.weight}%
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
