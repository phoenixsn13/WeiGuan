// review:P3-T1  TS 镜像后端 weiguan.canonical
export type Platform = "twitter" | "reddit";
export type PostKind = "original" | "repost" | "quote";
export type ReactionKind = "like" | "dislike" | "comment_like" | "comment_dislike";
export type TargetType = "post" | "comment";

export interface Actor {
  user_id: number;
  agent_id?: number | null;
  user_name?: string | null;
  name?: string | null;
  bio?: string | null;
  num_followers: number;
  num_followings: number;
}

export interface Post {
  post_id: number;
  author_id: number;
  kind: PostKind;
  content: string;
  quote_content?: string | null;
  original_post_id?: number | null;
  created_at?: string | null;
  num_likes: number;
  num_dislikes: number;
  num_shares: number;
  num_reports: number;
}

export interface Reply {
  comment_id: number;
  post_id: number;
  author_id: number;
  content: string;
  created_at?: string | null;
  num_likes: number;
  num_dislikes: number;
}

export interface Reaction {
  kind: ReactionKind;
  actor_id: number;
  target_type: TargetType;
  target_id: number;
  created_at?: string | null;
}

export interface Follow {
  follower_id: number;
  followee_id: number;
  created_at?: string | null;
}

export interface Report {
  actor_id: number;
  post_id: number;
  reason?: string | null;
  created_at?: string | null;
}

export interface TraceEvent {
  actor_id: number;
  created_at?: string | null;
  action: string;
  info?: string | null;
}

export interface RunSnapshot {
  platform: Platform;
  seed_post_id?: number | null;
  actors: Actor[];
  posts: Post[];
  replies: Reply[];
  reactions: Reaction[];
  follows: Follow[];
  reports: Report[];
  traces: TraceEvent[];
}
