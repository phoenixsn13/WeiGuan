import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import type { WorldEvent, WorldEventsPage } from "../api/client";
import { getWorldEvents, listPersons } from "../api/client";
import MultiPlatformLiveScreen from "./MultiPlatformLiveScreen";

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return {
    ...actual,
    getWorldEvents: vi.fn(),
    listPersons: vi.fn(),
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
  vi.mocked(listPersons).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const events: WorldEvent[] = [
  {
    event_id: "tw-seed",
    world_id: "w_1",
    tick: 1,
    created_at: "1",
    platform: "twitter",
    actor_account_id: "acct-twitter-poster",
    kind: "seed",
    payload: {
      post_id: 1,
      author_id: 1,
      kind: "original",
      content: "同一条内容先在微博发酵",
      num_likes: 3,
      num_dislikes: 0,
      num_shares: 0,
      num_reports: 0,
    },
    run_id: "run-twitter",
  },
  {
    event_id: "rd-seed",
    world_id: "w_1",
    tick: 1,
    created_at: "1",
    platform: "reddit",
    actor_account_id: "acct-reddit-poster",
    kind: "seed",
    payload: {
      post_id: 2,
      author_id: 1,
      kind: "original",
      content: "同一条内容到了 Reddit",
      num_likes: 1,
      num_dislikes: 0,
      num_shares: 0,
      num_reports: 0,
    },
    run_id: "run-reddit",
  },
  {
    event_id: "bridge-1",
    world_id: "w_1",
    tick: 2,
    created_at: "2",
    platform: "reddit",
    actor_account_id: "acct-reddit-poster",
    kind: "bridge_inject",
    payload: { source_platform: "twitter", source_post_id: 1, content: "同一条内容先在微博发酵" },
    run_id: "run-reddit",
  },
];

function eventsPage(
  frames: WorldEvent[],
  overrides: Partial<WorldEventsPage> = {},
): WorldEventsPage {
  return {
    frames,
    next_after: overrides.next_after ?? frames.reduce((max, event) => Math.max(max, event.tick), 0),
    clock_tick: overrides.clock_tick ?? frames.reduce((max, event) => Math.max(max, event.tick), 0),
    launch_status: overrides.launch_status ?? null,
  };
}

function renderWorldLive(node: ReactElement, initialEntry = "/world/w_1/live") {
  return render(<MemoryRouter initialEntries={[initialEntry]}>{node}</MemoryRouter>);
}

function IdentityProbe() {
  const location = useLocation();
  return <div>{`身份页${location.pathname}${location.search}`}</div>;
}

test("multi-platform live renders columns clock and bridge links", () => {  // review:P9-T6-AC3
  renderWorldLive(<MultiPlatformLiveScreen events={events} />);

  expect(screen.getByText("世界时钟 · 第 2 拍")).toBeInTheDocument();
  expect(screen.getAllByText("微博").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Reddit").length).toBeGreaterThan(0);
  expect(screen.getByText("同一条内容先在微博发酵")).toBeInTheDocument();
  expect(screen.getByText("同一条内容到了 Reddit")).toBeInTheDocument();
  expect(screen.getByLabelText("跨平台桥 twitter 到 reddit")).toBeInTheDocument();
});

test("multi-platform route fetches world events and renders data", async () => {  // review:P11-T4-AC2
  vi.mocked(getWorldEvents).mockResolvedValueOnce(eventsPage(events));

  render(
    <MemoryRouter initialEntries={["/world/w_1/live"]}>
      <Routes>
        <Route path="/world/:id/live" element={<MultiPlatformLiveScreen />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(screen.getByText("正在进入多平台现场...")).toBeInTheDocument();
  expect(await screen.findByText("世界时钟 · 第 2 拍")).toBeInTheDocument();
  expect(getWorldEvents).toHaveBeenCalledWith("w_1", []);
  expect(screen.getByText("同一条内容到了 Reddit")).toBeInTheDocument();
  expect(screen.getByText("世界全景 · 共 2 平台")).toBeInTheDocument();
});

test("multi-platform route filters replay to the launched run ids", async () => {  // review:P11-T9-AC2
  vi.mocked(getWorldEvents).mockResolvedValueOnce(eventsPage(events));

  render(
    <MemoryRouter initialEntries={["/world/w_1/live?run_id=run-twitter&run_id=run-reddit"]}>
      <Routes>
        <Route path="/world/:id/live" element={<MultiPlatformLiveScreen />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByText("世界时钟 · 第 2 拍")).toBeInTheDocument();
  expect(getWorldEvents).toHaveBeenCalledWith("w_1", ["run-twitter", "run-reddit"]);
  expect(screen.getByText("本次发起 · 2 平台")).toBeInTheDocument();
});

test("multi-platform route renders honest empty state for empty worlds", async () => {  // review:P11-T4-AC3
  vi.mocked(getWorldEvents).mockResolvedValueOnce(eventsPage([]));

  render(
    <MemoryRouter initialEntries={["/world/w_empty/live"]}>
      <Routes>
        <Route path="/world/:id/live" element={<MultiPlatformLiveScreen />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByText("该世界还没有多平台内容")).toBeInTheDocument();
});

test("multi-platform route keeps polling while a new world is still warming up", async () => {  // review:P11-T7-AC2
  vi.useFakeTimers();
  vi.mocked(getWorldEvents)
    .mockResolvedValueOnce(eventsPage([], { next_after: 0, clock_tick: 0, launch_status: "running" }))
    .mockResolvedValueOnce(eventsPage(events, { next_after: 2, clock_tick: 2, launch_status: "running" }));

  render(
    <MemoryRouter initialEntries={["/world/w_pending/live"]}>
      <Routes>
        <Route path="/world/:id/live" element={<MultiPlatformLiveScreen />} />
      </Routes>
    </MemoryRouter>,
  );

  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByText("该世界还没有多平台内容")).toBeInTheDocument();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1500);
  });

  expect(getWorldEvents).toHaveBeenCalledTimes(2);
  expect(getWorldEvents).toHaveBeenNthCalledWith(2, "w_pending", [], 0);
  expect(screen.getByText("世界时钟 · 第 2 拍")).toBeInTheDocument();
});

test("multi-platform route stops polling after launch is done", async () => {  // review:P13-T3
  vi.useFakeTimers();
  vi.mocked(getWorldEvents)
    .mockResolvedValueOnce(eventsPage([], { next_after: 1, clock_tick: 1, launch_status: "running" }))
    .mockResolvedValueOnce(eventsPage(events, { next_after: 2, clock_tick: 2, launch_status: "done" }));

  render(
    <MemoryRouter initialEntries={["/world/w_done/live?run_id=run-twitter&run_id=run-reddit"]}>
      <Routes>
        <Route path="/world/:id/live" element={<MultiPlatformLiveScreen />} />
      </Routes>
    </MemoryRouter>,
  );

  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1500);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });

  expect(getWorldEvents).toHaveBeenCalledTimes(2);
  expect(getWorldEvents).toHaveBeenNthCalledWith(2, "w_done", ["run-twitter", "run-reddit"], 1);
  expect(screen.getByText("已完成 · 共 2 拍")).toBeInTheDocument();
});

