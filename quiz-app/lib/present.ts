import type { Question } from "./questions";

const LETTERS = "ABCDEFGH";

export type Presented = {
  // display-space view of the question: options relabeled A/B/C… by position,
  // answers + explanation letter-references remapped to match.
  question: Question;
  origToDisplay: Record<string, string>; // original option label -> shown label
  displayToOrig: Record<string, string>; // shown label -> original option label
};

// Deterministic Fisher–Yates keyed by (question id, seed) — stable across
// re-renders, fresh when the seed changes. No Math.random, so SSR/client agree.
function permute(n: number, key: number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  let s = (key >>> 0) || 1;
  const rand = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

// Remap only "option X" references (incl. "options A and B", "A/B", lowercase).
// Bare capital letters are left alone — in these explanations they are almost
// always the article "A" or a sentence-initial capital, not an option ref.
// Single-pass replace so A↔C swaps don't collide.
function remapExplanation(text: string, map: Record<string, string>): string {
  if (!text) return text;
  return text.replace(
    /\b(option[s]?\s+)([A-E](?:\s*(?:,|and|&|or|\/)\s*[A-E])*)/gi,
    (_m, pre: string, letters: string) =>
      pre + letters.replace(/[A-E]/g, (L) => map[L] ?? L),
  );
}

export function presentQuestion(
  q: Question,
  shuffle: boolean,
  seed: number,
): Presented {
  // Non-shuffle: return the question untouched (preserves original labels,
  // including the intentionally non-contiguous ones on flagged questions).
  if (!shuffle) {
    const identity = Object.fromEntries(q.options.map((o) => [o.label, o.label]));
    return { question: q, origToDisplay: identity, displayToOrig: identity };
  }

  const order = permute(q.options.length, (q.id * 2654435761) ^ seed);
  const origToDisplay: Record<string, string> = {};
  const displayToOrig: Record<string, string> = {};
  const options = order.map((origIdx, pos) => {
    const display = LETTERS[pos];
    const origLabel = q.options[origIdx].label;
    origToDisplay[origLabel] = display;
    displayToOrig[display] = origLabel;
    return { label: display, text: q.options[origIdx].text };
  });

  return {
    question: {
      ...q,
      options,
      answers: q.answers.map((a) => origToDisplay[a] ?? a),
      explanation: remapExplanation(q.explanation, origToDisplay),
    },
    origToDisplay,
    displayToOrig,
  };
}
