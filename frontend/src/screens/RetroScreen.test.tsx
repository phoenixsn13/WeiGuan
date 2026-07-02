import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import RetroScreen from "./RetroScreen";

beforeEach(() => localStorage.setItem("wg_llm_key", "sk-x"));
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

function mount() {
  render(
    <MemoryRouter initialEntries={["/run/r_1/retro"]}>
      <Routes>
        <Route path="/run/:id/retro" element={<RetroScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

test("renders sentiment from retro metrics", async () => {  // review:P5-T5-AC1
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("/snapshot")) {
        return {
          ok: true,
          json: async () => ({
            platform: "twitter",
            seed_post_id: 1,
            actors: [],
            posts: [],
            replies: [],
            reactions: [],
            follows: [],
            reports: [],
            traces: [],
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          sentiment: { positive: 5, negative: 2, neutral: 3 },
          spread_by_step: [1, 3, 2],
          totals: { reposts: 1, reports: 1 },
        }),
      };
    }),
  );
  mount();
  expect((await screen.findAllByText(/^正向$/)).length).toBeGreaterThan(0);
  expect(screen.getByText(/50%/)).toBeInTheDocument();
  expect(screen.getByText("围观回放")).toBeInTheDocument();
  expect(screen.getAllByText("发酵时间线").length).toBeGreaterThan(0);
  expect(screen.getByText(/第 1 波/)).toBeInTheDocument();
  expect(screen.getByText("回到评论区")).toHaveAttribute(
    "href",
    "/run/r_1/live?replay=1",
  );
});

test("replay timeline uses saved snapshot replies instead of canned copy", async () => {  // review:UI-P1-AC8
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("/snapshot")) {
        return {
          ok: true,
          json: async () => ({
            platform: "twitter",
            seed_post_id: 1,
            actors: [
              {
                user_id: 2,
                user_name: "dev_marco",
                name: "Marco",
                num_followers: 12,
                num_followings: 3,
              },
            ],
            posts: [
              {
                post_id: 1,
                author_id: 1,
                kind: "original",
                content: "真实历史主帖",
                num_likes: 0,
                num_dislikes: 0,
                num_shares: 0,
                num_reports: 0,
              },
            ],
            replies: [
              {
                comment_id: 7,
                post_id: 1,
                author_id: 2,
                content: "真实历史评论：CI 环境要说明",
                num_likes: 3,
                num_dislikes: 0,
              },
            ],
            reactions: [],
            follows: [],
            reports: [],
            traces: [],
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          sentiment: { positive: 1, negative: 0, neutral: 0 },
          spread_by_step: [1],
          totals: { replies: 1 },
        }),
      };
    }),
  );

  mount();

  expect(await screen.findByText("真实历史评论：CI 环境要说明")).toBeInTheDocument();
  expect(screen.getByText("Marco")).toBeInTheDocument();
  expect(screen.queryByText("缓存没清吧？")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "时间轴视图" }));
  expect(screen.getByText("发布正文")).toBeInTheDocument();
});

test("retro sidebar cleans profile prefixes and negative filter shows negative signals", async () => {  // review:UI-P17-AC1
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("/snapshot")) {
        return {
          ok: true,
          json: async () => ({
            platform: "twitter",
            seed_post_id: 1,
            actors: [
              {
                user_id: 1,
                user_name: "财00_韭菜观察员",
                name: "财00_韭菜观察员",
                num_followers: 12,
                num_followings: 3,
              },
              {
                user_id: 2,
                user_name: "财02_估值小刀",
                name: "财02_估值小刀",
                num_followers: 9,
                num_followings: 3,
              },
            ],
            posts: [
              {
                post_id: 1,
                author_id: 1,
                kind: "original",
                content: "AI 发展这么快",
                num_likes: 0,
                num_dislikes: 0,
                num_shares: 0,
                num_reports: 0,
              },
            ],
            replies: [
              {
                comment_id: 7,
                post_id: 1,
                author_id: 2,
                content: "估值全靠故事，泡沫太明显了",
                num_likes: 0,
                num_dislikes: 0,
              },
            ],
            reactions: [],
            follows: [],
            reports: [],
            traces: [],
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          sentiment: { positive: 49, negative: 3, neutral: 16 },
          spread_by_step: [1],
          totals: { replies: 1, reports: 3 },
        }),
      };
    }),
  );

  mount();

  expect(await screen.findByText("韭菜观察员")).toBeInTheDocument();
  expect(screen.queryByText("财00_韭菜观察员")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "负向" }));
  expect(screen.queryByText("没有符合条件的阶段。")).not.toBeInTheDocument();
  expect(screen.getByText("估值全靠故事，泡沫太明显了")).toBeInTheDocument();
  expect(screen.getByText("估值小刀")).toBeInTheDocument();
});

