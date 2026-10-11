#!/usr/bin/env node
// Extract the Google PMLE question bank from the obfuscated source PDF into
// data/questions.json. Zero external dependencies — uses Node's built-in zlib.
//
// The PDF hides its text with a per-font Caesar byte-shift (font subsetting).
// We: (1) inflate each content stream, (2) find the shift that maximises English
// word hits, (3) run a minimal PDF text-positioning interpreter to recover the
// real reading order (option letters and bodies are drawn at separate
// coordinates), (4) strip page furniture, and (5) parse question blocks.
//
// Usage: node scripts/extract-questions.mjs [path-to-pdf]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEFAULT_PDF = resolve(
  ROOT,
  "..",
  "PMLE",
  "Google-Professional-Machine-Learning-Engineer+解密.pdf",
);
const OUT = resolve(ROOT, "data", "questions.json");

const COMMON = [" the ", " and ", " you ", " model ", " Answer", " Question", " Explanation", " data ", " Option", " that "];
const score = (t) => COMMON.reduce((n, w) => n + t.split(w).length - 1, 0);
const shiftStr = (codes, k) => {
  let s = "";
  for (const c of codes) s += String.fromCharCode((c + k) & 0xff);
  return s;
};

// Unescape a PDF literal string (given as an array of byte codes) -> byte codes.
function unescape(codes) {
  const out = [];
  for (let i = 0; i < codes.length; i++) {
    const c = codes[i];
    if (c === 0x5c && i + 1 < codes.length) {
      const nxt = codes[i + 1];
      if (nxt >= 0x30 && nxt <= 0x37) {
        let oct = "";
        let j = i + 1;
        while (j < codes.length && oct.length < 3 && codes[j] >= 0x30 && codes[j] <= 0x37) {
          oct += String.fromCharCode(codes[j]);
          j++;
        }
        out.push(parseInt(oct, 8) & 0xff);
        i = j - 1;
        continue;
      }
      const map = { 0x6e: 0x0a, 0x72: 0x0d, 0x74: 0x09, 0x62: 0x08, 0x66: 0x0c, 0x28: 0x28, 0x29: 0x29, 0x5c: 0x5c };
      if (nxt in map) { out.push(map[nxt]); i++; continue; }
      i++;
      continue;
    }
    out.push(c);
  }
  return out;
}

const toCodes = (str) => { const a = []; for (let i = 0; i < str.length; i++) a.push(str.charCodeAt(i)); return a; };

