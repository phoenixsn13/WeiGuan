import { render, screen } from "@testing-library/react";

import type { WorldEvent } from "../api/client";
import MultiPlatformLiveScreen from "./MultiPlatformLiveScreen";

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

test("multi-platform live renders columns clock and bridge links", () => {  // review:P9-T6-AC3
  render(<MultiPlatformLiveScreen events={events} />);

  expect(screen.getByText("世界时钟 · 第 2 拍")).toBeInTheDocument();
  expect(screen.getAllByText("微博").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Reddit").length).toBeGreaterThan(0);
  expect(screen.getByText("同一条内容先在微博发酵")).toBeInTheDocument();
  expect(screen.getByText("同一条内容到了 Reddit")).toBeInTheDocument();
  expect(screen.getByLabelText("跨平台桥 twitter 到 reddit")).toBeInTheDocument();
});

test("single platform live falls back to one column without bridges", () => {  // review:P9-T6-AC4
  render(<MultiPlatformLiveScreen events={[events[0]]} />);

  expect(screen.getByText("世界时钟 · 第 1 拍")).toBeInTheDocument();
  expect(screen.getByText("微博")).toBeInTheDocument();
  expect(screen.queryByLabelText(/跨平台桥/)).not.toBeInTheDocument();
});

test("high-fidelity world stage uses tokenized bridge color and desktop three columns", () => {  // review:P9-T8-AC1
  const { container } = render(<MultiPlatformLiveScreen events={events} />);
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