test("done multi-platform live links to launch retro results", async () => {  // review:P13-T6
  vi.mocked(getWorldEvents).mockResolvedValueOnce(
    eventsPage(events, { next_after: 2, clock_tick: 2, launch_status: "done" }),
  );

  render(
    <MemoryRouter initialEntries={["/world/w_done/live?launch=launch_1&run_id=run-twitter&run_id=run-reddit"]}>
      <Routes>
        <Route path="/world/:id/live" element={<MultiPlatformLiveScreen />} />
        <Route path="/world/:id/retro" element={<div>launch 结果</div>} />
      </Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByText("已完成 · 共 2 拍")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "看结果" }));
  expect(screen.getByText("launch 结果")).toBeInTheDocument();
});

test("multi-platform route shows retry when world events fail", async () => {  // review:P11-T4-AC4
  vi.mocked(getWorldEvents)
    .mockRejectedValueOnce(new Error("network down"))
    .mockResolvedValueOnce(eventsPage(events));

  render(
    <MemoryRouter initialEntries={["/world/w_retry/live"]}>
      <Routes>
        <Route path="/world/:id/live" element={<MultiPlatformLiveScreen />} />
      </Routes>
    </MemoryRouter>,
  );

  const retry = await screen.findByRole("button", { name: "重试" });
  expect(screen.getByText("多平台现场加载失败")).toBeInTheDocument();
  fireEvent.click(retry);

  expect(await screen.findByText("世界时钟 · 第 2 拍")).toBeInTheDocument();
  expect(getWorldEvents).toHaveBeenCalledTimes(2);
});

