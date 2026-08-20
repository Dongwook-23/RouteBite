import { RestaurantFinder } from "@/components/restaurant-finder";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center bg-background font-sans">
      <main className="flex w-full max-w-3xl flex-col items-center gap-8 px-6 py-16 sm:items-start">
        <div className="flex flex-col gap-2 sm:items-start">
          <h1 className="text-2xl font-semibold tracking-tight">RouteBite</h1>
          <p className="text-muted-foreground">
            장소를 검색하면, 가까운 순으로 정렬된 주변 음식점을 보여드려요.
          </p>
        </div>
        <RestaurantFinder />
      </main>
    </div>
  );
}
