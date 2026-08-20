import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import Home from "@/app/page";

test("홈 화면은 제목과 장소 검색 입력을 보여준다", () => {
  render(<Home />);

  expect(
    screen.getByRole("heading", { level: 1, name: "맛있는 여행을 계획해 보세요" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("장소 검색")).toBeInTheDocument();
});
