import tailwindConfigSource from "../../tailwind.config.ts?raw";
import tailwindConfig from "../../tailwind.config";
import { POV, colors, sentimentColor, world } from "./tokens";

function relativeLuminance(hex: string): number {
  const [r, g, b] = hex
    .slice(1)
    .match(/../g)!
    .map((part) => parseInt(part, 16) / 255)
    .map((channel) => (
      channel <= 0.03928
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4
    ));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: string): number {
  const fg = relativeLuminance(foreground);
  const bg = relativeLuminance(background);
  return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
}

test("brand and accent tokens match spec §6", () => {  // review:PF0-T2-AC1
  expect(colors.brand).toBe("#E8A13A");
  expect(colors.accent).toBe("#2C4A7C");
  expect(colors.ink).toBe("#14140F");
});

test("sentiment colors map correctly", () => {  // review:PF0-T2-AC2
  expect(sentimentColor("positive")).toBe("#3E9B6E");
  expect(sentimentColor("negative")).toBe("#C4553B");
  expect(sentimentColor("neutral")).toBe("#8A8578");
  expect(sentimentColor("contested")).toContain("gradient");
});

test("POV enum reserves three lenses, poster first", () => {  // review:PF0-T2-AC3
  expect(POV.POSTER).toBe("poster");
  expect(Object.values(POV)).toEqual(["poster", "platform", "kol"]);
});

test("world layer tokens use locked palette", () => {  // review:P7-T4-AC1
  const hex = /^#[0-9A-F]{6}$/i;
  expect(world.identity).toBe(colors.brand);
  expect(world.surface).toMatch(hex);
  expect(world.line).toMatch(hex);
  expect(world.influenceUp).toMatch(hex);
  expect(world.influenceDown).toMatch(hex);
  expect(sentimentColor("positive")).toBe("#3E9B6E");
});

test("semantic text and scrim tokens are explicit hex values", () => {  // review:P13-T8-AC1
  const hex = /^#[0-9A-F]{6}$/i;
  expect(colors.textPrimary).toMatch(hex);
  expect(colors.textMuted).toMatch(hex);
  expect(colors.textSubtle).toMatch(hex);
  expect(colors.nightScrim).toMatch(hex);
  expect(colors.textPrimary).toBe(colors.ink);
  expect(contrastRatio(colors.textMuted, colors.cream)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(colors.textSubtle, colors.cream)).toBeGreaterThanOrEqual(3);
});

test("tailwind color palette is sourced from design tokens", () => {  // review:P13-T8-AC2
  expect(tailwindConfigSource).not.toMatch(/#[0-9A-Fa-f]{6}/);
  expect(tailwindConfigSource).toContain('from "./src/design/tokens"');
});

test("tailwind line keeps light shell hairline separate from world connector line", () => {  // review:P13-T8-AC3
  const palette = tailwindConfig.theme.extend.colors;
  expect(colors.hairline).toBe("#E4E8F0");
  expect(world.line).toBe("#2C4A7C");
  expect(palette.line).toBe(colors.hairline);
  expect(palette.line).not.toBe(world.line);
  expect(palette.sentiment.contestedFrom).toBe("#B4552F");
});
