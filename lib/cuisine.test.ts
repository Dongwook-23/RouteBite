import { describe, expect, test } from "vitest";
import { cuisineLabel, extractCuisineSlug } from "@/lib/cuisine";

describe("extractCuisineSlug", () => {
  test("catering.restaurant 아래 세부 카테고리에서 슬러그를 뽑는다", () => {
    expect(
      extractCuisineSlug(["catering.restaurant", "catering.restaurant.italian"]),
    ).toBe("italian");
  });

  test("세부 카테고리가 없으면 null을 반환한다", () => {
    expect(extractCuisineSlug(["catering.restaurant", "catering"])).toBeNull();
  });

  test("categories가 비어 있으면 null을 반환한다", () => {
    expect(extractCuisineSlug([])).toBeNull();
  });
});

describe("cuisineLabel", () => {
  test("알려진 슬러그는 한글 이름으로 변환한다", () => {
    expect(cuisineLabel("italian")).toBe("이탈리안");
    expect(cuisineLabel("korean")).toBe("한식");
    expect(cuisineLabel("sushi")).toBe("초밥/스시");
  });

  test("매핑에 없는 슬러그는 보기 좋게 변환한다", () => {
    expect(cuisineLabel("some_unmapped_cuisine")).toBe("Some Unmapped Cuisine");
  });
});
