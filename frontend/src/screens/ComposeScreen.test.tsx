import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import ComposeScreen from "./ComposeScreen";

beforeEach(() => localStorage.setItem("wg_llm_key", "sk-x"));
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

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
      </Routes>
    </MemoryRouter>,
  );
}

test("submits content and navigates to live", async () => {  // review:P4-T6-AC1
  const spy = vi.fn(async () => ({
    ok: true,
    json: async () => ({ run_id: "r_9" }),
  }));
  vi.stubGlobal("fetch", spy);
  mount();
  fireEvent.change(screen.getByPlaceholderText(/有什么新鲜事/), {
    target: { value: "构建砍到3秒" },
  });
  fireEvent.click(screen.getByText(/开始围观/));
  await waitFor(() => expect(screen.getByText("进行时页")).toBeInTheDocument());
  const [, init] = spy.mock.calls[0] as unknown as [unknown, RequestInit];
  const body = JSON.parse(init.body as string);
  expect(body.content).toBe("构建砍到3秒");
  expect(body.steps).toBe(10);
});

test("explains rounds and submits a custom long run", async () => {  // review:UI-P11-AC2
  const spy = vi.fn(async () => ({
    ok: true,
    json: async () => ({ run_id: "r_1000" }),
  }));
  vi.stubGlobal("fetch", spy);
  mount();

  expect(screen.getByText(/第 1 步发布原帖/)).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText(/自定义轮次/));
  fireEvent.change(screen.getByLabelText("自定义轮次数"), { target: { value: "1000" } });
  fireEvent.change(screen.getByPlaceholderText(/有什么新鲜事/), {
    target: { value: "长帖发酵测试" },
  });
  fireEvent.click(screen.getByText(/开始围观/));

  await waitFor(() => expect(screen.getByText("进行时页")).toBeInTheDocument());
  const [, init] = spy.mock.calls[0] as unknown as [unknown, RequestInit];
  const body = JSON.parse(init.body as string);
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
  const spy = vi.fn(async () => ({
    ok: true,
    json: async () => ({ run_id: "r_9" }),
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
  const [, init] = spy.mock.calls[0] as unknown as [unknown, RequestInit];
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
