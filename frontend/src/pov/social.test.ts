import { emptySnapshot } from "../model/accumulate";
import type { RunSnapshot } from "../model/canonical";
import {
  actorRows,
  hotRows,
  keyEvents,
  timelineRows,
  trendRows,
  repostRows,
} from "./social";

function snap(): RunSnapshot {
  return {
    ...emptySnapshot(),
    seed_post_id: 1,
    actors: [
      { user_id: 1, user_name: "you", name: "你", num_followers: 0, num_followings: 0 },
      { user_id: 2, user_name: "marco", name: "Marco", num_followers: 8, num_followings: 3 },
      { user_id: 3, user_name: "lin", name: "Lin", num_followers: 4, num_followings: 2 },
    ],
    posts: [
      {
        post_id: 1,
        author_id: 1,
        kind: "original",
        content: "构建砍到3秒",
        created_at: "1",
        num_likes: 0,
        num_dislikes: 0,
        num_shares: 0,
        num_reports: 0,
      },
      {
        post_id: 2,
        author_id: 3,
        kind: "quote",
        original_post_id: 1,
        content: "值得试试",
        quote_content: "我也想看复现步骤",
        created_at: "3",
        num_likes: 0,
        num_dislikes: 0,
        num_shares: 0,
        num_reports: 0,
      },
    ],
    replies: [
      {
        comment_id: 1,
        post_id: 1,
        author_id: 2,
        content: "缓存没清吧",
        created_at: "2",
        num_likes: 9,
        num_dislikes: 0,
      },
      {
        comment_id: 2,
        post_id: 1,
        author_id: 3,
        content: "环境配置要说清楚",
        created_at: "4",
        num_likes: 3,
        num_dislikes: 0,
      },
    ],
    reactions: [
      { kind: "like", actor_id: 2, target_type: "post", target_id: 1, created_at: "2" },
    ],
    follows: [{ follower_id: 3, followee_id: 1, created_at: "5" }],
  };
}

test("repostRows joins seed reposts with authors", () => {  // review:UI-P2-AC1
  const rows = repostRows(snap());
  expect(rows).toHaveLength(1);
  expect(rows[0].author.user_name).toBe("lin");
  expect(rows[0].label).toBe("引用");
});

test("actorRows ranks engaged people", () => {  // review:UI-P2-AC2
  const rows = actorRows(snap());
  expect(rows[0].actor.user_name).toBe("lin");
  expect(rows[0].score).toBeGreaterThanOrEqual(rows[1].score);
});

test("hotRows picks most liked replies", () => {  // review:UI-P2-AC3
  expect(hotRows(snap())[0].text).toBe("缓存没清吧");
});

test("timelineRows includes seed replies and follows", () => {  // review:UI-P2-AC4
  const rows = timelineRows(snap());
  expect(rows.map((row) => row.kind)).toEqual([
    "发布",
    "点赞",
    "评论",
    "转发",
    "评论",
    "关注",
  ]);
});

test("keyEvents and trendRows derive display summaries", () => {  // review:UI-P2-AC5
  expect(keyEvents(snap())[0].title).toContain("高赞评论");
  expect(trendRows(snap()).map((row) => row.label)).toContain("评论");
});
