import assert from "node:assert/strict";
import { test } from "node:test";

import questions from "../data/questions.json" with { type: "json" };
import { parseNumberedSteps, parseReferences, splitCodeBlocks } from "./format.ts";

test("splits a numbered procedure onto one step per line", () => {
  const r = parseNumberedSteps(
    "1. Create a Vertex Al managed dataset 2. Use a Vertex Ai training pipeline to train your model 3. Generate batch predictions in Vertex Al",
  );
  assert.deepEqual(r?.steps, [
    "Create a Vertex Al managed dataset",
    "Use a Vertex Ai training pipeline to train your model",
    "Generate batch predictions in Vertex Al",
  ]);
});

test("accepts the dump's dotless markers ('2 Schedule')", () => {
  const r = parseNumberedSteps(
    "1. Enable request-response logging on Vertex Al Endpoints. 2 Schedule a TensorFlow Data Validation job 3. Execute model retraining",
  );
  assert.equal(r?.steps.length, 3);
  assert.equal(r?.steps[1], "Schedule a TensorFlow Data Validation job");
});

test("keeps prose before the first step as the lead", () => {
  const r = parseNumberedSteps("For each model: 1. Train it. 2. Deploy it.");
  assert.equal(r?.lead, "For each model:");
  assert.deepEqual(r?.steps, ["Train it.", "Deploy it."]);
});

// The regression that motivated the marker-acceptance rule: a quantity inside a step
// ("2 instances", "2 n1-highcpu-64 machines") must not be mistaken for the next marker.
test("does not split on a quantity inside a step", () => {
  const r = parseNumberedSteps(
    "1. Create a cluster with 2 n1-highcpu-64 machines. 2. Deploy the model to it.",
  );
  assert.deepEqual(r?.steps, [
    "Create a cluster with 2 n1-highcpu-64 machines.",
    "Deploy the model to it.",
  ]);
});

test("does not split on a version number inside a step", () => {
  const r = parseNumberedSteps("1. Install Python 3. 2. Train the model. 3. Deploy it.");
  assert.deepEqual(r?.steps, ["Install Python 3.", "Train the model.", "Deploy it."]);
});

// A dropped digit must not silently glue the tail onto the previous step. Verbatim is
// the safe fallback: a missed split is cosmetic, a wrong split corrupts the option.
test("bails out when the source skips a number", () => {
  assert.equal(
    parseNumberedSteps("1. Create the dataset. 2. Train the model. 4. Deploy the model."),
    null,
  );
});

test("bails out on a list longer than the supported step count", () => {
  const long = Array.from({ length: 25 }, (_, i) => `${i + 1}. step`).join(" ");
  assert.equal(parseNumberedSteps(long), null);
});

test("leaves non-lists verbatim", () => {
  assert.equal(parseNumberedSteps("2 GPUs are needed. Use an n1-standard-8 machine."), null);
  assert.equal(parseNumberedSteps("1. Just the one step."), null); // needs a "2" to be a list
  assert.equal(parseNumberedSteps("You want to minimize training cost. What should you do?"), null);
  assert.equal(parseNumberedSteps(""), null);
});

// Explanations are riddled with footnote digits glued to words ("...actual positives1.").
// Splitting on those would mangle 60 explanations, so they must never parse as lists.
test("ignores footnote digits in explanation prose", () => {
  assert.equal(
    parseNumberedSteps(
      "Option A is correct because using F-score where recall is weighed more than precision is a suitable metric1. When the data is imbalanced, the positive class is the minority class2.",
    ),
    null,
  );
});

test("every parsed option in the question bank splits cleanly", () => {
  let parsed = 0;

  for (const q of questions) {
    for (const opt of q.options) {
      const r = parseNumberedSteps(opt.text);
      if (!r) continue;
      parsed += 1;

      for (const [i, step] of r.steps.entries()) {
        const where = `Q${q.id}${opt.label} step ${i + 1}`;
        assert.ok(step.length > 0, `${where}: empty step`);
        // A step opening mid-sentence is the signature of a bad split.
        assert.ok(!/^[a-z]/.test(step), `${where}: starts lowercase — "${step.slice(0, 50)}"`);
      }
    }
  }

  // Guards against a parser change that quietly stops recognising the real lists.
  assert.equal(parsed, 107, "expected 107 numbered options in the bank");
});

