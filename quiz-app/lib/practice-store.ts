/**
 * Reads the PMLE quiz's saved state (localStorage `pmle-practice-v3`). Pure, so the migration
 * rules are testable (lib/practice-store.test.ts) without a browser.
 */
export type Answers = Record<number, string[]>; // questionId -> selected labels

export type Persisted = {
  orderMode?: "sequential" | "shuffle";
  order: number[]; // indices into `questions` — the FULL bank, before domain filtering
  pos: number;
  answers: Answers;
  shuffleOpts?: boolean; // shuffle answer options within each question
  optSeed?: number; // seed for the option permutation
  domains?: number[]; // exam-guide sections to drill; empty = all of them
};

/**
 * Stored state can predate the current bank. Answers are keyed by question id, so they always
 * survive; an order that no longer fits the bank (a question added, tampered indices) is dropped
 * by clearing `orderMode`, which makes the caller deal a fresh shuffle and start at 0.
 */
export function parsePractice(raw: string, bankSize: number, isDomain: (d: number) => boolean): Persisted | null {
  try {
    const p = JSON.parse(raw) as Persisted;
    if (!p || typeof p !== "object") return null;
    const order = Array.isArray(p.order) ? p.order : [];
    const fits =
      order.length === bankSize &&
      new Set(order).size === bankSize &&
      order.every((i) => Number.isInteger(i) && i >= 0 && i < bankSize);
    if (!fits) {
      delete p.orderMode;
      p.order = [];
    }
    p.pos = Number.isInteger(p.pos) && p.pos >= 0 ? p.pos : 0;

    const answers: Answers = {};
    if (p.answers && typeof p.answers === "object") {
      // normalize any stray non-array values rather than trusting stored shape
      for (const [k, v] of Object.entries(p.answers))
        if (Array.isArray(v) && v.every((x) => typeof x === "string")) answers[Number(k)] = v;
    }
    p.answers = answers;

    // a stored filter naming a section that does not exist would hide questions forever
    p.domains = Array.isArray(p.domains) ? p.domains.filter(isDomain) : [];
    return p;
  } catch {
    return null;
  }
}
