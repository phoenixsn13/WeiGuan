import { useEffect, useState } from "react";

import { applyDelta, emptySnapshot } from "../model/accumulate";
import type { RunSnapshot } from "../model/canonical";

export type EventSourceFactory = (url: string) => EventSource;
export type StreamStatus = "connecting" | "running" | "done" | "error";

export interface RunStreamState {
  snapshot: RunSnapshot;
  step: number;
  total: number;
  status: StreamStatus;
  error?: string;
}

const defaultFactory: EventSourceFactory = (url) => new EventSource(url);

// review:P3-T4  消费契约 §2.3 SSE
export function useRunStream(
  runId: string,
  factory: EventSourceFactory = defaultFactory,
  enabled = true,
): RunStreamState {
  const [state, setState] = useState<RunStreamState>({
    snapshot: emptySnapshot(),
    step: 0,
    total: 0,
    status: "connecting",
  });

  useEffect(() => {
    if (!enabled) return;

    const es = factory(`/api/runs/${runId}/events`);
    const on = (name: string, fn: (data: any) => void) => {
      es.addEventListener(name, (event) => {
        fn(JSON.parse((event as MessageEvent).data));
      });
    };

    on("run_started", (data) =>
      setState((current) => ({
        ...current,
        total: data.steps,
        status: "running",
      })),
    );
    on("step_started", (data) =>
      setState((current) => ({
        ...current,
        step: Math.max(current.step, data.step),
        total: data.total,
      })),
    );
    on("delta", (data) =>
      setState((current) => {
        if (data.step < current.step) return current;
        return {
          ...current,
          step: data.step,
          snapshot: applyDelta(current.snapshot, data.snapshot),
        };
      }),
    );
    on("run_done", () => {
      setState((current) => ({ ...current, status: "done" }));
      es.close();
    });
    on("error", (data) => {
      setState((current) => ({
        ...current,
        status: "error",
        error: data?.message,
      }));
      es.close();
    });

    return () => es.close();
  }, [enabled, factory, runId]);

  return state;
}
