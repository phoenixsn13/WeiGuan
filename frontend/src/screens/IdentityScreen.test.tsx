import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import IdentityScreen from "./IdentityScreen";

afterEach(() => vi.restoreAllMocks());

function WorldProbe() {
  const location = useLocation();
  return <div>{`世界现场${location.pathname}`}</div>;
}

function mount(path = "/identity/p_author?world_id=w_1") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/identity/:personId" element={<IdentityScreen />} />
        <Route path="/world/:id/live" element={<WorldProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

test("renders a structured skeleton while loading identity details", () => {  // review:P13-T7
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));

  mount();

  expect(screen.getByTestId("identity-skeleton")).toBeInTheDocument();
  expect(screen.queryByText("正在读取身份…")).not.toBeInTheDocument();
});

test("renders identity card, stance timeline, influence curve, and accounts", async () => {  // review:P7-T7-AC2
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
              steps: 10,
              platform: "twitter",
              status: "done",
              created_at: "2026-07-02T08:00:00Z",
              totals: { replies: 5, reposts: 2, likes: 10 },
            },
          ];
        }
        return {
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
          stance: { stance_counts: { positive: 3, negative: 1 }, dominant: "positive" },
          total_influence: 56,
          run_ids: ["r_1", "r_2"],
          standing_timeline: [
            {
              run_id: "r_1",
              influence: 51,
              followers: 50001,
              stance_dominant: "positive",
              stance_score: 1,
            },
            {
              run_id: "r_2",
              influence: 56,
              followers: 50003,
              stance_dominant: "negative",
              stance_score: -1,
            },
          ],
        };
      },
    })),
  );

  mount();

  expect(await screen.findByText("财经大号")).toBeInTheDocument();
  expect(screen.getByText("KOL")).toBeInTheDocument();
  expect(screen.getByText("50,000 粉丝")).toBeInTheDocument();
  expect(screen.getByText("@finance_kol")).toBeInTheDocument();
  expect(screen.getByText("立场时间线")).toBeInTheDocument();
  expect(screen.getByText("影响力曲线")).toBeInTheDocument();
  expect(screen.getByText("第二条")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "看这个世界" }));  // review:P11-T6-AC5
  expect(screen.getByText("世界现场/world/w_1/live")).toBeInTheDocument();
});

test("shows empty state when world id is missing", async () => {  // review:P7-T7-AC3
  vi.stubGlobal("fetch", vi.fn());

  mount("/identity/p_author");

  expect(await screen.findByText("缺少世界信息")).toBeInTheDocument();
});

test("shows honest empty state when standing timeline is unavailable", async () => {  // review:P7-T10-AC2
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => {
        if (url === "/api/runs") return [];
        return {
          person: {
            person_id: "p_author",
            display_name: "财经大号",
            persona_kind: "kol",
            accounts: [],
          },
          stance: { stance_counts: {}, dominant: "other" },
          total_influence: 0,
          run_ids: ["r_1"],
          standing_timeline: [],
        };
      },
    })),
  );

  mount();

  expect(await screen.findByText("还没有足够记录形成时间线。")).toBeInTheDocument();
  expect(screen.getByText("影响力曲线")).toBeInTheDocument();
  expect(screen.getByText("还没有足够记录形成影响力曲线。")).toBeInTheDocument();
});

test("normalizes influence bars by the series maximum", async () => {  // review:P7-T12-AC4
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
              totals: {},
            },
            {
              run_id: "r_2",
              world_id: "w_1",
              content: "第二条",
              steps: 10,
              platform: "twitter",
              status: "done",
              created_at: "2026-07-02T08:00:00Z",
              totals: {},
            },
          ];
        }
        return {
          person: {
            person_id: "p_author",
            display_name: "财经大号",
            persona_kind: "kol",
            accounts: [],
          },
          stance: { stance_counts: {}, dominant: "other" },
          total_influence: 30,
          run_ids: ["r_1", "r_2"],
          standing_timeline: [
            {
              run_id: "r_1",
              influence: 10,
              followers: 100,
              stance_dominant: "neutral",
              stance_score: 0,
            },
            {
              run_id: "r_2",
              influence: 30,
              followers: 120,
              stance_dominant: "positive",
              stance_score: 1,
            },
          ],
        };
      },
    })),
  );

  mount();

  const first = await screen.findByLabelText("第 1 次 影响力 10");
  const second = screen.getByLabelText("第 2 次 影响力 30");
  expect(first).toHaveStyle({ height: "33.33333333333333%" });
  expect(second).toHaveStyle({ height: "100%" });
});

test("shows influence empty state when timeline influence maximum is zero", async () => {  // review:P7-T12-AC5
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
              totals: {},
            },
          ];
        }
        return {
          person: {
            person_id: "p_author",
            display_name: "财经大号",
            persona_kind: "kol",
            accounts: [],
          },
          stance: { stance_counts: {}, dominant: "other" },
          total_influence: 0,
          run_ids: ["r_1"],
          standing_timeline: [
            {
              run_id: "r_1",
              influence: 0,
              followers: 0,
              stance_dominant: "other",
              stance_score: 0,
            },
          ],
        };
      },
    })),
  );

  mount();

  expect(await screen.findByText("还没有足够记录形成影响力曲线。")).toBeInTheDocument();
});
