# 围观 计划 1 — 规范模型 + OASIS Adapter 实现计划

> **给 agentic 实现者：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项实现本计划。步骤使用复选框（`- [ ]`）语法跟踪。

**目标：** 把 OASIS 跑出来的 SQLite 事件日志，稳定地归一化成一个平台中立的「规范模型」（RunSnapshot），作为整个围观应用的稳定内核。

**架构：** Ports & Adapters。本计划只做内核最里层：`canonical`（pydantic 规范模型）+ `adapter`（OASIS SQLite → RunSnapshot）。不碰引擎运行、不碰 LLM、不碰前端。用一个"按 OASIS 真实 schema 手工插入已知数据"的 golden fixture DB 做确定性测试。

**技术栈：** Python 3.10+，pydantic v2，pytest。（后端整体是 Python + FastAPI + SSE，但本计划不引入 FastAPI。）

## 全局约束

- Python ≥ 3.10（用 `list[X]` / `X | None` 语法）。
- pydantic v2（`model_dump()` / `Field(default_factory=...)`）。
- 本计划**不 import `oasis` 包**：fixture 用内联 SQL 自建，保证测试无需装 OASIS、无需 LLM、无需网络。
- 所有 `created_at` 一律以**原样字符串**保存，不做时区/解析转换（确定性优先）。
- 规范模型字段命名一旦定义不可改：后续计划（POV/皮肤/复盘）依赖这些精确名字。
- 代码放在仓库 `backend/` 下；测试放 `backend/tests/`；`pytest` 在 `backend/` 目录运行。
- OASIS 真实表结构（本计划依据，逐字）：
  - `user(user_id PK, agent_id, user_name, name, bio, created_at, num_followings, num_followers)`
  - `post(post_id PK, user_id, original_post_id, content DEFAULT '', quote_content, created_at, num_likes, num_dislikes, num_shares, num_reports)` —— `original_post_id` 非空=转发或引用；`quote_content` 非空=引用。
  - `comment(comment_id PK, post_id, user_id, content, created_at, num_likes, num_dislikes)`
  - `like(like_id PK, user_id, post_id, created_at)` / `dislike(dislike_id PK, user_id, post_id, created_at)`
  - `comment_like(comment_like_id PK, user_id, comment_id, created_at)` / `comment_dislike(comment_dislike_id PK, user_id, comment_id, created_at)`
  - `follow(follow_id PK, follower_id, followee_id, created_at)`
  - `report(report_id PK, user_id, post_id, report_reason, created_at)`
  - `trace(user_id, created_at, action, info)`

---

## 文件结构

```
backend/
  pyproject.toml                         # 任务 1
  weiguan/
    __init__.py                          # 任务 1
    canonical/
      __init__.py                        # 任务 1 (re-export 模型)
      models.py                          # 任务 1 —— 所有规范模型
    adapter/
      __init__.py                        # 任务 3
      oasis_adapter.py                   # 任务 3+4 —— SQLite → RunSnapshot
  tests/
    conftest.py                          # 任务 2 —— fixture builder
    canonical/test_models.py             # 任务 1
    adapter/test_oasis_adapter.py        # 任务 3+4
```

- 每个文件单一职责：`models.py` 只定义数据形状；`oasis_adapter.py` 只做"读表→建模"，不含任何业务/渲染逻辑。

---

### 任务 1: 后端脚手架 + 规范模型

**文件：**
- 创建： `backend/pyproject.toml`
- 创建： `backend/weiguan/__init__.py`（空文件）
- 创建： `backend/weiguan/canonical/__init__.py`
- 创建： `backend/weiguan/canonical/models.py`
- 测试：`backend/tests/canonical/test_models.py`

