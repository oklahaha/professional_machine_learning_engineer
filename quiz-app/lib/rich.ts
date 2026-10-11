/**
 * Inline markup in the DSAI decks: `code` in backticks and $LaTeX$ between single dollars —
 * hundreds of the questions and cards use both ("$\bar{x} \pm z \frac{\sigma}{\sqrt{n}}$").
 *
 * Pure and dependency-free so it is testable on its own; components/RichText.tsx does the
 * rendering. An unclosed delimiter is kept as literal text rather than swallowing the rest of
 * the line, and "$$" is not display math here — the decks never use it.
 */
export type Run = { kind: "text" | "code" | "math"; content: string };

export function splitInline(text: string): Run[] {
  const runs: Run[] = [];
  let buf = "";
  let i = 0;
  const flush = () => {
    if (buf) runs.push({ kind: "text", content: buf });
    buf = "";
  };

  while (i < text.length) {
    const c = text[i];
    if (c === "\\" && text[i + 1] === "$") {
      buf += "$"; // an escaped dollar is a literal one
      i += 2;
      continue;
    }
    if (c === "`" || c === "$") {
      const end = text.indexOf(c, i + 1);
      const body = end === -1 ? "" : text.slice(i + 1, end);
      if (end !== -1 && body.trim()) {
        flush();
        runs.push({ kind: c === "`" ? "code" : "math", content: body });
        i = end + 1;
        continue;
      }
    }
    buf += c;
    i++;
  }
  flush();
  return runs;
}
