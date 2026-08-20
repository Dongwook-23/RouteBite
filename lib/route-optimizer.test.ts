import { describe, expect, test } from "vitest";
import { findOptimalRoundTrip, type TravelTimeCell } from "@/lib/route-optimizer";

function matrixFrom(rows: number[][]): TravelTimeCell[][] {
  return rows.map((row) =>
    row.map((time) => ({ travelTimeSeconds: time, distanceMeters: time * 10 })),
  );
}

describe("findOptimalRoundTrip", () => {
  test("스톱이 없으면 빈 경로를 반환한다", () => {
    const matrix = matrixFrom([[0]]);
    const result = findOptimalRoundTrip(matrix);
    expect(result.order).toEqual([]);
    expect(result.legs).toEqual([]);
    expect(result.totalTravelTimeSeconds).toBe(0);
  });

  test("스톱이 1개면 출발점→스톱→출발점 하나의 경로만 있다", () => {
    // index 0 = origin, index 1 = stop
    const matrix = matrixFrom([
      [0, 100],
      [120, 0],
    ]);
    const result = findOptimalRoundTrip(matrix);
    expect(result.order).toEqual([1]);
    expect(result.legs).toEqual([
      { fromIndex: 0, toIndex: 1, travelTimeSeconds: 100, distanceMeters: 1000 },
      { fromIndex: 1, toIndex: 0, travelTimeSeconds: 120, distanceMeters: 1200 },
    ]);
    expect(result.totalTravelTimeSeconds).toBe(220);
  });

  test("스톱이 여러 개면 총 이동시간이 최소인 순서를 고른다", () => {
    // origin=0, stops=1,2,3. Deliberately make order [2,1,3] cheapest via asymmetric costs.
    const matrix = matrixFrom([
      [0, 10, 50, 10],
      [10, 0, 5, 100],
      [50, 5, 0, 5],
      [10, 100, 5, 0],
    ]);
    const result = findOptimalRoundTrip(matrix);

    // Brute-force expectation computed by hand for this matrix:
    // 0->2->1->3->0 = 50+5+100+10 = 165
    // 0->1->2->3->0 = 10+5+5+10 = 30  <- cheapest
    // 0->1->3->2->0 = 10+100+5+50 = 165
    // 0->3->2->1->0 = 10+5+5+10 = 30 (reverse of best, same cost)
    expect(result.totalTravelTimeSeconds).toBe(30);
    expect([
      [1, 2, 3],
      [3, 2, 1],
    ]).toContainEqual(result.order);
  });

  test("모든 경로 후보 중 실제로 총 이동시간이 최소인지 전수조사와 대조한다", () => {
    const matrix = matrixFrom([
      [0, 7, 9, 3],
      [8, 0, 4, 6],
      [5, 6, 0, 2],
      [3, 9, 4, 0],
    ]);
    const result = findOptimalRoundTrip(matrix);

    function permutations(arr: number[]): number[][] {
      if (arr.length <= 1) return [arr];
      const out: number[][] = [];
      arr.forEach((item, i) => {
        const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
        for (const p of permutations(rest)) out.push([item, ...p]);
      });
      return out;
    }

    const bruteForceBest = Math.min(
      ...permutations([1, 2, 3]).map((perm) => {
        const path = [0, ...perm, 0];
        let total = 0;
        for (let i = 0; i < path.length - 1; i++) {
          total += matrix[path[i]][path[i + 1]].travelTimeSeconds;
        }
        return total;
      }),
    );

    expect(result.totalTravelTimeSeconds).toBe(bruteForceBest);
  });
});
