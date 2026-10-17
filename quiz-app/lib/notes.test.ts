import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import katex from "katex";
import { decodeEntities, formulas, renderMath } from "./notes-math.ts";
import { parseNotesState, toggleDone, EMPTY } from "./notes-store.ts";

const fake = (tex: string, display: boolean) => (display ? `[D:${tex}]` : `[I:${tex}]`);

test("display and inline delimiters are typeset; a lone dollar is prose", () => {
  assert.equal(
    renderMath("<p>Costs $5. \\( df = n-1 \\) and $$ x^2 $$</p>", fake),
    "<p>Costs $5. [I:df = n-1] and [D:x^2]</p>",
  );
});

test("code and pre are left verbatim", () => {
  const html = "<pre><code>re.sub(r'\\(x\\)', s)</code></pre><p><code>$$</code> \\(a\\)</p>";
  assert.equal(renderMath(html, fake), "<pre><code>re.sub(r'\\(x\\)', s)</code></pre><p><code>$$</code> [I:a]</p>");
});

test("entities are decoded before KaTeX sees them", () => {
  assert.equal(renderMath("\\( p &lt; 0.05 \\&amp; q \\)", fake), "[I:p < 0.05 \\& q]");
  assert.equal(decodeEntities("&#x3b1;&#946;&nbsp;"), "αβ ");
});

test("a formula that spans a tag is not guessed at", () => {
  const html = "\\( a <b>b</b> \\)";
  assert.equal(renderMath(html, fake), html);
});

test("every formula in the bank typesets without a KaTeX error", () => {
  const notes: { slug: string; html: string }[] = JSON.parse(
    readFileSync(new URL("../data/notes.json", import.meta.url), "utf8"),
  );
  let count = 0;
  for (const n of notes)
    for (const f of formulas(n.html)) {
      count++;
      assert.doesNotThrow(
        () => katex.renderToString(f.tex, { displayMode: f.display, throwOnError: true }),
        `${n.slug}: ${f.tex}`,
      );
    }
  assert.ok(count > 500, `expected the bank's formulas, found ${count}`);
});

test("stored state is coerced, never trusted", () => {
  assert.deepEqual(parseNotesState(null), EMPTY);
  assert.deepEqual(parseNotesState("{oops"), EMPTY);
  assert.deepEqual(parseNotesState('{"done":["a",1,"a"],"examOnly":"yes"}'), {
    version: 1,
    done: ["a"],
    examOnly: false,
  });
});

test("toggleDone adds and removes", () => {
  const on = toggleDone(EMPTY, "COM6001-w1");
  assert.deepEqual(on.done, ["COM6001-w1"]);
  assert.deepEqual(toggleDone(on, "COM6001-w1").done, []);
});