**接口：**
- 产出（后续所有计划依赖这些精确名字与类型）：
  - `Actor(user_id:int, agent_id:int|None, user_name:str|None, name:str|None, bio:str|None, num_followers:int, num_followings:int)`
  - `Post(post_id:int, author_id:int, kind:PostKind, content:str, quote_content:str|None, original_post_id:int|None, created_at:str|None, num_likes:int, num_dislikes:int, num_shares:int, num_reports:int)`
  - `Reply(comment_id:int, post_id:int, author_id:int, content:str, created_at:str|None, num_likes:int, num_dislikes:int)`
  - `Reaction(kind:ReactionKind, actor_id:int, target_type:TargetType, target_id:int, created_at:str|None)`
  - `Follow(follower_id:int, followee_id:int, created_at:str|None)`
  - `Report(actor_id:int, post_id:int, reason:str|None, created_at:str|None)`
  - `TraceEvent(actor_id:int, created_at:str|None, action:str, info:str|None)`
  - `RunSnapshot(platform:Platform, seed_post_id:int|None, actors:list[Actor], posts:list[Post], replies:list[Reply], reactions:list[Reaction], follows:list[Follow], reports:list[Report], traces:list[TraceEvent])`
  - Enums: `PostKind{ORIGINAL,REPOST,QUOTE}`、`ReactionKind{LIKE,DISLIKE,COMMENT_LIKE,COMMENT_DISLIKE}`、`TargetType{POST,COMMENT}`、`Platform{TWITTER,REDDIT}`

- [ ] **步骤 1：写 `backend/pyproject.toml`**

```toml
[project]
name = "weiguan-backend"
version = "0.1.0"
requires-python = ">=3.10"
dependencies = ["pydantic>=2.6"]

[project.optional-dependencies]
dev = ["pytest>=8.0"]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
```

- [ ] **步骤 2：建空包文件**

`backend/weiguan/__init__.py` 与 `backend/weiguan/canonical/__init__.py` 先建为空文件（步骤 5 再回填 canonical 的 re-export）。

- [ ] **步骤 3：写失败测试 `backend/tests/canonical/test_models.py`**

```python
from weiguan.canonical import (
    Actor, Post, PostKind, Reply, Reaction, ReactionKind, TargetType,
    Follow, Report, TraceEvent, RunSnapshot, Platform,
)


def test_post_defaults_are_original_and_empty():
    p = Post(post_id=1, author_id=10)
    assert p.kind == PostKind.ORIGINAL
    assert p.content == ""
    assert p.num_likes == 0
    assert p.original_post_id is None


def test_reaction_requires_kind_and_target():
    r = Reaction(kind=ReactionKind.LIKE, actor_id=3,
                 target_type=TargetType.POST, target_id=1)
    assert r.kind == ReactionKind.LIKE
    assert r.target_type == TargetType.POST


def test_run_snapshot_is_empty_by_default_and_serializable():
    snap = RunSnapshot()
    assert snap.platform == Platform.TWITTER
    assert snap.actors == []
    dumped = snap.model_dump()
    assert dumped["posts"] == []
    assert dumped["platform"] == "twitter"
```

- [ ] **步骤 4：运行测试，确认失败**

运行： `cd backend && python -m pytest tests/canonical/test_models.py -v`
期望： FAIL —— `ImportError: cannot import name 'Actor' from 'weiguan.canonical'`

- [ ] **步骤 5：写实现 `backend/weiguan/canonical/models.py`**

```python
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


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
```

然后把 `backend/weiguan/canonical/__init__.py` 回填为：

```python
from weiguan.canonical.models import (
    Actor, Follow, Platform, Post, PostKind, Reaction, ReactionKind,
    Reply, Report, RunSnapshot, TargetType, TraceEvent,
)

__all__ = [
    "Actor", "Follow", "Platform", "Post", "PostKind", "Reaction",
    "ReactionKind", "Reply", "Report", "RunSnapshot", "TargetType",
    "TraceEvent",
]
```

- [ ] **步骤 6：运行测试，确认通过**

运行： `cd backend && python -m pytest tests/canonical/test_models.py -v`
期望： PASS（3 passed）

- [ ] **步骤 7：提交**

```bash
git add backend/pyproject.toml backend/weiguan backend/tests/canonical
git commit -m "feat(canonical): 规范模型 RunSnapshot 及子模型"
```

---

### 任务 2: OASIS-schema golden fixture 构造器

