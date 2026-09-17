import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        base: "#0B0C10",
        surface: "#15161D",
        "surface-raised": "#1C1E28",
        border: "#2A2C38",
        ink: "#F3F3F5",
        "ink-muted": "#9A9AA7",
        "ink-faint": "#6B6C78",
        accent: {
          DEFAULT: "#7C5CFF",
          hover: "#6B4BEF",
          soft: "#7C5CFF1A",
        },
        success: "#3DDC84",
        warning: "#F5B942",
        danger: "#FF5D5D",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-body)", "sans-serif"],
      },
      borderRadius: {
        card: "18px",
        pill: "999px",
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.6)",
      },
      maxWidth: {
        prose: "72ch",
      },
    },
  },
  plugins: [],
};

export default config;
