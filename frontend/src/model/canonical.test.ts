import { applyDelta, emptySnapshot } from "./accumulate";
import type { RunSnapshot } from "./canonical";

test("applyDelta concatenates and fixes seed_post_id once", () => {  // review:P3-T1-AC1
  const d1: RunSnapshot = {
    ...emptySnapshot(),
    seed_post_id: 1,
    posts: [
      {
        post_id: 1,
        author_id: 1,
        kind: "original",
        content: "hi",
        num_likes: 0,
        num_dislikes: 0,
        num_shares: 0,
        num_reports: 0,
      },
    ],
  };
  const s1 = applyDelta(emptySnapshot(), d1);
  const d2: RunSnapshot = {
    ...emptySnapshot(),
    replies: [
      {
        comment_id: 1,
        post_id: 1,
        author_id: 2,
        content: "yo",
        num_likes: 3,
        num_dislikes: 0,
      },
    ],
  };
  const s2 = applyDelta(s1, d2);
  expect(s2.seed_post_id).toBe(1);
  expect(s2.posts).toHaveLength(1);
  expect(s2.replies[0].num_likes).toBe(3);
});

test("applyDelta is immutable", () => {  // review:P3-T1-AC2
  const base = emptySnapshot();
  applyDelta(base, {
    ...emptySnapshot(),
    actors: [{ user_id: 9, num_followers: 0, num_followings: 0 }],
  });
  expect(base.actors).toHaveLength(0);
});
