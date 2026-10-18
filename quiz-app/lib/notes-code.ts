/**
 * Light syntax colouring for the revision notes' code blocks (data/notes.json), done at build time
 * like renderMath, so no highlighter ships to the browser. The blocks are almost all Python; the
 * rest are call signatures and pseudo-code, which this tokenizer leaves mostly uncoloured rather
 * than guessing at. Only four token kinds, the ones the reference code windows colour:
 * comment (`tk-c`), string (`tk-s`), keyword (`tk-k`) and number (`tk-n`).
 *
 * Only `<pre><code>…</code></pre>` is touched; inline `<code>` stays plain. A block's text is
 * decoded, split into tokens and re-escaped, so the visible text is unchanged — `npm test`
 * asserts that for every block in the bank.
 */

const KEYWORDS = [
  "False", "None", "True", "and", "as", "assert", "async", "await", "break", "class", "continue",
  "def", "del", "elif", "else", "except", "finally", "for", "from", "global", "if", "import", "in",
  "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try", "while", "with", "yield",
];

// One pass, earliest match wins, so a quote inside a comment or a `#` inside a string is never
// misread. A single-quoted string must close on its own line: an apostrophe in pseudo-code
// ("don't") then stays plain text instead of colouring the rest of the block.
const TOKEN = new RegExp(
  [
    String.raw`(#[^\n]*)`,
    String.raw`((?:(?<!\w)[rRbBuUfF]{1,2})?(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"[^"\n\\]*(?:\\.[^"\n\\]*)*"|'[^'\n\\]*(?:\\.[^'\n\\]*)*'))`,
    String.raw`\b(${KEYWORDS.join("|")})\b`,
    String.raw`\b(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?j?)\b`,
  ].join("|"),
  "g",
);

const KIND = ["tk-c", "tk-s", "tk-k", "tk-n"];

// The blocks only ever escape these three (`npm test` would catch another, since its text
// would change). Kept local: an extensionless import of notes-math breaks `node --test`, and a
// `.ts` one breaks `next build`.
const unescape = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function highlightSource(src: string): string {
  let out = "";
  let last = 0;
  for (const m of src.matchAll(TOKEN)) {
    const kind = m.slice(1).findIndex((g) => g !== undefined);
    out += escape(src.slice(last, m.index)) + `<span class="${KIND[kind]}">${escape(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + escape(src.slice(last));
}

const BLOCK = /<pre><code>([\s\S]*?)<\/code><\/pre>/g;

export function highlightCode(html: string): string {
  return html.replace(BLOCK, (whole, body: string) =>
    body.includes("<") ? whole : `<pre><code>${highlightSource(unescape(body))}</code></pre>`,
  );
}