**文件：**
- 创建： `backend/tests/__init__.py`（空，便于包导入）
- 创建： `backend/tests/conftest.py`
- 测试：同文件内自测（见步骤 3）

**接口：**
- 产出：
  - pytest fixture `oasis_db_path(tmp_path) -> str`：在临时目录建一个符合 OASIS schema 的 SQLite，插入下述**已知固定数据**，返回 db 文件路径。
  - 固定数据（任务 3/4 的断言依据）：
    - users：`(user_id=1, agent_id=0, user_name="you", name="你", bio="产品负责人", num_followers=0, num_followings=0)`、`(user_id=2, agent_id=1, user_name="dev_marco", name="Marco", bio="后端老兵", 5, 3)`、`(user_id=3, agent_id=2, user_name="sre_lin", name="Lin", bio="SRE", 2, 4)`
    - posts：`(post_id=1, user_id=1, original_post_id=NULL, content="构建砍到3秒", quote_content=NULL, created_at="1", num_likes=2, num_dislikes=1, num_shares=1, num_reports=1)`（种子帖）；`(post_id=2, user_id=2, original_post_id=1, content="", quote_content=NULL, created_at="2", ...)`（转发）；`(post_id=3, user_id=3, original_post_id=1, content="", quote_content="今年最强DX", created_at="2", ...)`（引用）
    - comment：`(comment_id=1, post_id=1, user_id=2, content="缓存没清吧", created_at="2", num_likes=3, num_dislikes=0)`
    - like：`(1, user_id=2, post_id=1, "2")`、`(2, user_id=3, post_id=1, "2")`
    - dislike：`(1, user_id=3, post_id=1, "2")`
    - comment_like：`(1, user_id=1, comment_id=1, "2")`
    - comment_dislike：（空表，但要建表）
    - follow：`(1, follower_id=2, followee_id=1, "2")`
    - report：`(1, user_id=3, post_id=1, report_reason="夸大", "2")`
    - trace：`(user_id=1,"1","create_post","{\"post_id\":1}")`、`(user_id=2,"2","create_comment",...)`、`(user_id=2,"2","repost",...)`、`(user_id=3,"2","like_post",...)`

- [ ] **步骤 1：写 `backend/tests/__init__.py`**

空文件。

- [ ] **步骤 2：写 `backend/tests/conftest.py`（含建库 SQL 与已知数据）**

