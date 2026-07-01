import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import LiveScreen from "./LiveScreen";

class FakeES {
  static last: FakeES;
  static created = 0;
  listeners: Record<string, ((event: { data: string }) => void)[]> = {};

  constructor() {
    FakeES.created += 1;
    FakeES.last = this;
  }

  addEventListener(name: string, cb: (event: { data: string }) => void) {
    (this.listeners[name] ??= []).push(cb);
  }

  emit(name: string, data: unknown) {
    (this.listeners[name] ?? []).forEach((cb) => cb({ data: JSON.stringify(data) }));
  }

  close() {}
}

function mount() {
  const factory = () => new FakeES() as unknown as EventSource;
  FakeES.created = 0;
  render(
    <MemoryRouter initialEntries={["/run/r_1/live"]}>
      <Routes>
        <Route path="/run/:id/live" element={<LiveScreen streamFactory={factory} />} />
        <Route path="/run/:id/retro" element={<div>复盘页</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function mountReplay() {
  const factory = () => new FakeES() as unknown as EventSource;
  FakeES.created = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        platform: "twitter",
        seed_post_id: 1,
        actors: [
          { user_id: 1, user_name: "you", name: "你", num_followers: 0, num_followings: 0 },
        ],
        posts: [
          {
            post_id: 1,
            author_id: 1,
            kind: "original",
            content: "历史里的内容",
            num_likes: 0,
            num_dislikes: 0,
            num_shares: 0,
            num_reports: 0,
          },
        ],
        replies: [],
        reactions: [],
        follows: [],
        reports: [],
        traces: [],
      }),
    })),
  );
  render(
    <MemoryRouter initialEntries={["/run/r_1/live?replay=1"]}>
      <Routes>
        <Route path="/run/:id/live" element={<LiveScreen streamFactory={factory} />} />
      </Routes>
    </MemoryRouter>,
  );
}

test("streams seed post then reply, shows step counter", () => {  // review:P3-T5-AC1
  mount();
  const es = FakeES.last;
  act(() => es.emit("run_started", { steps: 6 }));
  act(() => es.emit("step_started", { step: 1, total: 6 }));
  act(() =>
    es.emit("delta", {
      step: 1,
      snapshot: {
        platform: "twitter",
        seed_post_id: 1,
        actors: [
          {
            user_id: 1,
            user_name: "you",
            name: "你",
            num_followers: 0,
            num_followings: 0,
          },
        ],
        posts: [
          {
            post_id: 1,
            author_id: 1,
            kind: "original",
            content: "构建砍到3秒",
            num_likes: 0,
            num_dislikes: 0,
            num_shares: 0,
            num_reports: 0,
          },
        ],
        replies: [],
        reactions: [],
        follows: [],
        reports: [],
        traces: [],
      },
    }),
  );
  expect(screen.getByText("构建砍到3秒")).toBeInTheDocument();
  expect(screen.getByText("1/6")).toBeInTheDocument();
});

test("see-results disabled until done, then navigates", () => {  // review:P3-T5-AC2
  mount();
  const es = FakeES.last;
  act(() => es.emit("run_started", { steps: 6 }));
  const btn = screen.getByText(/看结果/);
  expect(btn).toBeDisabled();
  act(() => es.emit("run_done", { run_id: "r_1" }));
  fireEvent.click(screen.getByText(/看结果/));
  expect(screen.getByText("复盘页")).toBeInTheDocument();
});

test("keeps comments inside a scrollable social viewport and switches actor perspective", () => {  // review:UI-P1-AC5
  mount();
  const es = FakeES.last;
  act(() => es.emit("run_started", { steps: 6 }));
  act(() =>
    es.emit("delta", {
      step: 2,
      snapshot: {
        platform: "twitter",
        seed_post_id: 1,
        actors: [
          { user_id: 1, user_name: "you", name: "你", num_followers: 0, num_followings: 0 },
          {
            user_id: 2,
            user_name: "dev_marco",
            name: "Marco",
            num_followers: 12,
            num_followings: 3,
          },
        ],
        posts: [
          {
            post_id: 1,
            author_id: 1,
            kind: "original",
            content: "构建砍到3秒",
            num_likes: 8,
            num_dislikes: 0,
            num_shares: 1,
            num_reports: 0,
          },
        ],
        replies: Array.from({ length: 18 }, (_, index) => ({
          comment_id: index + 1,
          post_id: 1,
          author_id: 2,
          content: `缓存没清吧 ${index + 1}`,
          num_likes: index,
          num_dislikes: 0,
        })),
        reactions: [],
        follows: [],
        reports: [],
        traces: [],
      },
    }),
  );

  expect(screen.getByLabelText("评论区滚动窗口")).toHaveClass("overflow-y-auto");
  fireEvent.click(screen.getAllByText("Marco")[0]);
  expect(screen.getByText("正在从 @dev_marco 的视角看")).toBeInTheDocument();
  expect(screen.getByText("回到我看到的")).toBeInTheDocument();
});

test("replay mode loads saved snapshot without opening event stream", async () => {  // review:UI-P1-AC7
  mountReplay();

  expect(await screen.findByText("历史里的内容")).toBeInTheDocument();
  expect(FakeES.created).toBe(0);
  expect(fetch).toHaveBeenCalledWith("/api/runs/r_1/snapshot");
});
