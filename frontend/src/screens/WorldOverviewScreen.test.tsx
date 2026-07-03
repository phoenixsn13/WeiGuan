import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import WorldOverviewScreen from "./WorldOverviewScreen";

afterEach(() => vi.restoreAllMocks());

function LocationProbe() {
  const location = useLocation();
  return <div>{`多平台现场${location.pathname}`}</div>;
}

function mount() {
  render(
    <MemoryRouter initialEntries={["/worlds"]}>
      <Routes>
        <Route path="/worlds" element={<WorldOverviewScreen />} />
        <Route path="/world/:id/live" element={<LocationProbe />} />
        <Route path="/compose" element={<div>发起页</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

test("renders persistent worlds and opens the world live view", async () => {  // review:P11-T6-AC2
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => {
        if (url === "/api/identities") {
          return {
            identities: [
              {
                world_id: "w_1",
                person_id: "p_author",
                display_name: "财经观察员",
                persona_kind: "kol",
                total_influence: 56,
                run_count: 2,
              },
            ],
          };
        }
        if (url === "/api/runs") {
          return [
            {
              run_id: "r_1",
              world_id: "w_1",
              poster_person_id: "p_author",
              content: "AI 政策会改变商业模式吗",
              steps: 15,
              platform: "twitter",
              status: "done",
              created_at: "2026-07-02T08:00:00Z",
              totals: { replies: 9, reposts: 1, likes: 5 },
            },
          ];
        }
        return {
          persons: [
            {
              person: {
                person_id: "p_author",
                display_name: "财经观察员",
                persona_kind: "kol",
                accounts: [
                  {
                    account_id: "a_tw",
                    person_id: "p_author",
                    platform: "twitter",
                    handle: "finance",
                    avatar_seed: "p_author",
                    num_followers: 100,
                    influence_score: 20,
                  },
                ],
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

  expect(await screen.findByText("世界总览")).toBeInTheDocument();
  expect(screen.getByText("财经观察员")).toBeInTheDocument();
  expect(screen.getByText("AI 政策会改变商业模式吗")).toBeInTheDocument();
  expect(screen.getByText("1 个平台现场")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "看现场" }));
  expect(screen.getByText("多平台现场/world/w_1/live")).toBeInTheDocument();
});

test("shows an empty state when no persistent world exists", async () => {  // review:P11-T6-AC3
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (url === "/api/identities" ? { identities: [] } : []),
    })),
  );

  mount();

  expect(await screen.findByText("还没有持续世界")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "发起一条内容" }));
  expect(screen.getByText("发起页")).toBeInTheDocument();
});
