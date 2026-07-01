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
