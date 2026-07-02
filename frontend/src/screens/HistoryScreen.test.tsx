import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import HistoryScreen from "./HistoryScreen";

afterEach(() => vi.restoreAllMocks());

function LocationProbe() {
  const location = useLocation();
  return <div>{`评论区${location.search}`}</div>;
}

function mount() {
  render(
    <MemoryRouter initialEntries={["/history"]}>
      <Routes>
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="/run/:id/live" element={<LocationProbe />} />
        <Route path="/run/:id/retro" element={<div>回放页</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

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
  expect(screen.getByText("评论区?replay=1")).toBeInTheDocument();
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
