import {
  createRun,
  fetchCrowds,
  fetchInsights,
  fetchRetro,
  fetchRunSnapshot,
  fetchRuns,
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

test("fetchRuns gets historical run summaries", async () => {  // review:UI-P1-AC2
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          run_id: "r_1",
          content: "构建砍到3秒",
          steps: 6,
          platform: "twitter",
          status: "done",
          totals: { replies: 3, reposts: 1 },
        },
      ],
    })),
  );
  const runs = await fetchRuns();
  expect(runs[0].run_id).toBe("r_1");
  expect(runs[0].totals.replies).toBe(3);
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

test("createRun sends optional LLM provider headers only when present", async () => {  // review:PA-T3-AC1
  const spy = vi.fn(async () => ({
    ok: true,
    json: async () => ({ run_id: "r_1" }),
  }));
  vi.stubGlobal("fetch", spy);
  const body = {
    audience: { crowd_id: "tech_devs" },
    content: "hi",
    steps: 10,
    platform: "twitter" as const,
  };

  await createRun(body, {
    key: "sk-x",
    model: "deepseek-v4-pro",
    baseUrl: "https://api.deepseek.com",
    reasoningEffort: "high",
    thinking: "enabled",
  });
  await createRun(body, { key: "sk-x", model: "deepseek-v4-pro" });

  const [, initWithProvider] = spy.mock.calls[0] as unknown as [unknown, RequestInit];
  const headersWithProvider = initWithProvider.headers as Record<string, string>;
  expect(headersWithProvider["X-LLM-Base-Url"]).toBe("https://api.deepseek.com");
  expect(headersWithProvider["X-LLM-Reasoning-Effort"]).toBe("high");
  expect(headersWithProvider["X-LLM-Thinking"]).toBe("enabled");

  const [, initWithoutProvider] = spy.mock.calls[1] as unknown as [unknown, RequestInit];
  const headersWithoutProvider = initWithoutProvider.headers as Record<string, string>;
  expect(headersWithoutProvider).not.toHaveProperty("X-LLM-Base-Url");
  expect(headersWithoutProvider).not.toHaveProperty("X-LLM-Reasoning-Effort");
  expect(headersWithoutProvider).not.toHaveProperty("X-LLM-Thinking");
});

test("createRun omits blank LLM headers so backend env defaults can apply", async () => {  // review:PA-T5-AC2
  const spy = vi.fn(async () => ({
    ok: true,
    json: async () => ({ run_id: "r_1" }),
  }));
  vi.stubGlobal("fetch", spy);

  await createRun(
    {
      audience: { crowd_id: "tech_devs" },
      content: "hi",
      steps: 10,
      platform: "twitter",
    },
    {
      key: "",
      model: "",
      baseUrl: "",
      reasoningEffort: "",
      thinking: "",
    },
  );

  const [, init] = spy.mock.calls[0] as unknown as [unknown, RequestInit];
  const headers = init.headers as Record<string, string>;
  expect(headers).not.toHaveProperty("X-LLM-Key");
  expect(headers).not.toHaveProperty("X-LLM-Model");
  expect(headers).not.toHaveProperty("X-LLM-Base-Url");
  expect(headers).not.toHaveProperty("X-LLM-Reasoning-Effort");
  expect(headers).not.toHaveProperty("X-LLM-Thinking");
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

test("fetchRunSnapshot loads saved snapshot without events stream", async () => {  // review:UI-P1-AC6
  const spy = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      platform: "twitter",
      seed_post_id: 1,
      actors: [],
      posts: [],
      replies: [],
      reactions: [],
      follows: [],
      reports: [],
      traces: [],
    }),
  }));
  vi.stubGlobal("fetch", spy);
  const snapshot = await fetchRunSnapshot("r_1");
  expect(snapshot.seed_post_id).toBe(1);
  expect(spy).toHaveBeenCalledWith("/api/runs/r_1/snapshot");
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
