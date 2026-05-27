/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0B0E14",
        surface: "#12161F",
        "surface-alt": "#181D28",
        card: "#1A1F2B",
        "card-hover": "#1E2433",
        border: "#252B3A",
        "border-light": "#313848",
        accent: "#4F8BF5",
        "accent-dim": "rgba(79,139,245,0.10)",
        green: "#34D399",
        "green-dim": "rgba(52,211,153,0.10)",
        amber: "#FBBF24",
        "amber-dim": "rgba(251,191,36,0.10)",
        red: "#F87171",
        purple: "#A78BFA",
        "purple-dim": "rgba(167,139,250,0.10)",
        "text-primary": "#E2E6EF",
        "text-muted": "#8891A5",
        "text-dim": "#555D73",
      },
      fontFamily: {
        sans: ["Instrument Sans", "DM Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
