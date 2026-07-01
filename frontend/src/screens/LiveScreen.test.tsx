import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import LiveScreen from "./LiveScreen";

class FakeES {
  static last: FakeES;
  listeners: Record<string, ((event: { data: string }) => void)[]> = {};

  constructor() {
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
  render(
    <MemoryRouter initialEntries={["/run/r_1/live"]}>
      <Routes>
        <Route path="/run/:id/live" element={<LiveScreen streamFactory={factory} />} />
        <Route path="/run/:id/retro" element={<div>复盘页</div>} />
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
  expect(screen.getByText(/1/)).toBeInTheDocument();
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
