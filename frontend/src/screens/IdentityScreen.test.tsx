import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import IdentityScreen from "./IdentityScreen";

afterEach(() => vi.restoreAllMocks());

function mount(path = "/identity/p_author?world_id=w_1") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/identity/:personId" element={<IdentityScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

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
});

test("shows empty state when world id is missing", async () => {  // review:P7-T7-AC3
  vi.stubGlobal("fetch", vi.fn());

  mount("/identity/p_author");

  expect(await screen.findByText("缺少世界信息")).toBeInTheDocument();
});