```python
import sqlite3

import pytest

_SCHEMA = """
CREATE TABLE user (user_id INTEGER PRIMARY KEY AUTOINCREMENT, agent_id INTEGER,
  user_name TEXT, name TEXT, bio TEXT, created_at DATETIME,
  num_followings INTEGER DEFAULT 0, num_followers INTEGER DEFAULT 0);
CREATE TABLE post (post_id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER,
  original_post_id INTEGER, content TEXT DEFAULT '', quote_content TEXT,
  created_at DATETIME, num_likes INTEGER DEFAULT 0, num_dislikes INTEGER DEFAULT 0,
  num_shares INTEGER DEFAULT 0, num_reports INTEGER DEFAULT 0);
CREATE TABLE comment (comment_id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER,
  user_id INTEGER, content TEXT, created_at DATETIME,
  num_likes INTEGER DEFAULT 0, num_dislikes INTEGER DEFAULT 0);
CREATE TABLE "like" (like_id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER,
  post_id INTEGER, created_at DATETIME);
CREATE TABLE dislike (dislike_id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER,
  post_id INTEGER, created_at DATETIME);
CREATE TABLE comment_like (comment_like_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER, comment_id INTEGER, created_at DATETIME);
CREATE TABLE comment_dislike (comment_dislike_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER, comment_id INTEGER, created_at DATETIME);
CREATE TABLE follow (follow_id INTEGER PRIMARY KEY AUTOINCREMENT, follower_id INTEGER,
  followee_id INTEGER, created_at DATETIME);
CREATE TABLE report (report_id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER,
  post_id INTEGER, report_reason TEXT, created_at DATETIME);
CREATE TABLE trace (user_id INTEGER, created_at DATETIME, action TEXT, info TEXT,
  PRIMARY KEY(user_id, created_at, action, info));
"""


def _seed(conn: sqlite3.Connection) -> None:
    conn.executescript(_SCHEMA)
    conn.executemany(
        "INSERT INTO user (user_id, agent_id, user_name, name, bio, created_at,"
        " num_followings, num_followers) VALUES (?,?,?,?,?,?,?,?)",
        [
            (1, 0, "you", "你", "产品负责人", "1", 0, 0),
            (2, 1, "dev_marco", "Marco", "后端老兵", "1", 3, 5),
            (3, 2, "sre_lin", "Lin", "SRE", "1", 4, 2),
        ],
    )
    conn.executemany(
        "INSERT INTO post (post_id, user_id, original_post_id, content,"
        " quote_content, created_at, num_likes, num_dislikes, num_shares,"
        " num_reports) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [
            (1, 1, None, "构建砍到3秒", None, "1", 2, 1, 1, 1),
            (2, 2, 1, "", None, "2", 0, 0, 0, 0),
            (3, 3, 1, "", "今年最强DX", "2", 0, 0, 0, 0),
        ],
    )
    conn.execute(
        "INSERT INTO comment (comment_id, post_id, user_id, content, created_at,"
        " num_likes, num_dislikes) VALUES (1,1,2,'缓存没清吧','2',3,0)")
    conn.executemany(
        'INSERT INTO "like" (like_id, user_id, post_id, created_at) VALUES (?,?,?,?)',
        [(1, 2, 1, "2"), (2, 3, 1, "2")])
    conn.execute(
        "INSERT INTO dislike (dislike_id, user_id, post_id, created_at)"
        " VALUES (1,3,1,'2')")
    conn.execute(
        "INSERT INTO comment_like (comment_like_id, user_id, comment_id, created_at)"
        " VALUES (1,1,1,'2')")
    conn.execute(
        "INSERT INTO follow (follow_id, follower_id, followee_id, created_at)"
        " VALUES (1,2,1,'2')")
    conn.execute(
        "INSERT INTO report (report_id, user_id, post_id, report_reason, created_at)"
        " VALUES (1,3,1,'夸大','2')")
    conn.executemany(
        "INSERT INTO trace (user_id, created_at, action, info) VALUES (?,?,?,?)",
        [
            (1, "1", "create_post", '{"post_id":1}'),
            (2, "2", "create_comment", '{"comment_id":1}'),
            (2, "2", "repost", '{"post_id":2}'),
            (3, "2", "like_post", '{"post_id":1}'),
        ],
    )
    conn.commit()


@pytest.fixture
def oasis_db_path(tmp_path) -> str:
    path = str(tmp_path / "sim.db")
    conn = sqlite3.connect(path)
    try:
        _seed(conn)
    finally:
        conn.close()
    return path
```

- [ ] **步骤 3：写并运行 fixture 自测（确认建库成功）**

在 `backend/tests/adapter/test_oasis_adapter.py` 先放一个占位自测（任务 3 会扩充）：

```python
import sqlite3


def test_fixture_builds_expected_rows(oasis_db_path):
    conn = sqlite3.connect(oasis_db_path)
    try:
        assert conn.execute("SELECT COUNT(*) FROM user").fetchone()[0] == 3
        assert conn.execute("SELECT COUNT(*) FROM post").fetchone()[0] == 3
        assert conn.execute(
            "SELECT content FROM post WHERE post_id=1").fetchone()[0] == "构建砍到3秒"
    finally:
        conn.close()
```

运行： `cd backend && python -m pytest tests/adapter/test_oasis_adapter.py -v`
期望： PASS（1 passed）

- [ ] **步骤 4：提交**

```bash
git add backend/tests
git commit -m "test(adapter): OASIS-schema golden fixture 构造器"
```

---

### 任务 3: Adapter 核心（actors / posts / replies）

**文件：**
- 创建： `backend/weiguan/adapter/__init__.py`
- 创建： `backend/weiguan/adapter/oasis_adapter.py`
- 测试：`backend/tests/adapter/test_oasis_adapter.py`（追加）

