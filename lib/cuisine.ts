const CUISINE_PREFIX = "catering.restaurant.";

const CUISINE_LABELS: Record<string, string> = {
  italian: "이탈리안",
  korean: "한식",
  japanese: "일식",
  sushi: "초밥/스시",
  chinese: "중식",
  pizza: "피자",
  mexican: "멕시칸",
  thai: "태국음식",
  indian: "인도음식",
  french: "프렌치",
  german: "독일음식",
  spanish: "스페인음식",
  vietnamese: "베트남음식",
  turkish: "터키음식",
  greek: "그리스음식",
  american: "아메리칸",
  seafood: "해산물",
  vegetarian: "채식",
  vegan: "비건",
  asian: "아시안",
  bbq: "바베큐",
  steak_house: "스테이크하우스",
  burger: "버거",
  noodle: "국수/면요리",
};

/**
 * Pulls the most specific cuisine slug (e.g. "italian") out of a Geoapify
 * category list (e.g. ["catering.restaurant", "catering.restaurant.italian"]).
 * Returns null when no cuisine-specific subcategory is present.
 */
export function extractCuisineSlug(categories: string[]): string | null {
  for (const category of categories) {
    if (category.startsWith(CUISINE_PREFIX) && category.length > CUISINE_PREFIX.length) {
      return category.slice(CUISINE_PREFIX.length);
    }
  }
  return null;
}

function prettifySlug(slug: string): string {
  return slug
    .split(/[_.]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function cuisineLabel(slug: string): string {
  return CUISINE_LABELS[slug] ?? prettifySlug(slug);
}
