import { NextRequest, NextResponse } from "next/server";
import { geocodeAutocomplete, getGeoapifyApiKey } from "@/lib/geoapify";

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
  } catch {
    return NextResponse.json(
      { error: "위치 검색에 실패했습니다." },
      { status: 502 },
    );
  }
}
