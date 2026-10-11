#!/usr/bin/env node
// Build data/cards.json from the Anki-style CSVs in ../DSAI/.
//
// Each CSV is one deck, named COURSE_Unit (e.g. COM6001_Lecture_1.csv), with two columns:
// Front,Back. A "Front,Back[,Tags]" header row is optional, and so is a third Tags column
// (COURSE::UNIT::topic); without one, course and unit come from the file name.
//
// Unlike `npm run extract` — which regenerates the PMLE bank from a PDF and refuses to
// clobber the hand-corrected union — this script is safe to re-run at any time: the CSVs
// are the source of truth and nothing in cards.json is hand-edited. Drop another CSV into
// DSAI/ and re-run; it is picked up automatically. (The .json files beside them are the
// multiple-choice bank — see build-mcq.mjs.)
//
// Usage: node scripts/build-cards.mjs [--dir <path>]

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { contentId, dataPath, deckFromStem, norm, sourceDir } from "./dsai-common.mjs";

const CSV_DIR = sourceDir();
const OUT = dataPath("cards.json");

const DQ = '"';

/**
 * RFC 4180 CSV: quoted fields, "" as a literal quote, newlines legal inside quotes.
 * Anki's export quotes every field, but a hand-edited row may not be, so handle both.
 */
function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let quoted = false;
  const src = text.replace(/^﻿/, "").replace(/\r\n/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === DQ) {
        if (src[i + 1] === DQ) {
          field += DQ;
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === DQ) {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  // drop blank trailing lines
  return rows.filter((r) => r.length > 1 || (r[0] ?? "").trim() !== "");
}

if (!existsSync(CSV_DIR)) {
  console.error(`FAILED — CSV directory not found: ${CSV_DIR}`);
  process.exit(1);
}

const files = readdirSync(CSV_DIR)
  .filter((f) => f.toLowerCase().endsWith(".csv"))
  // Natural order, so Lecture_05 sorts after Lecture_4 and the bank reads in course order.
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (files.length === 0) {
  console.error(`FAILED — no .csv files in ${CSV_DIR}`);
  process.exit(1);
}

const cards = [];
const warnings = [];
const byId = new Map();

for (const file of files) {
  const stem = file.replace(/\.csv$/i, "");
  const rows = parseCsv(readFileSync(resolve(CSV_DIR, file), "utf8"));
  const first = (rows[0] ?? []).map((h) => norm(h).toLowerCase());
  const hasHeader = first[0] === "front" && first[1] === "back";
  if (hasHeader) rows.shift();
  const fromName = deckFromStem(stem);

  let kept = 0;
  rows.forEach((r, i) => {
    const line = i + (hasHeader ? 2 : 1); // 1-based
    const front = norm(r[0]);
    const back = norm(r[1]);
    const tag = norm(r[2]);

    if (!front || !back) {
      warnings.push(`${file}:${line} — skipped: empty ${!front ? "front" : "back"}`);
      return;
    }

    // No tag is the normal case for the DSAI CSVs: the file name carries course and unit.
    // A three-part tag, when present, still wins — that is what an Anki export writes.
    const parts = tag.split("::").map(norm).filter(Boolean);
    let course, unit, topic;
    if (parts.length >= 3) {
      [course, unit] = parts;
      topic = parts.slice(2).join("::");
    } else {
      ({ course, unit } = fromName);
      topic = parts.length ? parts[parts.length - 1] : "";
      if (tag) warnings.push(`${file}:${line} — tag "${tag}" is not COURSE::UNIT::topic; used the file name`);
    }

    // Content hash, not a row number — SRS state is keyed by it. A collision fails loudly.
    const id = contentId(course, unit, front);
    const clash = byId.get(id);
    if (clash) {
      console.error(
        `FAILED — id collision ${id}:\n  ${clash.deck}: ${clash.front}\n  ${stem}: ${front}`,
      );
      process.exit(1);
    }

    const tagOut = topic ? `${course}::${unit}::${topic}` : `${course}::${unit}`;
    const card = { id, front, back, course, unit, topic, tag: tagOut, deck: stem };
    byId.set(id, card);
    cards.push(card);
    kept++;
  });

  console.log(`  ${stem.padEnd(24)} ${String(kept).padStart(3)} cards`);
}

// Which schedules this rebuild resets. An edited Front changes its hash, so the card reads as
// new — that is the price of not putting an id column in the source CSVs, and it must be loud
// rather than discovered later as a card that mysteriously forgot its history.
if (existsSync(OUT)) {
  try {
    const prev = JSON.parse(readFileSync(OUT, "utf8"));
    const prevIds = new Set(prev.map((c) => c.id));
    const nextIds = new Set(cards.map((c) => c.id));
    const gone = prev.filter((c) => !nextIds.has(c.id));
    const added = cards.filter((c) => !prevIds.has(c.id));
    if (gone.length || added.length) {
      console.log(`\nId diff vs the committed bank: -${gone.length} +${added.length}`);
      for (const c of gone.slice(0, 10)) console.log(`  - ${c.id} ${c.front.slice(0, 64)}`);
      for (const c of added.slice(0, 10)) console.log(`  + ${c.id} ${c.front.slice(0, 64)}`);
      if (gone.length) console.log("  (schedules stored under the removed ids are dropped on next load)");
    }
  } catch {
    /* unreadable previous bank — nothing to diff against */
  }
}

writeFileSync(OUT, JSON.stringify(cards, null, 2) + "\n");

const courses = [...new Set(cards.map((c) => c.course))].sort();
const units = new Set(cards.map((c) => `${c.course}::${c.unit}`));
console.log(`\nWrote ${cards.length} cards to data/cards.json`);
console.log(`  courses: ${courses.length} [${courses.join(", ")}]`);
console.log(`  units:   ${units.size}`);
console.log(`  topics:  ${new Set(cards.filter((c) => c.topic).map((c) => c.tag)).size}`);
if (warnings.length) {
  console.log(`\nWarnings (${warnings.length}, non-blocking — run validate:cards to gate):`);
  for (const w of warnings.slice(0, 20)) console.log("  ! " + w);
}
