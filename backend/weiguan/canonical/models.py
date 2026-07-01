from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


# review:P1-T1
class Platform(str, Enum):
    TWITTER = "twitter"
    REDDIT = "reddit"


class PostKind(str, Enum):
    ORIGINAL = "original"
    REPOST = "repost"
    QUOTE = "quote"


class ReactionKind(str, Enum):
    LIKE = "like"
    DISLIKE = "dislike"
    COMMENT_LIKE = "comment_like"
    COMMENT_DISLIKE = "comment_dislike"


class TargetType(str, Enum):
    POST = "post"
    COMMENT = "comment"


class Actor(BaseModel):
    user_id: int
    agent_id: int | None = None
    user_name: str | None = None
    name: str | None = None
    bio: str | None = None
    num_followers: int = 0
    num_followings: int = 0


class Post(BaseModel):
    post_id: int
    author_id: int
    kind: PostKind = PostKind.ORIGINAL
    content: str = ""
    quote_content: str | None = None
    original_post_id: int | None = None
    created_at: str | None = None
    num_likes: int = 0
    num_dislikes: int = 0
    num_shares: int = 0
    num_reports: int = 0


class Reply(BaseModel):
    comment_id: int
    post_id: int
    author_id: int
    content: str = ""
    created_at: str | None = None
    num_likes: int = 0
    num_dislikes: int = 0


class Reaction(BaseModel):
    kind: ReactionKind
    actor_id: int
    target_type: TargetType
    target_id: int
    created_at: str | None = None


class Follow(BaseModel):
    follower_id: int
    followee_id: int
    created_at: str | None = None


class Report(BaseModel):
    actor_id: int
    post_id: int
    reason: str | None = None
    created_at: str | None = None


class TraceEvent(BaseModel):
    actor_id: int
    created_at: str | None = None
    action: str
    info: str | None = None


class RunSnapshot(BaseModel):
    platform: Platform = Platform.TWITTER
    seed_post_id: int | None = None
    actors: list[Actor] = Field(default_factory=list)
    posts: list[Post] = Field(default_factory=list)
    replies: list[Reply] = Field(default_factory=list)
    reactions: list[Reaction] = Field(default_factory=list)
    follows: list[Follow] = Field(default_factory=list)
    reports: list[Report] = Field(default_factory=list)
    traces: list[TraceEvent] = Field(default_factory=list)
