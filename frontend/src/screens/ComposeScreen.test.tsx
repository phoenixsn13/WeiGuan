import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import ComposeScreen from "./ComposeScreen";

beforeEach(() => localStorage.setItem("wg_llm_key", "sk-x"));
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

function WorldLiveProbe() {
  const location = useLocation();
  return (
    <div>
      <span>多平台现场页</span>
      <span>{`URL${location.pathname}${location.search}`}</span>
    </div>
  );
}

function mount() {
  render(
    <MemoryRouter
      initialEntries={[
        { pathname: "/compose", state: { audience: { crowd_id: "tech_devs" } } },
      ]}
    >
      <Routes>
        <Route path="/compose" element={<ComposeScreen />} />
        <Route path="/run/:id/live" element={<div>进行时页</div>} />
        <Route path="/world/:id/live" element={<WorldLiveProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

function runPostBody(spy: ReturnType<typeof vi.fn>) {
  const call = spy.mock.calls.find(
    ([url, init]) =>
      url === "/api/runs" && (init as RequestInit | undefined)?.method === "POST",
  ) as [string, RequestInit] | undefined;
  if (!call) throw new Error("missing create run request");
  return JSON.parse(call[1].body as string);
}

function personPostBody(spy: ReturnType<typeof vi.fn>) {
  const call = spy.mock.calls.find(
    ([url, init]) =>
      url === "/api/persons" && (init as RequestInit | undefined)?.method === "POST",
  ) as [string, RequestInit] | undefined;
  if (!call) throw new Error("missing create person request");
  return JSON.parse(call[1].body as string);
}

function multiRunPostBody(spy: ReturnType<typeof vi.fn>) {
  const call = spy.mock.calls.find(
    ([url, init]) =>
      url === "/api/multi-runs" && (init as RequestInit | undefined)?.method === "POST",
  ) as [string, RequestInit] | undefined;
  if (!call) throw new Error("missing create multi run request");
  return JSON.parse(call[1].body as string);
}

test("submits content and navigates to live", async () => {  // review:P4-T6-AC1
  const spy = vi.fn(async (url: string) => ({
    ok: true,
    json: async () =>
      url === "/api/persons"
        ? {
            world_id: "w_new",
            person: {
              person_id: "p_new",
              display_name: "普通人test",
              persona_kind: "ordinary",
              accounts: [],
            },
          }
        : { run_id: "r_9" },
  }));
  vi.stubGlobal("fetch", spy);
  mount();
  fireEvent.change(screen.getByPlaceholderText(/有什么新鲜事/), {
    target: { value: "构建砍到3秒" },
  });
  fireEvent.click(screen.getByText(/开始围观/));
  await waitFor(() => expect(screen.getByText("进行时页")).toBeInTheDocument());
  const body = runPostBody(spy);
  expect(body.content).toBe("构建砍到3秒");
  expect(body.steps).toBe(10);
  expect(spy.mock.calls.some(([url]) => url === "/api/multi-runs")).toBe(false);
});

test("selecting two platforms creates a multi-platform world run", async () => {  // review:P11-T5-AC2
  const spy = vi.fn(async (url: string) => ({
    ok: true,
    json: async () =>
      url === "/api/persons"
        ? {
            world_id: "w_new",
            person: {
              person_id: "p_new",
              display_name: "普通人test",
              persona_kind: "ordinary",
              accounts: [],
            },
          }
        : url === "/api/multi-runs"
          ? { world_id: "w_multi", run_ids: ["run-twitter", "run-reddit"] }
          : { run_id: "r_ignored" },
  }));
  vi.stubGlobal("fetch", spy);
  mount();

  fireEvent.change(screen.getByPlaceholderText(/有什么新鲜事/), {
    target: { value: "多平台同发" },
  });
  fireEvent.click(screen.getByLabelText("Reddit"));

  expect(screen.getByText("多平台并发")).toBeInTheDocument();
  expect(screen.getByText(/这条会同时在微博和 Reddit 发酵/)).toBeInTheDocument();
  fireEvent.click(screen.getByText(/开始围观/));

  await waitFor(() => expect(screen.getByText("多平台现场页")).toBeInTheDocument());
  expect(screen.getByText("URL/world/w_multi/live?run_id=run-twitter&run_id=run-reddit")).toBeInTheDocument();
  expect(spy.mock.calls.some(([url]) => url === "/api/runs")).toBe(false);
  expect(multiRunPostBody(spy)).toMatchObject({
    content: "多平台同发",
    platforms: ["twitter", "reddit"],
    world_id: "w_new",
    poster_person_id: "p_new",
  });
});

test("disables start button while the launch request is pending", async () => {  // review:P13-T7
  const personPromise = new Promise<{ ok: boolean; json: () => Promise<unknown> }>(() => undefined);
  const spy = vi.fn((url: string) => {
    if (url.includes("preview-cost")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ estimated_rmb: 1.8, budgeted_agents: 8, decision_steps: 9 }),
      });
    }
    if (url === "/api/persons") {
      return personPromise;
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ run_id: "r_pending" }),
    });
  });
  vi.stubGlobal("fetch", spy);
  mount();

  fireEvent.change(screen.getByPlaceholderText(/有什么新鲜事/), {
    target: { value: "观察提交态" },
  });
  fireEvent.click(screen.getByText(/开始围观/));

  await waitFor(() =>
    expect(screen.getByRole("button", { name: "正在发起" })).toBeDisabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "正在发起" }));
  expect(spy.mock.calls.filter(([url]) => url === "/api/persons")).toHaveLength(1);
});

