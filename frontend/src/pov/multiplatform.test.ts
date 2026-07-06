import type { WorldEvent } from "../api/client";
import { cleanDisplayName, multiPlatformView, resolveWorldDisplayName } from "./multiplatform";

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

test("cleanDisplayName removes dataset prefixes but keeps meaningful suffixes", () => {  // review:P13-T1
  expect(cleanDisplayName("码05_产品懂点码")).toBe("产品懂点码");
  expect(cleanDisplayName("财00_韭菜观察员")).toBe("韭菜观察员");
  expect(cleanDisplayName("估值洁癖2")).toBe("估值洁癖2");
});

test("resolveWorldDisplayName follows payload person index and alias fallback order", () => {  // review:P13-T1
  const accountId = "7bb2eb80803d4d44afacf6b9994d0c4e";
  const personViews = [
    {
      person: {
        person_id: "p_1",
        display_name: "码05_产品懂点码",
        persona_kind: "ordinary" as const,
        accounts: [
          {
            account_id: accountId,
            person_id: "p_1",
            platform: "twitter" as const,
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
  ];

  expect(resolveWorldDisplayName({ payloadName: "财00_韭菜观察员", accountId, personViews })).toBe(
    "韭菜观察员",
  );
  expect(resolveWorldDisplayName({ accountId, personViews })).toBe("产品懂点码");
  expect(resolveWorldDisplayName({ accountId, personViews: [] })).toBe("围观者·0c4e");
});

test("multiPlatformView uses display-name chain without rendering bare account ids", () => {  // review:P13-T1
  const longAccountId = "7bb2eb80803d4d44afacf6b9994d0c4e";
  const view = multiPlatformView([
    {
      ...seed("twitter", 1, "主帖"),
      actor_account_id: longAccountId,
      payload: { ...seed("twitter", 1, "主帖").payload, author_display_name: "财00_韭菜观察员" },
    },
  ]);

  expect(view.columns[0].view.me?.name).toBe("韭菜观察员");
  expect(JSON.stringify(view)).not.toMatch(/[0-9a-f]{12,}/);
});
