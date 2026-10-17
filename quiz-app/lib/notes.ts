/**
 * The DSAI revision notes: one page per lecture, built from DSAI/revision-notes/*.html by
 * `npm run notes` (scripts/build-notes.mjs).
 *
 * Server-only in practice — every page is prerendered, and the bank is ~800 KB of HTML, so no
 * client component may import this. Client code gets a page's slug and headings as props.
 */
import notesRaw from "@/data/notes.json";

export type Heading = { id: string; text: string };

export type Note = {
  slug: string; // "COM6004-ch5": the file name, the route and the "reviewed" key
  course: string; // "COM6004"
  courseTitle: string; // "Data Mining", from the page's own breadcrumb
  unitLabel: string; // "Chapter 5"
  title: string;
  meta: string; // the source line: slide deck, slide count, topics
  headings: Heading[];
  html: string; // math still as $$…$$ / \(…\) source; see lib/notes-math.ts
};

// Already in course and lecture order: the builder sorts file names naturally.
export const notes: Note[] = notesRaw;

export function findNote(slug: string): Note | undefined {
  return notes.find((n) => n.slug === slug);
}

export type NoteCourse = { course: string; title: string; notes: Note[] };

export function notesByCourse(): NoteCourse[] {
  const map = new Map<string, NoteCourse>();
  for (const n of notes) {
    const c = map.get(n.course) ?? { course: n.course, title: n.courseTitle, notes: [] };
    c.notes.push(n);
    map.set(n.course, c);
  }
  return [...map.values()];
}

/** Previous and next page within the same course; undefined at either end. */
export function neighbours(slug: string): { prev?: Note; next?: Note } {
  const i = notes.findIndex((n) => n.slug === slug);
  if (i === -1) return {};
  const same = (n?: Note) => (n && n.course === notes[i].course ? n : undefined);
  return { prev: same(notes[i - 1]), next: same(notes[i + 1]) };
}
