import { render, screen } from "@testing-library/react";

import type { PosterViewModel } from "../pov/poster";
import { PlatformSkinFeed, availableSkins, skinForPlatform } from "./skin";

const vm: PosterViewModel = {
  me: {
    user_id: 1,
    user_name: "poster",
    name: "主理人",
    num_followers: 0,
    num_followings: 0,
  },
  seedPost: {
    post_id: 1,
    author_id: 1,
    kind: "original",
    content: "AI发展这么快，政策会改变商业模式吗",
    num_likes: 8,
    num_dislikes: 0,
    num_shares: 2,
    num_reports: 0,
  },
  thread: [
    {
      reply: {
        comment_id: 11,
        post_id: 1,
        author_id: 2,
        content: "要看落地效率，不只是政策口号。",
        num_likes: 3,
        num_dislikes: 0,
      },
      author: {
        user_id: 2,
        user_name: "reader",
        name: "读者甲",
        num_followers: 0,
        num_followings: 0,
      },
    },
  ],
  notifications: [],
};

test("skin registry exposes distinct weibo x and reddit skins", () => {  // review:P9-T5-AC1
  expect(availableSkins.map((skin) => skin.id)).toEqual(["weibo", "x", "reddit"]);
  expect(skinForPlatform("twitter").id).toBe("weibo");
  expect(skinForPlatform("reddit").id).toBe("reddit");
});

test.each([
  ["weibo", "微博正文", "评论 1"],
  ["x", "Post", "Replies 1"],
  ["reddit", "r/weiguan", "1 comment"],
] as const)("the %s skin renders the same poster view with platform chrome", (skin, chrome, count) => {  // review:P9-T5-AC2
  render(<PlatformSkinFeed skin={skin} vm={vm} />);

  expect(screen.getByText("AI发展这么快，政策会改变商业模式吗")).toBeInTheDocument();
  expect(screen.getByText("要看落地效率，不只是政策口号。")).toBeInTheDocument();
  expect(screen.getByText(chrome)).toBeInTheDocument();
  expect(screen.getByText(count)).toBeInTheDocument();
});
