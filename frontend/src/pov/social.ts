import type { Actor, Post, Reply, RunSnapshot } from "../model/canonical";

export interface RepostRow {
  post: Post;
  author: Actor;
  label: "转发" | "引用";
  text: string;
}

export interface ActorRow {
  actor: Actor;
  score: number;
  summary: string;
}

export interface HotRow {
  id: string;
  text: string;
  author?: Actor;
  score: number;
  kind: string;
}

export interface KeyEventRow {
  id: string;
  title: string;
  detail: string;
  author?: Actor;
  score: number;
  kind: string;
}

export interface TimelineRow {
  id: string;
  at: string;
  kind: string;
  title: string;
  detail: string;
}

export interface TrendRow {
  label: string;
  value: number;
  note: string;
}

function actorOf(snapshot: RunSnapshot, userId: number): Actor {
  return (
    snapshot.actors.find((actor) => actor.user_id === userId) ?? {
      user_id: userId,
      name: `用户 ${userId}`,
      num_followers: 0,
      num_followings: 0,
    }
  );
}

function actorName(actor: Actor | undefined): string {
  return actor?.user_name ? `@${actor.user_name}` : actor?.name ?? "未知用户";
}

function seedId(snapshot: RunSnapshot): number | null {
  return snapshot.seed_post_id ?? null;
}

export function seedReplies(snapshot: RunSnapshot): Reply[] {
  const seed = seedId(snapshot);
  return snapshot.replies.filter((reply) => reply.post_id === seed);
}

export function repostRows(snapshot: RunSnapshot): RepostRow[] {
  const seed = seedId(snapshot);
  return snapshot.posts
    .filter((post) => post.original_post_id === seed)
    .map((post) => ({
      post,
      author: actorOf(snapshot, post.author_id),
      label: post.kind === "quote" ? "引用" : "转发",
      text: post.quote_content || post.content || "转发了你的微博",
    }));
}

export function actorRows(snapshot: RunSnapshot): ActorRow[] {
  const scores = new Map<number, number>();
  const bump = (id: number, value: number) => scores.set(id, (scores.get(id) ?? 0) + value);

  for (const reply of seedReplies(snapshot)) bump(reply.author_id, 2 + Math.min(reply.num_likes, 3));
  for (const post of repostRows(snapshot)) bump(post.author.user_id, 4);
  for (const reaction of snapshot.reactions) {
    if (reaction.target_type === "post" && reaction.target_id === seedId(snapshot)) {
      bump(reaction.actor_id, 1);
    }
  }
  for (const follow of snapshot.follows) bump(follow.follower_id, 1);

  return [...scores.entries()]
    .map(([actorId, score]) => {
      const actor = actorOf(snapshot, actorId);
      return {
        actor,
        score,
        summary: `${seedReplies(snapshot).filter((reply) => reply.author_id === actorId).length} 条评论 · ${score} 热度`,
      };
    })
    .sort((a, b) => b.score - a.score || a.actor.user_id - b.actor.user_id);
}

export function hotRows(snapshot: RunSnapshot): HotRow[] {
  const replies = seedReplies(snapshot).map((reply) => ({
    id: `reply-${reply.comment_id}`,
    text: reply.content,
    author: actorOf(snapshot, reply.author_id),
    score: reply.num_likes,
    kind: "高赞评论",
  }));
  const reposts = repostRows(snapshot).map((row) => ({
    id: `repost-${row.post.post_id}`,
    text: row.text,
    author: row.author,
    score: 4,
    kind: row.label,
  }));
  return [...replies, ...reposts].sort((a, b) => b.score - a.score).slice(0, 8);
}

export function timelineRows(snapshot: RunSnapshot): TimelineRow[] {
  const seed = seedId(snapshot);
  const rows: TimelineRow[] = [];
  const seedPost = snapshot.posts.find((post) => post.post_id === seed);
  if (seedPost) {
    rows.push({
      id: `post-${seedPost.post_id}`,
      at: seedPost.created_at ?? "0",
      kind: "发布",
      title: "发布正文",
      detail: seedPost.content,
    });
  }
  for (const reaction of snapshot.reactions) {
    if (reaction.target_type === "post" && reaction.target_id === seed) {
      rows.push({
        id: `reaction-${reaction.kind}-${reaction.actor_id}`,
        at: reaction.created_at ?? "",
        kind: reaction.kind === "like" ? "点赞" : "反应",
        title: `${actorName(actorOf(snapshot, reaction.actor_id))} 有了反应`,
        detail: reaction.kind === "like" ? "赞了你的微博" : reaction.kind,
      });
    }
  }
  for (const reply of seedReplies(snapshot)) {
    rows.push({
      id: `reply-${reply.comment_id}`,
      at: reply.created_at ?? "",
      kind: "评论",
      title: `${actorName(actorOf(snapshot, reply.author_id))} 评论`,
      detail: reply.content,
    });
  }
  for (const row of repostRows(snapshot)) {
    rows.push({
      id: `repost-${row.post.post_id}`,
      at: row.post.created_at ?? "",
      kind: "转发",
      title: `${actorName(row.author)} ${row.label}`,
      detail: row.text,
    });
  }
  for (const follow of snapshot.follows) {
    rows.push({
      id: `follow-${follow.follower_id}-${follow.followee_id}`,
      at: follow.created_at ?? "",
      kind: "关注",
      title: `${actorName(actorOf(snapshot, follow.follower_id))} 关注了你`,
      detail: "后续可能继续关注这条内容",
    });
  }
  return rows.sort((a, b) => a.at.localeCompare(b.at));
}

export function keyEvents(snapshot: RunSnapshot): KeyEventRow[] {
  const rows = hotRows(snapshot);
  return rows.length
    ? rows.map((row) => ({
        id: `event-${row.id}`,
        title: `${row.kind}：${row.score}`,
        detail: row.text,
        kind: row.kind,
        score: row.score,
        author: row.author,
      }))
    : [
        {
          id: "event-empty",
          kind: "关键事件",
          title: "关键事件",
          detail: "还没有明显事件",
          score: 0,
        },
      ];
}

export function keyEventCards(snapshot: RunSnapshot): { title: string; detail: string }[] {
  const hottest = keyEvents(snapshot)[0];
  const repost = repostRows(snapshot)[0];
  return [
    hottest
      ? {
          title: hottest.title,
          detail: hottest.detail,
        }
      : { title: "评论开始", detail: "等待更多讨论" },
    repost
      ? { title: `${repost.label}出现`, detail: `${actorName(repost.author)} ${repost.text}` }
      : { title: "暂未转发", detail: "讨论还停留在评论区" },
  ];
}

export function trendRows(snapshot: RunSnapshot): TrendRow[] {
  const replies = seedReplies(snapshot).length;
  const reposts = repostRows(snapshot).length;
  const likes = snapshot.reactions.filter(
    (reaction) => reaction.target_type === "post" && reaction.target_id === seedId(snapshot),
  ).length;
  const people = actorRows(snapshot).length;
  return [
    { label: "评论", value: replies, note: "正文下的直接回复" },
    { label: "转发", value: reposts, note: "带来的二次传播" },
    { label: "点赞", value: likes, note: "轻量正向反馈" },
    { label: "人物", value: people, note: "参与过互动的人" },
  ];
}
