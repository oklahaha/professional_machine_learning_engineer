"use client";

import { useEffect, useState } from "react";

// A display preference, not study state: it belongs to no source, so it has its own key.
const STORAGE_KEY = "ui-motion-v1";

/**
 * Pauses the animated backdrop (.cosmos in app/layout.tsx). It moves for as long as a page is
 * open, so it needs an off switch beyond prefers-reduced-motion. The switch sets
 * `data-motion="off"` on <html>, and globals.css pauses every backdrop animation in place.
 */
export default function MotionToggle() {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let stored = false;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY) === "off";
    } catch {
      /* storage may be unavailable (private mode) — ignore */
    }
    setPaused(stored);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.motion = paused ? "off" : "on";
  }, [paused]);

  function toggle() {
    const next = !paused;
    setPaused(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "off" : "on");
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={paused}
      className="hud-label rounded-md px-3 py-2 transition hover:text-paper"
    >
      {paused ? "Resume background motion" : "Pause background motion"}
    </button>
  );
}
