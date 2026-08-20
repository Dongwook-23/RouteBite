"use client";

import { useEffect, useRef, useState } from "react";
import type { LocationSuggestion, RankedRestaurant, TravelMode } from "@/lib/geoapify";
import { MAX_STOPS_PER_DAY } from "@/lib/day-planner";
import { cuisineLabel, extractCuisineSlug } from "@/lib/cuisine";
import { cn } from "@/lib/utils";

type SuggestionsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; query: string; message: string }
  | { status: "results"; query: string; suggestions: LocationSuggestion[] };

type RestaurantsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "results"; restaurants: RankedRestaurant[] };

type Stop = {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
};

type RouteLeg = {
  from: Stop | null;
  to: Stop | null;
  travelTimeSeconds: number;
  distanceMeters: number;
};

type DayPlan = {
  order: Stop[];
  legs: RouteLeg[];
  totalTravelTimeSeconds: number;
  totalDistanceMeters: number;
} | null;

type DayPlansState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; requestKey: string; message: string }
  | { status: "results"; requestKey: string; days: DayPlan[] };

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "-";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
}

function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return "-";
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

// 검색 결과 라벨은 "장소명, 도시, 국가" 형태라 첫 구획만 짧은 이름으로 사용한다.
function shortLocationLabel(label: string): string {
  return label.split(",")[0]?.trim() || label;
}

const CUISINE_EMOJI: Record<string, string> = {
  italian: "🍝",
  korean: "🍚",
  japanese: "🍱",
  sushi: "🍣",
  chinese: "🥡",
  pizza: "🍕",
  mexican: "🌮",
  thai: "🍜",
  indian: "🍛",
  french: "🥐",
  german: "🥨",
  spanish: "🥘",
  vietnamese: "🍲",
  turkish: "🥙",
  greek: "🥗",
  american: "🍔",
  seafood: "🦐",
  vegetarian: "🥦",
  vegan: "🥬",
  bbq: "🍖",
  steak_house: "🥩",
  burger: "🍔",
  noodle: "🍜",
};

function cuisineEmoji(categories: string[]): string {
  const slug = extractCuisineSlug(categories);
  return (slug && CUISINE_EMOJI[slug]) || "🍽️";
}

