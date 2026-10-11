import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B1120",
        ink2: "#0F1728",
        panel: "#141D33",
        panel2: "#1B2740",
        line: "#26324D",
        linestrong: "#35446A",
        mist: "#8895B3",
        paper: "#EAEEF9",
        paperdim: "#C3CBE0",
        signal: "#3DE0B4",
        correct: "#34E3A8",
        wrong: "#FF6B81",
        amber: "#FFC24B",
        iris: "#7C9CFF",
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
