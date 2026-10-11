#!/usr/bin/env node
// Validate data/cards.json structural integrity. Run after `npm run cards`, or after any
// hand-edit. Hard failures exit non-zero; advisory notes are printed only.
//
// Usage: node scripts/validate-cards.mjs

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DATA = resolve(dirname(fileURLToPath(import.meta.url)), "..", "data", "cards.json");
const cards = JSON.parse(readFileSync(DATA, "utf8"));

const hard = []; // integrity errors -> non-zero exit
const soft = []; // worth a look, not worth blocking

// Keep in sync with scripts/build-cards.mjs. Duplicated rather than imported so this script
// stays a standalone zero-dep check, the same way validate-questions.mjs duplicates SECTIONS.
function fnv1a(str, basis) {
  let h = basis >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function cardId(course, unit, front) {
  const key = `${course}::${unit}::${front}`;
  return (
    fnv1a(key, 0x811c9dc5).toString(16).padStart(8, "0") +
    fnv1a(key, 0x7f4a7c15).toString(16).padStart(8, "0")
  ).slice(0, 12);
}

if (!Array.isArray(cards) || cards.length === 0) {
  console.error("FAILED — data/cards.json is not a non-empty array. Run `npm run cards`.");
  process.exit(1);
}

const ids = new Set();
const frontsByCourse = new Map();

for (const c of cards) {
  const where = `${c.id ?? "?"}`;

  if (typeof c.id !== "string" || !/^[0-9a-f]{12}$/.test(c.id))
    hard.push(`${where}: id must be 12 hex chars`);
  if (ids.has(c.id)) hard.push(`${where}: duplicate id`);
  ids.add(c.id);

  if (typeof c.front !== "string" || c.front.trim().length < 3)
    hard.push(`${where}: front is empty or too short`);
  if (typeof c.back !== "string" || c.back.trim().length < 3)
    hard.push(`${where}: back is empty or too short`);
  if (typeof c.deck !== "string" || !c.deck) hard.push(`${where}: missing deck`);

  // The tag is the taxonomy the course filter and the card header are built from. A malformed
  // one would put a card in a course that does not exist, where nothing would ever show it.
  // COURSE::UNIT when the CSV row carried no tag (the DSAI norm), COURSE::UNIT::topic when it did.
  const parts = String(c.tag ?? "").split("::");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !p.trim()))
    hard.push(`${where}: tag must be COURSE::UNIT[::topic] (got ${JSON.stringify(c.tag)})`);
  else if (parts[0] !== c.course || parts[1] !== c.unit || (parts[2] ?? "") !== (c.topic ?? ""))
    hard.push(`${where}: tag ${c.tag} disagrees with ${c.course}/${c.unit}/${c.topic}`);

  // The id IS the content hash — spaced-repetition state is stored against it. A hand-edit that
  // changes the front without rebuilding leaves an id pointing at text it no longer describes,
  // and the schedule silently belongs to the wrong card.
  if (typeof c.front === "string" && typeof c.course === "string" && typeof c.unit === "string") {
    const expect = cardId(c.course, c.unit, c.front);
    if (c.id !== expect)
      hard.push(`${where}: stale id — content hashes to ${expect}. Re-run \`npm run cards\`.`);
  }

  const key = c.course;
  if (!frontsByCourse.has(key)) frontsByCourse.set(key, new Map());
  const seen = frontsByCourse.get(key);
  if (seen.has(c.front)) soft.push(`${where}: same front as ${seen.get(c.front)} in ${key}`);
  else seen.set(c.front, c.id);

  if (typeof c.back === "string" && c.back.length > 600)
    soft.push(`${where}: back is ${c.back.length} chars — long for a single card`);
}

const courses = [...new Set(cards.map((c) => c.course))].sort();

console.log(`Validated ${cards.length} cards across ${courses.length} course(s).`);
console.log("  course / unit breakdown:");
for (const course of courses) {
  const inCourse = cards.filter((c) => c.course === course);
  const units = [...new Set(inCourse.map((c) => c.unit))];
  console.log(
    `    ${course}  ${String(inCourse.length).padStart(3)} cards  ${units.length} unit(s): ${units.join(", ")}`,
  );
}
console.log(`  distinct topics: ${new Set(cards.filter((c) => c.topic).map((c) => c.tag)).size}`);

if (soft.length) {
  console.log(`\nNotes (${soft.length}, non-blocking):`);
  for (const s of soft.slice(0, 40)) console.log("  - " + s);
}
if (hard.length) {
  console.error(`\nFAILED — ${hard.length} integrity error(s):`);
  for (const h of hard.slice(0, 60)) console.error("  ✗ " + h);
  process.exit(1);
}
console.log("\nOK — no integrity errors.");
