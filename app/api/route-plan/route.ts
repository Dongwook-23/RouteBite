import { NextRequest, NextResponse } from "next/server";
import { getGeoapifyApiKey, type TravelMode } from "@/lib/geoapify";
import { MAX_STOPS_PER_DAY } from "@/lib/day-planner";
import { isValidStop, planRoundTrip } from "@/lib/route-plan";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문을 읽을 수 없습니다." }, { status: 400 });
  }

  const { mode, origin, stops } = (body ?? {}) as {
    mode?: unknown;
    origin?: unknown;
    stops?: unknown;
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
  if (!Array.isArray(stops) || stops.length === 0 || !stops.every(isValidStop)) {
    return NextResponse.json(
      { error: "선택한 곳이 1곳 이상 필요합니다." },
      { status: 400 },
    );
  }
  if (stops.length > MAX_STOPS_PER_DAY) {
    return NextResponse.json(
      { error: `선택할 수 있는 곳은 최대 ${MAX_STOPS_PER_DAY}곳입니다.` },
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
    const plan = await planRoundTrip(mode as TravelMode, origin, stops, apiKey);
    return NextResponse.json(plan);
  } catch {
    return NextResponse.json(
      { error: "방문 순서를 계산하지 못했습니다." },
      { status: 502 },
    );
  }
}
