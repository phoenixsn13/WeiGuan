import { emptySnapshot } from "../model/accumulate";
import type { RunSnapshot } from "../model/canonical";
import { posterView } from "./poster";

function snap(): RunSnapshot {
  return {
    ...emptySnapshot(),
    seed_post_id: 1,
    actors: [
      {
        user_id: 1,
        user_name: "you",
        name: "你",
        num_followers: 0,
        num_followings: 0,
      },
      {
        user_id: 2,
        user_name: "marco",
        name: "Marco",
        num_followers: 5,
        num_followings: 3,
      },
      {
        user_id: 3,
        user_name: "lin",
        name: "Lin",
        num_followers: 2,
        num_followings: 4,
      },
    ],
    posts: [
      {
        post_id: 1,
        author_id: 1,
        kind: "original",
        content: "构建砍到3秒",
        created_at: "1",
        num_likes: 1,
        num_dislikes: 0,
        num_shares: 1,
        num_reports: 0,
      },
      {
        post_id: 2,
        author_id: 3,
        kind: "repost",
        original_post_id: 1,
        content: "",
        created_at: "2",
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
        num_likes: 3,
        num_dislikes: 0,
      },
    ],
    reactions: [
      {
        kind: "like",
        actor_id: 2,
        target_type: "post",
        target_id: 1,
        created_at: "2",
      },
    ],
    follows: [{ follower_id: 2, followee_id: 1, created_at: "2" }],
  };
}

test("me and seedPost resolved", () => {  // review:P3-T2-AC1
  const vm = posterView(snap());
  expect(vm.me?.user_name).toBe("you");
  expect(vm.seedPost?.content).toBe("构建砍到3秒");
});

test("thread joins replies with authors", () => {  // review:P3-T2-AC2
  const vm = posterView(snap());
  expect(vm.thread).toHaveLength(1);
  expect(vm.thread[0].author.name).toBe("Marco");
  expect(vm.thread[0].reply.content).toBe("缓存没清吧");
});

test("notifications include like, repost, follow", () => {  // review:P3-T2-AC3
  const kinds = posterView(snap())
    .notifications.map((n) => n.kind)
    .sort();
  expect(kinds).toEqual(["follow", "like", "repost"]);
});

test("empty snapshot yields nulls", () => {  // review:P3-T2-AC4
  const vm = posterView(emptySnapshot());
  expect(vm.me).toBeNull();
  expect(vm.seedPost).toBeNull();
});
