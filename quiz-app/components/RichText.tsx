"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import { useMemo } from "react";
import { splitInline } from "@/lib/rich";

/**
 * Inline `code` and $math$ for the DSAI decks (see lib/rich.ts). Phrasing content only — it
 * sits inside option <button>s — so math is KaTeX's inline markup, never a block.
 *
 * KaTeX escapes its input and `trust` stays off, so \href / \url cannot inject markup; a
 * formula it cannot parse renders as red source text instead of throwing.
 *
 * The default output is HTML plus hidden MathML: the HTML is what you see, the MathML is what a
 * screen reader reads. HTML alone would leave it a string of unrelated glyphs.
 */
export default function RichText({ text }: { text: string }) {
  const runs = useMemo(() => splitInline(text), [text]);
  return (
    <>
      {runs.map((r, i) => {
        if (r.kind === "code")
          return (
            <code
              key={i}
              className="rounded-[3px] border border-signal/20 bg-ink/70 px-1 py-px font-mono text-[0.88em] text-paper"
            >
              {r.content}
            </code>
          );
        if (r.kind === "math")
          return (
            <span
              key={i}
              className="text-paper"
              dangerouslySetInnerHTML={{
                __html: katex.renderToString(r.content, { throwOnError: false }),
              }}
            />
          );
        return <span key={i}>{r.content}</span>;
      })}
    </>
  );
}
