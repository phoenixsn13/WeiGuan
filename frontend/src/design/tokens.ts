// review:PF0-T2  设计 tokens（对应 spec §6）
export const colors = {
  ink: "#14140F",
  cream: "#F7F4EC",
  brand: "#E8A13A",
  accent: "#2C4A7C",
  hairline: "#E4E8F0",
  textPrimary: "#14140F",
  textMuted: "#5B5B52",
  textSubtle: "#7A7468",
  nightScrim: "#070B14",
  contestedFrom: "#B4552F",
} as const;

// review:P7-T4
export const world = {
  surface: "#0F172A",
  line: "#2C4A7C",
  identity: colors.brand,
  influenceUp: "#3E9B6E",
  influenceDown: "#C4553B",
} as const;

export type Sentiment = "positive" | "negative" | "neutral" | "contested";

export function sentimentColor(kind: Sentiment): string {
  switch (kind) {
    case "positive":
      return "#3E9B6E";
    case "negative":
      return "#C4553B";
    case "neutral":
      return "#8A8578";
    case "contested":
      return `linear-gradient(90deg, ${colors.contestedFrom}, ${colors.brand})`;
  }
}

export const POV = { POSTER: "poster", PLATFORM: "platform", KOL: "kol" } as const;
export type PovKind = (typeof POV)[keyof typeof POV];