test("single platform live falls back to one column without bridges", () => {  // review:P9-T6-AC4
  renderWorldLive(<MultiPlatformLiveScreen events={[events[0]]} />);

  expect(screen.getByText("世界时钟 · 第 1 拍")).toBeInTheDocument();
  expect(screen.getByText("微博")).toBeInTheDocument();
  expect(screen.queryByLabelText(/跨平台桥/)).not.toBeInTheDocument();
});

test("high-fidelity world stage uses tokenized bridge color and desktop three columns", () => {  // review:P9-T8-AC1
  const { container } = renderWorldLive(<MultiPlatformLiveScreen events={events} />);
  const stage = screen.getByTestId("world-live-stage");
  const bridge = screen.getByLabelText("跨平台桥 twitter 到 reddit");

  expect(stage).toHaveAttribute("data-world-surface", "#0F172A");
  expect(stage).toHaveStyle({ backgroundColor: "#0F172A" });
  expect(bridge).toHaveAttribute("data-from-platform", "twitter");
  expect(bridge).toHaveAttribute("data-to-platform", "reddit");
  expect(bridge).toHaveStyle({ borderColor: "#2C4A7C" });
  expect(container.querySelector("[class*='indigo-']")).toBeNull();
  expect(container.querySelector(".lg\\:grid-cols-3")).not.toBeNull();
});

test("platform columns use bounded scroll viewports instead of stretching the page", () => {  // review:P11-T9-AC3
  renderWorldLive(<MultiPlatformLiveScreen events={events} />);

  const viewports = screen.getAllByTestId("platform-scroll-viewport");
  expect(viewports).toHaveLength(2);
  for (const viewport of viewports) {
    expect(viewport.className).toContain("max-h-[760px]");
    expect(viewport.className).toContain("overflow-y-auto");
  }
});

test("multi-platform live resolves person names and never renders bare long ids", async () => {  // review:P13-T1
  const longAccountId = "7bb2eb80803d4d44afacf6b9994d0c4e";
  const rawEvents: WorldEvent[] = [
    {
      ...events[0],
      actor_account_id: longAccountId,
      payload: { ...events[0].payload, author_display_name: undefined },
    },
  ];
  vi.mocked(getWorldEvents).mockResolvedValueOnce(eventsPage(rawEvents));
  vi.mocked(listPersons).mockResolvedValueOnce([
    {
      person: {
        person_id: "p_1",
        display_name: "码05_产品懂点码",
        persona_kind: "ordinary",
        accounts: [
          {
            account_id: longAccountId,
            person_id: "p_1",
            platform: "twitter",
            handle: "h",
            avatar_seed: "p_1",
            num_followers: 20,
            influence_score: 1,
          },
        ],
      },
      stance: { stance_counts: {}, dominant: "neutral" },
      total_influence: 0,
      run_ids: [],
      standing_timeline: [],
    },
  ]);

  const { container } = render(
    <MemoryRouter initialEntries={["/world/w_1/live"]}>
      <Routes>
        <Route path="/world/:id/live" element={<MultiPlatformLiveScreen />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByText("产品懂点码")).toBeInTheDocument();
  expect(container.textContent ?? "").not.toMatch(/[0-9a-f]{12,}/);
  expect(listPersons).toHaveBeenCalledWith("w_1");
});

test("opens identity page from multi-platform author when ownership is known", async () => {  // review:P14-T7
  vi.mocked(getWorldEvents).mockResolvedValueOnce(eventsPage([events[0]]));
  vi.mocked(listPersons).mockResolvedValueOnce([
    {
      person: {
        person_id: "p_author",
        display_name: "财经观察员",
        persona_kind: "kol",
        accounts: [
          {
            account_id: "acct-twitter-poster",
            person_id: "p_author",
            platform: "twitter",
            handle: "finance",
            avatar_seed: "p_author",
            num_followers: 50000,
            influence_score: 50,
          },
        ],
      },
      stance: { stance_counts: {}, dominant: "neutral" },
      total_influence: 50,
      run_ids: [],
      standing_timeline: [],
    },
  ]);

  render(
    <MemoryRouter initialEntries={["/world/w_1/live"]}>
      <Routes>
        <Route path="/world/:id/live" element={<MultiPlatformLiveScreen />} />
        <Route path="/identity/:personId" element={<IdentityProbe />} />
      </Routes>
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole("button", { name: "财经观察员" }));
  expect(screen.getByText("身份页/identity/p_author?world_id=w_1")).toBeInTheDocument();
});
