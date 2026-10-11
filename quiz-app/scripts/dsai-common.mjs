// Shared by build-cards.mjs and build-mcq.mjs: where the DSAI sources live, how a file name
// becomes a course/unit, and the content hash both banks key their stored progress on.
// Zero-dep, like every script here.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** `--dir <path>` overrides the default ../../DSAI (one level above quiz-app/). */
export function sourceDir(argv = process.argv) {
  const at = argv.indexOf("--dir");
  return at !== -1 && argv[at + 1] ? resolve(argv[at + 1]) : resolve(HERE, "..", "..", "DSAI");
}

export const dataPath = (name) => resolve(HERE, "..", "data", name);

/**
 * "COM6001_Lecture_05" -> { course: "COM6001", unit: "Lecture_5" }.
 *
 * Leading zeros are dropped so "Lecture_05" and "Lecture_4" sort and read as one series
 * ("Lecture 5", "Lecture 4") — the folder spells numbers both ways. The unit is part of the
 * content hash, so this normalisation must not change casually: it would reset every schedule.
 */
export function deckFromStem(stem) {
  const m = stem.match(/^([A-Za-z]+\d+)[_-](.+)$/);
  if (!m) return { course: stem, unit: "misc" };
  const unit = m[2].replace(/(^|[_\- ])0+(?=\d)/g, "$1");
  return { course: m[1], unit };
}

/**
 * 48 bits of FNV-1a (two passes, different offset bases). Ids must survive a rebuild: stored
 * progress is keyed by them, so a positional id would renumber everything when a file lands.
 */
function fnv1a(str, basis) {
  let h = basis >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function contentId(course, unit, text) {
  const key = `${course}::${unit}::${text}`;
  const a = fnv1a(key, 0x811c9dc5).toString(16).padStart(8, "0");
  const b = fnv1a(key, 0x7f4a7c15).toString(16).padStart(8, "0");
  return (a + b).slice(0, 12);
}

export const norm = (s) => (s ?? "").replace(/\s+/g, " ").trim();
