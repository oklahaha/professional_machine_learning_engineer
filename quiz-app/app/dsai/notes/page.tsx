import type { Metadata } from "next";
import Link from "next/link";
import ModeSwitch from "@/components/ModeSwitch";
import StyleToggle from "@/components/StyleToggle";
import { NotesCourseProgress, NotesDoneMark } from "@/components/NotesReader";
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
      <div className="flex items-center justify-between gap-4">
        <Link href="/dsai" className="hud-label inline-flex items-center gap-1.5 transition hover:text-paper">
          <span aria-hidden>←</span> Data Science &amp; AI
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="seg">
            <ModeSwitch source="dsai" />
          </div>
          <StyleToggle />
        </div>
      </div>

      <header className="mb-10 mt-8 sm:mb-12 sm:mt-12">
        <h1 className="neon-title text-balance font-display text-5xl font-bold leading-[0.95] tracking-tight sm:text-7xl">
          Revision notes
        </h1>
        <p className="mt-4 max-w-2xl font-sans text-lg leading-relaxed text-paperdim">
          {notes.length} lectures, one page each: the concepts explained in Traditional Chinese with the
          English terms kept, worked examples, a self-test and a one-page cheat sheet.
        </p>
        <p className="mt-3 max-w-2xl font-sans text-base leading-relaxed text-mist">
          Exam markers are inferred from what the slides stress, repeat and work through — they are not
          the lecturer&rsquo;s announced scope. <span className="text-paperdim">Exam only</span> on each
          page hides everything else.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        {courses.map((c) => (
          <section key={c.course} className="holo-card animate-cell-in rounded-lg p-6 sm:p-7">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="font-display text-xl font-semibold tracking-tight text-paper">
                <span translate="no" className="text-signal">{c.course}</span> {c.title}
              </h2>
              <NotesCourseProgress slugs={c.notes.map((n) => n.slug)} />
            </div>
            <ol lang="zh-Hant" className="mt-4 flex flex-col">
              {c.notes.map((n) => (
                <li key={n.slug}>
                  <Link
                    href={`/dsai/notes/${n.slug}`}
                    className="-mx-2 flex items-baseline gap-3 rounded-[4px] px-2 py-2 transition hover:bg-signal/5"
                  >
                    <span lang="en" className="hud-label w-[5.5rem] shrink-0 tabular-nums">{n.unitLabel}</span>
                    <span className="min-w-0 flex-1 text-[15px] leading-snug text-paperdim">{n.title}</span>
                    <NotesDoneMark slug={n.slug} />
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
