import type { Actor, Post, Reply, RunSnapshot } from "../model/canonical";

export interface ReplyView {
  reply: Reply;
  author: Actor;
}

export interface Notification {
  id: string;
  kind: "like" | "repost" | "quote" | "follow";
  actor: Actor;
  created_at?: string | null;
}

export interface PosterViewModel {
  me: Actor | null;
  seedPost: Post | null;
  thread: ReplyView[];
  notifications: Notification[];
}

function actorOf(snap: RunSnapshot, userId: number): Actor {
  return (
    snap.actors.find((a) => a.user_id === userId) ?? {
      user_id: userId,
      num_followers: 0,
      num_followings: 0,
    }
  );
}

function timeRank(value?: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function compareNewestReply(a: Reply, b: Reply): number {
  const byTime = timeRank(b.created_at) - timeRank(a.created_at);
  return byTime || b.comment_id - a.comment_id;
}

// review:P3-T2  poster 视角纯函数（契约 §2.6 定稿）
export function posterView(snap: RunSnapshot): PosterViewModel {
  const seedId = snap.seed_post_id ?? null;
  const seedPost =
    seedId == null ? null : snap.posts.find((p) => p.post_id === seedId) ?? null;
  const me = seedPost ? actorOf(snap, seedPost.author_id) : null;

  const thread: ReplyView[] = snap.replies
    .filter((r) => r.post_id === seedId)
    .sort(compareNewestReply)
    .map((reply) => ({ reply, author: actorOf(snap, reply.author_id) }));

  const notifications: Notification[] = [];
  for (const reaction of snap.reactions) {
    if (
      reaction.kind === "like" &&
      reaction.target_type === "post" &&
      reaction.target_id === seedId
    ) {
      notifications.push({
        id: `like-${reaction.actor_id}`,
        kind: "like",
        actor: actorOf(snap, reaction.actor_id),
        created_at: reaction.created_at,
      });
    }
  }
  for (const post of snap.posts) {
    if (post.original_post_id === seedId) {
      notifications.push({
        id: `share-${post.post_id}`,
        kind: post.quote_content ? "quote" : "repost",
        actor: actorOf(snap, post.author_id),
        created_at: post.created_at,
      });
    }
  }
  if (me) {
    for (const follow of snap.follows) {
      if (follow.followee_id === me.user_id) {
        notifications.push({
          id: `follow-${follow.follower_id}`,
          kind: "follow",
          actor: actorOf(snap, follow.follower_id),
          created_at: follow.created_at,
        });
      }
    }
  }

  return { me, seedPost, thread, notifications };
}