// Minimal content-stream interpreter: returns [{y, x, text}] drawn items.
const TOKEN = /(\((?:[^()\\]|\\.|\([^()]*\))*\))|(<[0-9A-Fa-f\s]*>)|([-+]?\d*\.?\d+)|(\/[^\s\[\]<>()/]+)|([\[\]])|([A-Za-z'"*]+)/g;

function mul(m, n) {
  return [
    m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5],
  ];
}

function interpret(streamStr, shift) {
  const items = [];
  let Tm = [1, 0, 0, 1, 0, 0];
  let Tlm = [1, 0, 0, 1, 0, 0];
  let leading = 0;
  let stack = [];
  TOKEN.lastIndex = 0;
  let m;
  while ((m = TOKEN.exec(streamStr)) !== null) {
    if (m[3] !== undefined) { stack.push(parseFloat(m[3])); continue; }
    if (m[1] !== undefined) { stack.push({ t: "str", v: m[1].slice(1, -1) }); continue; }
    if (m[2] !== undefined) { stack.push({ t: "hex" }); continue; }
    if (m[4] !== undefined) { stack.push({ t: "name" }); continue; }
    if (m[5] !== undefined) { stack.push(m[5]); continue; }
    const op = m[6];
    if (op === "BT") { Tm = [1, 0, 0, 1, 0, 0]; Tlm = [1, 0, 0, 1, 0, 0]; }
    else if (op === "Tm") {
      const nums = stack.filter((x) => typeof x === "number").slice(-6);
      if (nums.length === 6) { Tm = nums.slice(); Tlm = nums.slice(); }
    } else if (op === "Td" || op === "TD") {
      const nums = stack.filter((x) => typeof x === "number");
      if (nums.length >= 2) {
        const tx = nums[nums.length - 2], ty = nums[nums.length - 1];
        if (op === "TD") leading = -ty;
        Tlm = mul([1, 0, 0, 1, tx, ty], Tlm); Tm = Tlm.slice();
      }
    } else if (op === "T*") {
      Tlm = mul([1, 0, 0, 1, 0, -leading], Tlm); Tm = Tlm.slice();
    } else if (op === "TL") {
      const nums = stack.filter((x) => typeof x === "number");
      if (nums.length) leading = nums[nums.length - 1];
    } else if (op === "Tj" || op === "'" || op === '"') {
      for (let i = stack.length - 1; i >= 0; i--) {
        const s = stack[i];
        if (s && s.t === "str") {
          const txt = shiftStr(unescape(toCodes(s.v)), shift);
          items.push([Math.round(Tm[5] * 10) / 10, Math.round(Tm[4] * 10) / 10, txt]);
          break;
        }
      }
    } else if (op === "TJ") {
      const arr = [];
      while (stack.length) {
        const e = stack.pop();
        if (e === "[") break;
        arr.push(e);
      }
      arr.reverse();
      let buf = "";
      for (const e of arr) {
        if (e && e.t === "str") buf += shiftStr(unescape(toCodes(e.v)), shift);
        else if (typeof e === "number" && e < -100) buf += " ";
      }
      if (buf) items.push([Math.round(Tm[5] * 10) / 10, Math.round(Tm[4] * 10) / 10, buf]);
      stack = [];
      continue;
    }
    stack = [];
  }
  return items;
}

function pageText(items) {
  if (!items.length) return "";
  items.sort((a, b) => (b[0] - a[0]) || (a[1] - b[1]));
  const lines = [];
  let cur = [];
  let cury = null;
  for (const [y, x, txt] of items) {
    if (cury === null || Math.abs(y - cury) <= 3) { cur.push([x, txt]); if (cury === null) cury = y; }
    else { lines.push(cur); cur = [[x, txt]]; cury = y; }
  }
  if (cur.length) lines.push(cur);
  return lines.map((ln) => { ln.sort((a, b) => a[0] - b[0]); return ln.map((p) => p[1]).join(""); }).join("\n");
}

function extractText(pdfBuf) {
  const raw = pdfBuf.toString("latin1");
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const pages = [];
  let m;
  while ((m = streamRe.exec(raw)) !== null) {
    const bytes = Buffer.from(m[1], "latin1");
    let inflated;
    try { inflated = inflateSync(bytes); } catch { continue; }
    const s = inflated.toString("latin1");
    if (!s.includes("Tj") && !s.includes("TJ")) continue;
    // best shift from concatenated literal strings
    const litRe = /\((?:[^()\\]|\\.)*\)/g;
    const codes = [];
    let lm;
    while ((lm = litRe.exec(s)) !== null) codes.push(...unescape(toCodes(lm[0].slice(1, -1))));
    let best = 0, bestScore = -1;
    for (let k = 0; k < 256; k++) { const sc = score(shiftStr(codes, k)); if (sc > bestScore) { bestScore = sc; best = k; } }
    pages.push(pageText(interpret(s, best)));
  }
  return pages.join("\n\f\n");
}

function stripFurniture(full) {
  full = full.replace(/\f/g, "\n");
  full = full.replace(/Top IT Certification Prep Material\s*\d+ of 317/g, " ");
  full = full.replace(/Exams Prep\s*Google - Professional-Machine-Learning-Engineer/g, " ");
  full = full.replace(/Google - Professional-Machine-Learning-Engineer\s*Exams Prep/g, " ");
  full = full.replace(/Top IT Certification Prep Material/g, " ");
  full = full.replace(/Exams Prep/g, " ");
  full = full.replace(/Google - Professional-Machine-Learning-Engineer/g, " ");
  full = full.replace(/\b\d+ of 317\b/g, " ");
  return full;
}

function collapse(s) { return s.replace(/\s+/g, " ").trim(); }

function parseBlock(num, body) {
  const am = body.match(/Answer:\s*([A-E])(?![A-Za-z])/);
  const answers = am ? [am[1]] : [];
  const ansPos = am ? am.index : body.length;
  const head = body.slice(0, ansPos);
  const tail = body.slice(ansPos);
  const optRe = /^([A-E])\.\s+(.*(?:\n(?![A-E]\.\s|Answer:|Explanation).*)*)/gm;
  const opts = [];
  let om;
  let firstStart = head.length;
  while ((om = optRe.exec(head)) !== null) {
    if (opts.length === 0) firstStart = om.index;
    opts.push({ label: om[1], text: collapse(om[2]) });
  }
  const stem = collapse(head.slice(0, opts.length ? firstStart : head.length));
  let expl = tail.replace(/^Answer:\s*[A-E]\s*/, "").replace(/^\s*Explanation\s*/, "");
  expl = collapse(expl);
  // `domain` (exam-guide section 1..6) cannot be derived from the PDF — it is a judgment
  // call made per question and stored in the committed JSON. A freshly extracted bank is
  // emitted unclassified (0) and must be re-classified; validate-questions.mjs rejects 0.
  return { id: num, question: stem, options: opts, answers, domain: 0, explanation: expl };
}

function computeFlags(q) {
  const f = [];
  const labels = q.options.map((o) => o.label);
  if (q.options.length < 3) f.push("few_options");
  if (q.question.length < 40) f.push("short_stem");
  if (!q.answers.length) f.push("no_answer");
  if (q.answers.some((a) => !labels.includes(a))) f.push("answer_not_in_options");
  const expected = labels.map((_, i) => String.fromCharCode(65 + i));
  if (labels.join("") !== expected.join("")) f.push("label_gap");
  if (q.options.some((o) => o.text.length < 3)) f.push("empty_option");
  if (q.explanation.length < 20) f.push("short_explanation");
  return f;
}

function main() {
  const pdfPath = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_PDF;
  const pdfBuf = readFileSync(pdfPath);
  const full = stripFurniture(extractText(pdfBuf));
  const parts = full.split(/Question #:\s*(\d+)/);
  const questions = [];
  for (let i = 1; i < parts.length; i += 2) {
    const q = parseBlock(parseInt(parts[i], 10), parts[i + 1]);
    q.needsReview = computeFlags(q).length > 0;
    q.flags = computeFlags(q);
    questions.push(q);
  }
  questions.sort((a, b) => a.id - b.id);

  const clean = questions.filter((q) => !q.needsReview).length;
  const flagged = questions.filter((q) => q.needsReview);
  const reasons = {};
  for (const q of flagged) for (const r of q.flags) reasons[r] = (reasons[r] || 0) + 1;

  // Guard: data/questions.json may be a hand-assembled UNION (the base 285 plus
  // extra questions carrying a `source`). This extractor only rebuilds the base
  // 285, so overwriting would silently drop them. Refuse unless --force.
  if (!process.argv.includes("--force") && existsSync(OUT)) {
    let existing = [];
    try { existing = JSON.parse(readFileSync(OUT, "utf8")); } catch { /* unreadable → treat as base */ }
    const extra = existing.filter((q) => q && q.source);
    if (extra.length > 0 || existing.length > questions.length) {
      console.error(
        `REFUSING to overwrite ${OUT}: it holds ${existing.length} questions ` +
        `(${extra.length} with a non-extractor 'source'), but this run parsed only ` +
        `${questions.length}. Pass --force to overwrite and rebuild the base 285.`,
      );
      process.exit(1);
    }
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(questions, null, 2) + "\n");

  console.log(`Source: ${pdfPath}`);
  console.log(`Extracted ${questions.length} questions -> ${OUT}`);
  console.log(`  clean: ${clean}`);
  console.log(`  needsReview: ${flagged.length} -> ids [${flagged.map((q) => q.id).join(", ")}]`);
  console.log(`  flag reasons:`, reasons);
  if (questions.length < 250) { console.error("FATAL: too few questions parsed — extraction likely broke."); process.exit(1); }
}

main();
