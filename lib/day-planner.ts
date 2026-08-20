export const MAX_STOPS_PER_DAY = 4;

type GeoPoint = { lat: number; lon: number };

function approximateMeters(a: GeoPoint, b: GeoPoint): number {
  const avgLatRad = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const dx = (b.lon - a.lon) * Math.cos(avgLatRad) * 111_320;
  const dy = (b.lat - a.lat) * 111_320;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Groups points into at most `ceil(points.length / maxGroupSize)` clusters of
 * at most `maxGroupSize` each, so geographically distant points don't get
 * merged into the same group just to fill it up. Picks well-separated seeds
 * via farthest-point sampling, then assigns each point to its nearest seed
 * with room left, so nearby places end up together.
 */
export function clusterByProximity<T extends GeoPoint>(
  points: T[],
  maxGroupSize: number,
): T[][] {
  if (points.length === 0) return [];

  const groupCount = Math.ceil(points.length / maxGroupSize);
  if (groupCount <= 1) return [points];

  const seeds: T[] = [points[0]];
  while (seeds.length < groupCount) {
    let farthest: T | null = null;
    let farthestDistance = -1;
    for (const point of points) {
      if (seeds.includes(point)) continue;
      const nearestSeedDistance = Math.min(
        ...seeds.map((seed) => approximateMeters(point, seed)),
      );
      if (nearestSeedDistance > farthestDistance) {
        farthestDistance = nearestSeedDistance;
        farthest = point;
      }
    }
    seeds.push(farthest as T);
  }

  const preferences = points.map((point) => {
    const order = seeds
      .map((_, seedIndex) => seedIndex)
      .sort(
        (a, b) =>
          approximateMeters(point, seeds[a]) - approximateMeters(point, seeds[b]),
      );
    return { point, order, nearestDistance: approximateMeters(point, seeds[order[0]]) };
  });
  preferences.sort((a, b) => a.nearestDistance - b.nearestDistance);

  const groups: T[][] = seeds.map(() => []);
  for (const { point, order } of preferences) {
    const seedIndex = order.find((index) => groups[index].length < maxGroupSize);
    groups[seedIndex as number].push(point);
  }

  return groups.filter((group) => group.length > 0);
}
