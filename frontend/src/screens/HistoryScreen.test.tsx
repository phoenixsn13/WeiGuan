import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import HistoryScreen from "./HistoryScreen";

afterEach(() => vi.restoreAllMocks());

function LocationProbe() {
  const location = useLocation();
  return <div>{`评论区${location.pathname}${location.search}`}</div>;
}

function WorldProbe() {
  const location = useLocation();
  return <div>{`世界现场${location.pathname}${location.search}`}</div>;
}

function IdentityProbe() {
  const location = useLocation();
  return <div>{`身份页${location.pathname}${location.search}`}</div>;
}

function mount() {
  render(
    <MemoryRouter initialEntries={["/history"]}>
      <Routes>
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="/run/:id/live" element={<LocationProbe />} />
        <Route path="/run/:id/retro" element={<div>回放页</div>} />
        <Route path="/world/:id/live" element={<WorldProbe />} />
        <Route path="/world/:id/retro" element={<WorldProbe />} />
        <Route path="/identity/:personId" element={<IdentityProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

test("renders a structured skeleton while loading history", () => {  // review:P13-T7
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));

  mount();

  expect(screen.getByTestId("history-skeleton")).toBeInTheDocument();
  expect(screen.queryByText("正在加载历史记录…")).not.toBeInTheDocument();
});

test("renders historical runs and opens live view", async () => {  // review:UI-P1-AC3
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
          totals: { replies: 3, reposts: 1, likes: 8 },
        },
      ],
    })),
  );

  mount();

  expect(await screen.findByText("历史记录")).toBeInTheDocument();
  expect(screen.getByText("构建砍到3秒")).toBeInTheDocument();
  fireEvent.click(screen.getByText("看评论区"));
  expect(screen.getByText("评论区/run/r_1/live?replay=1")).toBeInTheDocument();
});

test("shows shared hot topics from saved runs", async () => {  // review:UI-P11-AC3
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          run_id: "r_1",
          content: "spacex股价怎么回事啊",
          steps: 15,
          platform: "twitter",
          status: "done",
          totals: { replies: 13, reposts: 1, likes: 6 },
        },
      ],
    })),
  );

  mount();

  expect(await screen.findByText("围观热榜")).toBeInTheDocument();
  expect(screen.getAllByText("#spacex股价怎么回事啊").length).toBeGreaterThan(0);
});

test("history cards keep actions in a fixed right column", async () => {  // review:UI-P11-AC6
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          run_id: "r_1",
          content: "今天meta说要建数据中心，把闲置的AI算力做成云服务，这明显就是AI泡沫破裂的前奏",
          steps: 15,
          platform: "twitter",
          status: "running",
          totals: { replies: 10, reposts: 0, likes: 4 },
        },
      ],
    })),
  );

  mount();

  const layout = await screen.findByTestId("history-run-card-layout");
  expect(layout.className).toContain("sm:grid-cols-[minmax(0,1fr)_auto]");
});

test("opens replay from historical run", async () => {  // review:UI-P1-AC4
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
          totals: { replies: 3, reposts: 1, likes: 8 },
        },
      ],
    })),
  );

  mount();

  fireEvent.click(await screen.findByText("看回放"));
  expect(screen.getByText("回放页")).toBeInTheDocument();
});

test("groups historical runs under persistent identities", async () => {  // review:P7-T6-AC4
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => {
        if (url === "/api/runs") {
          return [
            {
              run_id: "r_1",
              world_id: "w_1",
              content: "第一条",
              steps: 10,
              platform: "twitter",
              status: "done",
              created_at: "2026-07-01T08:00:00Z",
              totals: { replies: 3, reposts: 1, likes: 8 },
            },
            {
              run_id: "r_2",
              world_id: "w_1",
              content: "第二条",
              steps: 15,
              platform: "twitter",
              status: "done",
              created_at: "2026-07-02T08:00:00Z",
              totals: { replies: 4, reposts: 0, likes: 2 },
            },
          ];
        }
        return {
          persons: [
            {
              person: {
                person_id: "p_author",
                display_name: "财经大号",
                persona_kind: "kol",
                accounts: [
                  {
                    account_id: "acct_1",
                    person_id: "p_author",
                    platform: "twitter",
                    handle: "finance_kol",
                    avatar_seed: "p_author",
                    num_followers: 50000,
                    influence_score: 50,
                  },
                ],
              },
              stance: { stance_counts: {}, dominant: "other" },
              total_influence: 56,
              run_ids: ["r_1", "r_2"],
            },
          ],
        };
      },
    })),
  );

  mount();

  expect(await screen.findByText("财经大号")).toBeInTheDocument();
  expect(screen.getByText("2 次围观")).toBeInTheDocument();
  expect(screen.getByText("第二条")).toBeInTheDocument();
  expect(screen.getByText("第一条")).toBeInTheDocument();
});

