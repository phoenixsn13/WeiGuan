import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders brand", () => {  // review:PF0-T1-AC1
  render(<App />);
  expect(screen.getByText("围观")).toBeInTheDocument();
});
