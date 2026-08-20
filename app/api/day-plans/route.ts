import { NextRequest, NextResponse } from "next/server";
import { GeoapifyQuotaExceededError, getGeoapifyApiKey, type TravelMode } from "@/lib/geoapify";
import { clusterByProximity, MAX_STOPS_PER_DAY } from "@/lib/day-planner";
import { isValidStop, planRoundTrip, type RoundTripPlan } from "@/lib/route-plan";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문을 읽을 수 없습니다." }, { status: 400 });
  }

  const { mode, origin, stops, tripDays } = (body ?? {}) as {
    mode?: unknown;
    origin?: unknown;
    stops?: unknown;
    tripDays?: unknown;
  };

  if (mode !== "walk" && mode !== "drive") {
    return NextResponse.json(
      { error: "이동수단은 walk 또는 drive여야 합니다." },
      { status: 400 },
    );
  }
  const originPoint = origin as { lat?: unknown; lon?: unknown } | undefined;
  if (
    !originPoint ||
    typeof originPoint.lat !== "number" ||
    typeof originPoint.lon !== "number"
  ) {
    return NextResponse.json(
      { error: "유효한 출발점(origin)이 필요합니다." },
      { status: 400 },
    );
  }
  if (
    typeof tripDays !== "number" ||
    !Number.isInteger(tripDays) ||
    tripDays < 1
  ) {
    return NextResponse.json(
      { error: "여행 일수는 1 이상의 정수여야 합니다." },
      { status: 400 },
    );
  }
  if (!Array.isArray(stops) || stops.length === 0 || !stops.every(isValidStop)) {
    return NextResponse.json(
      { error: "선택한 곳이 1곳 이상 필요합니다." },
      { status: 400 },
    );
  }
  const maxStops = tripDays * MAX_STOPS_PER_DAY;
  if (stops.length > maxStops) {
    return NextResponse.json(
      { error: `선택할 수 있는 곳은 최대 ${maxStops}곳입니다.` },
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
    const origin = { lat: originPoint.lat, lon: originPoint.lon };
    const dayGroups = clusterByProximity(stops, MAX_STOPS_PER_DAY);
    const plans = await Promise.all(
      dayGroups.map((group) => planRoundTrip(mode as TravelMode, origin, group, apiKey)),
    );
    const days: (RoundTripPlan | null)[] = [
      ...plans,
      ...Array<null>(Math.max(0, tripDays - plans.length)).fill(null),
    ];
    return NextResponse.json({ days });
  } catch (error) {
    if (error instanceof GeoapifyQuotaExceededError) {
      return NextResponse.json(
        { error: "오늘의 Geoapify 무료 사용량(3,000크레딧)을 모두 사용했습니다. 내일 다시 시도해주세요." },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "날짜별 방문 순서를 계산하지 못했습니다." },
      { status: 502 },
    );
  }
}
