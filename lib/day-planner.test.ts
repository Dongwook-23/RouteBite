import { describe, expect, test } from "vitest";
import { clusterByProximity, MAX_STOPS_PER_DAY } from "@/lib/day-planner";

type Point = { id: string; lat: number; lon: number };

describe("clusterByProximity", () => {
  test("빈 목록이면 빈 배열을 반환한다", () => {
    expect(clusterByProximity<Point>([], 4)).toEqual([]);
  });

  test("그룹 크기를 넘지 않는다", () => {
    const points: Point[] = Array.from({ length: 10 }, (_, i) => ({
      id: `p${i}`,
      lat: 37.5 + i * 0.001,
      lon: 127 + i * 0.001,
    }));
    const groups = clusterByProximity(points, 4);
    for (const group of groups) {
      expect(group.length).toBeLessThanOrEqual(4);
    }
  });

  test("모든 항목이 정확히 한 번씩만 포함된다", () => {
    const points: Point[] = Array.from({ length: 7 }, (_, i) => ({
      id: `p${i}`,
      lat: 37.5 + i * 0.001,
      lon: 127,
    }));
    const groups = clusterByProximity(points, 4);
    const flattened = groups.flat();
    expect(flattened).toHaveLength(7);
    expect(new Set(flattened.map((p) => p.id)).size).toBe(7);
  });

  test("지리적으로 멀리 떨어진 두 무리는 같은 그룹으로 섞이지 않는다", () => {
    // Cluster A: near Seoul. Cluster B: near Paris (far away).
    const seoulCluster: Point[] = [
      { id: "a1", lat: 37.55, lon: 126.97 },
      { id: "a2", lat: 37.551, lon: 126.971 },
      { id: "a3", lat: 37.552, lon: 126.972 },
    ];
    const parisCluster: Point[] = [
      { id: "b1", lat: 48.85, lon: 2.35 },
      { id: "b2", lat: 48.851, lon: 2.351 },
      { id: "b3", lat: 48.852, lon: 2.352 },
    ];
    const groups = clusterByProximity([...seoulCluster, ...parisCluster], 4);

    for (const group of groups) {
      const ids = group.map((p) => p.id);
      const hasSeoul = ids.some((id) => id.startsWith("a"));
      const hasParis = ids.some((id) => id.startsWith("b"));
      expect(hasSeoul && hasParis).toBe(false);
    }
  });

  test("그룹 크기 이하의 입력이면 하나의 그룹으로 묶인다", () => {
    const points: Point[] = [
      { id: "p0", lat: 37.5, lon: 127 },
      { id: "p1", lat: 37.6, lon: 127.1 },
    ];
    const groups = clusterByProximity(points, 4);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  test("MAX_STOPS_PER_DAY는 4다", () => {
    expect(MAX_STOPS_PER_DAY).toBe(4);
  });
});
