"use client";

import { useEffect, useState } from "react";
import type { Heading } from "@/lib/notes";

/*
 * The interactive bits of the revision notes. The page itself (app/dsai/notes/[slug]) is a
 * server component that prerenders the lecture's HTML and math; these islands only add what
 * needs the browser: the scroll-tracking contents, and keyboard access to wide code blocks.
 */

/**
 * The page's sections. On a desktop it sits in the sticky rail and follows the scroll; on a
 * phone, where the rail lands under the article, the same list is a collapsed <details> at the
 * top of the article instead (`variant="inline"`).
 */
export function NotesToc({ headings, variant }: { headings: Heading[]; variant: "rail" | "inline" }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (variant !== "rail") return;
    const els = headings.map((h) => document.getElementById(h.id)).filter((e): e is HTMLElement => !!e);
    // The current section is the last heading above the top 30% of the viewport — so a long
    // section stays lit all the way down, not only while its heading is in that band. Read once
    // per frame at most; there are only a dozen headings.
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.3;
      let current: string | null = null;
      for (const el of els) {
        if (el.getBoundingClientRect().top > line) break;
        current = el.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [headings, variant]);

  const list = (
    <ol className="flex flex-col gap-0.5">
      {headings.map((h) => (
        <li key={h.id}>
          <a
            href={`#${h.id}`}
            aria-current={active === h.id ? "location" : undefined}
            className="block rounded-[4px] px-2.5 py-1.5 text-[14px] leading-snug text-mist transition hover:bg-signal/5 hover:text-paper aria-[current=location]:bg-signal/10 aria-[current=location]:text-signal"
          >
            {h.text}
          </a>
        </li>
      ))}
    </ol>
  );

  if (variant === "inline")
    return (
      <details className="group mt-6 rounded-md bg-ink/50 px-4 py-3 lg:hidden">
        <summary className="cursor-pointer font-display text-sm font-medium text-paperdim">
          Contents · {headings.length} sections
        </summary>
        <nav aria-label="Contents" className="mt-2">
          {list}
        </nav>
      </details>
    );

  return (
    <nav aria-label="Contents" className="holo rounded-lg p-4">
      <h2 className="hud-label mb-2 px-2.5">On This Page</h2>
      {list}
    </nav>
  );
}

/**
 * A code block, table or display formula wider than the article scrolls sideways, and a keyboard
 * user can only
 * scroll what they can focus. Measured in the browser (a block that fits must not become a useless
 * tab stop), and again on resize, since a phone overflows blocks a desktop does not. A code block
 * gets a name to announce on focus: as a `group`, not a `region` landmark, since a page can hold
 * twenty and landmarks must be told apart. A table keeps its own role, and a formula is read
 * from its MathML. An inline formula too wide for its line is made a scroller too. Renders nothing.
 */
export function NotesCodeScroll() {
  useEffect(() => {
    const blocks = [...document.querySelectorAll<HTMLElement>(".notes-prose :is(pre, table, .katex-display)")];
    const inline = [...document.querySelectorAll<HTMLElement>(".notes-prose .katex")].filter(
      (k) => !k.closest(".katex-display, pre, table"),
    );
    let frame = 0;
    const mark = () => {
      frame = 0;
      // An inline formula cannot wrap; one wider than its line (a long \dfrac on a phone) would push
      // the page past the screen. Only those get `.katex-wide`, a sideways scroller (globals.css):
      // making every inline formula one would move them all off the text's baseline.
      for (const k of inline) {
        // The line is the nearest block's content box: an inline parent (<b>) reports width 0.
        const block = k.parentElement!.closest<HTMLElement>("p, li, td, th, dd, div, h2, h3, h4") ?? k.parentElement!;
        const cs = getComputedStyle(block);
        const line = block.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const wide = k.classList.contains("katex-wide") ? k.scrollWidth > k.clientWidth + 1 : k.getBoundingClientRect().width > line + 1;
        k.classList.toggle("katex-wide", wide);
        if (wide) k.tabIndex = 0;
        else k.removeAttribute("tabindex");
      }
      for (const el of blocks) {
        const isCode = el.tagName === "PRE";
        if (el.scrollWidth > el.clientWidth + 1) {
          el.tabIndex = 0;
          if (isCode) {
            el.setAttribute("role", "group");
            el.setAttribute("aria-label", "Code listing");
          }
        } else {
          el.removeAttribute("tabindex");
          if (isCode) {
            el.removeAttribute("role");
            el.removeAttribute("aria-label");
          }
        }
      }
    };
    const onResize = () => {
      if (!frame) frame = requestAnimationFrame(mark);
    };
    mark();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, []);
  return null;
}
