import { render, screen } from "@testing-library/react";
import App from "./App";

afterEach(() => vi.restoreAllMocks());

test("renders brand", async () => {  // review:PF0-T1-AC1
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => [
        { id: "review_crowd", name: "审核圈子", emoji: "R", blurb: "用于 App 测试" },
      ],
    })),
  );
  render(<App />);
  expect(screen.getByText("围观")).toBeInTheDocument();
  expect(await screen.findByText("审核圈子")).toBeInTheDocument();
});
