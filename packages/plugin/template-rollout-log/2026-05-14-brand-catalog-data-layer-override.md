---
title: Brand-catalog data-layer override (JSON fixture replaces Shopify product fetches)
changeKey: brand-catalog-data-layer-override
introducedOn: 2026-05-14
changeType: feature
defaultAction: review
appliesTo:
  - agent-generated
  - brand-catalog-enabled
paths:
  - apps/template/lib/brand-catalog/server.ts
  - apps/template/lib/brand-catalog/server.test.ts
  - apps/template/lib/shopify/operations/products.ts
  - apps/template/app/api/brand-catalog/revalidate/route.ts
  - apps/template/components/product-detail/product-detail-section.tsx
  - apps/template/.env.example
  - apps/template/vitest.config.ts
  - apps/template/vitest.server-only-stub.ts
  - apps/template/package.json
  - turbo.json
---

## Summary

Adds a pluggable JSON-fixture seam in front of every product-fetch operation in `lib/shopify/operations/products.ts`. When `lib/brand-catalog/catalog.json` exists in the seed, the shop reads products from that file (transformed to the same `ProductCard` / `ProductDetails` shapes the components already consume) instead of calling Shopify. When the file is absent, every operation falls through to Shopify exactly as upstream — no behavior change for non-agent storefronts.

Seven product-fetch operations participate in the override:

- `fetchCatalogProducts` (homepage `<FeaturedProducts>`)
- `getProduct` (PDP)
- `getProductsByHandles`
- `getProductRecommendations`
- `getCollectionProducts` (PLP / collection pages)
- `searchIndexProducts` (`/search`)
- `getSearchFacets` (`/search` facets)

The override module (`lib/brand-catalog/server.ts`) exposes `loadBrandCatalog`, `toProductCard`, `toProductDetails`, and `isBrandCatalogActive`. The loader is sync, module-memoized, and returns `null` (not throws) when the file is missing so callers can fall through without try/catch. `BRAND_CATALOG_DISABLE=1` forces Shopify-only mode regardless of file presence.

Synthetic product IDs are namespaced as `gid://brand-catalog/Product/{handle}` so they never collide with real Shopify GIDs. The PDP `BuyButtons` block (the only user-visible add-to-cart CTA) is hidden when `isBrandCatalogActive()` returns true because synthetic IDs would 404 against Shopify cart endpoints.

A `POST /api/brand-catalog/revalidate` route handler calls `revalidateTag("products")` so external writers (the storefront-generation agent in `vercel-labs/commercetools-store-agent`) can flush the Next.js cache after rewriting `catalog.json` mid-session without bouncing the dev server.

### Test infrastructure introduced alongside

The same change wires up `vitest` in the template (`pnpm test`, `pnpm typecheck`), adds a `server-only` stub so server-only modules are importable from tests, and threads both tasks through Turbo. 15 unit tests cover the loader and the two transforms.

## Why it matters

- Lets an external caller (today the storefront-generation agent; tomorrow a commercetools backend or a CT migration step) replace the demo Shopify furniture catalog by writing one JSON file, with zero changes to UI components and zero changes to the Shopify-backed flow.
- The agent that drove this work generates brand-aligned catalogs (e.g. a racing-gloves brand emits 8 racing-glove products). Without this seam, those storefronts rendered crimson-and-gold cards titled "The Ravello Floating Modular Sectional Sofa" — cosmetically branded, topically incoherent.
- Pairs naturally with `[[components-consume-brand-tokens]]`: that change makes the chrome brand-aligned; this change makes the products brand-aligned. Either is independently useful, but together they produce a coherent generated storefront.
- Makes the future commercetools migration substantially smaller: swap one module (`lib/brand-catalog/server.ts`) for a commercetools-backed equivalent and the rest of the operation/component graph keeps working.

## Apply when

- The storefront is generated or seeded by an external tool that wants to override Shopify's catalog (the canonical case: `vercel-labs/commercetools-store-agent`).
- The storefront is the seed for downstream agent-driven projects that may want to swap data sources later (commercetools, mock data for E2E tests, etc.) without touching components.
- The storefront wants `BRAND_CATALOG_DISABLE=1` as an escape hatch for A/B comparing branded vs. unbranded output.

## Safe to skip when

- The storefront only ever reads from Shopify and has no agent/fixture/CT pipeline. The seam is inert in that case (no fixture → fall-through → identical behavior), but it's dead plumbing the storefront will never use, and `vitest` plus the revalidate route are non-trivial additions to maintain. Stripping it back to upstream is reasonable for those projects.
- The storefront has already migrated to a different data backend (commercetools, Saleor, etc.) and wired the seam at a different layer.

## Notes

- **v1 scope and what's deliberately out:** the catalog is a flat list (no per-collection membership — every entry belongs to every collection), products have no variants/options, the cart CTA is hidden (synthetic IDs would 404), and there's no schema validation in the shop (the caller validates with its own Zod schema). Filters and PLP facets on synthetic data are best-effort. These are intentional v1 trade-offs documented in the PRD ([#3]); growth is caller-side.
- **Catalog schema contract:** documented in the source PRD. Required fields are `id`, `handle`, `title`, `vendor`, `description`, `descriptionHtml`, `price`, `featuredImagePath`, `altText`, `tags`, `availableForSale`. Optional: `compareAtPrice`. Top-level: `brandName`, `currency`, `products[]`.
- **Image generation is the caller's responsibility.** This change references `featuredImagePath` (typically `/brand/product-{handle}.webp`) but does not generate or serve images — the caller's image-generation step writes the files into `public/brand/`.
- **Two-phase rollout history:** phase 1 (commit `12db028`) added the loader + homepage operation + revalidate route + hide-CTA + test infra. Phase 2 (commit `51b9ac0`) extended the pattern to PDP, recommendations, by-handles, and collections. Commit `c560b26` patched the two remaining search-path operations (`searchIndexProducts`, `getSearchFacets`) that phase 2 missed. The current state covers all seven product-fetch operations.

## Validation

1. `pnpm --filter template test` — 15 brand-catalog unit tests pass.
2. `pnpm --filter template typecheck` — clean.
3. Drop a hand-written 8-product `catalog.json` into `apps/template/lib/brand-catalog/`, plus matching `/public/brand/product-{handle}.webp` placeholders. Run `pnpm dev`. Home, PDP, `/search`, and collection pages should all show the fixture's products with the synthetic images.
4. Click a homepage card → land on a PDP whose title/description/price/image match the card. The "Add to bag" button should not be visible.
5. `curl -X POST http://localhost:3000/api/brand-catalog/revalidate` should return 200; subsequent page loads pick up a freshly-rewritten `catalog.json`.
6. Remove the fixture file and reload — every page should fall back to Shopify's default furniture catalog without errors.
7. Set `BRAND_CATALOG_DISABLE=1` with the fixture still present — every operation should bypass the fixture and use Shopify.