**接口：**
- 消费：`weiguan.canonical` 全部模型；`oasis_db_path` fixture。
- 产出：
  - `load_run_snapshot(db_path: str, platform: Platform = Platform.TWITTER, seed_post_id: int | None = None) -> RunSnapshot`
  - 任务 3 只填 `actors / posts / replies`；`reactions/follows/reports/traces` 在 任务 4 填。

- [ ] **步骤 1：写失败测试（追加到 `test_oasis_adapter.py`）**

```python
from weiguan.adapter.oasis_adapter import load_run_snapshot
from weiguan.canonical import Platform, PostKind


def test_load_actors(oasis_db_path):
    snap = load_run_snapshot(oasis_db_path, seed_post_id=1)
    assert snap.platform == Platform.TWITTER
    assert snap.seed_post_id == 1
    assert len(snap.actors) == 3
    marco = next(a for a in snap.actors if a.user_id == 2)
    assert marco.user_name == "dev_marco"
    assert marco.num_followers == 5
    assert marco.num_followings == 3


def test_load_posts_kinds(oasis_db_path):
    snap = load_run_snapshot(oasis_db_path)
    by_id = {p.post_id: p for p in snap.posts}
    assert by_id[1].kind == PostKind.ORIGINAL
    assert by_id[1].content == "构建砍到3秒"
    assert by_id[1].num_likes == 2
    assert by_id[2].kind == PostKind.REPOST          # original_post_id 非空、无 quote
    assert by_id[2].original_post_id == 1
    assert by_id[3].kind == PostKind.QUOTE           # quote_content 非空
    assert by_id[3].quote_content == "今年最强DX"


def test_load_replies(oasis_db_path):
    snap = load_run_snapshot(oasis_db_path)
    assert len(snap.replies) == 1
    r = snap.replies[0]
    assert r.comment_id == 1 and r.post_id == 1 and r.author_id == 2
    assert r.content == "缓存没清吧" and r.num_likes == 3
```

- [ ] **步骤 2：运行，确认失败**

运行： `cd backend && python -m pytest tests/adapter/test_oasis_adapter.py -v`
期望： FAIL —— `ModuleNotFoundError: No module named 'weiguan.adapter'`

- [ ] **步骤 3：写实现 `backend/weiguan/adapter/oasis_adapter.py`（含空 `__init__.py`）**

`backend/weiguan/adapter/__init__.py` 建空文件。`oasis_adapter.py`：

```python
from __future__ import annotations

import sqlite3

from weiguan.canonical import (
    Actor, Platform, Post, PostKind, Reply, RunSnapshot,
)


def _rows(conn: sqlite3.Connection, sql: str) -> list[sqlite3.Row]:
    return conn.execute(sql).fetchall()


def _post_kind(original_post_id, quote_content) -> PostKind:
    if quote_content is not None:
        return PostKind.QUOTE
    if original_post_id is not None:
        return PostKind.REPOST
    return PostKind.ORIGINAL


def load_run_snapshot(
    db_path: str,
    platform: Platform = Platform.TWITTER,
    seed_post_id: int | None = None,
) -> RunSnapshot:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        actors = [
            Actor(
                user_id=r["user_id"], agent_id=r["agent_id"],
                user_name=r["user_name"], name=r["name"], bio=r["bio"],
                num_followers=r["num_followers"] or 0,
                num_followings=r["num_followings"] or 0,
            )
            for r in _rows(conn, "SELECT * FROM user ORDER BY user_id")
        ]
        posts = [
            Post(
                post_id=r["post_id"], author_id=r["user_id"],
                kind=_post_kind(r["original_post_id"], r["quote_content"]),
                content=r["content"] or "", quote_content=r["quote_content"],
                original_post_id=r["original_post_id"], created_at=r["created_at"],
                num_likes=r["num_likes"] or 0, num_dislikes=r["num_dislikes"] or 0,
                num_shares=r["num_shares"] or 0, num_reports=r["num_reports"] or 0,
            )
            for r in _rows(conn, "SELECT * FROM post ORDER BY post_id")
        ]
        replies = [
            Reply(
                comment_id=r["comment_id"], post_id=r["post_id"],
                author_id=r["user_id"], content=r["content"] or "",
                created_at=r["created_at"], num_likes=r["num_likes"] or 0,
                num_dislikes=r["num_dislikes"] or 0,
            )
            for r in _rows(conn, "SELECT * FROM comment ORDER BY comment_id")
        ]
        return RunSnapshot(
            platform=platform, seed_post_id=seed_post_id,
            actors=actors, posts=posts, replies=replies,
        )
    finally:
        conn.close()
```

