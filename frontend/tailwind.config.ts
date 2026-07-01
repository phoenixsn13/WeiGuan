import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B1220",
        cream: "#F5F7FB",
        brand: "#F5B12F",
        accent: "#0F6FFF",
        night: "#09111D",
        line: "#E4E8F0",
        sentiment: {
          positive: "#3E9B6E",
          negative: "#C4553B",
          neutral: "#8A8578",
          contestedFrom: "#B4552F",
          contestedTo: "#E8A13A",
        },
      },
      fontFamily: {
        display: ['"Noto Sans SC"', "system-ui", "sans-serif"],
        body: ['"Noto Sans SC"', "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: { card: "8px" },
      boxShadow: {
        spotlight:
          "0 18px 45px -28px rgba(15,23,42,0.45), 0 0 0 1px rgba(15,23,42,0.06)",
        chrome: "0 18px 60px -32px rgba(9,17,29,0.55)",
      },
    },
  },
  plugins: [],
} satisfies Config;
