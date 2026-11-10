#!/usr/bin/env node
// Extract the AIF-C01 bank from AIF-C01/AIF-C01-dump.pdf into data/aif-questions.json.
// The PDF has a clean text layer, so this is `pdftotext` (poppler) plus a line parser.
//
// Like `npm run extract`, this is a bootstrap, not a build step: `domain` is a judgment call the
// PDF does not carry (taken from the committed bank by id, 0 for a question it has never seen),
// and it refuses to overwrite an existing bank without --force, because the JSON is hand-edited.
//
// HOTSPOT questions are skipped: their choices and answers are images, not text.
//
// Usage: node scripts/extract-aif.mjs [--force]

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const PDF = resolve(here, "..", "..", "AIF-C01", "AIF-C01-dump.pdf");
const OUT = resolve(here, "..", "data", "aif-questions.json");

const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
if (prev.length && !process.argv.includes("--force")) {
  console.error(`${OUT} exists and is hand-edited; re-run with --force to overwrite it.`);
  process.exit(1);
}
const domainOf = new Map(prev.map((q) => [q.id, q.domain]));

const raw = execFileSync("pdftotext", [PDF, "-"], { encoding: "utf8", maxBuffer: 1 << 26 });

// pdftotext drops the soft hyphen when it merges a wrapped line, welding two words. Each weld
// made its line abnormally long (> 115 characters), which is how these were enumerated.
const WELDS = {
  wellsuited: "well-suited", problemsolving: "problem-solving", humancentered: "human-centered",
  rulebased: "rule-based", lowerdimensional: "lower-dimensional", domainspecific: "domain-specific",
  nonfraudulent: "non-fraudulent", patientfacing: "patient-facing", nocode: "no-code",
  languagebased: "language-based", decisionmaking: "decision-making", highquality: "high-quality",
  finetune: "fine-tune", finetuning: "fine-tuning", companyapproved: "company-approved",
  longterm: "long-term", olderaged: "older-aged", productrelated: "product-related",
  manualstyle: "manual-style", taskspecific: "task-specific", MLpowered: "ML-powered",
  modelgenerated: "model-generated",
};
const unweld = (s) => s.replace(new RegExp(`\\b(${Object.keys(WELDS).join("|")})\\b`, "g"), (w) => WELDS[w]);

// The vertical watermark 店铺：学习小店66 comes out one fragment per line. Its last `6` carries
// no CJK and is not always next to another fragment, so every lone `6` line is dropped: no
// question in this dump has a line that is just "6".
const lines = [];
for (const line of raw.replace(/\f/g, "\n").split("\n")) {
  const t = line.trim();
  // blank lines are only watermark spacing; paragraphs are rebuilt below
  if (!t || t === "6" || /[\u3000-\u9fff\uff00-\uffef]/.test(t)) continue;
  lines.push(unweld(t));
}

const WRAP = 100; // the PDF wraps at ~105 characters
// Re-join wrapped lines. A line is a paragraph's last when it ends a sentence and the next
// line's first word would still have fitted on it.
function paragraphs(ls) {
  const res = [];
  for (let i = 0; i < ls.length; i++) {
    const prevLine = ls[i - 1];
    const first = ls[i].split(" ")[0];
    const wrapped =
      i > 0 && !(/[.?!:]["”)]?$/.test(prevLine) && prevLine.length + 1 + first.length <= WRAP) &&
      !/^[•\-–]\s|^\d+\.\s/.test(ls[i]);
    if (wrapped) res[res.length - 1] += " " + ls[i];
    else res.push(ls[i]);
  }
  return res.join("\n");
}

const questions = [];
const skipped = [];
const starts = lines.flatMap((l, i) => (/^QUESTION \d+$/.test(l) ? [i] : []));
starts.forEach((s, n) => {
  const id = Number(lines[s].slice(9));
  const body = lines.slice(s + 1, starts[n + 1] ?? lines.length);
  const ansAt = body.findIndex((l) => /^Correct Answer:/.test(l));
  const answers = ansAt < 0 ? [] : body[ansAt].slice(15).trim().split("");
  const optAt = body.findIndex((l) => /^A\. /.test(l));
  if (body[0] === "HOTSPOT" || optAt < 0 || optAt > ansAt || !answers.length) return skipped.push(id);

  const options = [];
  for (const l of body.slice(optAt, ansAt)) {
    const next = String.fromCharCode(65 + options.length);
    if (l.startsWith(next + ". ")) options.push({ label: next, text: l.slice(3).trim() });
    else options[options.length - 1].text += " " + l;
  }
  const expl = body.slice(ansAt + 1).filter((l) => !/^(Section: |Explanation\/Reference:$|Explanation:$)/.test(l));
  questions.push({
    id,
    question: paragraphs(body.slice(0, optAt)),
    options,
    answers,
    domain: domainOf.get(id) ?? 0,
    explanation: paragraphs(expl),
    needsReview: false,
    flags: [],
  });
});

if (questions.length < 500) throw new Error(`only ${questions.length} questions parsed`);
writeFileSync(OUT, JSON.stringify(questions, null, 2) + "\n");
console.log(`Wrote ${questions.length} questions; skipped ${skipped.length} HOTSPOT: ${skipped.join(", ")}`);