- [ ] **步骤 4：运行，确认通过**

运行： `cd backend && python -m pytest tests/adapter/test_oasis_adapter.py -v`
期望： PASS（4 passed，含 任务 2 的 fixture 自测）

- [ ] **步骤 5：提交**

```bash
git add backend/weiguan/adapter backend/tests/adapter
git commit -m "feat(adapter): actors/posts/replies 归一化 + 转发/引用判定"
```

---

### 任务 4: Adapter 关系（reactions / follows / reports / traces）

**文件：**
- 修改： `backend/weiguan/adapter/oasis_adapter.py`
- 测试：`backend/tests/adapter/test_oasis_adapter.py`（追加）

**接口：**
- 消费：任务 3 的 `load_run_snapshot` 与全部规范模型。
- 产出：`load_run_snapshot` 填齐 `reactions`（来自 like/dislike/comment_like/comment_dislike 四表）、`follows`、`reports`、`traces`。字段语义：
  - like → `Reaction(kind=LIKE, target_type=POST)`；dislike → `DISLIKE/POST`；comment_like → `COMMENT_LIKE/COMMENT`；comment_dislike → `COMMENT_DISLIKE/COMMENT`。
  - report：`Report(actor_id=user_id, post_id, reason=report_reason)`。
  - trace：`TraceEvent(actor_id=user_id, created_at, action, info)`，按 `(created_at, action)` 升序。

- [ ] **步骤 1：写失败测试（追加）**

```python
from weiguan.canonical import ReactionKind, TargetType


def test_load_reactions(oasis_db_path):
    snap = load_run_snapshot(oasis_db_path)
    kinds = sorted((r.kind.value, r.target_type.value, r.actor_id, r.target_id)
                   for r in snap.reactions)
    assert kinds == [
        ("comment_like", "comment", 1, 1),
        ("dislike", "post", 3, 1),
        ("like", "post", 2, 1),
        ("like", "post", 3, 1),
    ]


def test_load_follows_and_reports(oasis_db_path):
    snap = load_run_snapshot(oasis_db_path)
    assert len(snap.follows) == 1
    assert snap.follows[0].follower_id == 2 and snap.follows[0].followee_id == 1
    assert len(snap.reports) == 1
    assert snap.reports[0].actor_id == 3 and snap.reports[0].post_id == 1
    assert snap.reports[0].reason == "夸大"


def test_load_traces_sorted(oasis_db_path):
    snap = load_run_snapshot(oasis_db_path)
    assert len(snap.traces) == 4
    assert snap.traces[0].action == "create_post"      # created_at="1" 最早
    assert snap.traces[0].actor_id == 1
    actions_at_step2 = {t.action for t in snap.traces if t.created_at == "2"}
    assert actions_at_step2 == {"create_comment", "repost", "like_post"}
```

- [ ] **步骤 2：运行，确认失败**

运行： `cd backend && python -m pytest tests/adapter/test_oasis_adapter.py -k "reactions or follows or traces" -v`
期望： FAIL —— `AssertionError`（`snap.reactions` 为空 `[]`）

- [ ] **步骤 3：修改实现，填齐关系**

在 `oasis_adapter.py` 顶部 import 追加：`Follow, Reaction, ReactionKind, Report, TargetType, TraceEvent`。在 `load_run_snapshot` 的 `replies = [...]` 之后、`return` 之前插入：