test("continuing an identity sends world and person ids to multi-platform run", async () => {  // review:P11-T5-AC3
  const spy = vi.fn(async (url: string) => ({
    ok: true,
    json: async () => {
      if (url.includes("preview-cost")) {
        return { estimated_rmb: 1.8, budgeted_agents: 8, decision_steps: 9 };
      }
      if (url === "/api/identities") {
        return {
          identities: [
            {
              world_id: "w_1",
              person_id: "p_author",
              display_name: "财经大号",
              persona_kind: "kol",
              total_influence: 56,
              run_count: 2,
            },
          ],
        };
      }
      return url === "/api/multi-runs"
        ? { world_id: "w_1", run_ids: ["run-twitter", "run-reddit"] }
        : { run_id: "r_ignored" };
    },
  }));
  vi.stubGlobal("fetch", spy);
  mount();

  fireEvent.click(screen.getByLabelText(/继续身份/));
  expect(await screen.findByText("财经大号")).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Reddit"));
  fireEvent.change(screen.getByPlaceholderText(/有什么新鲜事/), {
    target: { value: "继续身份多平台" },
  });
  fireEvent.click(screen.getByText(/开始围观/));

  await waitFor(() => expect(screen.getByText("多平台现场页")).toBeInTheDocument());
  expect(multiRunPostBody(spy)).toMatchObject({
    world_id: "w_1",
    poster_person_id: "p_author",
    persona: "kol",
  });
});

test("start is blocked when every platform is unchecked", async () => {  // review:P11-T5-AC4
  const spy = vi.fn(async (_url: string) => ({
    ok: true,
    json: async () => ({ run_id: "r_should_not_create" }),
  }));
  vi.stubGlobal("fetch", spy);
  mount();

  fireEvent.click(screen.getByLabelText("微博"));
  fireEvent.change(screen.getByPlaceholderText(/有什么新鲜事/), {
    target: { value: "没有平台" },
  });
  fireEvent.click(screen.getByText(/开始围观/));

  expect(await screen.findByText("至少选择一个平台")).toBeInTheDocument();
  expect(spy.mock.calls.some(([url]) => url === "/api/runs" || url === "/api/multi-runs")).toBe(false);
});

