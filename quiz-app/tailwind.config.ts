import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Deep-space base. Panels are tinted toward cyan so glass reads as "lit" rather than grey.
        ink: "#04050D",
        ink2: "#080C1C",
        panel: "#0C1228",
        panel2: "#121A38",
        line: "#1D2B55",
        linestrong: "#2D4280",
        mist: "#8E9CC8",
        paper: "#EEF3FF",
        paperdim: "#C6CFEB",
        // Electric cyan: the interactive/"system" accent. Kept clearly bluer than `correct`
        // so a selected option never reads as a right answer.
        signal: "#2EE6FF",
        correct: "#34E3A8",
        wrong: "#FF6B81",
        amber: "#FFB547",
        iris: "#A88BFF",
        // Decorative magenta — glows, gradients, nebula. Never a verdict colour.
        plasma: "#D66BFF",
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
