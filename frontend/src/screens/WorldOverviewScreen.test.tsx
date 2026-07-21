import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import WorldOverviewScreen from "./WorldOverviewScreen";

afterEach(() => vi.restoreAllMocks());

function LocationProbe() {
  const location = useLocation();
  return <div>{`多平台现场${location.pathname}${location.search}`}</div>;
}

function IdentityProbe() {
  const location = useLocation();
  return <div>{`身份页${location.pathname}${location.search}`}</div>;
}

function mount() {
  render(
    <MemoryRouter initialEntries={["/worlds"]}>
      <Routes>
        <Route path="/worlds" element={<WorldOverviewScreen />} />
        <Route path="/world/:id/live" element={<LocationProbe />} />
        <Route path="/identity/:personId" element={<IdentityProbe />} />
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
                primary_identity_person_id: "p_author",
                primary_identity_name: "财经观察员",
                latest: {
                  content: "AI 政策会改变商业模式吗",
                  created_at: "2026-07-02T08:00:00Z",
                  status: "done",
                  run_ids: ["r_1"],
                  launch_id: "r_1",
                },
                created_at: "2026-07-02T08:00:00Z",
              },
              {
                world_id: "w_empty",
                name: "空壳世界",
                identity_count: 6,
                total_influence: 0,
                platform_count: 1,
                run_count: 0,
                primary_identity_person_id: "p_empty",
                primary_identity_name: "普通人",
                latest: null,
                created_at: "2026-07-01T08:00:00Z",
              },
            ],
          };
        }
        return {};
      },
    })),
  );

  mount();

  expect(await screen.findByRole("heading", { name: "世界" })).toBeInTheDocument();
  expect(screen.getByTestId("world-overview-desktop-grid").className).toContain("lg:grid-cols-[300px_minmax(0,1fr)]");
  expect(screen.getByTestId("world-card-w_1").className).toContain("lg:grid-cols-[64px_minmax(0,1fr)_260px]");
  expect(screen.queryByText("累计影响力")).not.toBeInTheDocument();
  expect(screen.queryByText("空壳世界")).not.toBeInTheDocument();
  expect(screen.getAllByText("身份数").length).toBeGreaterThan(0);
  expect(screen.getAllByText("总影响力").length).toBeGreaterThan(0);
  expect(screen.getByText("围观热榜")).toBeInTheDocument();
  expect(screen.getAllByText("#AI政策会改变商业模式吗").length).toBeGreaterThan(0);
  expect(requested).toEqual(["/api/worlds"]);
  expect(screen.getByText("财经吐槽圈")).toBeInTheDocument();
  expect(screen.getByText("AI 政策会改变商业模式吗")).toBeInTheDocument();
  expect(screen.getByText("1 个平台现场")).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/w_[0-9a-f]{6,}|[0-9a-f]{12,}/);

  fireEvent.click(screen.getByRole("button", { name: "看最新现场" }));
  expect(screen.getByText("多平台现场/world/w_1/live?run_id=r_1")).toBeInTheDocument();
});

test("world hot rail falls back to world name when latest content is blank", async () => {  // review:P14-HIFI-RAIL-AC1
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => {
        if (url === "/api/worlds") {
          return {
            worlds: [
              {
                world_id: "w_named",
                name: "架构阿川3的世界",
                identity_count: 56,
                total_influence: 181,
                platform_count: 2,
                run_count: 2,
                primary_identity_person_id: "p_author",
                primary_identity_name: "架构阿川3",
                latest: {
                  content: "",
                  created_at: "2026-07-02T08:00:00Z",
                  status: "done",
                  run_ids: ["r_1", "r_2"],
                  launch_id: "launch_1",
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

  expect(await screen.findByText("围观热榜")).toBeInTheDocument();
  expect(screen.getAllByText("#架构阿川3的世界").length).toBeGreaterThan(0);
  expect(screen.getByTestId("world-overview-desktop-grid").className).toContain("lg:grid-cols-[300px_minmax(0,1fr)]");
});

test("opens identity page from the world card primary identity name", async () => {  // review:P14-T7
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
                platform_count: 1,
                run_count: 2,
                primary_identity_person_id: "p_author",
                primary_identity_name: "财经观察员",
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

  const entry = await screen.findByRole("button", { name: "财经观察员" });
  expect(document.body.textContent).not.toMatch(/w_[0-9a-f]{6,}|[0-9a-f]{12,}/);
  fireEvent.click(entry);
  expect(screen.getByText("身份页/identity/p_author?world_id=w_1")).toBeInTheDocument();
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
