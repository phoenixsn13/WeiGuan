import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import type { WorldEvent } from "../api/client";
import { getWorldEvents } from "../api/client";
import MultiPlatformLiveScreen from "./MultiPlatformLiveScreen";

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return {
    ...actual,
    getWorldEvents: vi.fn(),
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
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

function renderWorldLive(node: ReactElement, initialEntry = "/world/w_1/live") {
  return render(<MemoryRouter initialEntries={[initialEntry]}>{node}</MemoryRouter>);
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
  vi.mocked(getWorldEvents).mockResolvedValueOnce(events);

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
});

test("multi-platform route filters replay to the launched run ids", async () => {  // review:P11-T9-AC2
  vi.mocked(getWorldEvents).mockResolvedValueOnce(events);

  render(
    <MemoryRouter initialEntries={["/world/w_1/live?run_id=run-twitter&run_id=run-reddit"]}>
      <Routes>
        <Route path="/world/:id/live" element={<MultiPlatformLiveScreen />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByText("世界时钟 · 第 2 拍")).toBeInTheDocument();
  expect(getWorldEvents).toHaveBeenCalledWith("w_1", ["run-twitter", "run-reddit"]);
});

test("multi-platform route renders honest empty state for empty worlds", async () => {  // review:P11-T4-AC3
  vi.mocked(getWorldEvents).mockResolvedValueOnce([]);

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
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce(events);

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
  expect(screen.getByText("世界时钟 · 第 2 拍")).toBeInTheDocument();
});

test("multi-platform route shows retry when world events fail", async () => {  // review:P11-T4-AC4
  vi.mocked(getWorldEvents)
    .mockRejectedValueOnce(new Error("network down"))
    .mockResolvedValueOnce(events);

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
