import { MapPinned } from "lucide-react";
import { RestaurantFinder } from "@/components/restaurant-finder";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-stone-50 font-sans">
      <header className="flex h-16 shrink-0 items-center border-b border-stone-200 bg-white px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-orange-500">
            <MapPinned size={20} className="text-white" aria-hidden="true" />
          </span>
          <span className="text-xl font-bold tracking-tight text-stone-900">
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
