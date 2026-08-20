"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  CarFront,
  Circle,
  CircleCheck,
  Footprints,
  MapPin,
  MapPinned,
  Minus,
  Navigation,
  Plus,
  RotateCcw,
  Route,
  Search,
  SlidersHorizontal,
  Timer,
  UtensilsCrossed,
} from "lucide-react";
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

const MAX_TRIP_DAYS = 10;

// 검색 결과 라벨은 "장소명, 도시, 국가" 형태라 첫 구획만 짧은 이름으로 사용한다.
function shortLocationLabel(label: string): string {
  return label.split(",")[0]?.trim() || label;
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
  const ModeIcon = mode === "walk" ? Footprints : CarFront;
  const modeLabel = mode === "walk" ? "도보" : "자동차";

  async function runLocationSearch(trimmed: string) {
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
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (selectedLocation && selectedLocation.label === trimmed) {
      return;
    }
    if (trimmed.length < 2) {
      return;
    }

    debounceRef.current = setTimeout(() => {
      runLocationSearch(trimmed);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function handleSearchClick() {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    runLocationSearch(trimmed);
  }

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

  const safeDayIndex = Math.min(activeDayIndex, tripDays - 1);

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
    const nextTripDays = Math.min(MAX_TRIP_DAYS, Math.max(1, Math.floor(value) || 1));
    setTripDays(nextTripDays);
    const nextMax = nextTripDays * MAX_STOPS_PER_DAY;
    setSelectedStopIds((current) => current.slice(0, nextMax));
  }

  const currentRequestKey = `${selectedStopIds.join(",")}|${tripDays}`;
  const originLabel = selectedLocation ? shortLocationLabel(selectedLocation.label) : "";

  return (
    <div className="flex flex-1 flex-col">
      {/* 상단 히어로: 헤드라인 + 장소 검색 */}
      <section className="border-b border-stone-200 bg-white px-6 py-8 dark:border-stone-800 dark:bg-stone-900">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            맛있는 여행을 계획해 보세요
          </h1>

          <div className="relative flex flex-col gap-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MapPin
                  size={20}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-orange-500 dark:text-orange-400"
                  aria-hidden="true"
                />
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
                  className="h-11 w-full rounded-lg border border-stone-300 bg-white pl-10 pr-3 text-sm text-stone-900 outline-none transition-colors duration-200 placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500"
                />
              </div>
              <button
                type="button"
                onClick={handleSearchClick}
                className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-orange-600"
              >
                <Search size={16} aria-hidden="true" />
                검색
              </button>
            </div>

            {query.trim().length >= 2 && suggestionsState.status === "loading" && (
              <p className="text-sm text-stone-500 dark:text-stone-400">검색 중...</p>
            )}
            {query.trim().length >= 2 &&
              suggestionsState.status === "error" &&
              suggestionsState.query === query.trim() && (
                <p className="text-sm text-red-600 dark:text-red-400">{suggestionsState.message}</p>
              )}
            {query.trim().length >= 2 &&
              suggestionsState.status === "results" &&
              suggestionsState.query === query.trim() && (
              <ul
                role="listbox"
                className="flex flex-col overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900"
              >
                {suggestionsState.suggestions.length === 0 ? (
                  <li className="px-4 py-2.5 text-sm text-stone-500 dark:text-stone-400">
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
                        className="w-full px-4 py-2.5 text-left text-sm text-stone-700 transition-colors duration-200 hover:bg-orange-50 dark:text-stone-300 dark:hover:bg-orange-950/40"
                      >
                        {suggestion.label}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}

            {selectedLocation && (
              <p
                className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400"
                title={selectedLocation.label}
              >
                <Navigation size={16} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
                출발지 · {originLabel}
              </p>
            )}
          </div>

          {/* 필터 영역: 이동수단 · 여행 일수 · 음식 카테고리 (한 줄) */}
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            <div className="flex shrink-0 items-center gap-1 rounded-2xl border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-stone-900">
              {(["walk", "drive"] as const).map((option) => {
                const OptionIcon = option === "walk" ? Footprints : CarFront;
                const selected = mode === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMode(option)}
                    className={cn(
                      "flex min-h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors duration-200",
                      selected
                        ? "border-transparent bg-orange-500 text-white shadow-sm"
                        : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-stone-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
                    )}
                  >
                    <OptionIcon size={16} aria-hidden="true" />
                    {option === "walk" ? "도보" : "자동차"}
                  </button>
                );
              })}
            </div>

            <div className="flex shrink-0 items-center gap-1 rounded-2xl border border-zinc-200 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-stone-900">
              <span className="flex items-center gap-1.5 pl-1 text-sm text-zinc-600 dark:text-zinc-300">
                <CalendarDays size={16} className="text-orange-500 dark:text-orange-400" aria-hidden="true" />
                여행 일수
              </span>
              <button
                type="button"
                aria-label="여행 일수 줄이기"
                disabled={tripDays <= 1}
                onClick={() => handleTripDaysChange(tripDays - 1)}
                className="flex size-9 items-center justify-center rounded-lg text-zinc-600 transition-colors duration-200 hover:bg-zinc-100 disabled:pointer-events-none disabled:text-zinc-300 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:disabled:text-zinc-600"
              >
                <Minus size={16} aria-hidden="true" />
              </button>
              <span
                className="w-8 text-center text-sm font-semibold text-zinc-900 dark:text-zinc-100"
                aria-live="polite"
              >
                {tripDays}일
              </span>
              <button
                type="button"
                aria-label="여행 일수 늘리기"
                disabled={tripDays >= MAX_TRIP_DAYS}
                onClick={() => handleTripDaysChange(tripDays + 1)}
                className="flex size-9 items-center justify-center rounded-lg text-zinc-600 transition-colors duration-200 hover:bg-zinc-100 disabled:pointer-events-none disabled:text-zinc-300 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:disabled:text-zinc-600"
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>

            {cuisineOptions.length > 0 && (
              <div className="flex shrink-0 items-center gap-2">
                <span className="h-5 w-px shrink-0 bg-stone-200 dark:bg-stone-800" aria-hidden="true" />
                <span className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                  <SlidersHorizontal
                    size={16}
                    className="text-zinc-400 dark:text-zinc-500"
                    aria-hidden="true"
                  />
                  카테고리
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedCuisineSlug(null)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-200",
                    selectedCuisineSlug === null
                      ? "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300"
                      : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-stone-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
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
                        ? "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300"
                        : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-stone-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
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
        <div className="flex w-full flex-col rounded-xl border border-stone-200 bg-white lg:h-[calc(100vh-64px-1px-1px)] lg:w-[420px] lg:shrink-0 dark:border-stone-800 dark:bg-stone-900">
          <div className="flex shrink-0 flex-col gap-1 border-b border-stone-100 px-5 py-4 dark:border-stone-800">
            <span className="text-lg font-semibold text-stone-900 dark:text-stone-100">
              {restaurantsState.status === "results"
                ? `주변 음식점 ${restaurantsState.restaurants.length}곳 · ${selectedStopIds.length}곳 선택`
                : "주변 음식점"}
            </span>
            {selectedStopIds.length >= maxSelectedStops && maxSelectedStops > 0 && (
              <span className="text-xs text-stone-500 dark:text-stone-400">
                최대 {maxSelectedStops}곳까지 선택할 수 있어요.
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 lg:min-h-0">
            {!selectedLocation && (
              <p className="text-sm text-stone-500 dark:text-stone-400">
                장소를 검색하고 선택하면 주변 음식점을 보여드려요.
              </p>
            )}
            {restaurantsState.status === "loading" && (
              <p className="text-sm text-stone-500 dark:text-stone-400">주변 음식점을 찾는 중...</p>
            )}
            {restaurantsState.status === "error" && (
              <p className="text-sm text-red-600 dark:text-red-400">{restaurantsState.message}</p>
            )}
            {restaurantsState.status === "results" &&
              (restaurantsState.restaurants.length === 0 ? (
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  이 근처에서 음식점을 찾지 못했어요.
                </p>
              ) : visibleRestaurants.length === 0 ? (
                <p className="text-sm text-stone-500 dark:text-stone-400">
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
                            "relative flex cursor-pointer gap-3 rounded-lg border p-3 transition-all duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-orange-400",
                            isSelected
                              ? "border-orange-400 bg-orange-50/60 shadow-sm dark:border-orange-500 dark:bg-orange-950/30"
                              : "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm dark:border-zinc-700 dark:bg-stone-900 dark:hover:border-zinc-600",
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
                          <span className="flex size-[72px] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-amber-50 dark:from-orange-900/30 dark:to-amber-900/20">
                            <UtensilsCrossed
                              size={24}
                              className="text-orange-500 dark:text-orange-400"
                              aria-hidden="true"
                            />
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5 pr-6">
                            <span className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                              {restaurant.name}
                            </span>
                            <span className="line-clamp-2 text-xs text-stone-500 dark:text-stone-400">
                              {restaurant.address}
                            </span>
                            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                <ModeIcon size={16} aria-hidden="true" />
                                {modeLabel} {formatDuration(restaurant.travelTimeSeconds)}
                              </span>
                              <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                                <Route size={16} aria-hidden="true" />
                                {formatDistance(restaurant.distanceMeters)}
                              </span>
                            </span>
                          </span>
                          <span className="absolute right-3 top-3" aria-hidden="true">
                            {isSelected ? (
                              <CircleCheck size={20} className="text-orange-500 dark:text-orange-400" />
                            ) : (
                              <Circle size={20} className="text-zinc-300 dark:text-zinc-600" />
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
        <div className="flex w-full flex-1 flex-col rounded-xl border border-stone-200 bg-white lg:h-[calc(100vh-64px-1px-1px)] dark:border-stone-800 dark:bg-stone-900">
          {selectedStops.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-5 py-12">
              <p className="text-sm text-stone-500 dark:text-stone-400">
                음식점을 선택하면 일자별 일정을 만들어드려요.
              </p>
            </div>
          ) : (
            <>
              <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-stone-100 px-5 pt-4 dark:border-stone-800">
                {Array.from({ length: tripDays }, (_, dayIndex) => {
                  const dayCount =
                    dayPlansState.status === "results" &&
                    dayPlansState.requestKey === currentRequestKey
                      ? (dayPlansState.days[dayIndex]?.order.length ?? 0)
                      : null;
                  const isEmpty = dayCount === 0;
                  return (
                    <button
                      key={dayIndex}
                      type="button"
                      onClick={() => setActiveDayIndex(dayIndex)}
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors duration-200",
                        safeDayIndex === dayIndex
                          ? "border-orange-500 text-orange-600 dark:text-orange-400"
                          : isEmpty
                            ? "border-transparent text-stone-300 hover:text-stone-400 dark:text-stone-600 dark:hover:text-stone-500"
                            : "border-transparent text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-300",
                      )}
                    >
                      Day {dayIndex + 1}
                      {dayCount !== null && (
                        <span
                          className={cn(
                            "flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold",
                            safeDayIndex === dayIndex
                              ? "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400"
                              : isEmpty
                                ? "bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-600"
                                : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300",
                          )}
                        >
                          {dayCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 lg:min-h-0">
                {dayPlansState.status === "loading" && (
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    날짜별 방문 순서를 계산하는 중...
                  </p>
                )}
                {dayPlansState.status === "error" &&
                  dayPlansState.requestKey === currentRequestKey && (
                    <p className="text-sm text-red-600 dark:text-red-400">{dayPlansState.message}</p>
                  )}
                {dayPlansState.status === "results" &&
                  dayPlansState.requestKey === currentRequestKey &&
                  (() => {
                    const day = dayPlansState.days[safeDayIndex];
                    if (!day) {
                      return (
                        <p className="text-sm text-stone-500 dark:text-stone-400">
                          이 날짜에 배정된 곳이 없어요.
                        </p>
                      );
                    }
                    const hasReturnLeg = day.legs.length > day.order.length;
                    return (
                      <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-3 divide-x divide-orange-100 rounded-2xl bg-orange-50 dark:divide-orange-900 dark:bg-orange-950/30">
                          <div className="flex flex-col items-center gap-1 px-3 py-3">
                            <MapPinned
                              size={16}
                              className="text-orange-500 dark:text-orange-400"
                              aria-hidden="true"
                            />
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">방문 장소</span>
                            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {day.order.length}곳
                            </span>
                          </div>
                          <div className="flex flex-col items-center gap-1 px-3 py-3">
                            <Timer
                              size={16}
                              className="text-orange-500 dark:text-orange-400"
                              aria-hidden="true"
                            />
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">총 이동시간</span>
                            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {formatDuration(day.totalTravelTimeSeconds)}
                            </span>
                          </div>
                          <div className="flex flex-col items-center gap-1 px-3 py-3">
                            <Route
                              size={16}
                              className="text-orange-500 dark:text-orange-400"
                              aria-hidden="true"
                            />
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">총 이동거리</span>
                            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {formatDistance(day.totalDistanceMeters)}
                            </span>
                          </div>
                        </div>

                        <ol className="flex flex-col">
                          {/* 출발지 노드 */}
                          <li className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/40">
                                <Navigation
                                  size={14}
                                  className="text-blue-600 dark:text-blue-400"
                                  aria-hidden="true"
                                />
                              </span>
                              <span className="w-px flex-1 bg-stone-200 dark:bg-stone-800" />
                            </div>
                            <div className="flex flex-col pb-4">
                              <span className="text-sm font-medium text-stone-900 dark:text-stone-100">
                                출발지 · {originLabel || "출발지"}
                              </span>
                              {day.legs[0] && (
                                <span className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                                  <ModeIcon size={14} aria-hidden="true" />
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
                                  {(!isLast || hasReturnLeg) && (
                                    <span className="w-px flex-1 bg-stone-200 dark:bg-stone-800" />
                                  )}
                                </div>
                                <div className="flex flex-col pb-4">
                                  <span className="text-sm font-medium text-stone-900 dark:text-stone-100">
                                    {stop.name}
                                  </span>
                                  <span className="line-clamp-1 text-xs text-stone-500 dark:text-stone-400">
                                    {stop.address}
                                  </span>
                                  {nextLeg && (
                                    <span className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                                      <ModeIcon size={14} aria-hidden="true" />
                                      {formatDuration(nextLeg.travelTimeSeconds)} ·{" "}
                                      {formatDistance(nextLeg.distanceMeters)}
                                    </span>
                                  )}
                                </div>
                              </li>
                            );
                          })}

                          {/* 출발지 복귀 노드 */}
                          {hasReturnLeg && (
                            <li className="flex gap-3">
                              <div className="flex flex-col items-center">
                                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/40">
                                  <RotateCcw
                                    size={14}
                                    className="text-blue-600 dark:text-blue-400"
                                    aria-hidden="true"
                                  />
                                </span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-stone-900 dark:text-stone-100">
                                  출발지로 돌아가기
                                </span>
                              </div>
                            </li>
                          )}
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