export function RestaurantFinder() {
  const [query, setQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<LocationSuggestion | null>(
    null,
  );
  const [mode, setMode] = useState<TravelMode>("walk");
  const [tripDays, setTripDays] = useState(1);
  const [suggestionsState, setSuggestionsState] = useState<SuggestionsState>({
    status: "idle",
  });
  const [restaurantsState, setRestaurantsState] = useState<RestaurantsState>({
    status: "idle",
  });
  const [selectedStopIds, setSelectedStopIds] = useState<string[]>([]);
  const [selectedCuisineSlug, setSelectedCuisineSlug] = useState<string | null>(null);
  const [dayPlansState, setDayPlansState] = useState<DayPlansState>({
    status: "idle",
  });
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const maxSelectedStops = tripDays * MAX_STOPS_PER_DAY;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (selectedLocation && selectedLocation.label === trimmed) {
      return;
    }
    if (trimmed.length < 2) {
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSuggestionsState({ status: "loading" });
      try {
        const response = await fetch(
          `/api/geocode?text=${encodeURIComponent(trimmed)}`,
        );
        const data = await response.json();
        if (!response.ok) {
          setSuggestionsState({
            status: "error",
            query: trimmed,
            message: data.error ?? "위치 검색에 실패했습니다.",
          });
          return;
        }
        setSuggestionsState({
          status: "results",
          query: trimmed,
          suggestions: data.suggestions,
        });
      } catch {
        setSuggestionsState({
          status: "error",
          query: trimmed,
          message: "위치 검색 중 오류가 발생했습니다.",
        });
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (!selectedLocation) return;

    let cancelled = false;

    (async () => {
      setRestaurantsState({ status: "loading" });
      setSelectedCuisineSlug(null);
      try {
        const url = `/api/restaurants?lat=${selectedLocation.lat}&lon=${selectedLocation.lon}&mode=${mode}`;
        const response = await fetch(url);
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setRestaurantsState({
            status: "error",
            message: data.error ?? "음식점 목록을 불러오지 못했습니다.",
          });
          return;
        }
        setRestaurantsState({ status: "results", restaurants: data.restaurants });
      } catch {
        if (!cancelled) {
          setRestaurantsState({
            status: "error",
            message: "음식점 목록을 불러오는 중 오류가 발생했습니다.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedLocation, mode]);

  const selectedStops: Stop[] =
    restaurantsState.status === "results"
      ? restaurantsState.restaurants.filter((r) => selectedStopIds.includes(r.placeId))
      : [];

  const OTHER_CUISINE_SLUG = "__other__";

  const cuisineOptions: { slug: string; label: string }[] =
    restaurantsState.status === "results"
      ? [
          ...Array.from(
            new Set(
              restaurantsState.restaurants
                .map((r) => extractCuisineSlug(r.categories))
                .filter((slug): slug is string => slug !== null),
            ),
          )
            .map((slug) => ({ slug, label: cuisineLabel(slug) }))
            .sort((a, b) => a.label.localeCompare(b.label)),
          ...(restaurantsState.restaurants.some(
            (r) => extractCuisineSlug(r.categories) === null,
          )
            ? [{ slug: OTHER_CUISINE_SLUG, label: "기타" }]
            : []),
        ]
      : [];

  const visibleRestaurants: RankedRestaurant[] =
    restaurantsState.status === "results"
      ? selectedCuisineSlug === null
        ? restaurantsState.restaurants
        : selectedCuisineSlug === OTHER_CUISINE_SLUG
          ? restaurantsState.restaurants.filter(
              (r) => extractCuisineSlug(r.categories) === null,
            )
          : restaurantsState.restaurants.filter(
              (r) => extractCuisineSlug(r.categories) === selectedCuisineSlug,
            )
      : [];

  useEffect(() => {
    if (!selectedLocation || selectedStops.length === 0) {
      return;
    }

    const requestKey = `${selectedStopIds.join(",")}|${tripDays}`;
    let cancelled = false;

    (async () => {
      setDayPlansState({ status: "loading" });
      try {
        const response = await fetch("/api/day-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            origin: { lat: selectedLocation.lat, lon: selectedLocation.lon },
            stops: selectedStops,
            tripDays,
          }),
        });
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setDayPlansState({
            status: "error",
            requestKey,
            message: data.error ?? "날짜별 방문 순서를 계산하지 못했습니다.",
          });
          return;
        }
        setDayPlansState({ status: "results", requestKey, days: data.days });
      } catch {
        if (!cancelled) {
          setDayPlansState({
            status: "error",
            requestKey,
            message: "날짜별 방문 순서를 계산하는 중 오류가 발생했습니다.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocation, mode, selectedStopIds.join(","), tripDays]);

  useEffect(() => {
    setActiveDayIndex(0);
  }, [tripDays]);

  function handleSelectSuggestion(suggestion: LocationSuggestion) {
    setSelectedLocation(suggestion);
    setQuery(suggestion.label);
    setSuggestionsState({ status: "idle" });
    setSelectedStopIds([]);
  }

  function toggleStopSelection(placeId: string) {
    setSelectedStopIds((current) => {
      if (current.includes(placeId)) {
        return current.filter((id) => id !== placeId);
      }
      if (current.length >= maxSelectedStops) {
        return current;
      }
      return [...current, placeId];
    });
  }

  function handleTripDaysChange(value: number) {
    const nextTripDays = Math.max(1, Math.floor(value) || 1);
    setTripDays(nextTripDays);
    const nextMax = nextTripDays * MAX_STOPS_PER_DAY;
    setSelectedStopIds((current) => current.slice(0, nextMax));
  }

  const currentRequestKey = `${selectedStopIds.join(",")}|${tripDays}`;
  const originLabel = selectedLocation ? shortLocationLabel(selectedLocation.label) : "";

  return (
    <div className="flex flex-1 flex-col">
      {/* 상단 히어로: 헤드라인 + 장소 검색 */}
      <section className="border-b border-stone-200 bg-white px-6 py-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
            맛있는 여행을 계획해 보세요
          </h1>

          <div className="relative flex flex-col gap-2">
            <input
              id="location-search"
              type="text"
              aria-label="장소 검색"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedLocation(null);
                setRestaurantsState({ status: "idle" });
                setSelectedStopIds([]);
              }}
              placeholder="도시나 주소를 입력하세요 (예: 서울역, Paris)"
              className="w-full rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-900 outline-none transition-colors duration-200 placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30"
            />
            {query.trim().length >= 2 && suggestionsState.status === "loading" && (
              <p className="text-sm text-stone-500">검색 중...</p>
            )}
            {query.trim().length >= 2 &&
              suggestionsState.status === "error" &&
              suggestionsState.query === query.trim() && (
                <p className="text-sm text-red-600">{suggestionsState.message}</p>
              )}
            {query.trim().length >= 2 &&
              suggestionsState.status === "results" &&
              suggestionsState.query === query.trim() && (
              <ul
                role="listbox"
                className="flex flex-col overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm"
              >
                {suggestionsState.suggestions.length === 0 ? (
                  <li className="px-4 py-2.5 text-sm text-stone-500">
                    일치하는 장소가 없습니다.
                  </li>
                ) : (
                  suggestionsState.suggestions.map((suggestion) => (
                    <li key={`${suggestion.lat}-${suggestion.lon}`}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selectedLocation?.label === suggestion.label}
                        onClick={() => handleSelectSuggestion(suggestion)}
                        className="w-full px-4 py-2.5 text-left text-sm text-stone-700 transition-colors duration-200 hover:bg-orange-50"
                      >
                        {suggestion.label}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          {/* 필터 영역: 이동수단 · 여행 일수 · 음식 카테고리 (한 줄) */}
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            <div className="flex shrink-0 items-center gap-1 rounded-full border border-stone-200 bg-stone-100 p-1">
              {(["walk", "drive"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMode(option)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-200",
                    mode === option
                      ? "bg-orange-500 text-white"
                      : "text-stone-600 hover:text-stone-900",
                  )}
                >
                  {option === "walk" ? "도보" : "자동차"}
                </button>
              ))}
            </div>

            <div className="flex shrink-0 items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5">
              <label htmlFor="trip-days" className="text-sm text-stone-600">
                여행 일수
              </label>
              <input
                id="trip-days"
                type="number"
                min={1}
                value={tripDays}
                onChange={(event) => handleTripDaysChange(Number(event.target.value))}
                className="w-10 bg-transparent text-sm font-medium text-stone-900 outline-none"
              />
            </div>

            {cuisineOptions.length > 0 && (
              <div className="flex shrink-0 items-center gap-2">
                <span className="h-5 w-px shrink-0 bg-stone-200" aria-hidden />
                <button
                  type="button"
                  onClick={() => setSelectedCuisineSlug(null)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-200",
                    selectedCuisineSlug === null
                      ? "border-orange-500 bg-orange-500 text-white"
                      : "border-stone-300 bg-white text-stone-600 hover:border-stone-400",
                  )}
                >
                  전체
                </button>
                {cuisineOptions.map((option) => (
                  <button
                    key={option.slug}
                    type="button"
                    onClick={() => setSelectedCuisineSlug(option.slug)}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-200",
                      selectedCuisineSlug === option.slug
                        ? "border-orange-500 bg-orange-500 text-white"
                        : "border-stone-300 bg-white text-stone-600 hover:border-stone-400",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 본문: 왼쪽 음식점 패널 + 오른쪽 일정 패널 */}
      <section className="flex flex-1 flex-col gap-6 px-6 py-6 lg:flex-row lg:items-start">
        {/* 왼쪽: 음식점 검색 및 선택 패널 (420px, 독립 스크롤) */}
        <div className="flex w-full flex-col rounded-xl border border-stone-200 bg-white lg:h-[calc(100vh-64px-1px-1px)] lg:w-[420px] lg:shrink-0">
          <div className="flex shrink-0 flex-col gap-1 border-b border-stone-100 px-5 py-4">
            <span className="text-lg font-semibold text-stone-900">
              {restaurantsState.status === "results"
                ? `주변 음식점 ${restaurantsState.restaurants.length}곳 · ${selectedStopIds.length}곳 선택`
                : "주변 음식점"}
            </span>
            {selectedStopIds.length >= maxSelectedStops && maxSelectedStops > 0 && (
              <span className="text-xs text-stone-500">
                최대 {maxSelectedStops}곳까지 선택할 수 있어요.
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 lg:min-h-0">
            {!selectedLocation && (
              <p className="text-sm text-stone-500">
                장소를 검색하고 선택하면 주변 음식점을 보여드려요.
              </p>
            )}
            {restaurantsState.status === "loading" && (
              <p className="text-sm text-stone-500">주변 음식점을 찾는 중...</p>
            )}
            {restaurantsState.status === "error" && (
              <p className="text-sm text-red-600">{restaurantsState.message}</p>
            )}
            {restaurantsState.status === "results" &&
              (restaurantsState.restaurants.length === 0 ? (
                <p className="text-sm text-stone-500">
                  이 근처에서 음식점을 찾지 못했어요.
                </p>
              ) : visibleRestaurants.length === 0 ? (
                <p className="text-sm text-stone-500">
                  이 음식 종류에 해당하는 곳이 없어요.
                </p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {visibleRestaurants.map((restaurant) => {
                    const isSelected = selectedStopIds.includes(restaurant.placeId);
                    const isDisabled =
                      !isSelected && selectedStopIds.length >= maxSelectedStops;
                    return (
                      <li key={restaurant.placeId}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors duration-200",
                            isSelected
                              ? "border-orange-400 bg-orange-50"
                              : "border-stone-200 bg-white hover:border-stone-300",
                            isDisabled && "pointer-events-none opacity-50",
                          )}
                        >
                          <input
                            type="checkbox"
                            aria-label={`${restaurant.name} 선택`}
                            checked={isSelected}
                            disabled={isDisabled}
                            onChange={() => toggleStopSelection(restaurant.placeId)}
                            className="sr-only"
                          />
                          <span
                            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-lg"
                            aria-hidden
                          >
                            {cuisineEmoji(restaurant.categories)}
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="truncate text-sm font-medium text-stone-900">
                              {restaurant.name}
                            </span>
                            <span className="line-clamp-2 text-xs text-stone-500">
                              {restaurant.address}
                            </span>
                            <span className="mt-1 flex items-center gap-2">
                              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                {formatDuration(restaurant.travelTimeSeconds)}
                              </span>
                              <span className="text-xs text-stone-400">
                                {formatDistance(restaurant.distanceMeters)}
                              </span>
                            </span>
                          </span>
                          <span
                            className={cn(
                              "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200",
                              isSelected
                                ? "border-orange-500 bg-orange-500"
                                : "border-stone-300 bg-white",
                            )}
                            aria-hidden
                          >
                            {isSelected && (
                              <svg
                                viewBox="0 0 20 20"
                                className="size-3 fill-none stroke-white stroke-[3]"
                              >
                                <path
                                  d="M4 10l4 4 8-8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ol>
              ))}
          </div>
        </div>

        {/* 오른쪽: 일자별 일정 (Day 탭) */}
        <div className="flex w-full flex-1 flex-col rounded-xl border border-stone-200 bg-white lg:h-[calc(100vh-64px-1px-1px)]">
          {selectedStops.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-5 py-12">
              <p className="text-sm text-stone-500">
                음식점을 선택하면 일자별 일정을 만들어드려요.
              </p>
            </div>
          ) : (
            <>
              <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-stone-100 px-5 pt-4">
                {Array.from({ length: tripDays }, (_, dayIndex) => (
                  <button
                    key={dayIndex}
                    type="button"
                    onClick={() => setActiveDayIndex(dayIndex)}
                    className={cn(
                      "shrink-0 border-b-2 px-4 py-2 text-sm font-medium transition-colors duration-200",
                      activeDayIndex === dayIndex
                        ? "border-orange-500 text-orange-600"
                        : "border-transparent text-stone-500 hover:text-stone-700",
                    )}
                  >
                    Day {dayIndex + 1}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 lg:min-h-0">
                {dayPlansState.status === "loading" && (
                  <p className="text-sm text-stone-500">
                    날짜별 방문 순서를 계산하는 중...
                  </p>
                )}
                {dayPlansState.status === "error" &&
                  dayPlansState.requestKey === currentRequestKey && (
                    <p className="text-sm text-red-600">{dayPlansState.message}</p>
                  )}
                {dayPlansState.status === "results" &&
                  dayPlansState.requestKey === currentRequestKey &&
                  (() => {
                    const day = dayPlansState.days[activeDayIndex];
                    if (!day) {
                      return (
                        <p className="text-sm text-stone-500">
                          이 날짜에 배정된 곳이 없어요.
                        </p>
                      );
                    }
                    return (
                      <div className="flex flex-col gap-4">
                        <p className="text-sm font-medium text-stone-700">
                          {day.order.length}곳 방문 · 총{" "}
                          {formatDuration(day.totalTravelTimeSeconds)} ·{" "}
                          {formatDistance(day.totalDistanceMeters)}
                        </p>

                        <ol className="flex flex-col">
                          {/* 출발지 노드 */}
                          <li className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-medium text-stone-600">
                                •
                              </span>
                              <span className="w-px flex-1 bg-stone-200" />
                            </div>
                            <div className="flex flex-col pb-4">
                              <span className="text-sm font-medium text-stone-900">
                                {originLabel || "출발지"} 출발
                              </span>
                              {day.legs[0] && (
                                <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                  {formatDuration(day.legs[0].travelTimeSeconds)} ·{" "}
                                  {formatDistance(day.legs[0].distanceMeters)}
                                </span>
                              )}
                            </div>
                          </li>

                          {/* 방문 순서 노드들 */}
                          {day.order.map((stop, index) => {
                            const nextLeg = day.legs[index + 1];
                            const isLast = index === day.order.length - 1;
                            return (
                              <li key={stop.placeId} className="flex gap-3">
                                <div className="flex flex-col items-center">
                                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-semibold text-white">
                                    {index + 1}
                                  </span>
                                  {!isLast && (
                                    <span className="w-px flex-1 bg-stone-200" />
                                  )}
                                </div>
                                <div className="flex flex-col pb-4">
                                  <span className="text-sm font-medium text-stone-900">
                                    {stop.name}
                                  </span>
                                  <span className="line-clamp-1 text-xs text-stone-500">
                                    {stop.address}
                                  </span>
                                  {nextLeg && (
                                    <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                      {isLast ? "복귀 " : ""}
                                      {formatDuration(nextLeg.travelTimeSeconds)} ·{" "}
                                      {formatDistance(nextLeg.distanceMeters)}
                                    </span>
                                  )}
                                </div>
                              </li>
                            );
                          })}

                          {/* 복귀 노드 */}
                          <li className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-medium text-stone-600">
                                •
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-stone-900">
                                {originLabel || "출발지"}로 복귀
                              </span>
                            </div>
                          </li>
                        </ol>
                      </div>
                    );
                  })()}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
