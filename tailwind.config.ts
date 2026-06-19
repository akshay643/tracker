import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0b1020",
        panel: "#11182e",
        panel2: "#161f3a",
        edge: "#243056",
        accent: "#6366f1",
        accent2: "#22d3ee",
        good: "#22c55e",
        warn: "#f59e0b",
        bad: "#ef4444",
        muted: "#8a93b2",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        hud: "0 10px 40px -12px rgba(99,102,241,0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
