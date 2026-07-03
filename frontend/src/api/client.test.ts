import {
  createMultiRun,
  createRun,
  fetchCrowds,
  fetchInsights,
  createPerson,
  getIdentities,
  listPersons,
  previewCost,
  fetchRetro,
  fetchRunSummary,
  fetchRunSnapshot,
  fetchRuns,
  getWorldEvents,
  fetchSavedInsights,
  getAnalysis,
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

test("fetchRunSummary gets one run before events arrive", async () => {  // review:UI-P12-AC3
  const spy = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      run_id: "r_1",
      content: "刚写下的正文",
      steps: 500,
      platform: "twitter",
      status: "created",
      totals: {},
    }),
  }));
  vi.stubGlobal("fetch", spy);

  const summary = await fetchRunSummary("r_1");

  expect(summary.content).toBe("刚写下的正文");
  expect(summary.steps).toBe(500);
  expect(spy).toHaveBeenCalledWith("/api/runs/r_1");
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

test("createMultiRun posts UI-friendly multi-platform body", async () => {  // review:P11-T5-AC1
  const spy = vi.fn(async () => ({
    ok: true,
    json: async () => ({ world_id: "w_multi" }),
  }));
  vi.stubGlobal("fetch", spy);

  const result = await createMultiRun(
    {
      audience: { crowd_id: "tech_devs" },
      content: "多平台发酵",
      steps: 10,
      persona: "kol",
      platforms: ["twitter", "reddit"],
      world_id: "w_1",
      poster_person_id: "p_author",
      person_memory_budget: 4,
    },
    { key: "sk-x", model: "m" },
  );

  expect(result.world_id).toBe("w_multi");
  const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("/api/multi-runs");
  expect((init.headers as Record<string, string>)["X-LLM-Key"]).toBe("sk-x");
  expect(JSON.parse(init.body as string)).toMatchObject({
    content: "多平台发酵",
    persona: "kol",
    platforms: ["twitter", "reddit"],
    world_id: "w_1",
    poster_person_id: "p_author",
  });
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

test("fetchSavedInsights reads persisted suggestions", async () => {  // review:UI-P16-AC2
  const spy = vi.fn(async () => ({
    ok: true,
    json: async () => ({ verdict: "已保存", suggestions: ["继续观察"] }),
  }));
  vi.stubGlobal("fetch", spy);
  const insights = await fetchSavedInsights("r_1");
  expect(insights).not.toBeNull();
  expect(insights?.verdict).toBe("已保存");
  expect(spy).toHaveBeenCalledWith("/api/runs/r_1/insights");
});

test("identity APIs call person endpoints", async () => {  // review:P7-T5-AC1
  const spy = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      world_id: "w_1",
      person: { person_id: "p_1", display_name: "财经大号", accounts: [] },
    }),
  }));
  vi.stubGlobal("fetch", spy);

  await createPerson({
    world_id: "w_1",
    display_name: "财经大号",
    persona_kind: "kol",
    platform: "twitter",
    handle: "finance_kol",
  });

  const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("/api/persons");
  expect(JSON.parse(init.body as string).persona_kind).toBe("kol");
});

test("listPersons and previewCost hit backend contracts", async () => {  // review:P7-T5-AC2
  const spy = vi.fn(async (url: string) => ({
    ok: true,
    json: async () =>
      url.includes("preview-cost")
        ? { estimated_rmb: 1.23, budgeted_agents: 8, decision_steps: 9 }
        : { persons: [] },
  }));
  vi.stubGlobal("fetch", spy);

  await listPersons("w_1");
  const cost = await previewCost({
    steps: 10,
    llm_max_agents: 8,
    attention_comment_budget: 12,
    person_memory_budget: 4,
  });

  expect(spy.mock.calls[0][0]).toBe("/api/worlds/w_1/persons");
  expect(String(spy.mock.calls[1][0])).toContain("/api/runs/preview-cost?");
  expect(cost.estimated_rmb).toBe(1.23);
});

test("getIdentities reads global persistent identity list", async () => {  // review:P7-T12-AC1
  const spy = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      identities: [
        {
          world_id: "w_1",
          person_id: "p_author",
          display_name: "财经大号",
          persona_kind: "kol",
          total_influence: 56,
          run_count: 2,
        },
      ],
    }),
  }));
  vi.stubGlobal("fetch", spy);

  const identities = await getIdentities();

  expect(spy).toHaveBeenCalledWith("/api/identities");
  expect(identities[0].world_id).toBe("w_1");
  expect(identities[0].person_id).toBe("p_author");
});

test("getWorldEvents reads persisted world timeline frames", async () => {  // review:P11-T4-AC1
  const spy = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      frames: [
        {
          event_id: "e_1",
          world_id: "w_1",
          tick: 1,
          created_at: "2026-07-03T01:00:00Z",
          platform: "twitter",
          actor_account_id: "acct-twitter-poster",
          kind: "seed",
          payload: { post_id: 1, author_id: 1, content: "微博主帖" },
          run_id: "r_1",
        },
      ],
    }),
  }));
  vi.stubGlobal("fetch", spy);

  const events = await getWorldEvents("w_1");

  expect(spy).toHaveBeenCalledWith("/api/worlds/w_1/events");
  expect(events[0].event_id).toBe("e_1");
});

test("getAnalysis reads professional social analysis projection", async () => {  // review:P8-T7
  const spy = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      diffusion: { tree: [], max_depth: 0, breadth: 0, cascade_size: 0, key_rebroadcasters: [] },
      opinion: {
        stance_by_tick: [],
        convergence_trend: "stable",
        polarization_index: 0,
        homophily: 0,
        cross_stance_ratio: 0,
        echo_chamber_risk: "low",
      },
      influence: { ranking: [], top_leaders: [], iterations: 0 },
      temporal: {
        fermentation_curve: [],
        peak_tick: 0,
        half_life_ticks: 0,
        sentiment_reversals: [],
      },
    }),
  }));
  vi.stubGlobal("fetch", spy);

  const analysis = await getAnalysis("r_1");

  expect(spy).toHaveBeenCalledWith("/api/runs/r_1/analysis");
  expect(analysis.opinion.echo_chamber_risk).toBe("low");
});
