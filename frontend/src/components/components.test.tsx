import { fireEvent, render, screen } from "@testing-library/react";

import { Button } from "./Button";
import { Card } from "./Card";
import { SentimentTag } from "./SentimentTag";

test("button fires onClick and shows label", () => {  // review:PF0-T3-AC1
  const fn = vi.fn();
  render(<Button onClick={fn}>开始围观</Button>);
  fireEvent.click(screen.getByText("开始围观"));
  expect(fn).toHaveBeenCalledOnce();
});

test("interactive card has spotlight hover class", () => {  // review:PF0-T3-AC2
  render(<Card interactive>内容</Card>);
  expect(screen.getByTestId("wg-card").className).toContain("hover:shadow-spotlight");
});

test("sentiment tag colors positive", () => {  // review:PF0-T3-AC3
  render(<SentimentTag kind="positive" label="正向" />);
  const el = screen.getByText("正向");
  expect(el).toHaveStyle({ color: "#3E9B6E" });
});
