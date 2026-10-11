#!/usr/bin/env node
// Build data/dsai-questions.json — the DSAI multiple-choice bank — from the *.json files in
// ../DSAI/. Each file is one deck (COURSE_Unit.json, the same stem as its flashcard CSV) and
// holds an array of:
//
//   { question, options: [{ label, text, Explanation }], answers: ["A"], hints, course, week }
//
// Like `npm run cards` this is safe to re-run: the DSAI files are the source of truth and
// nothing in the output is hand-edited. Course and unit come from the FILE NAME, not the
// record, so a question lands in the same course/unit as its deck's flashcards and the two
// study modes filter identically. Structural defects are hard failures — a question whose
// answer letter matches no option would be unanswerable in the UI.
//
// Usage: node scripts/build-mcq.mjs [--dir <path>]

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { contentId, dataPath, deckFromStem, norm, sourceDir } from "./dsai-common.mjs";

const DIR = sourceDir();
const OUT = dataPath("dsai-questions.json");

if (!existsSync(DIR)) {
  console.error(`FAILED — source directory not found: ${DIR}`);
  process.exit(1);
}

const files = readdirSync(DIR)
  .filter((f) => f.toLowerCase().endsWith(".json"))
  // Natural order, so Lecture_05 sorts after Lecture_4 and the bank reads in course order.
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (files.length === 0) {
  console.error(`FAILED — no .json files in ${DIR}`);
  process.exit(1);
}

const out = [];
const hard = [];
const soft = [];
const byId = new Map();

for (const file of files) {
  const stem = file.replace(/\.json$/i, "");
  const { course, unit } = deckFromStem(stem);

  let raw;
  try {
    raw = JSON.parse(readFileSync(resolve(DIR, file), "utf8"));
  } catch (e) {
    hard.push(`${file}: not valid JSON (${e.message})`);
    continue;
  }
  if (!Array.isArray(raw)) {
    hard.push(`${file}: expected a top-level array of questions`);
    continue;
  }

  raw.forEach((q, i) => {
    const where = `${file}[${i}]`;
    const question = norm(q?.question);
    if (!question) return hard.push(`${where}: empty question`);

    const options = (Array.isArray(q.options) ? q.options : []).map((o) => ({
      label: norm(o?.label).toUpperCase(),
      text: norm(o?.text),
      // The source capitalises this key; accept either spelling.
      explanation: norm(o?.Explanation ?? o?.explanation),
    }));
    const labels = options.map((o) => o.label);
    const answers = (Array.isArray(q.answers) ? q.answers : []).map((a) => norm(a).toUpperCase());

    if (options.length < 2) hard.push(`${where}: fewer than two options`);
    if (new Set(labels).size !== labels.length) hard.push(`${where}: duplicate option labels`);
    if (options.some((o) => !o.label || !o.text)) hard.push(`${where}: option with no label or text`);
    if (answers.length === 0) hard.push(`${where}: no answer`);
    for (const a of answers)
      if (!labels.includes(a)) hard.push(`${where}: answer ${a} is not one of ${labels.join("/")}`);

    if (q.course && norm(q.course) !== course)
      soft.push(`${where}: record says course ${q.course}, file name says ${course} — file name wins`);
    for (const o of options)
      if (!o.explanation) soft.push(`${where}: option ${o.label} has no explanation`);

    const id = contentId(course, unit, question);
    const clash = byId.get(id);
    if (clash) return hard.push(`${where}: duplicate question (same text as ${clash})`);
    byId.set(id, where);

    out.push({
      id,
      question,
      options,
      answers,
      hint: norm(q.hints ?? q.hint),
      course,
      unit,
      deck: stem,
    });
  });

  console.log(`  ${stem.padEnd(24)} ${String(raw.length).padStart(3)} questions`);
}

if (hard.length) {
  console.error(`\nFAILED — ${hard.length} error(s); nothing written:`);
  for (const h of hard.slice(0, 60)) console.error("  ✗ " + h);
  process.exit(1);
}

writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");

const courses = [...new Set(out.map((q) => q.course))].sort();
console.log(`\nWrote ${out.length} questions to data/dsai-questions.json`);
console.log(`  courses: ${courses.length} [${courses.join(", ")}]`);
console.log(`  units:   ${new Set(out.map((q) => `${q.course}::${q.unit}`)).size}`);
if (soft.length) {
  console.log(`\nNotes (${soft.length}, non-blocking):`);
  for (const s of soft.slice(0, 20)) console.log("  - " + s);
}
