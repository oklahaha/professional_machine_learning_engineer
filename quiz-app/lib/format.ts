export type StemSegment = {
  kind: "text" | "code";
  content: string;
};

/**
 * A few stems ("...train a DNN regression model with Keras APIs using this code:") only make
 * sense with the source PDF's code listing, which the extractor could not carry across. Those
 * listings are restored by hand into the stem inside ``` fences, so whitespace — the one thing
 * `whitespace-pre-line` prose cannot preserve — survives into the UI as a real code block.
 *
 * Splits the stem into prose and code runs, in order. A stem with no fence yields a single text
 * segment, which is exactly how it rendered before. An unterminated fence matches nothing and is
 * likewise rendered verbatim rather than swallowing the rest of the question.
 */
export function splitCodeBlocks(text: string): StemSegment[] {
  const segments: StemSegment[] = [];
  const fence = /```[^\n]*\n([\s\S]*?)```/g; // opening fence may carry a language tag
  let cut = 0;

  for (let m = fence.exec(text); m; m = fence.exec(text)) {
    const prose = text.slice(cut, m.index).trim();
    if (prose) segments.push({ kind: "text", content: prose });

    const code = m[1].replace(/\s+$/, "");
    if (code) segments.push({ kind: "code", content: code });

    cut = fence.lastIndex;
  }

  const tail = text.slice(cut).trim();
  if (tail) segments.push({ kind: "text", content: tail });
  return segments;
}

export type NumberedText = {
  lead: string; // prose before the first step ("For each model:"); usually ""
  steps: string[]; // step bodies, without their "1." markers
};

const MAX_STEPS = 20;

/**
 * Locate the marker for step `n` at or after `from`.
 *
 * The hard part is telling a marker apart from a number that merely occurs in prose:
 * the dump writes markers both with and without the dot ("2. Deploy", "2 Schedule"),
 * so a bare digit is not enough to go on. A candidate only counts when it carries a
 * "." / ")" separator, or the word after it is not lowercase — which keeps counts like
 * "a cluster with 2 n1-highcpu-64 machines" from being read as the start of step 2.
 *
 * `mustOpen` additionally requires the marker to open the text or follow a colon; it
 * is what stops a stray "1" mid-sentence from being mistaken for the head of a list.
 */
function findMarker(s: string, n: number, from: number, mustOpen: boolean) {
  const re = new RegExp(`(^|[\\s:])${n}([.)]?)\\s+(?=(\\S))`, "g");
  re.lastIndex = from;

  for (let m = re.exec(s); m; m = re.exec(s)) {
    const [, before, separator, nextChar] = m;
    const at = m.index + before.length; // index of the digit itself

    if (!separator && /[a-z]/.test(nextChar)) continue; // prose, not a marker
    if (mustOpen) {
      const preceding = s.slice(0, at).trimEnd();
      if (preceding !== "" && !preceding.endsWith(":")) continue;
    }
    return { at, body: m.index + m[0].length };
  }
  return null;
}

/** Does any marker numbered `minN` or above still appear in `s`? */
function hasMarkerFrom(s: string, minN: number) {
  const re = new RegExp(`(^|[\\s:])(\\d{1,2})([.)]?)\\s+(?=(\\S))`, "g");

  for (let m = re.exec(s); m; m = re.exec(s)) {
    const [, , digits, separator, nextChar] = m;
    if (!separator && /[a-z]/.test(nextChar)) continue; // prose, not a marker
    if (Number(digits) >= minN) return true;
  }
  return false;
}

/**
 * The source PDF draws multi-step options on one line ("1. Do X 2. Do Y"), so the
 * enumeration survives extraction only as inline text. Recover the step boundaries
 * so they can render one per line.
 *
 * Returns null whenever the text is not an unambiguous enumeration — the caller then
 * renders it verbatim, which is always acceptable. Bailing out is the safe direction:
 * a wrong split silently corrupts an exam option, while a missed split merely leaves
 * it as it reads in the source.
 */
export function parseNumberedSteps(text: string): NumberedText | null {
  const s = (text ?? "").trim();
  if (!s) return null;

  const marks: { at: number; body: number }[] = [];
  for (let n = 1; n <= MAX_STEPS; n += 1) {
    const mark = findMarker(s, n, marks.at(-1)?.body ?? 0, n === 1);
    if (!mark) break;
    marks.push(mark);
  }

  if (marks.length < 2) return null;

  const steps = marks.map((mark, i) =>
    s.slice(mark.body, i + 1 < marks.length ? marks[i + 1].at : s.length).trim(),
  );

  // If a later marker is still sitting inside the final step, we failed to place it —
  // the source skipped or mangled a digit, or the list runs past MAX_STEPS. Left alone
  // it would be silently glued onto the previous step, so render the option verbatim.
  if (hasMarkerFrom(steps[steps.length - 1], marks.length + 1)) return null;

  return { lead: s.slice(0, marks[0].at).trim(), steps };
}

/**
 * `reference` holds the official cloud.google.com doc links for a question as one
 * space-separated string (the 375題 dump prints up to three per question).
 *
 * These strings end up in an `<a href>`, and React does not sanitise href — a
 * `javascript:` value would execute on click. The bank is PDF-derived and CLAUDE.md
 * makes hand-editing `data/questions.json` the supported way to fix a question, so a
 * bad scheme can arrive through an entirely normal workflow. Anything that is not an
 * absolute http(s) URL is therefore dropped rather than rendered. Duplicates are
 * collapsed so the rendered list can safely key on the URL itself.
 */
export function parseReferences(raw: string | undefined): string[] {
  if (!raw) return [];

  const urls: string[] = [];
  for (const token of raw.split(/\s+/)) {
    if (!token || urls.includes(token)) continue;
    let parsed: URL;
    try {
      parsed = new URL(token);
    } catch {
      continue; // not absolute, or not a URL at all
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") continue;
    urls.push(token);
  }
  return urls;
}