test("splits a fenced listing out of the stem, keeping its indentation", () => {
  const segments = splitCodeBlocks(
    "Using this code:\n\n```python\nmodel.add(Dense(\n    256))\n```\n\nHow many weights?",
  );
  assert.deepEqual(segments, [
    { kind: "text", content: "Using this code:" },
    { kind: "code", content: "model.add(Dense(\n    256))" },
    { kind: "text", content: "How many weights?" },
  ]);
});

test("a stem without a fence is one text segment", () => {
  const segments = splitCodeBlocks("You want to minimize training cost. What should you do?");
  assert.deepEqual(segments, [
    { kind: "text", content: "You want to minimize training cost. What should you do?" },
  ]);
});

// Verbatim is the safe fallback, as it is for the numbered-step parser: a stray fence must not
// swallow the rest of the question.
test("leaves an unterminated fence in the prose", () => {
  const segments = splitCodeBlocks("Given ```python\nmodel.fit()\nwhat happens?");
  assert.equal(segments.length, 1);
  assert.equal(segments[0].kind, "text");
});

test("every fenced stem in the question bank yields a code segment", () => {
  const fenced = questions.filter((q) => q.question.includes("```"));

  for (const q of fenced) {
    const segments = splitCodeBlocks(q.question);
    assert.ok(
      segments.some((s) => s.kind === "code"),
      `Q${q.id}: fence in the stem did not parse as a code block`,
    );
    // The fence markers themselves must never reach the UI.
    for (const seg of segments) assert.ok(!seg.content.includes("```"), `Q${q.id}: leaked fence`);
  }

  assert.equal(fenced.length, 1, "expected 1 stem with a code listing in the bank");
});

test("splits reference URLs and collapses duplicates", () => {
  assert.deepEqual(
    parseReferences("https://cloud.google.com/a https://cloud.google.com/b"),
    ["https://cloud.google.com/a", "https://cloud.google.com/b"],
  );
  // the rendered list keys on the URL, so a repeat must not survive
  assert.deepEqual(parseReferences("https://x.dev/a https://x.dev/a"), ["https://x.dev/a"]);
  assert.deepEqual(parseReferences(undefined), []);
  assert.deepEqual(parseReferences("   "), []);
});

test("drops any reference that is not an absolute http(s) URL", () => {
  // React does not sanitise href — a javascript: value would execute on click.
  assert.deepEqual(parseReferences("javascript:alert(1)"), []);
  assert.deepEqual(parseReferences("data:text/html;base64,PHNjcmlwdD4="), []);
  assert.deepEqual(parseReferences("/docs/relative"), []);
  assert.deepEqual(parseReferences("cloud.google.com/no-scheme"), []);
  // a bad entry must not take the good ones down with it
  assert.deepEqual(parseReferences("javascript:alert(1) https://cloud.google.com/ok"), [
    "https://cloud.google.com/ok",
  ]);
});

test("every reference in the question bank is a safe absolute URL", () => {
  let withRefs = 0;
  let urls = 0;

  for (const q of questions) {
    if (!q.reference) continue;
    withRefs += 1;

    const parsed = parseReferences(q.reference);
    const raw = q.reference.split(/\s+/).filter(Boolean);
    // Nothing may be silently dropped: a reference that fails to parse is a data bug,
    // and validate-questions.mjs hard-fails on it.
    assert.equal(parsed.length, raw.length, `Q${q.id}: unsafe or duplicate reference`);
    urls += parsed.length;
  }

  // Guards against a data edit that quietly drops the doc links.
  assert.equal(withRefs, 10, "expected 10 questions carrying reference URLs");
  assert.equal(urls, 23, "expected 23 reference URLs in the bank");
});
