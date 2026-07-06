import type { RunSummary } from "../api/client";
import { buildTrendItems } from "./TrendRail";

function run(
  run_id: string,
  content: string,
  totals: RunSummary["totals"],
): RunSummary {
  return {
    run_id,
    content,
    steps: 15,
    platform: "twitter",
    status: "done",
    totals,
  };
}

test("buildTrendItems aggregates repeated content into one topic", () => {  // review:P13-T4
  const items = buildTrendItems([
    run("r_1", "spacex股价怎么回事啊", { replies: 13, reposts: 1, likes: 6 }),
    run("r_2", "spacex股价怎么回事啊", { replies: 9, reposts: 0, likes: 4 }),
    run("r_3", "AI算力租赁是不是泡沫", { replies: 4, reposts: 0, likes: 2 }),
  ]);

  expect(items[0]).toMatchObject({
    label: "#spacex股价怎么回事啊",
    meta: "22 评论 · 10 赞 · 发起 2 次",
  });
  expect(items.filter((item) => item.label === "#spacex股价怎么回事啊")).toHaveLength(1);
});
