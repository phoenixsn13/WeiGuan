import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14140F",
        cream: "#F7F4EC",
        brand: "#E8A13A",
        accent: "#2C4A7C",
        sentiment: {
          positive: "#3E9B6E",
          negative: "#C4553B",
          neutral: "#8A8578",
          contestedFrom: "#B4552F",
          contestedTo: "#E8A13A",
        },
      },
      fontFamily: {
        display: ['"Noto Serif SC"', "serif"],
        body: ['"Noto Sans SC"', "system-ui", "sans-serif"],
      },
      borderRadius: { card: "8px" },
      boxShadow: {
        spotlight:
          "0 6px 20px -8px rgba(20,20,15,0.35), 0 0 0 1px rgba(232,161,58,0.15)",
      },
    },
  },
  plugins: [],
} satisfies Config;
