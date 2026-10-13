/**
 * Option shuffle for the DSAI quiz — a pure presentation transform, like PMLE's lib/present.ts
 * but over the DSAI shape (string ids, a per-option explanation that travels with its option).
 *
 * State and scoring stay in ORIGINAL-label space; only the view is relabeled A/B/C… by position.
 * No DSAI text refers to an option by letter (checked across all 211 questions), so unlike the
 * PMLE presenter there is nothing in the prose to remap.
 */
type Option = { label: string; text: string; explanation: string };
type Shuffleable = { id: string; options: Option[]; answers: string[] };

const LETTERS = "ABCDEFGH";

export type PresentedMcq<Q extends Shuffleable> = {
  question: Q; // display-space view: relabeled options, remapped answers
  origToDisplay: Record<string, string>;
  displayToOrig: Record<string, string>;
};

// FNV-1a over the hex id, so each question gets its own arrangement for a given seed.
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

// Deterministic Fisher–Yates: stable across re-renders, fresh when the seed changes, and no
// Math.random, so SSR and the client agree.
function permute(n: number, key: number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  let s = key >>> 0 || 1;
  const rand = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

export function presentMcq<Q extends Shuffleable>(q: Q, shuffle: boolean, seed: number): PresentedMcq<Q> {
  if (!shuffle) {
    const identity = Object.fromEntries(q.options.map((o) => [o.label, o.label]));
    return { question: q, origToDisplay: identity, displayToOrig: identity };
  }

  const order = permute(q.options.length, hashId(q.id) ^ seed);
  const origToDisplay: Record<string, string> = {};
  const displayToOrig: Record<string, string> = {};
  const options = order.map((origIdx, pos) => {
    const display = LETTERS[pos];
    const orig = q.options[origIdx];
    origToDisplay[orig.label] = display;
    displayToOrig[display] = orig.label;
    return { ...orig, label: display };
  });

  return {
    question: { ...q, options, answers: q.answers.map((a) => origToDisplay[a] ?? a) },
    origToDisplay,
    displayToOrig,
  };
}
