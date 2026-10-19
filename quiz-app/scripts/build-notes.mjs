#!/usr/bin/env node
// Build data/notes.json — the DSAI revision notes — from the static pages in
// ../DSAI/revision-notes/. Each page is one lecture (COM6004-ch5.html) written to a fixed
// template (see that folder's TEMPLATE in the original notes project): a topbar with a
// `.crumb`, then `<main>` holding a `.meta` line, the `<h1>`, the content and a `.pager`.
//
// Only the content is kept. The topbar, the pager and the page's own scripts are dropped:
// the app draws its own chrome and generates prev/next from the order here, so the pages'
// relative `.html` links never reach the browser. Math stays as `$$…$$` / `\(…\)` source and
// is typeset by KaTeX when the route is prerendered (lib/notes.ts), not by a CDN script.
//
// Like `npm run cards` this is safe to re-run: the HTML pages are the source of truth.
// Anything that would execute or load in the browser (a script, an inline handler, an
// image, a stray link) is a hard failure — the body is injected with dangerouslySetInnerHTML.
//
// Usage: node scripts/build-notes.mjs [--dir <path>]   (default ../DSAI/revision-notes)

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { dataPath, sourceDir } from "./dsai-common.mjs";

const at = process.argv.indexOf("--dir");
const DIR = at !== -1 ? sourceDir() : resolve(sourceDir(), "revision-notes");
const OUT = dataPath("notes.json");

if (!existsSync(DIR)) {
  console.error(`FAILED — source directory not found: ${DIR}`);
  process.exit(1);
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#")
      return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
const text = (html) => decode(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

const files = readdirSync(DIR)
  .filter((f) => /^[A-Z]+\d+-[a-z0-9]+\.html$/i.test(f))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (files.length === 0) {
  console.error(`FAILED — no COURSE-unit.html pages in ${DIR}`);
  process.exit(1);
}

const slugs = new Set(files.map((f) => f.replace(/\.html$/i, "")));
const out = [];
const hard = [];

for (const file of files) {
  const slug = file.replace(/\.html$/i, "");
  const src = readFileSync(resolve(DIR, file), "utf8");
  const fail = (msg) => hard.push(`${file}: ${msg}`);

  const crumb = src.match(/<span class="crumb">([^<]*)<\/span>/);
  const main = src.match(/<main>([\s\S]*)<\/main>/);
  if (!crumb || !main) {
    fail("no .crumb or <main> — not written from the template");
    continue;
  }

  // "COM6004 Data Mining › Chapter 5"
  const cm = decode(crumb[1]).match(/^(\S+)\s+(.+?)\s*›\s*(.+)$/);
  if (!cm) {
    fail(`crumb "${crumb[1]}" is not "CODE Course title › Unit"`);
    continue;
  }
  const [, course, courseTitle, unitLabel] = cm;
  if (!slug.startsWith(course + "-")) fail(`file name says ${slug.split("-")[0]}, crumb says ${course}`);

  let body = main[1];
  const h1 = body.match(/<h1>([\s\S]*?)<\/h1>/);
  const meta = body.match(/<p class="meta">([\s\S]*?)<\/p>/);
  if (!h1) fail("no <h1>");
  body = body
    .replace(/<p class="meta">[\s\S]*?<\/p>/, "")
    .replace(/<h1>[\s\S]*?<\/h1>/, "")
    .replace(/<nav class="pager">[\s\S]*?<\/nav>/, "")
    .trim();

  // The original pages numbered their sections in script (s1, s2…); do it here, so the table
  // of contents and any shared #s3 link keep working without running anything in the browser.
  const headings = [];
  body = body.replace(/<h2>([\s\S]*?)<\/h2>/g, (_, inner) => {
    const id = `s${headings.length + 1}`;
    headings.push({ id, text: text(inner) });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  if (headings.length === 0) fail("no <h2> sections");

  // The overview box opens with an <h3> straight under the page's <h1>, skipping a level (axe
  // "heading-order", on every page). Promote it to an <h2> carrying a class, so the numbering
  // above, which matches bare <h2>s only, keeps it out of the contents. CSS sizes it as an h3.
  body = body.replace(/(<div class="overview">\s*)<h3>([\s\S]*?)<\/h3>/g, '$1<h2 class="overview-title">$2</h2>');

  // A comparison table whose corner cell is empty labels its rows in the first column. Make those
  // labels row headers, so a screen reader reads "意思" with each cell of that row (axe
  // "td-has-header"). CSS keeps them looking like the plain cells they were.
  body = body.replace(/<table\b[^>]*>[\s\S]*?<\/table>/g, (table) =>
    /^<table\b[^>]*>\s*(?:<thead>\s*)?<tr>\s*<th>\s*<\/th>/.test(table)
      ? table.replace(/(<tr>\s*)<td>([\s\S]*?)<\/td>/g, '$1<th scope="row">$2</th>')
      : table,
  );
  // An empty header cell (the corner, or a blank column head) heads nothing; a header with no
  // text is announced as a blank (axe "empty-table-header"). Make it a plain cell.
  body = body.replace(/<th>\s*<\/th>/g, "<td></td>");

  // A cross-reference to a sibling page ("see Week 3") becomes that page's route.
  body = body.replace(/(<a\b[^>]*href=")([^"#]+)\.html(#[^"]*)?"/gi, (m, pre, name, hash = "") =>
    slugs.has(name) ? `${pre}/dsai/notes/${name}${hash}"` : m,
  );

  if (/<(script|style|link|iframe|img|object|embed|form|input|svg)\b/i.test(body))
    fail("body contains an element that loads or runs something");
  if (/\son[a-z]+\s*=/i.test(body)) fail("body contains an inline event handler");
  if (/javascript:/i.test(body)) fail("body contains a javascript: URL");
  for (const [, href] of body.matchAll(/<a\b[^>]*href="([^"]*)"/gi))
    if (!/^(https?:\/\/|#|\/dsai\/notes\/)/.test(href)) fail(`relative link ${href} would not resolve inside the app`);
  for (const tag of ["div", "details", "table", "pre", "ul", "ol"]) {
    const open = (body.match(new RegExp(`<${tag}\\b`, "g")) ?? []).length;
    const close = (body.match(new RegExp(`</${tag}>`, "g")) ?? []).length;
    if (open !== close) fail(`${open} <${tag}> but ${close} </${tag}>`);
  }

  out.push({
    slug,
    course,
    courseTitle,
    unitLabel,
    title: h1 ? text(h1[1]) : slug,
    meta: meta ? text(meta[1]) : "",
    headings,
    html: body,
  });
  console.log(`  ${slug.padEnd(14)} ${String(headings.length).padStart(2)} sections  ${String(body.length).padStart(6)} B`);
}

// One course title per code: the crumb is hand-written on every page, so a typo would split a course.
const titles = new Map();
for (const n of out) {
  const seen = titles.get(n.course);
  if (seen && seen !== n.courseTitle) hard.push(`${n.slug}: course title "${n.courseTitle}" ≠ "${seen}"`);
  titles.set(n.course, n.courseTitle);
}

if (hard.length) {
  console.error(`\nFAILED — ${hard.length} error(s); nothing written:`);
  for (const h of hard.slice(0, 60)) console.error("  ✗ " + h);
  process.exit(1);
}

writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`\nWrote ${out.length} pages to data/notes.json`);
console.log(`  courses: ${titles.size} [${[...titles].map(([c, t]) => `${c} ${t}`).join(", ")}]`);