```python
        reactions: list[Reaction] = []
        for r in _rows(conn, 'SELECT * FROM "like" ORDER BY like_id'):
            reactions.append(Reaction(
                kind=ReactionKind.LIKE, actor_id=r["user_id"],
                target_type=TargetType.POST, target_id=r["post_id"],
                created_at=r["created_at"]))
        for r in _rows(conn, "SELECT * FROM dislike ORDER BY dislike_id"):
            reactions.append(Reaction(
                kind=ReactionKind.DISLIKE, actor_id=r["user_id"],
                target_type=TargetType.POST, target_id=r["post_id"],
                created_at=r["created_at"]))
        for r in _rows(conn, "SELECT * FROM comment_like ORDER BY comment_like_id"):
            reactions.append(Reaction(
                kind=ReactionKind.COMMENT_LIKE, actor_id=r["user_id"],
                target_type=TargetType.COMMENT, target_id=r["comment_id"],
                created_at=r["created_at"]))
        for r in _rows(conn, "SELECT * FROM comment_dislike ORDER BY comment_dislike_id"):
            reactions.append(Reaction(
                kind=ReactionKind.COMMENT_DISLIKE, actor_id=r["user_id"],
                target_type=TargetType.COMMENT, target_id=r["comment_id"],
                created_at=r["created_at"]))

        follows = [
            Follow(follower_id=r["follower_id"], followee_id=r["followee_id"],
                   created_at=r["created_at"])
            for r in _rows(conn, "SELECT * FROM follow ORDER BY follow_id")
        ]
        reports = [
            Report(actor_id=r["user_id"], post_id=r["post_id"],
                   reason=r["report_reason"], created_at=r["created_at"])
            for r in _rows(conn, "SELECT * FROM report ORDER BY report_id")
        ]
        traces = [
            TraceEvent(actor_id=r["user_id"], created_at=r["created_at"],
                       action=r["action"], info=r["info"])
            for r in _rows(conn,
                           "SELECT * FROM trace ORDER BY created_at, action")
        ]
```

并把 `return RunSnapshot(...)` 改为包含新字段：

```python
        return RunSnapshot(
            platform=platform, seed_post_id=seed_post_id,
            actors=actors, posts=posts, replies=replies,
            reactions=reactions, follows=follows, reports=reports, traces=traces,
        )
```

- [ ] **步骤 4：运行全部 adapter 测试，确认通过**

运行： `cd backend && python -m pytest tests/ -v`
期望： PASS（全部通过：models 3 + fixture 1 + adapter 3 + relations 3）

- [ ] **步骤 5：提交**

```bash
git add backend/weiguan/adapter backend/tests/adapter
git commit -m "feat(adapter): reactions/follows/reports/traces 归一化，Adapter 完成"
```

---

## 完成标准（计划 1 Done）

- `load_run_snapshot(db_path)` 能把任意 OASIS SQLite（Twitter 模式）读成完整 `RunSnapshot`。
- `cd backend && python -m pytest tests/ -v` 全绿，且**不依赖 oasis 包 / LLM / 网络**。
- `RunSnapshot.model_dump()` 可序列化为 JSON（供后续计划存快照、流式、复盘复用）。

## 交接给下一个计划的接口

后续计划（引擎运行+流式、POV 透镜、皮肤、复盘）一律**只依赖 `weiguan.canonical` 与 `load_run_snapshot`**，不得直接读 OASIS 表——这是 Ports & Adapters 的核心纪律。

---

## 自审

- **规格覆盖**：本计划只对应 设计 §1 的「Engine 封装 → Adapter → 规范模型」中的 Adapter+规范模型两层；Engine 实际运行（`oasis.make`/`env.step` 流式）刻意留到计划 2（需要 LLM/真跑，测试策略不同）。规范模型字段覆盖 设计 §1 canonical 列出的 Actor/Post/Reply/Reaction/Repost(=Post.kind)/Follow/Report/步骤(=TraceEvent+created_at)。
- **占位符扫描**：无 TBD/TODO；每个代码步给了完整代码与可运行命令。
- **类型一致性**：`load_run_snapshot` 签名、各模型字段名（如 `author_id`、`num_followers`、`kind`）在 任务 1/3/4 中一致；测试断言与模型字段逐一对应。
