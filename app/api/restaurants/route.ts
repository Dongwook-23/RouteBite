import { NextRequest, NextResponse } from "next/server";
import {
  computeTravelTimes,
  getGeoapifyApiKey,
  rankRestaurantsByTravelTime,
  searchNearbyRestaurants,
  type TravelMode,
} from "@/lib/geoapify";

const SEARCH_RADIUS_METERS = 3000;
const RESULT_LIMIT = 20;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const latParam = params.get("lat");
  const lonParam = params.get("lon");
  const lat = latParam ? Number(latParam) : NaN;
  const lon = lonParam ? Number(lonParam) : NaN;
  const mode = params.get("mode");

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(
      { error: "유효한 위치(lat, lon)가 필요합니다." },
      { status: 400 },
    );
  }
  if (mode !== "walk" && mode !== "drive") {
    return NextResponse.json(
      { error: "이동수단은 walk 또는 drive여야 합니다." },
      { status: 400 },
    );
  }

  let apiKey: string;
  try {
    apiKey = getGeoapifyApiKey();
  } catch {
    return NextResponse.json(
      { error: "서버에 GEOAPIFY_API_KEY가 설정되어 있지 않습니다." },
      { status: 500 },
    );
  }

  try {
    const places = await searchNearbyRestaurants(
      lat,
      lon,
      apiKey,
      SEARCH_RADIUS_METERS,
      RESULT_LIMIT,
    );
    if (places.length === 0) {
      return NextResponse.json({ restaurants: [] });
    }

    const travelTimes = await computeTravelTimes(
      mode as TravelMode,
      { lat, lon },
      places.map((p) => ({ lat: p.lat, lon: p.lon })),
      apiKey,
    );
    const restaurants = rankRestaurantsByTravelTime(places, travelTimes);
    return NextResponse.json({ restaurants });
  } catch {
    return NextResponse.json(
      { error: "주변 음식점을 불러오지 못했습니다." },
      { status: 502 },
    );
  }
}