test("explains rounds and submits a custom long run", async () => {  // review:UI-P11-AC2
  const spy = vi.fn(async (url: string) => ({
    ok: true,
    json: async () =>
      url === "/api/persons"
        ? {
            world_id: "w_new",
            person: {
              person_id: "p_new",
              display_name: "普通人test",
              persona_kind: "ordinary",
              accounts: [],
            },
          }
        : { run_id: "r_1000" },
  }));
  vi.stubGlobal("fetch", spy);
  mount();

  expect(screen.getByText(/第 1 拍发布原帖/)).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText(/自定义轮次/));
  fireEvent.change(screen.getByLabelText("自定义轮次数"), { target: { value: "1000" } });
  fireEvent.change(screen.getByPlaceholderText(/有什么新鲜事/), {
    target: { value: "长帖发酵测试" },
  });
  fireEvent.click(screen.getByText(/开始围观/));

  await waitFor(() => expect(screen.getByText("进行时页")).toBeInTheDocument());
  const body = runPostBody(spy);
  expect(body.steps).toBe(1000);
});

test("shows error when create fails", async () => {  // review:P4-T6-AC2
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: false,
      json: async () => ({ detail: "missing X-LLM-Key" }),
    })),
  );
  localStorage.clear();
  mount();
  fireEvent.change(screen.getByPlaceholderText(/有什么新鲜事/), {
    target: { value: "hi" },
  });
  fireEvent.click(screen.getByText(/开始围观/));
  expect(await screen.findByText(/missing X-LLM-Key/)).toBeInTheDocument();
});

test("saves provider settings locally and sends them when starting", async () => {  // review:PA-T3-AC1
  const spy = vi.fn(async (url: string) => ({
    ok: true,
    json: async () =>
      url === "/api/persons"
        ? {
            world_id: "w_new",
            person: {
              person_id: "p_new",
              display_name: "普通人test",
              persona_kind: "ordinary",
              accounts: [],
            },
          }
        : { run_id: "r_9" },
  }));
  vi.stubGlobal("fetch", spy);
  localStorage.clear();
  mount();

  fireEvent.change(screen.getByLabelText("API Key"), { target: { value: "sk-local" } });
  fireEvent.change(screen.getByLabelText("Base URL"), {
    target: { value: "https://api.deepseek.com" },
  });
  fireEvent.change(screen.getByLabelText("Model"), {
    target: { value: "deepseek-v4-pro" },
  });
  fireEvent.change(screen.getByLabelText("Reasoning"), { target: { value: "high" } });
  fireEvent.change(screen.getByLabelText("Thinking"), { target: { value: "enabled" } });
  fireEvent.change(screen.getByPlaceholderText(/有什么新鲜事/), {
    target: { value: "构建砍到3秒" },
  });
  fireEvent.click(screen.getByText(/开始围观/));

  await waitFor(() => expect(screen.getByText("进行时页")).toBeInTheDocument());
  expect(localStorage.getItem("wg_llm_base_url")).toBe("https://api.deepseek.com");
  expect(localStorage.getItem("wg_llm_reasoning")).toBe("high");
  expect(localStorage.getItem("wg_llm_thinking")).toBe("enabled");
  const [, init] = (spy.mock.calls as unknown as Array<[unknown, RequestInit | undefined]>).find(
    ([url, requestInit]) =>
      url === "/api/runs" && (requestInit as RequestInit | undefined)?.method === "POST",
  ) as unknown as [unknown, RequestInit];
  const headers = init.headers as Record<string, string>;
  expect(headers["X-LLM-Base-Url"]).toBe("https://api.deepseek.com");
  expect(headers["X-LLM-Reasoning-Effort"]).toBe("high");
  expect(headers["X-LLM-Thinking"]).toBe("enabled");
});

test("byok settings stay inside the narrow settings rail", () => {  // review:UI-P5-AC1
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ run_id: "r_9" }),
    })),
  );
  mount();
  const apiKey = screen.getByLabelText("API Key");
  const grid = apiKey.closest("div");
  expect(grid?.className).not.toContain("grid-cols-2");
  expect(apiKey.className).toContain("min-w-0");
});

