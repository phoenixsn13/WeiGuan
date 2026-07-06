import type { Config } from "tailwindcss";
import { colors, sentimentColor, world } from "./src/design/tokens";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: colors.ink,
        cream: colors.cream,
        brand: colors.brand,
        accent: colors.accent,
        accentSoft: colors.accentSoft,
        warnSoft: colors.warnSoft,
        warnBorder: colors.warnBorder,
        warnInk: colors.warnInk,
        muted: colors.textMuted,
        subtle: colors.textSubtle,
        night: world.surface,
        nightScrim: colors.nightScrim,
        line: colors.hairline,
        sentiment: {
          positive: sentimentColor("positive"),
          negative: sentimentColor("negative"),
          neutral: sentimentColor("neutral"),
          contestedFrom: colors.contestedFrom,
          contestedTo: colors.brand,
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