test("sentiment tabs classify stages by their dominant evidence", async () => {  // review:UI-P18-AC1
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("/snapshot")) {
        return {
          ok: true,
          json: async () => ({
            platform: "twitter",
            seed_post_id: 1,
            actors: [
              {
                user_id: 1,
                user_name: "财00_韭菜观察员",
                name: "财00_韭菜观察员",
                num_followers: 12,
                num_followings: 3,
              },
              {
                user_id: 2,
                user_name: "研报搬砖人",
                name: "研报搬砖人",
                num_followers: 9,
                num_followings: 3,
              },
            ],
            posts: [
              {
                post_id: 1,
                author_id: 1,
                kind: "original",
                content: "AI 发展这么快",
                num_likes: 0,
                num_dislikes: 0,
                num_shares: 0,
                num_reports: 0,
              },
            ],
            replies: [
              {
                comment_id: 6,
                post_id: 1,
                author_id: 2,
                content: "这个方向挺靠谱，落地数据如果跟上就看好",
                num_likes: 0,
                num_dislikes: 0,
              },
              {
                comment_id: 7,
                post_id: 1,
                author_id: 2,
                content: "先看落地数据，泡沫风险也要说清楚",
                num_likes: 0,
                num_dislikes: 0,
              },
              {
                comment_id: 8,
                post_id: 1,
                author_id: 2,
                content: "我还在观望，政策怎么落地还不好说",
                num_likes: 0,
                num_dislikes: 0,
              },
              {
                comment_id: 9,
                post_id: 1,
                author_id: 2,
                content: "继续看后续披露，先不下结论",
                num_likes: 0,
                num_dislikes: 0,
              },
            ],
            reactions: [],
            follows: [],
            reports: [],
            traces: [],
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          sentiment: { positive: 2, negative: 1, neutral: 4 },
          spread_by_step: [1, 2, 3, 4],
          totals: { replies: 1, likes: 2, reports: 1 },
        }),
      };
    }),
  );

  mount();
  await screen.findByText(/第 1 波/);

  fireEvent.click(screen.getByRole("button", { name: "正向" }));
  expect(screen.getByText(/第 1 波/)).toBeInTheDocument();
  expect(screen.queryByText(/第 2 波/)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "负向" }));
  expect(screen.getByText(/第 2 波/)).toBeInTheDocument();
  expect(screen.queryByText(/第 1 波/)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "中立" }));
  expect(screen.getByText(/第 3 波/)).toBeInTheDocument();
  expect(screen.getByText(/第 4 波/)).toBeInTheDocument();
  expect(screen.queryByText(/第 1 波/)).not.toBeInTheDocument();
});

test("generate insights shows verdict and suggestions", async () => {  // review:P5-T5-AC2
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sentiment: { positive: 1, negative: 0, neutral: 0 },
        spread_by_step: [1],
        totals: {},
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        platform: "twitter",
        seed_post_id: 1,
        actors: [],
        posts: [],
        replies: [],
        reactions: [],
        follows: [],
        reports: [],
        traces: [],
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        verdict: "偏正向但有暗线",
        suggestions: ["加冷启动实测", "盯硬核用户"],
      }),
    });
  vi.stubGlobal("fetch", fetchMock);
  mount();
  await screen.findAllByText(/^正向$/);
  fireEvent.click(screen.getByText(/生成建议/));
  expect(await screen.findByText("偏正向但有暗线")).toBeInTheDocument();
  expect(screen.getByText("加冷启动实测")).toBeInTheDocument();
});

test("loads persisted insights and offers regeneration", async () => {  // review:UI-P16-AC3
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sentiment: { positive: 1, negative: 0, neutral: 0 },
        spread_by_step: [1],
        totals: {},
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        platform: "twitter",
        seed_post_id: 1,
        actors: [],
        posts: [],
        replies: [],
        reactions: [],
        follows: [],
        reports: [],
        traces: [],
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        verdict: "刷新后还在",
        suggestions: ["这是持久化建议"],
      }),
    });
  vi.stubGlobal("fetch", fetchMock);

  mount();

  expect(await screen.findByText("刷新后还在")).toBeInTheDocument();
  expect(screen.getByText("这是持久化建议")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "重新生成建议" })).toBeInTheDocument();
});
