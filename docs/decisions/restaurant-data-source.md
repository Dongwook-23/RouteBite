# Restaurant data source

## Decisions

- 맛집 목록은 Geoapify Places API의 음식점 카테고리(catering/restaurant)로만 가져온다. 평점·리뷰 기반 필터링은 적용하지 않는다.
- 이동시간은 Geoapify Routing / Route Matrix API로 계산한다 (도보/자동차/자전거/대중교통 지원, 대중교통은 근사치).
- 음식 종류 필터는 Geoapify Places API가 이미 제공하는 세부 카테고리(예: catering.restaurant.italian, .korean, .sushi 등)를 그대로 활용한다. 가격대 필터는 적용하지 않는다.

## Boundaries

- 이 결정은 "위치 입력 → 이동시간순 맛집 리스트" 범위와, 이후 이 데이터를 그대로 재사용하는 모든 범위에 적용된다.
- 평점 기반 큐레이션이 필요해지는 시점(추후 스프린트)에는 재검토 대상이며, 그 전까지는 카테고리 기반 리스트가 "맛집 목록"의 실제 정의다.

## Why

PRODUCT.md는 "평점/리뷰 기반 자동 추출"을 전제했지만, Geoapify Places API 공식 문서 확인 결과 응답에 평점·리뷰·인기도 필드가 없다 (name, address, categories, distance, place_id만 제공). 별도 API(Foursquare, Google Places 등)를 붙이면 구현 범위와 검증 복잡도가 커지므로, 첫 범위는 카테고리 기반 리스트로 좁히고 평점 반영은 뒤로 미루기로 사용자가 확정했다.

## Reconsider when

- 평점 기반 필터링/정렬이 제품 요구사항으로 다시 필요해질 때, 어떤 외부 데이터 소스를 추가로 연동할지 결정해야 한다.
- 가격대 필터가 제품 요구사항으로 다시 필요해질 때도 마찬가지로 외부 데이터 소스 연동 여부를 결정해야 한다.

## Still-rejected alternatives

- Foursquare Places API 등 별도 평점 API를 첫 범위부터 병행 연동 — 구현·검증 범위가 커져 이번 스프린트에서 기각. 평점 요구가 다시 확정되면 재검토.

## Evidence worth preserving

- Geoapify Places API 공식 문서(apidocs.geoapify.com/docs/places) 확인 결과: 응답 필드에 rating/review/popularity 없음. 가격대(price-level) 필드도 없음.
- Geoapify Places API 카테고리 문서 확인 결과: catering.restaurant 아래에 음식 종류별 세부 카테고리(pizza, sushi, korean, italian, chinese, japanese, mexican, thai, indian, french 등 다수)가 이미 존재함.
- Geoapify Routing API 문서 확인 결과: `time` 필드(초 단위 이동시간) 제공, walk/drive/bicycle/transit(근사) 모드 지원. 별도 Route Matrix API로 origin 1개 → destination 다수 계산 가능.
