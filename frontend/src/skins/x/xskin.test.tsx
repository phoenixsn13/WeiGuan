import { fireEvent, render, screen } from "@testing-library/react";

import type { PosterViewModel } from "../../pov/poster";
import { XActionBar } from "./XActionBar";
import { XFeed } from "./XFeed";

const vm: PosterViewModel = {
  me: {
    user_id: 1,
    user_name: "you",
    name: "你",
    num_followers: 0,
    num_followings: 0,
  },
  seedPost: {
    post_id: 1,
    author_id: 1,
    kind: "original",
    content: "构建砍到3秒",
    num_likes: 48,
    num_dislikes: 0,
    num_shares: 5,
    num_reports: 0,
  },
  thread: [
    {
      reply: {
        comment_id: 1,
        post_id: 1,
        author_id: 2,
        content: "缓存没清吧",
        num_likes: 3,
        num_dislikes: 0,
      },
      author: {
        user_id: 2,
        user_name: "marco",
        name: "Marco",
        num_followers: 5,
        num_followings: 3,
      },
    },
  ],
  notifications: [],
};

test("feed renders seed post content and reply", () => {  // review:P3-T3-AC1
  render(<XFeed vm={vm} />);
  expect(screen.getByText("构建砍到3秒")).toBeInTheDocument();
  expect(screen.getByText("缓存没清吧")).toBeInTheDocument();
});

test("action bar counts use tabular numerals", () => {  // review:P3-T3-AC2
  render(<XActionBar replies={12} reposts={5} likes={48} />);
  const like = screen.getByText("48");
  expect(like.className).toContain("tabular");
});

test("clicking avatar fires onActorClick", () => {  // review:P3-T3-AC3
  const fn = vi.fn();
  render(<XFeed vm={vm} onActorClick={fn} />);
  fireEvent.click(screen.getByLabelText("用户 marco"));
  expect(fn).toHaveBeenCalledWith(expect.objectContaining({ user_id: 2 }));
});

test("empty feed shows waiting hint", () => {  // review:P3-T3-AC4
  render(<XFeed vm={{ me: null, seedPost: null, thread: [], notifications: [] }} />);
  expect(screen.getByText(/等待第一条/)).toBeInTheDocument();
});