test("selecting KOL persona sends poster_persona", async () => {  // review:P7-T5-AC3
  const spy = vi.fn(async (url: string) => ({
    ok: true,
    json: async () =>
      url.includes("preview-cost")
        ? { estimated_rmb: 1.8, budgeted_agents: 8, decision_steps: 9 }
        : url === "/api/persons"
          ? {
              world_id: "w_kol",
              person: {
                person_id: "p_kol",
                display_name: "KOLtest",
                persona_kind: "kol",
                accounts: [],
              },
            }
          : { run_id: "r_kol" },
  }));
  vi.stubGlobal("fetch", spy);
  mount();

  fireEvent.click(screen.getByLabelText(/KOL/));
  fireEvent.change(screen.getByPlaceholderText(/有什么新鲜事/), {
    target: { value: "KOL 发帖" },
  });
  fireEvent.click(screen.getByText(/开始围观/));

  await waitFor(() => expect(screen.getByText("进行时页")).toBeInTheDocument());
  expect(runPostBody(spy).poster_persona).toBe("kol");
});

test("continuing an identity sends poster_person_id", async () => {  // review:P7-T5-AC4
  const spy = vi.fn(async (url: string) => ({
    ok: true,
    json: async () => {
      if (url.includes("preview-cost")) {
        return { estimated_rmb: 1.8, budgeted_agents: 8, decision_steps: 9 };
      }
      if (url === "/api/identities") {
        return {
          identities: [
            {
              world_id: "w_1",
              person_id: "p_author",
              display_name: "财经大号",
              persona_kind: "kol",
              total_influence: 56,
              run_count: 2,
            },
          ],
        };
      }
      return { run_id: "r_identity" };
    },
  }));
  vi.stubGlobal("fetch", spy);
  mount();

  fireEvent.click(screen.getByLabelText(/继续身份/));
  expect(await screen.findByText("财经大号")).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText(/有什么新鲜事/), {
    target: { value: "继续发帖" },
  });
  fireEvent.click(screen.getByText(/开始围观/));

  await waitFor(() => expect(screen.getByText("进行时页")).toBeInTheDocument());
  expect(runPostBody(spy).poster_person_id).toBe("p_author");
  expect(runPostBody(spy).world_id).toBe("w_1");
  expect(localStorage.getItem("wg_current_person_id")).toBe("p_author");
});

test("new identity creates a persistent person before starting run", async () => {  // review:P7-T12-AC2
  const spy = vi.fn(async (url: string) => ({
    ok: true,
    json: async () => {
      if (url.includes("preview-cost")) {
        return { estimated_rmb: 1.8, budgeted_agents: 8, decision_steps: 9 };
      }
      if (url === "/api/persons") {
        return {
          world_id: "w_new",
          person: {
            person_id: "p_new",
            display_name: "财经观察员",
            persona_kind: "verified",
            accounts: [],
          },
        };
      }
      return { run_id: "r_new_identity" };
    },
  }));
  vi.stubGlobal("fetch", spy);
  mount();

  fireEvent.click(screen.getByLabelText(/大V/));
  fireEvent.change(screen.getByLabelText("身份昵称"), { target: { value: "财经观察员" } });
  fireEvent.change(screen.getByPlaceholderText(/有什么新鲜事/), {
    target: { value: "新身份发帖" },
  });
  fireEvent.click(screen.getByText(/开始围观/));

  await waitFor(() => expect(screen.getByText("进行时页")).toBeInTheDocument());
  const calls = spy.mock.calls as unknown as Array<[string, RequestInit | undefined]>;
  const personIndex = calls.findIndex(([url]) => url === "/api/persons");
  const runIndex = calls.findIndex(
    ([url, init]) => url === "/api/runs" && (init as RequestInit | undefined)?.method === "POST",
  );
  expect(personIndex).toBeGreaterThanOrEqual(0);
  expect(runIndex).toBeGreaterThan(personIndex);
  expect(personPostBody(spy)).toMatchObject({
    display_name: "财经观察员",
    persona_kind: "verified",
    platform: "twitter",
  });
  expect(runPostBody(spy)).toMatchObject({
    world_id: "w_new",
    poster_person_id: "p_new",
    poster_persona: "verified",
  });
  expect(localStorage.getItem("wg_current_person_id")).toBe("p_new");
  expect(localStorage.getItem("wg_current_world_id")).toBe("w_new");
});

