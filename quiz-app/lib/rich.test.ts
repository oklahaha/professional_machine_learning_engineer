import { test } from "node:test";
import assert from "node:assert/strict";
import { splitInline } from "./rich.ts";

test("plain text is one run", () => {
  assert.deepEqual(splitInline("no markup here"), [{ kind: "text", content: "no markup here" }]);
});

test("backticks and dollars split into code and math runs", () => {
  assert.deepEqual(splitInline("Use `df.loc` when $n > 3$."), [
    { kind: "text", content: "Use " },
    { kind: "code", content: "df.loc" },
    { kind: "text", content: " when " },
    { kind: "math", content: "n > 3" },
    { kind: "text", content: "." },
  ]);
});

test("a dollar inside code stays code", () => {
  assert.deepEqual(splitInline("`echo $HOME`"), [{ kind: "code", content: "echo $HOME" }]);
});

test("an unclosed delimiter is literal text", () => {
  assert.deepEqual(splitInline("costs $5 today"), [{ kind: "text", content: "costs $5 today" }]);
  assert.deepEqual(splitInline("a ` stray"), [{ kind: "text", content: "a ` stray" }]);
});

test("an escaped dollar is a literal dollar", () => {
  assert.deepEqual(splitInline("\\$5 and \\$6"), [{ kind: "text", content: "$5 and $6" }]);
});
