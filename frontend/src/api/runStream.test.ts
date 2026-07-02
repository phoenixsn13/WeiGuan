import { act, renderHook } from "@testing-library/react";

import { useRunStream } from "./runStream";

class FakeES {
  static last: FakeES;
  listeners: Record<string, ((event: { data: string }) => void)[]> = {};
  closed = false;

  constructor() {
    FakeES.last = this;
  }

  addEventListener(name: string, cb: (event: { data: string }) => void) {
    (this.listeners[name] ??= []).push(cb);
  }

  emit(name: string, data: unknown) {
    (this.listeners[name] ?? []).forEach((cb) => cb({ data: JSON.stringify(data) }));
  }

  close() {
    this.closed = true;
  }
}

test("hook accumulates deltas and finishes", () => {  // review:P3-T4-AC1
  const factory = () => new FakeES() as unknown as EventSource;
  const { result } = renderHook(() => useRunStream("r_1", factory));
  const es = FakeES.last;
  act(() => es.emit("run_started", { run_id: "r_1", steps: 6, platform: "twitter" }));
  expect(result.current.total).toBe(6);
  expect(result.current.status).toBe("running");
  act(() => es.emit("step_started", { step: 1, total: 6 }));
  act(() =>
    es.emit("delta", {
      step: 1,
      snapshot: {
        platform: "twitter",
        seed_post_id: 1,
        actors: [],
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
        replies: [],
        reactions: [],
        follows: [],
        reports: [],
        traces: [],
      },
    }),
  );
  expect(result.current.snapshot.posts).toHaveLength(1);
  expect(result.current.step).toBe(1);
  act(() => es.emit("run_done", { run_id: "r_1" }));
  expect(result.current.status).toBe("done");
});

test("error event sets error status", () => {  // review:P3-T4-AC2
  const factory = () => new FakeES() as unknown as EventSource;
  const { result } = renderHook(() => useRunStream("r_x", factory));
  act(() => FakeES.last.emit("error", { message: "LLM key invalid" }));
  expect(result.current.status).toBe("error");
  expect(result.current.error).toBe("LLM key invalid");
});

test("hook ignores stale step events from reconnects", () => {  // review:UI-P13-AC2
  const factory = () => new FakeES() as unknown as EventSource;
  const { result } = renderHook(() => useRunStream("r_1", factory));
  const es = FakeES.last;
  act(() => es.emit("run_started", { run_id: "r_1", steps: 500 }));
  act(() => es.emit("step_started", { step: 85, total: 500 }));
  act(() =>
    es.emit("delta", {
      step: 85,
      snapshot: {
        platform: "twitter",
        seed_post_id: 1,
        actors: [],
        posts: [],
        replies: [],
        reactions: [],
        follows: [],
        reports: [],
        traces: [],
      },
    }),
  );

  act(() => es.emit("run_started", { run_id: "r_1", steps: 500 }));
  act(() => es.emit("step_started", { step: 1, total: 500 }));
  act(() =>
    es.emit("delta", {
      step: 1,
      snapshot: {
        platform: "twitter",
        seed_post_id: 1,
        actors: [],
        posts: [],
        replies: [
          {
            comment_id: 1,
            post_id: 1,
            author_id: 1,
            content: "stale",
            num_likes: 0,
            num_dislikes: 0,
          },
        ],
        reactions: [],
        follows: [],
        reports: [],
        traces: [],
      },
    }),
  );

  expect(result.current.step).toBe(85);
  expect(result.current.snapshot.replies).toHaveLength(0);
});

test("hook replaces state from running run snapshot subscription", () => {  // review:UI-P13-AC3
  const factory = () => new FakeES() as unknown as EventSource;
  const { result } = renderHook(() => useRunStream("r_1", factory));
  const es = FakeES.last;

  act(() => es.emit("run_started", { run_id: "r_1", steps: 500 }));
  act(() =>
    es.emit("snapshot", {
      step: 18,
      snapshot: {
        platform: "twitter",
        seed_post_id: 1,
        actors: [],
        posts: [],
        replies: [
          {
            comment_id: 1,
            post_id: 1,
            author_id: 1,
            content: "已有评论",
            num_likes: 0,
            num_dislikes: 0,
          },
        ],
        reactions: [],
        follows: [],
        reports: [],
        traces: [],
      },
    }),
  );

  expect(result.current.step).toBe(18);
  expect(result.current.snapshot.replies[0].content).toBe("已有评论");
  expect(result.current.status).toBe("running");
});
