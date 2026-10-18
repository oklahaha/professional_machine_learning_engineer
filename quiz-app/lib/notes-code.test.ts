import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { highlightCode, highlightSource } from "./notes-code.ts";
import { decodeEntities } from "./notes-math.ts";

test("comments, strings, keywords and numbers are tagged", () => {
  assert.equal(
    highlightSource(`if x > 2: print("a # b")  # it's 3`),
    `<span class="tk-k">if</span> x &gt; <span class="tk-n">2</span>: print(<span class="tk-s">"a # b"</span>)  <span class="tk-c"># it's 3</span>`,
  );
  assert.equal(highlightSource(`f"{x}" + rb'y'`), `<span class="tk-s">f"{x}"</span> + <span class="tk-s">rb'y'</span>`);
});

test("an unclosed apostrophe and words containing keywords stay plain", () => {
  assert.equal(highlightSource("don't index x1"), "don't index x1");
});

test("only fenced blocks are touched, and their text survives", () => {
  assert.equal(highlightCode("<p><code>1</code></p>"), "<p><code>1</code></p>");
  assert.equal(highlightCode("<pre><code>a &lt; 1</code></pre>"), `<pre><code>a &lt; <span class="tk-n">1</span></code></pre>`);
});

test("every code block in the bank reads the same once highlighted", () => {
  const notes: { html: string }[] = JSON.parse(readFileSync(new URL("../data/notes.json", import.meta.url), "utf8"));
  const text = (html: string) =>
    [...html.matchAll(/<pre><code>([\s\S]*?)<\/code><\/pre>/g)].map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, "")));
  let blocks = 0;
  for (const n of notes) {
    const before = text(n.html);
    assert.deepEqual(text(highlightCode(n.html)), before);
    blocks += before.length;
  }
  assert.ok(blocks > 0);
});
