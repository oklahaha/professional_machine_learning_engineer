"use client";

import { useEffect, useState } from "react";
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
 * Collapsed on a phone (six rows would push the question below the fold), open in the desktop
 * rail; collapsed, the summary line still surfaces the weakest section.
 */
export default function DomainPanel({ stats, selected, onToggle, onClear }: Props) {
  // Open where the desktop rail has room for it, shut on a phone. Until you toggle it, CSS makes
  // that call (`auto` below), so the server render is already laid out right and nothing moves
  // when the page hydrates; opening it from an effect pushed the rest of the rail down.
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const [wide, setWide] = useState(false); // only for aria-expanded, which moves nothing
  useEffect(() => setWide(window.matchMedia("(min-width: 1024px)").matches), []);
  const open = userOpen ?? wide;
  const auto = userOpen === null;

  // "weakest" is only meaningful once a section has enough answers to not be noise.
  const weakest = stats
    .filter((d) => d.accuracy !== null && d.answered >= 3)
    .sort((a, b) => a.accuracy! - b.accuracy!)[0];

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
          <span>Exam sections</span>
          <span className="hud-label">
            {selected.length === 0 ? `all ${DOMAINS.length}` : `${selected.length} selected`}
          </span>
        </button>

        {weakest && (auto || !open) && (
          <span className={`hud-label ${auto ? "lg:hidden" : ""}`}>
            Weakest §{weakest.id}{" "}
            <span className={`tabular-nums ${scoreTone(weakest.accuracy)}`}>
              {weakest.accuracy}%
            </span>
          </span>
        )}

        {selected.length > 0 && (
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
            <span className="flex-1">Section and your accuracy</span>
            <span>Seen</span>
            <span className="w-12 text-right">Exam</span>
          </div>

          {stats.map((d) => {
            const on = selected.includes(d.id);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onToggle(d.id)}
                aria-pressed={on}
                aria-label={`§${d.id} ${d.name}: ${
                  d.accuracy !== null ? `${d.accuracy}% correct, ` : ""
                }${d.answered} of ${d.total} answered, about ${d.weight}% of the exam`}
                title={`${d.title} — ${d.blurb}`}
                className={`flex w-full items-center gap-3 rounded-md border px-2.5 py-2 text-left transition ${
                  on
                    ? "border-signal/50 bg-signal/[0.08]"
                    : "border-transparent hover:border-line hover:bg-panel2/40"
                }`}
              >
                <span
                  className={`w-7 shrink-0 font-display text-sm font-semibold tabular-nums ${
                    on ? "text-signal" : "text-mist"
                  }`}
                >
                  §{d.id}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate font-sans text-sm ${
                      on ? "text-paper" : "text-paperdim"
                    }`}
                  >
                    {d.name}
                  </span>
                  <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-linestrong/40">
                    <span
                      className={`block h-full origin-left transition-transform duration-300 ${barTone(d.accuracy)}`}
                      style={{ transform: `scaleX(${(d.accuracy ?? 0) / 100})` }}
                    />
                  </span>
                </span>

                {/* No placeholder dash before the first answer: the count alone says "not started". */}
                <span className="shrink-0 text-right">
                  {d.accuracy !== null && (
                    <span className={`hud-figure block text-sm ${scoreTone(d.accuracy)}`}>
                      {d.accuracy}%
                    </span>
                  )}
                  <span className="hud-label block tabular-nums">
                    {d.answered}/{d.total}
                  </span>
                </span>

                <span
                  title={`This section is ~${d.weight}% of the real exam`}
                  className="hud-label w-12 shrink-0 text-right tabular-nums"
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
