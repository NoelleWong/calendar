import type { Config } from "tailwindcss";

// Design tokens — see CLAUDE.md. This is a data-density tool, not a
// marketing page: chrome stays quiet and neutral so user-defined project
// colors (the actual content) are what carries visual weight.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F1F2EF", // page background
        surface: "#FFFFFF", // grid/card background
        ink: "#1B1D1B", // primary text
        graphite: "#5B5E59", // secondary text
        line: "#E1E3DE", // hairlines, slot dividers
        gap: "#F1F2EF", // the fixed-width gap between bubbles = canvas color
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        bubble: "999px",
      },
      spacing: {
        slot: "1.5rem", // height of one 30-min slot at default zoom
      },
    },
  },
  plugins: [],
};

export default config;
