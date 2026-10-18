import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Role tokens, not fixed colours: each is an `r g b` triple set per theme in globals.css
        // (:root is the deep-space default; the style switcher swaps the rest). Deep-space base:
        // panels are tinted toward cyan so glass reads as "lit" rather than grey.
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        ink2: "rgb(var(--c-ink2) / <alpha-value>)",
        panel: "rgb(var(--c-panel) / <alpha-value>)",
        panel2: "rgb(var(--c-panel2) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
        linestrong: "rgb(var(--c-linestrong) / <alpha-value>)",
        mist: "rgb(var(--c-mist) / <alpha-value>)",
        paper: "rgb(var(--c-paper) / <alpha-value>)",
        paperdim: "rgb(var(--c-paperdim) / <alpha-value>)",
        // Electric cyan: the interactive/"system" accent. Kept clearly bluer than `correct`
        // so a selected option never reads as a right answer.
        signal: "rgb(var(--c-signal) / <alpha-value>)",
        correct: "rgb(var(--c-correct) / <alpha-value>)",
        wrong: "rgb(var(--c-wrong) / <alpha-value>)",
        amber: "rgb(var(--c-amber) / <alpha-value>)",
        iris: "rgb(var(--c-iris) / <alpha-value>)",
        // Decorative magenta — glows, gradients, nebula. Never a verdict colour.
        plasma: "rgb(var(--c-plasma) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        "cell-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "verdict-in": {
          from: { opacity: "0", transform: "translateY(-4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "cell-in": "cell-in 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
        "verdict-in": "verdict-in 0.25s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
