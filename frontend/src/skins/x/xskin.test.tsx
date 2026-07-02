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

test("feed renders relative social times from event order", () => {  // review:UI-P14-AC2
  render(
    <XFeed
      vm={{
        ...vm,
        seedPost: { ...vm.seedPost!, created_at: "1" },
        thread: [
          {
            ...vm.thread[0],
            reply: { ...vm.thread[0].reply, created_at: "4" },
          },
          {
            reply: {
              comment_id: 2,
              post_id: 1,
              author_id: 2,
              content: "两分钟前的评论",
              created_at: "2",
              num_likes: 0,
              num_dislikes: 0,
            },
            author: vm.thread[0].author,
          },
        ],
      }}
    />,
  );

  expect(screen.getAllByText("刚刚").length).toBeGreaterThan(0);
  expect(screen.getByText("2分钟前")).toBeInTheDocument();
});


test("feed hides internal ids and dataset prefixes in profile labels", () => {  // review:UI-P9-AC1
  render(
    <XFeed
      vm={{
        ...vm,
        me: {
          user_id: 0,
          user_name: "0",
          name: "财00_韭菜观察员",
          num_followers: 0,
          num_followings: 0,
        },
        thread: [
          {
            reply: {
              comment_id: 2,
              post_id: 1,
              author_id: 3,
              content: "看看财报再说",
              num_likes: 0,
              num_dislikes: 0,
            },
            author: {
              user_id: 3,
              user_name: "3",
              name: "财03_空仓老刘",
              num_followers: 0,
              num_followings: 0,
            },
          },
        ],
      }}
    />,
  );

  expect(screen.getByText("韭菜观察员")).toBeInTheDocument();
  expect(screen.getByText("空仓老刘")).toBeInTheDocument();
  expect(screen.queryByText("@0")).not.toBeInTheDocument();
  expect(screen.queryByText("@3")).not.toBeInTheDocument();
  expect(screen.queryByText(/财00_/)).not.toBeInTheDocument();
});

test("feed derives topic tags from content instead of fixed engineering tags", () => {  // review:UI-P9-AC2
  render(
    <XFeed
      vm={{
        ...vm,
        seedPost: {
          ...vm.seedPost!,
          content: "spacex股价怎么回事啊",
        },
      }}
    />,
  );

  expect(screen.getByText("#SpaceX")).toBeInTheDocument();
  expect(screen.getByText("#股价讨论")).toBeInTheDocument();
  expect(screen.queryByText("#前端构建优化")).not.toBeInTheDocument();
  expect(screen.queryByText("#性能优化")).not.toBeInTheDocument();
});

test("feed styles mentions and hashtags inside post text", () => {  // review:UI-P10-AC2
  render(
    <XFeed
      vm={{
        ...vm,
        seedPost: {
          ...vm.seedPost!,
          content: "@港股夜猫 看看这个 #大模型",
        },
      }}
    />,
  );

  expect(screen.getByText("@港股夜猫")).toHaveClass("text-accent");
  expect(screen.getAllByText("#大模型")[0]).toHaveClass("text-accent");
});

test("feed does not style leaked internal numeric mentions as real users", () => {  // review:UI-P11-AC5
  render(
    <XFeed
      vm={{
        ...vm,
        seedPost: {
          ...vm.seedPost!,
          content: "@用户11 这个说得比我还在点子上",
        },
      }}
    />,
  );

  expect(screen.getByText("@用户11")).not.toHaveClass("text-accent");
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

test("feed tabs render wired repost rows", () => {  // review:UI-P2-AC6
  const onModeChange = vi.fn();
  render(
    <XFeed
      vm={vm}
      mode="reposts"
      onModeChange={onModeChange}
      reposts={[
        {
          post: {
            post_id: 9,
            author_id: 2,
            kind: "quote",
            original_post_id: 1,
            content: "转走",
            quote_content: "我也想看复现步骤",
            num_likes: 0,
            num_dislikes: 0,
            num_shares: 0,
            num_reports: 0,
          },
          author: {
            user_id: 2,
            user_name: "marco",
            name: "Marco",
            num_followers: 5,
            num_followings: 3,
          },
          label: "引用",
          text: "我也想看复现步骤",
        },
      ]}
    />,
  );
  expect(screen.getByText("我也想看复现步骤")).toBeInTheDocument();
  fireEvent.click(screen.getByText(/评论/));
  expect(onModeChange).toHaveBeenCalledWith("comments");
});
