/**
 * Typesets the math in a revision-notes page (data/notes.json) at build time, so the browser
 * receives finished KaTeX markup and no script has to walk the page after it loads.
 *
 * The pages use KaTeX auto-render's delimiters: `$$…$$` for display and `\(…\)` inline. A lone
 * `$` is prose ("$5"), never math. Like auto-render, this leaves `<pre>` and `<code>` alone and
 * only typesets a formula that is plain text — one whose source would span an HTML tag is left
 * verbatim rather than guessed at. Entities are decoded first: the pages escape `<` in a
 * formula as `&lt;`, and KaTeX must see the `<`.
 *
 * Pure, with the renderer passed in, so it can be tested without KaTeX.
 */
export type RenderTex = (tex: string, display: boolean) => string;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#")
      return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const VERBATIM = /<pre\b[\s\S]*?<\/pre>|<code\b[\s\S]*?<\/code>/gi;
const MATH = /\$\$([\s\S]+?)\$\$|\\\(([\s\S]+?)\\\)/g;

export function renderMath(html: string, render: RenderTex): string {
  let out = "";
  let last = 0;
  for (const m of html.matchAll(VERBATIM)) {
    out += typeset(html.slice(last, m.index), render) + m[0];
    last = m.index + m[0].length;
  }
  return out + typeset(html.slice(last), render);
}

function typeset(chunk: string, render: RenderTex): string {
  return chunk.replace(MATH, (whole, display: string | undefined, inline: string | undefined) => {
    const tex = display ?? inline ?? "";
    if (tex.includes("<")) return whole;
    return render(decodeEntities(tex).trim(), display !== undefined);
  });
}

/** Every formula in a page, decoded, in order — what the bank-wide KaTeX test loops over. */
export function formulas(html: string): { tex: string; display: boolean }[] {
  const found: { tex: string; display: boolean }[] = [];
  renderMath(html, (tex, display) => {
    found.push({ tex, display });
    return "";
  });
  return found;
}
