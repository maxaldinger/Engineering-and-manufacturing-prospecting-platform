import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        background: "#f6f8fb",
        surface: "#ffffff",
        "surface-2": "#eef2f7",
        border: "#dbe2ec",
        "border-strong": "#b8c4d4",
        "text-primary": "#0f1f3a",
        "text-secondary": "#475569",
        "text-muted": "#94a3b8",
        navy: {
          DEFAULT: "#0f2a56",
          deep: "#0a1f42",
          soft: "#1e3a6c",
        },
        primary: {
          DEFAULT: "#1e9bcb",
          hover: "#1881ad",
          subtle: "#e0f2fa",
          deep: "#0f2a56",
        },
        signal: {
          job: "#059669",
          news: "#2563eb",
          gov: "#d97706",
          tech: "#0f2a56",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "pulse-soft": "pulse-soft 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
