import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import RetroScreen from "./RetroScreen";

beforeEach(() => localStorage.setItem("wg_llm_key", "sk-x"));
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

const analysis = {
  diffusion: {
    tree: [
      { post_id: 1, author_id: 1, depth: 0, children: [2] },
      { post_id: 2, author_id: 20, depth: 1, children: [] },
    ],
    max_depth: 1,
    breadth: 1,
    cascade_size: 1,
    key_rebroadcasters: [20],
  },
  opinion: {
    stance_by_tick: [{ tick: "1", stance_counts: { question: 2, analysis: 1 } }],
    convergence_trend: "diverging",
    polarization_index: 0.67,
    homophily: 0.9,
    cross_stance_ratio: 0.1,
    echo_chamber_risk: "high",
  },
  influence: {
    ranking: [{ actor_id: 20, in_degree: 5, centrality: 0.6, structural_influence: 0.6, kcore: 2 }],
    top_leaders: [20],
    iterations: 12,
  },
  temporal: {
    fermentation_curve: [
      { tick: "1", volume: 2, sentiment: "positive" },
      { tick: "2", volume: 5, sentiment: "negative" },
    ],
    peak_tick: 2,
    half_life_ticks: 1,
    sentiment_reversals: [{ tick: "2", from: "positive", to: "negative" }],
  },
};

const snapshot = {
  platform: "twitter",
  seed_post_id: 1,
  actors: [{ user_id: 1, user_name: "财00_韭菜观察员", name: "财00_韭菜观察员" }],
  posts: [{ post_id: 1, author_id: 1, kind: "original", content: "真实历史主帖" }],
  replies: [],
  reactions: [],
  follows: [],
  reports: [],
  traces: [],
};

function WorldProbe() {
  const location = useLocation();
  return <div>{`世界现场${location.pathname}`}</div>;
}

function mount() {
  render(
    <MemoryRouter initialEntries={["/run/r_1/retro"]}>
      <Routes>
        <Route path="/run/:id/retro" element={<RetroScreen />} />
        <Route path="/world/:id/live" element={<WorldProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

function stubFetch(savedInsights: object | null = null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/runs/r_1") {
        return {
          ok: true,
          json: async () => ({
            run_id: "r_1",
            world_id: "w_1",
            content: "真实历史主帖",
            steps: 15,
            platform: "twitter",
            status: "done",
            totals: { replies: 2, reposts: 1, likes: 3 },
          }),
        };
      }
      if (url.endsWith("/analysis")) return { ok: true, json: async () => analysis };
      if (url.endsWith("/snapshot")) throw new Error("retro should not request full snapshot");
      if (url.endsWith("/insights") && savedInsights) {
        return { ok: true, json: async () => savedInsights };
      }
      if (url.endsWith("/insights")) return { ok: false, status: 404, json: async () => ({}) };
      return { ok: true, json: async () => ({}) };
    }),
  );
}

test("retro renders professional analysis tabs and insight cards", async () => {  // review:P8-T7
  stubFetch();
  mount();

  expect(await screen.findByText("围观回放")).toBeInTheDocument();
  expect(screen.getAllByText("传播树").length).toBeGreaterThan(0);
  expect(screen.getAllByText("立场分化").length).toBeGreaterThan(0);
  expect(screen.getAllByText("影响力榜").length).toBeGreaterThan(0);
  expect(screen.getAllByText("情绪时间线").length).toBeGreaterThan(0);
  expect(screen.getAllByText("数据趋势").length).toBeGreaterThan(0);
  expect(screen.getByText("关键传播节点")).toBeInTheDocument();
  expect(screen.getAllByText(/@20/).length).toBeGreaterThan(0);
  expect(screen.queryByText(/第 1 波/)).not.toBeInTheDocument();
});

test("retro switches method-family views", async () => {  // review:P8-T7
  stubFetch();
  mount();

  await screen.findByText("原帖 @1");
  fireEvent.click(screen.getAllByRole("button", { name: "立场分化" })[0]);
  expect(screen.getByText("负向 2")).toBeInTheDocument();

  fireEvent.click(screen.getAllByRole("button", { name: "影响力榜" })[0]);
  expect(screen.getByText("入度 5 · 核心层 2")).toBeInTheDocument();

  fireEvent.click(screen.getAllByRole("button", { name: "情绪时间线" })[0]);
  expect(screen.getByText(/正向 → 负向/)).toBeInTheDocument();
});

test("loads persisted insights and offers regeneration", async () => {  // review:P8-T7
  stubFetch({ verdict: "刷新后还在", suggestions: ["这是持久化建议"] });
  mount();

  expect(await screen.findByText("刷新后还在")).toBeInTheDocument();
  expect(screen.getByText("这是持久化建议")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "重新生成建议" })).toBeInTheDocument();
});

test("links retro back to the multi-platform world when available", async () => {  // review:P11-T6-AC6
  stubFetch();
  mount();

  fireEvent.click(await screen.findByRole("button", { name: "看世界现场" }));
  expect(screen.getByText("世界现场/world/w_1/live")).toBeInTheDocument();
});

test("retro avoids full snapshot fetch and uses summary content", async () => {  // review:P13-T5
  const requests: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requests.push(url);
      if (url === "/api/runs/r_1") {
        return {
          ok: true,
          json: async () => ({
            run_id: "r_1",
            world_id: "w_1",
            content: "摘要里的主帖",
            steps: 15,
            platform: "twitter",
            status: "done",
            poster_person_id: "p_author",
            totals: { replies: 2, reposts: 1, likes: 3 },
          }),
        };
      }
      if (url.endsWith("/analysis")) return { ok: true, json: async () => analysis };
      if (url.endsWith("/insights")) return { ok: false, status: 404, json: async () => ({}) };
      if (url.endsWith("/snapshot")) throw new Error("full snapshot should not be fetched");
      return { ok: true, json: async () => ({}) };
    }),
  );

  mount();

  expect(await screen.findByText("摘要里的主帖")).toBeInTheDocument();
  expect(requests.some((url) => url.endsWith("/snapshot"))).toBe(false);
});
