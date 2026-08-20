import { NextRequest, NextResponse } from "next/server";
import {
  GeoapifyQuotaExceededError,
  geocodeAutocomplete,
  getGeoapifyApiKey,
} from "@/lib/geoapify";

export async function GET(request: NextRequest) {
  const text = request.nextUrl.searchParams.get("text")?.trim() ?? "";
  if (!text) {
    return NextResponse.json({ suggestions: [] });
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
    const suggestions = await geocodeAutocomplete(text, apiKey);
    return NextResponse.json({ suggestions });
  } catch (error) {
    if (error instanceof GeoapifyQuotaExceededError) {
      return NextResponse.json(
        { error: "오늘의 Geoapify 무료 사용량(3,000크레딧)을 모두 사용했습니다. 내일 다시 시도해주세요." },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "위치 검색에 실패했습니다." },
      { status: 502 },
    );
  }
}
