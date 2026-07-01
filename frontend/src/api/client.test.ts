import { createRun, fetchCrowds } from "./client";

afterEach(() => vi.restoreAllMocks());

test("fetchCrowds hits /api/crowds", async () => {  // review:P4-T4-AC1
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => [{ id: "tech_devs", name: "科技", emoji: "T", blurb: "b" }],
    })),
  );
  const crowds = await fetchCrowds();
  expect(crowds[0].id).toBe("tech_devs");
});

test("createRun posts with BYOK headers", async () => {  // review:P4-T4-AC2
  const spy = vi.fn(async () => ({
    ok: true,
    json: async () => ({ run_id: "r_1" }),
  }));
  vi.stubGlobal("fetch", spy);
  const res = await createRun(
    {
      audience: { crowd_id: "tech_devs" },
      content: "hi",
      steps: 10,
      platform: "twitter",
    },
    { key: "sk-x", model: "gpt-4o-mini" },
  );
  expect(res.run_id).toBe("r_1");
  const [, init] = spy.mock.calls[0];
  expect((init.headers as Record<string, string>)["X-LLM-Key"]).toBe("sk-x");
});

test("createRun throws on error", async () => {  // review:P4-T4-AC3
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: false,
      json: async () => ({ detail: "steps must be one of 6/10/15" }),
    })),
  );
  await expect(
    createRun(
      { audience: { crowd_id: "t" }, content: "x", steps: 3, platform: "twitter" },
      { key: "k", model: "m" },
    ),
  ).rejects.toThrow(/steps/);
});
