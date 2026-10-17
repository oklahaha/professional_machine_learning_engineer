"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { EMPTY, STORAGE_KEY, parseNotesState, toggleDone, type NotesState } from "@/lib/notes-store";
import type { Heading } from "@/lib/notes";

/*
 * The interactive bits of the revision notes. The page itself (app/dsai/notes/[slug]) is a
 * server component that prerenders the lecture's HTML and math; these islands only add what
 * needs the browser: the Exam-only view, the "reviewed" tick and the scroll-tracking contents.
 * They share one store, so a toggle in the header and a tick in the rail never disagree.
 */

// The last value written, for when localStorage throws (private mode): the toggles still work
// for the visit, they just are not remembered.
let memory: string | null = null;
let cachedRaw: string | null | undefined;
let cached: NotesState = EMPTY;
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return memory;
  }
}

function snapshot(): NotesState {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parseNotesState(raw);
  }
  return cached;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function write(next: NotesState) {
  memory = JSON.stringify(next);
  try {
    window.localStorage.setItem(STORAGE_KEY, memory);
  } catch {
    /* storage unavailable — `memory` carries it */
  }
  listeners.forEach((l) => l());
}

// The server renders the defaults (nothing reviewed, full view); the stored state lands on
// hydration.
export function useNotesState(): NotesState {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

/** The reader's two switches, as a `.seg` group beside the mode switch. */
export function NotesToggles({ slug }: { slug: string }) {
  const state = useNotesState();
  const done = state.done.includes(slug);
  return (
    <div className="seg">
      <button
        type="button"
        onClick={() => write({ ...state, examOnly: !state.examOnly })}
        aria-pressed={state.examOnly}
        title="Show only the exam-marked points, headings and the overview"
        className="seg-item"
      >
        Exam only
      </button>
      <span aria-hidden className="seg-sep" />
      <button
        type="button"
        onClick={() => write(toggleDone(state, slug))}
        aria-pressed={done}
        className="seg-item"
      >
        {done ? "Reviewed ✓" : "Mark reviewed"}
      </button>
    </div>
  );
}

/**
 * Wraps the prerendered lecture. Exam-only is pure CSS (`.notes-prose` in globals.css): it hides
 * every top-level block that neither is nor contains an `.exam` marker, which is the rule the
 * original pages applied in script.
 */
export function NotesBody({ children }: { children: ReactNode }) {
  const { examOnly } = useNotesState();
  return <div data-exam-only={examOnly ? "true" : undefined}>{children}</div>;
}

/** The tick beside a lecture in the index and the rail. Renders nothing until reviewed. */
export function NotesDoneMark({ slug }: { slug: string }) {
  const { done } = useNotesState();
  if (!done.includes(slug)) return null;
  return (
    <span className="shrink-0 text-[13px] text-correct">
      <span aria-hidden>✓</span>
      <span className="sr-only">reviewed</span>
    </span>
  );
}

/** "3 of 7 reviewed" under a course heading. */
export function NotesCourseProgress({ slugs }: { slugs: string[] }) {
  const { done } = useNotesState();
  const n = slugs.filter((s) => done.includes(s)).length;
  return (
    <span className="hud-label tabular-nums">
      {n} of {slugs.length} reviewed
    </span>
  );
}

/**
 * The page's sections. On a desktop it sits in the sticky rail and follows the scroll; on a
 * phone, where the rail lands under the article, the same list is a collapsed <details> at the
 * top of the article instead (`variant="inline"`).
 */
export function NotesToc({ headings, variant }: { headings: Heading[]; variant: "rail" | "inline" }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (variant !== "rail") return;
    const els = headings.map((h) => document.getElementById(h.id)).filter((e): e is HTMLElement => !!e);
    // A heading counts as current once it crosses the top 30% of the viewport.
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "0px 0px -70% 0px" },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [headings, variant]);

  const list = (
    <ol className="flex flex-col gap-0.5">
      {headings.map((h) => (
        <li key={h.id}>
          <a
            href={`#${h.id}`}
            aria-current={active === h.id ? "location" : undefined}
            className="block rounded-[4px] px-2.5 py-1.5 text-[14px] leading-snug text-mist transition hover:bg-signal/5 hover:text-paper aria-[current=location]:bg-signal/10 aria-[current=location]:text-signal"
          >
            {h.text}
          </a>
        </li>
      ))}
    </ol>
  );

  if (variant === "inline")
    return (
      <details className="group mt-6 rounded-md bg-ink/50 px-4 py-3 lg:hidden">
        <summary className="cursor-pointer font-display text-sm font-medium text-paperdim">
          Contents · {headings.length} sections
        </summary>
        <nav aria-label="Contents" className="mt-2">
          {list}
        </nav>
      </details>
    );

  return (
    <nav aria-label="Contents" className="holo rounded-lg p-4">
      <h2 className="hud-label mb-2 px-2.5">On this page</h2>
      {list}
    </nav>
  );
}
