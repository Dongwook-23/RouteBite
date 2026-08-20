import { computeTravelTimeMatrix, type TravelMode } from "@/lib/geoapify";
import { findOptimalRoundTrip } from "@/lib/route-optimizer";

export type Stop = {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
};

export type RouteLeg = {
  from: Stop | null;
  to: Stop | null;
  travelTimeSeconds: number;
  distanceMeters: number;
};

export type RoundTripPlan = {
  order: Stop[];
  legs: RouteLeg[];
  totalTravelTimeSeconds: number;
  totalDistanceMeters: number;
};

export async function planRoundTrip(
  mode: TravelMode,
  origin: { lat: number; lon: number },
  stops: Stop[],
  apiKey: string,
): Promise<RoundTripPlan> {
  const points = [origin, ...stops.map((s) => ({ lat: s.lat, lon: s.lon }))];
  const matrix = await computeTravelTimeMatrix(mode, points, apiKey);
  const optimal = findOptimalRoundTrip(matrix);
  const stopByIndex = (index: number) => stops[index - 1];

  return {
    order: optimal.order.map(stopByIndex),
    legs: optimal.legs.map((leg) => ({
      from: leg.fromIndex === 0 ? null : stopByIndex(leg.fromIndex),
      to: leg.toIndex === 0 ? null : stopByIndex(leg.toIndex),
      travelTimeSeconds: leg.travelTimeSeconds,
      distanceMeters: leg.distanceMeters,
    })),
    totalTravelTimeSeconds: optimal.totalTravelTimeSeconds,
    totalDistanceMeters: optimal.totalDistanceMeters,
  };
}

export function isValidStop(value: unknown): value is Stop {
  if (!value || typeof value !== "object") return false;
  const stop = value as Record<string, unknown>;
  return (
    typeof stop.placeId === "string" &&
    typeof stop.name === "string" &&
    typeof stop.address === "string" &&
    typeof stop.lat === "number" &&
    typeof stop.lon === "number"
  );
}
