import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import GalleryScreen from "./GalleryScreen";

function mount() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => [
        { id: "tech_devs", name: "科技程序员群", emoji: "T", blurb: "毒舌" },
      ],
    })),
  );
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<GalleryScreen />} />
        <Route path="/compose" element={<div>写内容页</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => vi.restoreAllMocks());

test("renders crowd cards from api", async () => {  // review:P4-T5-AC1
  mount();
  expect(await screen.findByText("科技程序员群")).toBeInTheDocument();
});

test("clicking a crowd navigates to compose", async () => {  // review:P4-T5-AC2
  mount();
  fireEvent.click(await screen.findByText("科技程序员群"));
  await waitFor(() => expect(screen.getByText("写内容页")).toBeInTheDocument());
});

test("custom audience navigates to compose", async () => {  // review:P4-T5-AC3
  mount();
  await screen.findByText("科技程序员群");
  fireEvent.change(screen.getByPlaceholderText(/一句话描述/), {
    target: { value: "年轻妈妈" },
  });
  fireEvent.click(screen.getByText(/用这个受众/));
  await waitFor(() => expect(screen.getByText("写内容页")).toBeInTheDocument());
});
