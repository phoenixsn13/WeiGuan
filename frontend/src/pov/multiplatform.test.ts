import type { WorldEvent } from "../api/client";
import { multiPlatformView } from "./multiplatform";

const seed = (platform: "twitter" | "reddit", postId: number, content: string): WorldEvent => ({
  event_id: `${platform}-seed-${postId}`,
  world_id: "w_1",
  tick: 1,
  created_at: "1",
  platform,
  actor_account_id: `acct-${platform}-poster`,
  kind: "seed",
  payload: {
    post_id: postId,
    author_id: 1,
    kind: "original",
    content,
    num_likes: 4,
    num_dislikes: 0,
    num_shares: 0,
    num_reports: 0,
  },
  run_id: `run-${platform}`,
});

test("multiPlatformView splits events into platform columns and bridge edges", () => {  // review:P9-T6-AC1
  const view = multiPlatformView([
    seed("twitter", 1, "微博主帖"),
    seed("reddit", 2, "Reddit 主帖"),
    {
      event_id: "twitter-reply-1",
      world_id: "w_1",
      tick: 2,
      created_at: "2",
      platform: "twitter",
      actor_account_id: "acct-twitter-reader",
      kind: "reply",
      payload: {
        comment_id: 10,
        post_id: 1,
        author_id: 2,
        content: "微博评论",
        num_likes: 0,
        num_dislikes: 0,
      },
      run_id: "run-twitter",
    },
    {
      event_id: "bridge-1",
      world_id: "w_1",
      tick: 3,
      created_at: "3",
      platform: "reddit",
      actor_account_id: "acct-reddit-poster",
      kind: "bridge_inject",
      payload: {
        source_platform: "twitter",
        source_post_id: 1,
        content: "微博主帖",
      },
      run_id: "run-reddit",
    },
  ]);

  expect(view.clockTick).toBe(3);
  expect(view.columns.map((column) => column.platform)).toEqual(["twitter", "reddit"]);
  expect(view.columns[0].view.seedPost?.content).toBe("微博主帖");
  expect(view.columns[0].view.thread[0].reply.content).toBe("微博评论");
  expect(view.bridges).toEqual([
    { fromPlatform: "twitter", toPlatform: "reddit", postRef: 1, tick: 3 },
  ]);
});

test("single platform view has no bridge edges", () => {  // review:P9-T6-AC2
  const view = multiPlatformView([seed("twitter", 1, "只有一个平台")]);

  expect(view.columns).toHaveLength(1);
  expect(view.bridges).toEqual([]);
});
