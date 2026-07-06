import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import LaunchRetroScreen from "./LaunchRetroScreen";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

const twitterAnalysis = {
  diffusion: { tree: [{ post_id: 1, author_id: 1, depth: 0, children: [] }], max_depth: 1, breadth: 1, cascade_size: 1, key_rebroadcasters: [] },
  opinion: { stance_by_tick: [{ tick: "1", stance_counts: { support: 2 } }], convergence_trend: "stable", polarization_index: 0.1, homophily: 0.2, cross_stance_ratio: 0.8, echo_chamber_risk: "low" },
  influence: { ranking: [{ actor_id: 2, in_degree: 1, centrality: 0.2, structural_influence: 0.2, kcore: 1 }], top_leaders: [2], iterations: 1 },
  temporal: { fermentation_curve: [{ tick: "1", volume: 3, sentiment: "positive" }], peak_tick: 1, half_life_ticks: 1, sentiment_reversals: [] },
};

const redditAnalysis = {
  ...twitterAnalysis,
  diffusion: { tree: [{ post_id: 2, author_id: 1, depth: 0, children: [3] }], max_depth: 2, breadth: 2, cascade_size: 2, key_rebroadcasters: [3] },
  temporal: { fermentation_curve: [{ tick: "1", volume: 5, sentiment: "negative" }], peak_tick: 1, half_life_ticks: 1, sentiment_reversals: [] },
};

function LocationProbe() {
  const location = useLocation();
  return <div>{`位置${location.pathname}${location.search}`}</div>;
}

function mount(path = "/world/w_1/retro?launch=launch_1") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/world/:id/retro" element={<LaunchRetroScreen />} />
        <Route path="/world/:id/live" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

function stubFetch(events: object[] = []) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/launches") {
        return {
          ok: true,
          json: async () => ({
            launches: [
              {
                launch_id: "launch_1",
                kind: "multi",
                world_id: "w_1",
                content: "跨平台复盘主题",
                steps: 15,
                platforms: ["twitter", "reddit"],
                run_ids: ["run-twitter", "run-reddit"],
                status: "done",
                clock_tick: 15,
                created_at: "2026-07-04T08:00:00Z",
              },
            ],
          }),
        };
      }
      if (url === "/api/runs/run-twitter") {
        return {
          ok: true,
          json: async () => ({
            run_id: "run-twitter",
            world_id: "w_1",
            content: "微博侧内容",
            steps: 15,
            platform: "twitter",
            status: "done",
            totals: { replies: 3, reposts: 1, likes: 8 },
          }),
        };
      }
      if (url === "/api/runs/run-reddit") {
        return {
          ok: true,
          json: async () => ({
            run_id: "run-reddit",
            world_id: "w_1",
            content: "Reddit 侧内容",
            steps: 15,
            platform: "reddit",
            status: "done",
            totals: { replies: 5, reposts: 0, likes: 2 },
          }),
        };
      }
      if (url === "/api/runs/run-twitter/analysis") return { ok: true, json: async () => twitterAnalysis };
      if (url === "/api/runs/run-reddit/analysis") return { ok: true, json: async () => redditAnalysis };
      if (url.endsWith("/insights")) return { ok: false, status: 404, json: async () => ({}) };
      if (url === "/api/worlds/w_1/events?run_id=run-twitter&run_id=run-reddit") {
        return {
          ok: true,
          json: async () => ({ frames: events, next_after: 2, clock_tick: 2, launch_status: "done" }),
        };
      }
      if (url === "/api/runs/run-twitter/flavor?world_id=w_1") {
        return {
          ok: true,
          json: async () => ({
            world_id: "w_1",
            run_ids: ["run-twitter", "run-reddit"],
            platforms: [
              { platform: "twitter", spread_shape: "单源爆发", volume: 3, persona_mix: { ordinary: 2 }, phases: [] },
              { platform: "reddit", spread_shape: "链式讨论", volume: 5, persona_mix: { ordinary: 3 }, phases: [] },
            ],
            cross_platform_notes: ["微博先起量，Reddit 后续深挖证据。"],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    }),
  );
}

test("launch retro switches platform tabs and loads the selected run analysis", async () => {  // review:P13-T6
  stubFetch();
  mount();

  expect(await screen.findByText("跨平台复盘主题")).toBeInTheDocument();
  expect(await screen.findByText(/微博侧内容/)).toBeInTheDocument();
  expect(screen.getByText(/3\s*条互动/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Reddit" }));

  expect(await screen.findByText(/Reddit 侧内容/)).toBeInTheDocument();
  expect(screen.getByText(/5\s*条互动/)).toBeInTheDocument();
});

test("launch retro renders bridge notes and an honest empty bridge state", async () => {  // review:P13-T6
  stubFetch([
    {
      event_id: "bridge-1",
      world_id: "w_1",
      tick: 2,
      created_at: "2026-07-04T08:00:00Z",
      platform: "reddit",
      actor_account_id: "acct_1",
      kind: "bridge_inject",
      payload: { source_platform: "twitter", content: "微博观点被带到 Reddit 继续讨论" },
      run_id: "run-reddit",
    },
  ]);
  mount();

  expect(await screen.findByText("桥接摘要")).toBeInTheDocument();
  expect(screen.getByText(/微博观点被带到 Reddit 继续讨论/)).toBeInTheDocument();
  expect(screen.getByText("微博先起量，Reddit 后续深挖证据。")).toBeInTheDocument();

  stubFetch([]);
  mount("/world/w_1/retro?launch=launch_1");
  expect(await screen.findAllByText("暂无跨平台桥接。")).toHaveLength(1);
});
