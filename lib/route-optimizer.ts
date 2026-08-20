export type TravelTimeCell = {
  travelTimeSeconds: number;
  distanceMeters: number;
};

export type RouteLeg = {
  fromIndex: number;
  toIndex: number;
  travelTimeSeconds: number;
  distanceMeters: number;
};

export type OptimalRoundTrip = {
  order: number[];
  legs: RouteLeg[];
  totalTravelTimeSeconds: number;
  totalDistanceMeters: number;
};

function permutations(values: number[]): number[][] {
  if (values.length <= 1) return [values];
  const result: number[][] = [];
  values.forEach((value, index) => {
    const rest = [...values.slice(0, index), ...values.slice(index + 1)];
    for (const perm of permutations(rest)) {
      result.push([value, ...perm]);
    }
  });
  return result;
}

function buildLegs(matrix: TravelTimeCell[][], path: number[]): RouteLeg[] {
  const legs: RouteLeg[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const fromIndex = path[i];
    const toIndex = path[i + 1];
    const cell = matrix[fromIndex][toIndex];
    legs.push({
      fromIndex,
      toIndex,
      travelTimeSeconds: cell.travelTimeSeconds,
      distanceMeters: cell.distanceMeters,
    });
  }
  return legs;
}

function sumLegs(legs: RouteLeg[]) {
  return legs.reduce(
    (totals, leg) => ({
      totalTravelTimeSeconds: totals.totalTravelTimeSeconds + leg.travelTimeSeconds,
      totalDistanceMeters: totals.totalDistanceMeters + leg.distanceMeters,
    }),
    { totalTravelTimeSeconds: 0, totalDistanceMeters: 0 },
  );
}

/**
 * `matrix` is a square travel-time matrix where index 0 is the origin and
 * indices 1..n are the stops to visit. Returns the visiting order of stop
 * indices (1..n) whose round trip from and back to the origin has the lowest
 * total travel time.
 */
export function findOptimalRoundTrip(matrix: TravelTimeCell[][]): OptimalRoundTrip {
  const stopIndices = matrix.slice(1).map((_, index) => index + 1);

  if (stopIndices.length === 0) {
    return { order: [], legs: [], totalTravelTimeSeconds: 0, totalDistanceMeters: 0 };
  }

  let best: OptimalRoundTrip | null = null;

  for (const perm of permutations(stopIndices)) {
    const path = [0, ...perm, 0];
    const legs = buildLegs(matrix, path);
    const totals = sumLegs(legs);
    if (best === null || totals.totalTravelTimeSeconds < best.totalTravelTimeSeconds) {
      best = { order: perm, legs, ...totals };
    }
  }

  return best as OptimalRoundTrip;
}