test("continuing an identity uses picker world and person ids", async () => {  // review:P7-T12-AC3
  const spy = vi.fn(async (url: string) => ({
    ok: true,
    json: async () => {
      if (url.includes("preview-cost")) {
        return { estimated_rmb: 1.8, budgeted_agents: 8, decision_steps: 9 };
      }
      if (url === "/api/identities") {
        return {
          identities: [
            {
              world_id: "w_1",
              person_id: "p_author",
              display_name: "财经大号",
              persona_kind: "kol",
              total_influence: 56,
              run_count: 2,
            },
          ],
        };
      }
      return { run_id: "r_continue_identity" };
    },
  }));
  vi.stubGlobal("fetch", spy);
  mount();

  fireEvent.click(screen.getByLabelText(/继续身份/));
  expect(await screen.findByText("财经大号")).toBeInTheDocument();
  expect(screen.queryByLabelText("身份 ID")).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText(/财经大号/));
  fireEvent.change(screen.getByPlaceholderText(/有什么新鲜事/), {
    target: { value: "继续发帖" },
  });
  fireEvent.click(screen.getByText(/开始围观/));

  await waitFor(() => expect(screen.getByText("进行时页")).toBeInTheDocument());
  expect(runPostBody(spy)).toMatchObject({
    world_id: "w_1",
    poster_person_id: "p_author",
  });
  expect(localStorage.getItem("wg_current_person_id")).toBe("p_author");
  expect(localStorage.getItem("wg_current_world_id")).toBe("w_1");
});

test("continuing many identities uses a bounded searchable picker", async () => {  // review:P11-T8-AC1
  const identities = Array.from({ length: 100 }, (_, index) => ({
    world_id: `w_${index}`,
    person_id: `p_${index}`,
    display_name: index === 87 ? "长列表目标身份" : `测试身份${index}`,
    persona_kind: "ordinary" as const,
    total_influence: 100 - index,
    run_count: index + 1,
  }));
  const spy = vi.fn(async (url: string) => ({
    ok: true,
    json: async () => {
      if (url.includes("preview-cost")) {
        return { estimated_rmb: 1.8, budgeted_agents: 8, decision_steps: 9 };
      }
      if (url === "/api/identities") {
        return { identities };
      }
      return { run_id: "r_continue_large_identity" };
    },
  }));
  vi.stubGlobal("fetch", spy);
  mount();

  fireEvent.click(screen.getByLabelText(/继续身份/));
  expect(await screen.findByText(/已保存 100 个身份/)).toBeInTheDocument();
  expect(screen.getByTestId("identity-picker-list").className).toContain("max-h-80");
  expect(screen.getByText("测试身份0")).toBeInTheDocument();
  expect(screen.queryByText("长列表目标身份")).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("搜索身份"), {
    target: { value: "目标" },
  });
  fireEvent.click(await screen.findByLabelText(/长列表目标身份/));
  fireEvent.change(screen.getByPlaceholderText(/有什么新鲜事/), {
    target: { value: "长列表身份继续发帖" },
  });
  fireEvent.click(screen.getByText(/开始围观/));

  await waitFor(() => expect(screen.getByText("进行时页")).toBeInTheDocument());
  expect(runPostBody(spy)).toMatchObject({
    world_id: "w_87",
    poster_person_id: "p_87",
  });
});

test("cost preview renders RMB and changes with steps", async () => {  // review:P7-T5-AC5
  const spy = vi.fn(async (url: string) => ({
    ok: true,
    json: async () =>
      url.includes("preview-cost")
        ? { estimated_rmb: 2.4, budgeted_agents: 6, decision_steps: 9 }
        : { run_id: "r_cost" },
  }));
  vi.stubGlobal("fetch", spy);
  mount();

  expect(await screen.findAllByText(/约 ¥2.40/)).toHaveLength(2);
  expect(screen.getByText(/自有算力/)).toBeInTheDocument();
  expect(screen.getByText(/付费 API/)).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText(/深度发酵/));

  await waitFor(() =>
    expect(
      spy.mock.calls.some(([url]) => String(url).includes("steps=15")),
    ).toBe(true),
  );
});
