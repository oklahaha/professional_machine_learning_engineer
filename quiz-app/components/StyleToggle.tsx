"use client";

import { useEffect, useState } from "react";

// TEMPORARY: a style trial, to be deleted once one style is chosen. To remove it: delete this
// file and every <StyleToggle /> (the page headers, next to the mode switch), the STYLE_BOOT
// script and data-theme attribute in app/layout.tsx, and fold the chosen style's tokens from the
// end of globals.css into :root.
export const STYLE_KEY = "ui-style-trial-v1";

const STYLES = [
  { id: "claude-dark", label: "Claude" },
  { id: "resend", label: "Resend" },
] as const;

type StyleId = (typeof STYLES)[number]["id"];

/** Rendered on <html> by app/layout.tsx, so the page is in it even before (or without) script. */
export const DEFAULT_STYLE: StyleId = "claude-dark";

function isStyle(v: unknown): v is StyleId {
  return STYLES.some((s) => s.id === v);
}

/** Runs before first paint (inlined in <head>), so a reload never flashes the default style. A
 *  stored style that is no longer offered (an earlier trial's "space", "cursor"…) is ignored. */
export const STYLE_BOOT = `try{var s=localStorage.getItem(${JSON.stringify(STYLE_KEY)});if(${JSON.stringify(STYLES.map((s) => s.id))}.indexOf(s)>=0)document.documentElement.dataset.theme=s}catch(e){}`;

/** Claude Code's pixel mascot, drawn on a 12×8 grid so every block lands on a whole pixel. */
function ClaudeMark() {
  return (
    <svg viewBox="0 0 12 8" className="theme-switch-icon" shapeRendering="crispEdges" aria-hidden>
      <path fill="#d97757" d="M1 0h10v6H1zM0 2h1v2H0zM11 2h1v2h-1zM1 6h1v2H1zM3 6h1v2H3zM8 6h1v2H8zM10 6h1v2h-1z" />
      <path fill="#000" d="M2 2h1v1H2zM9 2h1v1H9z" />
    </svg>
  );
}

/** Resend's "R": a top bar and bowl with no stem, the leg kicking out from the bowl. */
function ResendMark() {
  return (
    <svg viewBox="0 0 24 24" className="theme-switch-icon" aria-hidden>
      <defs>
        <linearGradient id="resend-r" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0.45" stopColor="#fff" />
          <stop offset="1" stopColor="#9a9a9a" />
        </linearGradient>
      </defs>
      <path
        fill="url(#resend-r)"
        d="M4 4.5h9.2c3.4 0 5.8 2.3 5.8 5.3 0 2.4-1.6 4.3-3.9 5L19.8 20h-4.6l-4.8-5.7c-.4-.5-.1-1.2.5-1.4l1.8-.6c1.4-.4 2.2-1.3 2.2-2.4 0-1.3-1-2.1-2.3-2.1H4z"
      />
    </svg>
  );
}

/**
 * A two-way switch, Claude ⇄ Resend: a pill track with a raised round knob that carries the
 * style's mark and slides to its side, the name showing in the half it leaves free. Neither side
 * is "off", so it reads as which style, not on/off; it sits at the end of each header row.
 */
export default function StyleToggle() {
  const [style, setStyle] = useState<StyleId>(DEFAULT_STYLE);

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    if (isStyle(current)) setStyle(current);
  }, []);

  function toggle() {
    const next: StyleId = style === "resend" ? "claude-dark" : "resend";
    setStyle(next);
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(STYLE_KEY, next);
    } catch {
      /* storage may be unavailable (private mode) — the choice just won't survive a reload */
    }
  }

  const resend = style === "resend";
  const [current, other] = resend ? [STYLES[1], STYLES[0]] : [STYLES[0], STYLES[1]];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={resend}
      aria-label="Resend style"
      title={`${current.label} style — switch to ${other.label}`}
      onClick={toggle}
      data-on={resend}
      className="theme-switch self-center"
    >
      <span className="theme-switch-track">
        <span className="theme-switch-label">{current.label}</span>
      </span>
      <span className="theme-switch-knob">{resend ? <ResendMark /> : <ClaudeMark />}</span>
    </button>
  );
}
