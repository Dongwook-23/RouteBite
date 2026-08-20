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

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="location-search" className="text-sm font-medium">
          장소 검색
        </label>
        <input
          id="location-search"
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedLocation(null);
            setRestaurantsState({ status: "idle" });
            setSelectedStopIds([]);
          }}
          placeholder="도시나 주소를 입력하세요 (예: 서울역, Paris)"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {selectedLocation && (
          <p className="text-sm text-muted-foreground">
            출발점: {selectedLocation.label}
          </p>
        )}
        {query.trim().length >= 2 && suggestionsState.status === "loading" && (
          <p className="text-sm text-muted-foreground">검색 중...</p>
        )}
        {query.trim().length >= 2 &&
          suggestionsState.status === "error" &&
          suggestionsState.query === query.trim() && (
            <p className="text-sm text-destructive">{suggestionsState.message}</p>
          )}
        {query.trim().length >= 2 &&
          suggestionsState.status === "results" &&
          suggestionsState.query === query.trim() && (
          <ul
            role="listbox"
            className="flex flex-col overflow-hidden rounded-md border border-border"
          >
            {suggestionsState.suggestions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
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
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    {suggestion.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <div className="flex flex-col gap-6 md:w-1/2">
          <div className="flex gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">이동수단</span>
              <div className="flex gap-2">
                {(["walk", "drive"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMode(option)}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-sm",
                      mode === option
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground",
                    )}
                  >
                    {option === "walk" ? "도보" : "자동차"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="trip-days" className="text-sm font-medium">
                여행 일수
              </label>
              <input
                id="trip-days"
                type="number"
                min={1}
                value={tripDays}
                onChange={(event) => handleTripDaysChange(Number(event.target.value))}
                className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {selectedStops.length > 0 && (
            <>
              <span className="text-sm font-medium">
                선택한 {selectedStops.length}곳의 날짜별 방문 순서
              </span>
              {dayPlansState.status === "loading" && (
                <p className="text-sm text-muted-foreground">
                  날짜별 방문 순서를 계산하는 중...
                </p>
              )}
              {dayPlansState.status === "error" &&
                dayPlansState.requestKey === currentRequestKey && (
                  <p className="text-sm text-destructive">{dayPlansState.message}</p>
                )}
              {dayPlansState.status === "results" &&
                dayPlansState.requestKey === currentRequestKey && (
                  <div className="flex flex-col gap-3">
                    {dayPlansState.days.map((day, dayIndex) => (
                      <div
                        key={dayIndex}
                        className="flex flex-col gap-3 rounded-md border border-border p-3"
                      >
                        <span className="font-medium">
                          {dayIndex + 1}일차
                          {selectedLocation && ` (${selectedLocation.label} 출발)`}
                        </span>
                        {day === null ? (
                          <p className="text-sm text-muted-foreground">
                            이 날짜에 배정된 곳이 없어요.
                          </p>
                        ) : (
                          <>
                            <ol className="flex list-inside list-decimal flex-col gap-1">
                              {day.order.map((stop) => (
                                <li key={stop.placeId} className="text-sm">
                                  {stop.name}
                                </li>
                              ))}
                            </ol>
                            <ul className="flex flex-col gap-1 border-t border-border pt-2">
                              {day.legs.map((leg, index) => (
                                <li
                                  key={index}
                                  className="text-sm text-muted-foreground"
                                >
                                  {leg.from?.name ?? "출발점"} →{" "}
                                  {leg.to?.name ?? "출발점"}:{" "}
                                  {formatDuration(leg.travelTimeSeconds)} ·{" "}
                                  {formatDistance(leg.distanceMeters)}
                                </li>
                              ))}
                            </ul>
                            <p className="text-sm font-medium">
                              왕복 총 이동시간:{" "}
                              {formatDuration(day.totalTravelTimeSeconds)} ·{" "}
                              {formatDistance(day.totalDistanceMeters)}
                            </p>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
            </>
          )}
        </div>

        <div className="flex flex-col gap-2 md:w-1/2">
          {restaurantsState.status === "results" &&
            restaurantsState.restaurants.length > 0 && (
              <>
                {cuisineOptions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCuisineSlug(null)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm",
                        selectedCuisineSlug === null
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground",
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
                          "rounded-full border px-3 py-1 text-sm",
                          selectedCuisineSlug === option.slug
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  {selectedStopIds.length}/{maxSelectedStops}곳 선택함
                  {selectedStopIds.length >= maxSelectedStops &&
                    ` — 최대 ${maxSelectedStops}곳까지 선택할 수 있어요.`}
                </p>
              </>
            )}
          {!selectedLocation && (
            <p className="text-sm text-muted-foreground">
              장소를 검색하고 선택하면 주변 음식점을 보여드려요.
            </p>
          )}
          {restaurantsState.status === "loading" && (
            <p className="text-sm text-muted-foreground">주변 음식점을 찾는 중...</p>
          )}
          {restaurantsState.status === "error" && (
            <p className="text-sm text-destructive">{restaurantsState.message}</p>
          )}
          {restaurantsState.status === "results" && (
            restaurantsState.restaurants.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                이 근처에서 음식점을 찾지 못했어요.
              </p>
            ) : visibleRestaurants.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                이 음식 종류에 해당하는 곳이 없어요.
              </p>
            ) : (
              <ol className="flex flex-col gap-2">
                {visibleRestaurants.map((restaurant) => {
                  const isSelected = selectedStopIds.includes(restaurant.placeId);
                  const isDisabled =
                    !isSelected && selectedStopIds.length >= maxSelectedStops;
                  return (
                    <li
                      key={restaurant.placeId}
                      className="flex items-start gap-3 rounded-md border border-border p-3"
                    >
                      <input
                        type="checkbox"
                        aria-label={`${restaurant.name} 선택`}
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => toggleStopSelection(restaurant.placeId)}
                        className="mt-1"
                      />
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{restaurant.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {restaurant.address}
                        </span>
                        <span className="text-sm">
                          {formatDuration(restaurant.travelTimeSeconds)} ·{" "}
                          {formatDistance(restaurant.distanceMeters)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )
          )}
        </div>
      </div>
    </div>
  );
}
