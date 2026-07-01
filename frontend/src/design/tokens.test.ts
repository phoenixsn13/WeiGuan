import { POV, colors, sentimentColor } from "./tokens";

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
