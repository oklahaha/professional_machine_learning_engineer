/**
 * What the revision notes remember per browser: which pages you have marked as reviewed, and
 * whether the Exam-only view is on. Its own key, like every other DSAI mode — the notes share
 * no state with the flashcards or the quiz.
 *
 * Read through useSyncExternalStore (components/NotesReader.tsx), so the reader's toggles and
 * the ticks on the index stay in step within a tab and across tabs (the `storage` event).
 */
export const STORAGE_KEY = "dsai-notes-v1";

export type NotesState = { version: 1; done: string[]; examOnly: boolean };

export const EMPTY: NotesState = { version: 1, done: [], examOnly: false };

/** Never throws: stored state may be hand-edited, or from a page that no longer exists. */
export function parseNotesState(raw: string | null): NotesState {
  if (!raw) return EMPTY;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object") return EMPTY;
    const done = Array.isArray(v.done) ? [...new Set(v.done.filter((d: unknown) => typeof d === "string"))] : [];
    return { version: 1, done: done as string[], examOnly: v.examOnly === true };
  } catch {
    return EMPTY;
  }
}

export function toggleDone(state: NotesState, slug: string): NotesState {
  const done = state.done.includes(slug) ? state.done.filter((d) => d !== slug) : [...state.done, slug];
  return { ...state, done };
}
