import type { Metadata } from "next";
import Link from "next/link";
import ModeSwitch, { HomeLink } from "@/components/ModeSwitch";
import StyleToggle from "@/components/StyleToggle";
import { notes, notesByCourse } from "@/lib/notes";

export const metadata: Metadata = {
  title: "DSAI Revision Notes",
  description: "One revision page per lecture for the MSc in Data Science and Artificial Intelligence.",
};

// Read at build time; only titles reach the browser from this page, never the notes themselves.
const courses = notesByCourse();

export default function Page() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <HomeLink />
        <div className="flex items-center gap-2">
          <div className="seg">
            <ModeSwitch source="dsai" />
          </div>
          <StyleToggle />
        </div>
      </div>

      <header className="mb-10 mt-8 sm:mb-12 sm:mt-12">
        <h1 className="neon-title text-balance font-display text-5xl font-bold leading-[0.95] tracking-tight sm:text-7xl">
          Revision Notes
        </h1>
        <p className="mt-4 max-w-2xl font-sans text-lg leading-relaxed text-paperdim">
          {notes.length} lectures, one page each: the concepts explained in Traditional Chinese with the
          English terms kept, worked examples, a self-test and a one-page cheat sheet.
        </p>
        <p className="mt-3 max-w-2xl font-sans text-base leading-relaxed text-mist">
          Exam markers are inferred from what the slides stress, repeat and work through — they are not
          the lecturer&rsquo;s announced scope.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        {courses.map((c) => (
          <section key={c.course} className="holo-card animate-cell-in rounded-lg p-6 sm:p-7">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              {/* The code takes the unit column's width, so the course title lines up with the lecture titles. */}
              <h2 className="flex items-baseline gap-3 font-display text-xl font-semibold tracking-tight text-paper">
                <span translate="no" className="w-[6.5rem] shrink-0 whitespace-nowrap text-signal">{c.course}</span>
                <span className="min-w-0">{c.title}</span>
              </h2>
            </div>
            <ol lang="zh-Hant" className="mt-4 flex flex-col">
              {c.notes.map((n) => (
                <li key={n.slug}>
                  <Link
                    href={`/dsai/notes/${n.slug}`}
                    className="-mx-2 flex items-baseline gap-3 rounded-[4px] px-2 py-2 transition hover:bg-signal/5"
                  >
                    <span lang="en" className="hud-label w-[6.5rem] shrink-0 tabular-nums">{n.unitLabel}</span>
                    <span className="min-w-0 flex-1 text-[15px] leading-snug text-paperdim">{n.title}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </main>
  );
}
