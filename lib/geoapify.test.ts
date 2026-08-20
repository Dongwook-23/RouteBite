import { describe, expect, test, vi } from "vitest";
import {
  GEOAPIFY_DAILY_CREDIT_LIMIT,
  GeoapifyQuotaExceededError,
  geocodeAutocomplete,
  rankRestaurantsByTravelTime,
  type RestaurantPlace,
} from "@/lib/geoapify";

describe("rankRestaurantsByTravelTime", () => {
  const places: RestaurantPlace[] = [
    { placeId: "a", name: "Far Place", address: "A", lat: 1, lon: 1, categories: [] },
    { placeId: "b", name: "Near Place", address: "B", lat: 2, lon: 2, categories: [] },
    { placeId: "c", name: "Mid Place", address: "C", lat: 3, lon: 3, categories: [] },
  ];

  test("정렬: 이동시간이 짧은 순으로 정렬한다", () => {
    const travelTimes = [
      { distanceMeters: 5000, travelTimeSeconds: 900 },
      { distanceMeters: 200, travelTimeSeconds: 120 },
      { distanceMeters: 1500, travelTimeSeconds: 400 },
    ];

    const ranked = rankRestaurantsByTravelTime(places, travelTimes);

    expect(ranked.map((r) => r.placeId)).toEqual(["b", "c", "a"]);
    expect(ranked[0].travelTimeSeconds).toBe(120);
  });

  test("누락된 이동시간 항목은 맨 뒤로 정렬된다", () => {
    const travelTimes = [
      { distanceMeters: 5000, travelTimeSeconds: 900 },
      { distanceMeters: 200, travelTimeSeconds: 120 },
    ];

    const ranked = rankRestaurantsByTravelTime(places, travelTimes);

    expect(ranked.at(-1)?.placeId).toBe("c");
    expect(ranked.at(-1)?.travelTimeSeconds).toBe(Number.POSITIVE_INFINITY);
  });

  test("빈 목록이면 빈 배열을 반환한다", () => {
    expect(rankRestaurantsByTravelTime([], [])).toEqual([]);
  });
});

describe("Geoapify 일일 크레딧 한도", () => {
  test("일일 한도를 초과하면 실제 요청 없이 GeoapifyQuotaExceededError를 던진다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    for (let i = 0; i < GEOAPIFY_DAILY_CREDIT_LIMIT; i++) {
      await geocodeAutocomplete("test", "key");
    }
    expect(fetchMock).toHaveBeenCalledTimes(GEOAPIFY_DAILY_CREDIT_LIMIT);

    await expect(geocodeAutocomplete("test", "key")).rejects.toThrow(
      GeoapifyQuotaExceededError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(GEOAPIFY_DAILY_CREDIT_LIMIT);

    vi.unstubAllGlobals();
  });
});
