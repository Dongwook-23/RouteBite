import { RestaurantFinder } from "@/components/restaurant-finder";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-stone-50 font-sans">
      <header className="flex h-16 shrink-0 items-center border-b border-stone-200 bg-white px-6">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-orange-500 text-sm font-bold text-white">
            R
          </span>
          <span className="text-lg font-semibold tracking-tight text-stone-900">
            RouteBite
          </span>
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        <RestaurantFinder />
      </main>
    </div>
  );
}
