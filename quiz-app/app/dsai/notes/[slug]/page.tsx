import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import katex from "katex";
import "katex/dist/katex.min.css";
import ModeSwitch from "@/components/ModeSwitch";
import StyleToggle from "@/components/StyleToggle";
import { NotesBody, NotesDoneMark, NotesToc, NotesToggles } from "@/components/NotesReader";
import { findNote, neighbours, notes } from "@/lib/notes";
import { highlightCode } from "@/lib/notes-code";
import { renderMath } from "@/lib/notes-math";

// Every lecture is prerendered at build time; an unknown slug is a 404, not a render.
export const dynamicParams = false;

export function generateStaticParams() {
  return notes.map((n) => ({ slug: n.slug }));
}

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const note = findNote((await params).slug);
  if (!note) return {};
  return {
    title: `${note.course} ${note.unitLabel} · ${note.title}`,
    description: `DSAI revision notes — ${note.course} ${note.courseTitle}, ${note.unitLabel}: ${note.title}.`,
  };
}

// KaTeX escapes its input and `trust` stays off; a formula it cannot parse renders as red
// source text. `npm test` asserts that none of the bank's formulas does.
const tex = (src: string, displayMode: boolean) => katex.renderToString(src, { displayMode, throwOnError: false });

export default async function Page({ params }: Params) {
  const note = findNote((await params).slug);
  if (!note) notFound();

  const html = highlightCode(renderMath(note.html, tex));
  const { prev, next } = neighbours(note.slug);
  const siblings = notes.filter((n) => n.course === note.course);

  return (
    <div className="study-shell pb-6 sm:pb-12">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <Link href="/dsai/notes" className="hud-label inline-flex items-center gap-1.5 transition hover:text-paper">
          <span aria-hidden>←</span> All revision notes
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <div className="seg">
            <ModeSwitch source="dsai" />
          </div>
          <NotesToggles slug={note.slug} />
          <StyleToggle />
        </div>
      </header>

      <div className="study-grid">
        <main id="main" className="study-main">
          <article lang="zh-Hant" className="holo-card holo-solid rounded-lg px-4 py-6 sm:px-10 sm:py-10">
            <p className="hud-label">
              <span translate="no">{note.course}</span> {note.courseTitle} · {note.unitLabel}
            </p>
            <h1 className="mt-2 text-balance font-display text-3xl font-semibold leading-tight tracking-tight text-paper sm:text-4xl">
              {note.title}
            </h1>
            <p className="hud-label mt-3">{note.meta}</p>

            <NotesToc headings={note.headings} variant="inline" />

            <NotesBody>
              <div className="notes-prose mt-8" dangerouslySetInnerHTML={{ __html: html }} />
            </NotesBody>
          </article>

          <nav aria-label="Lectures" className="mt-5 grid gap-3 sm:grid-cols-2">
            <PagerLink note={prev} dir="prev" />
            <PagerLink note={next} dir="next" />
          </nav>
        </main>

        <aside className="study-rail" aria-label="Contents and lectures">
          <div className="hidden lg:block">
            <NotesToc headings={note.headings} variant="rail" />
          </div>
          <nav aria-label={`${note.course} lectures`} className="holo rounded-lg p-4">
            <h2 className="hud-label mb-2 px-2.5">
              <span translate="no">{note.course}</span> {note.courseTitle}
            </h2>
            <ol className="flex flex-col gap-0.5">
              {siblings.map((n) => (
                <li key={n.slug}>
                  <Link
                    href={`/dsai/notes/${n.slug}`}
                    aria-current={n.slug === note.slug ? "page" : undefined}
                    className="flex items-baseline gap-2 rounded-[4px] px-2.5 py-1.5 text-[14px] leading-snug text-mist transition hover:bg-signal/5 hover:text-paper aria-[current=page]:bg-signal/10 aria-[current=page]:text-signal"
                  >
                    <span className="w-[5.5rem] shrink-0 tabular-nums">{n.unitLabel}</span>
                    <span className="min-w-0 flex-1">{n.title}</span>
                    <NotesDoneMark slug={n.slug} />
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
        </aside>
      </div>
    </div>
  );
}

/** Prev/next within the course; past either end it returns to the index. */
function PagerLink({ note, dir }: { note?: { slug: string; unitLabel: string; title: string }; dir: "prev" | "next" }) {
  const align = dir === "next" ? "sm:col-start-2 sm:items-end sm:text-right" : "";
  return (
    <Link
      href={note ? `/dsai/notes/${note.slug}` : "/dsai/notes"}
      className={`holo lift flex flex-col gap-1 rounded-lg px-5 py-4 ${align}`}
    >
      <span className="hud-label">
        {dir === "prev" ? "← " : ""}
        {note ? note.unitLabel : "All revision notes"}
        {dir === "next" ? " →" : ""}
      </span>
      {note && <span lang="zh-Hant" className="font-display text-base font-medium text-paper">{note.title}</span>}
    </Link>
  );
}
