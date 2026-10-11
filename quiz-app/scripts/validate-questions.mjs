#!/usr/bin/env node
// Validate data/questions.json structural integrity. Run in CI / before commit.
// Hard-fails on defects in "clean" (non-needsReview) questions; only reports
// issues on questions already tagged needsReview (known source-PDF defects).
//
// Usage: node scripts/validate-questions.mjs

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DATA = resolve(dirname(fileURLToPath(import.meta.url)), "..", "data", "questions.json");
const q = JSON.parse(readFileSync(DATA, "utf8"));

const hard = []; // failures on structurally-sound questions -> non-zero exit
const soft = []; // issues on known-broken source records -> reported only

// `needsReview` means "don't trust this answer" and covers two different things: records the source
// PDFs mangled, and records whose ANSWER is doubtful but whose structure is perfectly fine. Only the
// former may skip the structural checks — routing on needsReview alone would silently exempt every
// answer-disputed question from validation.
// Every flag the extractor's computeFlags() can emit, plus `defective_source` for records the
// merge pipelines could not repair. Keep in sync with extract-questions.mjs.
const STRUCTURAL_DEFECT = new Set([
  "defective_source",
  "few_options",
  "short_stem",
  "no_answer",
  "answer_not_in_options",
  "label_gap",
  "empty_option",
]);

// Flags meaning "the structure is fine, but a human must adjudicate the ANSWER". These are the ones
// that owe the reader an explanation; a structural flag already describes itself.
const JUDGMENT = new Set(["answer_disputed", "ambiguous", "duplicate_conflict"]);

const flagsOf = (item) => (Array.isArray(item.flags) ? item.flags : []);
const isSourceDefective = (item) => flagsOf(item).some((f) => STRUCTURAL_DEFECT.has(f));
const needsExplanation = (item) => flagsOf(item).some((f) => JUDGMENT.has(f));

function issue(item, msg) {
  (isSourceDefective(item) ? soft : hard).push(`Q${item.id}: ${msg}`);
}

const ids = new Set();
for (const item of q) {
  if (ids.has(item.id)) hard.push(`duplicate id ${item.id}`);
  ids.add(item.id);

  const labels = item.options.map((o) => o.label);
  if (!Array.isArray(item.answers) || item.answers.length === 0)
    issue(item, "no answers");
  for (const a of item.answers)
    if (!labels.includes(a)) issue(item, `answer '${a}' not in options [${labels}]`);
  for (const o of item.options)
    if (!o.text || o.text.trim().length < 3) issue(item, `empty option ${o.label}`);
  const expected = labels.map((_, i) => String.fromCharCode(65 + i));
  if (labels.join("") !== expected.join(""))
    issue(item, `non-contiguous labels [${labels}]`);
  if (item.needsReview !== (Array.isArray(item.flags) && item.flags.length > 0))
    hard.push(`Q${item.id}: needsReview/flags mismatch`);
  // Every question belongs to exactly one exam-guide section. This is never exempted for
  // source-defective records: a mangled stem is still classifiable, and an unclassified
  // question would silently vanish from a domain-filtered run.
  if (!Number.isInteger(item.domain) || item.domain < 1 || item.domain > 6)
    hard.push(`Q${item.id}: domain must be an integer 1..6 (got ${JSON.stringify(item.domain)})`);
  // A question flagged for a judgment call must say what to check, or the ⚠ badge is a dead end.
  // (Structural flags describe themselves, and the extractor cannot write a reviewNote.)
  if (needsExplanation(item) && !item.reviewNote?.trim())
    hard.push(`Q${item.id}: flagged [${flagsOf(item)}] but has no reviewNote`);
  if (!item.needsReview && item.reviewNote)
    hard.push(`Q${item.id}: reviewNote on a question that is not flagged`);
  // `reference` is rendered as an <a href>, and React does not sanitise href. Never exempted
  // for source-defective records: an unsafe scheme is a scripting vector, not a text defect.
  for (const url of String(item.reference ?? "").split(/\s+/).filter(Boolean)) {
    let scheme = null;
    try {
      scheme = new URL(url).protocol;
    } catch {
      /* not an absolute URL */
    }
    if (scheme !== "https:" && scheme !== "http:")
      hard.push(`Q${item.id}: reference is not an absolute http(s) URL: ${url}`);
  }
}

// dataset-level invariants
const seq = q.map((x) => x.id);
const contiguous = seq.every((v, i) => v === i + 1);
if (!contiguous) hard.push(`ids not contiguous 1..${q.length}`);
if (q.length < 285) hard.push(`only ${q.length} questions (expected >= 285)`);

const multi = q.filter((x) => x.answers.length > 1);
const review = q.filter((x) => x.needsReview);

console.log(`Validated ${q.length} questions.`);
console.log(`  multi-answer: ${multi.length} [${multi.map((x) => x.id).join(", ")}]`);
console.log(`  needsReview:  ${review.length}`);

// Exam-guide section titles + the real exam's weighting, so the bank's coverage can be eyeballed
// against what the exam actually asks. Keep in sync with lib/domains.ts.
const SECTIONS = [
  ["Architecting low-code AI solutions", 13],
  ["Collaborating to manage data and models", 16],
  ["Scaling prototypes into ML models", 21],
  ["Serving and scaling models", 20],
  ["Automating and orchestrating ML pipelines", 18],
  ["Monitoring AI solutions", 13],
];
console.log("  domains (bank share vs real-exam weight):");
SECTIONS.forEach(([title, weight], i) => {
  const n = q.filter((x) => x.domain === i + 1).length;
  const share = ((100 * n) / q.length).toFixed(1);
  console.log(
    `    ${i + 1}. ${String(n).padStart(3)} q  ${share.padStart(5)}% vs ~${weight}%  ${title}`,
  );
});
if (soft.length) {
  console.log(`\nKnown-defect notes (${soft.length}, non-blocking):`);
  for (const s of soft.slice(0, 40)) console.log("  - " + s);
}
if (hard.length) {
  console.error(`\nFAILED — ${hard.length} integrity error(s) on clean questions:`);
  for (const h of hard) console.error("  ✗ " + h);
  process.exit(1);
}
console.log("\nOK — no integrity errors on clean questions.");
