import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import WorldOverviewScreen from "./WorldOverviewScreen";

afterEach(() => vi.restoreAllMocks());

function LocationProbe() {
  const location = useLocation();
  return <div>{`多平台现场${location.pathname}${location.search}`}</div>;
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

test("renders a structured skeleton while loading worlds", () => {  // review:P13-T7
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));

  mount();

  expect(screen.getByTestId("world-overview-skeleton")).toBeInTheDocument();
  expect(screen.queryByText("正在加载世界…")).not.toBeInTheDocument();
});

test("renders persistent worlds and opens the world live view", async () => {  // review:P11-T6-AC2
  const requested: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => {
        requested.push(url);
        if (url === "/api/worlds") {
          return {
            worlds: [
              {
                world_id: "w_1",
                name: "财经吐槽圈",
                identity_count: 3,
                total_influence: 56,
                platform_count: 1,
                run_count: 2,
                latest: {
                  content: "AI 政策会改变商业模式吗",
                  created_at: "2026-07-02T08:00:00Z",
                  status: "done",
                  run_ids: ["r_1"],
                  launch_id: "r_1",
                },
                created_at: "2026-07-02T08:00:00Z",
              },
            ],
          };
        }
        return {};
      },
    })),
  );

  mount();

  expect(await screen.findByText("世界总览")).toBeInTheDocument();
  expect(requested).toEqual(["/api/worlds"]);
  expect(screen.getByText("财经吐槽圈")).toBeInTheDocument();
  expect(screen.getByText("AI 政策会改变商业模式吗")).toBeInTheDocument();
  expect(screen.getByText("1 个平台现场")).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/w_[0-9a-f]{6,}|[0-9a-f]{12,}/);

  fireEvent.click(screen.getByRole("button", { name: "看最新现场" }));
  expect(screen.getByText("多平台现场/world/w_1/live?run_id=r_1")).toBeInTheDocument();
});

test("opens the latest launch with run scoped world live url", async () => {  // review:P13-T4
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => {
        if (url === "/api/worlds") {
          return {
            worlds: [
              {
                world_id: "w_1",
                name: "财经吐槽圈",
                identity_count: 3,
                total_influence: 56,
                platform_count: 2,
                run_count: 2,
                latest: {
                  content: "AI 政策会改变商业模式吗",
                  created_at: "2026-07-04T08:00:00Z",
                  status: "running",
                  run_ids: ["run-twitter", "run-reddit"],
                  launch_id: "launch_1",
                },
                created_at: "2026-07-04T08:00:00Z",
              },
            ],
          };
        }
        return {};
      },
    })),
  );

  mount();

  expect(await screen.findByText("AI 政策会改变商业模式吗")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "看最新现场" }));
  expect(screen.getByText("多平台现场/world/w_1/live?run_id=run-twitter&run_id=run-reddit")).toBeInTheDocument();
});

test("shows an empty state when no persistent world exists", async () => {  // review:P11-T6-AC3
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (url === "/api/worlds" ? { worlds: [] } : []),
    })),
  );

  mount();

  expect(await screen.findByText("还没有持续世界")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "发起一条内容" }));
  expect(screen.getByText("发起页")).toBeInTheDocument();
});
