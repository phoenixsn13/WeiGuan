import {
  createRun,
  fetchCrowds,
  fetchInsights,
  fetchRetro,
  interviewActor,
} from "./client";

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
  const [, init] = spy.mock.calls[0] as unknown as [unknown, RequestInit];
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

test("interviewActor posts with key header", async () => {  // review:P5-T3-AC1
  const spy = vi.fn(async () => ({
    ok: true,
    json: async () => ({ answer: "因为..." }),
  }));
  vi.stubGlobal("fetch", spy);
  const result = await interviewActor("r_1", 2, "为什么?", { key: "sk", model: "m" });
  expect(result.answer).toBe("因为...");
  const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toContain("/api/runs/r_1/interview");
  expect((init.headers as Record<string, string>)["X-LLM-Key"]).toBe("sk");
});

test("fetchRetro gets metrics", async () => {  // review:P5-T3-AC2
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        sentiment: { positive: 2, negative: 1, neutral: 3 },
        spread_by_step: [1, 2],
        totals: { likes: 2 },
      }),
    })),
  );
  const metrics = await fetchRetro("r_1");
  expect(metrics.sentiment.positive).toBe(2);
});

test("fetchInsights posts with key", async () => {  // review:P5-T3-AC3
  const spy = vi.fn(async () => ({
    ok: true,
    json: async () => ({ verdict: "偏正向", suggestions: ["加实测"] }),
  }));
  vi.stubGlobal("fetch", spy);
  const insights = await fetchInsights("r_1", { key: "sk", model: "m" });
  expect(insights.verdict).toBe("偏正向");
});
