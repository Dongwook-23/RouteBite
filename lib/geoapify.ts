export type TravelMode = "walk" | "drive";

export type LocationSuggestion = {
  label: string;
  lat: number;
  lon: number;
};

export type RestaurantPlace = {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  categories: string[];
};

export type RankedRestaurant = RestaurantPlace & {
  distanceMeters: number;
  travelTimeSeconds: number;
};

const GEOAPIFY_BASE_URL = "https://api.geoapify.com";

export function getGeoapifyApiKey(): string {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) {
    throw new Error("GEOAPIFY_API_KEY is not configured");
  }
  return apiKey;
}

export async function geocodeAutocomplete(
  text: string,
  apiKey: string,
): Promise<LocationSuggestion[]> {
  const url = new URL(`${GEOAPIFY_BASE_URL}/v1/geocode/autocomplete`);
  url.searchParams.set("text", text);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("apiKey", apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Geoapify autocomplete request failed: ${response.status}`);
  }
  const data = await response.json();
  const results: unknown[] = Array.isArray(data.results) ? data.results : [];

  return results
    .map((result) => {
      const r = result as { formatted?: string; lat?: number; lon?: number };
      if (typeof r.lat !== "number" || typeof r.lon !== "number" || !r.formatted) {
        return null;
      }
      return { label: r.formatted, lat: r.lat, lon: r.lon };
    })
    .filter((value): value is LocationSuggestion => value !== null);
}

export async function searchNearbyRestaurants(
  lat: number,
  lon: number,
  apiKey: string,
  radiusMeters = 3000,
  limit = 20,
): Promise<RestaurantPlace[]> {
  const url = new URL(`${GEOAPIFY_BASE_URL}/v2/places`);
  url.searchParams.set("categories", "catering.restaurant");
  url.searchParams.set("filter", `circle:${lon},${lat},${radiusMeters}`);
  url.searchParams.set("bias", `proximity:${lon},${lat}`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("apiKey", apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Geoapify places request failed: ${response.status}`);
  }
  const data = await response.json();
  const features: unknown[] = Array.isArray(data.features) ? data.features : [];

  return features
    .map((feature) => {
      const properties = (feature as { properties?: Record<string, unknown> })
        .properties;
      if (!properties) return null;
      const { place_id, name, formatted, lat: placeLat, lon: placeLon, categories } =
        properties as {
          place_id?: string;
          name?: string;
          formatted?: string;
          lat?: number;
          lon?: number;
          categories?: unknown;
        };
      if (
        typeof placeLat !== "number" ||
        typeof placeLon !== "number" ||
        !place_id
      ) {
        return null;
      }
      return {
        placeId: place_id,
        name: name ?? formatted ?? "이름 없는 음식점",
        address: formatted ?? "",
        lat: placeLat,
        lon: placeLon,
        categories: Array.isArray(categories)
          ? categories.filter((c): c is string => typeof c === "string")
          : [],
      };
    })
    .filter((value): value is RestaurantPlace => value !== null);
}

type RouteMatrixEntry = {
  distance: number;
  time: number;
  target_index: number;
};

export async function computeTravelTimes(
  mode: TravelMode,
  origin: { lat: number; lon: number },
  destinations: { lat: number; lon: number }[],
  apiKey: string,
): Promise<{ distanceMeters: number; travelTimeSeconds: number }[]> {
  if (destinations.length === 0) return [];

  const url = new URL(`${GEOAPIFY_BASE_URL}/v1/routematrix`);
  url.searchParams.set("apiKey", apiKey);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode,
      sources: [{ location: [origin.lon, origin.lat] }],
      targets: destinations.map((d) => ({ location: [d.lon, d.lat] })),
    }),
  });
  if (!response.ok) {
    throw new Error(`Geoapify route matrix request failed: ${response.status}`);
  }
  const data = await response.json();
  const rows: RouteMatrixEntry[] = data.sources_to_targets?.[0] ?? [];
  if (rows.length === 0) {
    throw new Error("Geoapify route matrix response is missing travel time data");
  }

  const byTargetIndex = new Map<number, RouteMatrixEntry>();
  for (const row of rows) {
    byTargetIndex.set(row.target_index, row);
  }

  return destinations.map((_, index) => {
    const entry = byTargetIndex.get(index);
    return {
      distanceMeters: entry?.distance ?? Number.POSITIVE_INFINITY,
      travelTimeSeconds: entry?.time ?? Number.POSITIVE_INFINITY,
    };
  });
}

export async function computeTravelTimeMatrix(
  mode: TravelMode,
  points: { lat: number; lon: number }[],
  apiKey: string,
): Promise<{ distanceMeters: number; travelTimeSeconds: number }[][]> {
  if (points.length === 0) return [];

  const url = new URL(`${GEOAPIFY_BASE_URL}/v1/routematrix`);
  url.searchParams.set("apiKey", apiKey);

  const locations = points.map((p) => ({ location: [p.lon, p.lat] }));
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode,
      sources: locations,
      targets: locations,
    }),
  });
  if (!response.ok) {
    throw new Error(`Geoapify route matrix request failed: ${response.status}`);
  }
  const data = await response.json();
  const sourcesToTargets: RouteMatrixEntry[][] = data.sources_to_targets ?? [];
  if (sourcesToTargets.length !== points.length) {
    throw new Error("Geoapify route matrix response is missing travel time data");
  }

  return sourcesToTargets.map((row) => {
    const byTargetIndex = new Map<number, RouteMatrixEntry>();
    for (const entry of row) {
      byTargetIndex.set(entry.target_index, entry);
    }
    return points.map((_, targetIndex) => {
      const entry = byTargetIndex.get(targetIndex);
      return {
        distanceMeters: entry?.distance ?? Number.POSITIVE_INFINITY,
        travelTimeSeconds: entry?.time ?? Number.POSITIVE_INFINITY,
      };
    });
  });
}

export function rankRestaurantsByTravelTime(
  places: RestaurantPlace[],
  travelTimes: { distanceMeters: number; travelTimeSeconds: number }[],
): RankedRestaurant[] {
  return places
    .map((place, index) => ({
      ...place,
      distanceMeters: travelTimes[index]?.distanceMeters ?? Number.POSITIVE_INFINITY,
      travelTimeSeconds: travelTimes[index]?.travelTimeSeconds ?? Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => a.travelTimeSeconds - b.travelTimeSeconds);
}