test("opens identity page from historical author name", async () => {  // review:P14-T7
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => {
        if (url === "/api/runs") {
          return [
            {
              run_id: "r_1",
              world_id: "w_1",
              content: "第一条",
              steps: 10,
              platform: "twitter",
              status: "done",
              created_at: "2026-07-01T08:00:00Z",
              totals: { replies: 3, reposts: 1, likes: 8 },
            },
          ];
        }
        return {
          persons: [
            {
              person: {
                person_id: "p_author",
                display_name: "财经大号",
                persona_kind: "kol",
                accounts: [],
              },
              stance: { stance_counts: {}, dominant: "other" },
              total_influence: 56,
              run_ids: ["r_1"],
              standing_timeline: [],
            },
          ],
        };
      },
    })),
  );

  mount();

  const entry = await screen.findByRole("button", { name: "财经大号" });
  expect(document.body.textContent).not.toMatch(/[0-9a-f]{12,}/);
  fireEvent.click(entry);
  expect(screen.getByText("身份页/identity/p_author?world_id=w_1")).toBeInTheDocument();
});

test("links identity history groups to the multi-platform world", async () => {  // review:P11-T6-AC4
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => {
        if (url === "/api/runs") {
          return [
            {
              run_id: "r_1",
              world_id: "w_1",
              content: "跨平台内容",
              steps: 15,
              platform: "twitter",
              status: "done",
              created_at: "2026-07-01T08:00:00Z",
              totals: { replies: 3, reposts: 1, likes: 8 },
            },
          ];
        }
        return {
          persons: [
            {
              person: {
                person_id: "p_author",
                display_name: "财经大号",
                persona_kind: "kol",
                accounts: [],
              },
              stance: { stance_counts: {}, dominant: "other" },
              total_influence: 56,
              run_ids: ["r_1"],
              standing_timeline: [],
            },
          ],
        };
      },
    })),
  );

  mount();

  fireEvent.click(await screen.findByRole("button", { name: "看多平台现场" }));
  expect(screen.getByText("世界现场/world/w_1/live")).toBeInTheDocument();
});

test("renders multi-platform launches with run-scoped live and platform links", async () => {  // review:P13-T4
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => {
        if (url === "/api/launches") {
          return {
            launches: [
              {
                launch_id: "launch_1",
                kind: "multi",
                world_id: "w_1",
                content: "跨平台内容",
                steps: 15,
                platforms: ["twitter", "reddit"],
                run_ids: ["run-twitter", "run-reddit"],
                status: "done",
                clock_tick: 15,
                poster_person_id: "p_author",
                poster_persona: "kol",
                created_at: "2026-07-04T08:00:00Z",
              },
            ],
          };
        }
        if (url === "/api/runs") {
          return [
            {
              run_id: "run-twitter",
              world_id: "w_1",
              poster_person_id: "p_author",
              content: "跨平台内容",
              steps: 15,
              platform: "twitter",
              status: "done",
              created_at: "2026-07-04T08:00:00Z",
              totals: { replies: 3, reposts: 1, likes: 8 },
            },
            {
              run_id: "run-reddit",
              world_id: "w_1",
              poster_person_id: "p_author",
              content: "跨平台内容",
              steps: 15,
              platform: "reddit",
              status: "done",
              created_at: "2026-07-04T08:00:00Z",
              totals: { replies: 4, reposts: 0, likes: 2 },
            },
          ];
        }
        return {
          persons: [
            {
              person: {
                person_id: "p_author",
                display_name: "财经大号",
                persona_kind: "kol",
                accounts: [],
              },
              stance: { stance_counts: {}, dominant: "other" },
              total_influence: 56,
              run_ids: ["run-twitter", "run-reddit"],
              standing_timeline: [],
            },
          ],
        };
      },
    })),
  );

  mount();

  expect(await screen.findByText("财经大号")).toBeInTheDocument();
  expect(screen.getByText("微博 + Reddit")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "微博评论区" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reddit复盘" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "看现场" }));
  expect(screen.getByText("世界现场/world/w_1/live?run_id=run-twitter&run_id=run-reddit")).toBeInTheDocument();
});

test("multi-platform launch opens launch-level retro", async () => {  // review:P13-T6
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => {
        if (url === "/api/launches") {
          return {
            launches: [
              {
                launch_id: "launch_1",
                kind: "multi",
                world_id: "w_1",
                content: "跨平台内容",
                steps: 15,
                platforms: ["twitter", "reddit"],
                run_ids: ["run-twitter", "run-reddit"],
                status: "done",
                clock_tick: 15,
                poster_person_id: "p_author",
                poster_persona: "kol",
                created_at: "2026-07-04T08:00:00Z",
              },
            ],
          };
        }
        if (url === "/api/runs") {
          return [
            {
              run_id: "run-twitter",
              world_id: "w_1",
              poster_person_id: "p_author",
              content: "跨平台内容",
              steps: 15,
              platform: "twitter",
              status: "done",
              created_at: "2026-07-04T08:00:00Z",
              totals: { replies: 3, reposts: 1, likes: 8 },
            },
            {
              run_id: "run-reddit",
              world_id: "w_1",
              poster_person_id: "p_author",
              content: "跨平台内容",
              steps: 15,
              platform: "reddit",
              status: "done",
              created_at: "2026-07-04T08:00:00Z",
              totals: { replies: 4, reposts: 0, likes: 2 },
            },
          ];
        }
        return { persons: [] };
      },
    })),
  );

  mount();

  fireEvent.click(await screen.findByRole("button", { name: "看复盘" }));
  expect(screen.getByText("世界现场/world/w_1/retro?launch=launch_1")).toBeInTheDocument();
});
