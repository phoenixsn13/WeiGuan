import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { InterviewDrawer } from "./InterviewDrawer";

const actor = {
  user_id: 2,
  user_name: "marco",
  name: "Marco",
  bio: "后端老兵",
  num_followers: 5,
  num_followings: 3,
};

beforeEach(() => localStorage.setItem("wg_llm_key", "sk-x"));
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

test("null actor renders nothing", () => {  // review:P5-T4-AC1
  const { container } = render(
    <InterviewDrawer runId="r_1" actor={null} onClose={() => {}} />,
  );
  expect(container).toBeEmptyDOMElement();
});

test("asks question and shows answer", async () => {  // review:P5-T4-AC2
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ answer: "依赖图大，冷启动骗不了人" }),
    })),
  );
  render(<InterviewDrawer runId="r_1" actor={actor} onClose={() => {}} />);
  expect(screen.getByText("Marco")).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText(/继续问/), {
    target: { value: "为什么不信?" },
  });
  fireEvent.click(screen.getByText("问"));
  expect(await screen.findByText(/冷启动骗不了人/)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText(/为什么不信/)).toBeInTheDocument());
});
