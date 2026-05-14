---
title: PDP improvements that make the brand-catalog product page look like the reference Shopify PDP
changeKey: pdp-improvements-for-brand-catalog
introducedOn: 2026-05-14
changeType: feature
defaultAction: adopt
appliesTo:
  - all
  - brand-catalog-enabled
paths:
  - apps/template/lib/product.ts
  - apps/template/lib/product.test.ts
  - apps/template/lib/brand-catalog/server.ts
  - apps/template/lib/brand-catalog/server.test.ts
  - apps/template/components/product-detail/product-detail-section.tsx
---

## Summary

Three backward-compatible additions that make the brand-catalog PDP render as a real product page (price visible, multi-image grid, variants block) instead of the partially-collapsed shape it had at v1. None of the changes alter Shopify-backed behavior; an empty fixture or a fixture written for the v1 contract continues to render byte-for-byte identically to before.

### 1. PDP price falls back to `priceRange.minVariantPrice` when `variants` is empty

A new pure helper `getUniformDisplayPrice(variants, priceRange)` in `lib/product.ts` returns the variant price when `variants[0]` exists (current behavior, unchanged) and falls back to `priceRange.minVariantPrice` (with no `compareAtAmount`) when the array is empty. `product-detail-section.tsx` consumes the helper in place of the previous `variants[0] && <ProductPrice/>` short-circuit.

For Shopify-backed products `variants` is always non-empty, so the fallback path is unreachable on the standard code path. The helper is intentionally decoupled from brand-catalog: any future variant-less data source (a CT-backed source, mock data for E2E, etc.) gets the same graceful fallback without further change.

### 2. `BrandCatalogEntry.additionalImagePaths?: string[]`

A new optional field on `BrandCatalogEntry`. When present, `toProductCard` builds `images = [featuredImage, ...additional]` (and `toProductDetails` inherits via spread), so `<ProductMedia otherImages={images}>` renders the full Shopify-equivalent grid. When omitted (or `[]`), output is byte-for-byte equivalent to the prior single-image shape.

`featuredImage` is always `images[0]`, matching Shopify's shape. The entry's `altText` is applied to every additional image (`MediaImage` already falls back to `"{title} image {idx+1}"` for empty alts, so per-image alt strings are non-essential).

### 3. `BrandCatalogEntry.variant?: { id?; title? }`

A new optional field on `BrandCatalogEntry`. When present, `toProductDetails` emits a single canonical `ProductVariant` in `variants[]`, synthesised from the entry's product-level `price` / `compareAtPrice` / `availableForSale` / `featuredImagePath`. Defaults: `id = gid://brand-catalog/ProductVariant/{handle}`, `title = "Default Title"`. Both override-able. When omitted, `variants: []` is emitted exactly as before.

`options: []` stays unconditionally — `ProductInfoOptions` filters out default-only options anyway, so the no-op-for-single-variant requirement is satisfied by emitting no options at all. A future-proof options matrix is deliberately not built; adding it now would be premature for the v1 brand-catalog slice.

With a canonical variant present, `hasUniformPricing([v])` returns true (length ≤ 1) and `getUniformDisplayPrice` reads from `variants[0]` rather than `priceRange.minVariantPrice` — the standard path replaces change #1's fallback, but the fallback stays as defensive coverage for the variant-omitted path.

## Why it matters

- Pairs with `[[brand-catalog-data-layer-override]]`. That entry documents the v1 scope which deliberately had no variants and a single image per product; this entry lifts those v1 limitations behind two optional fields, so a richer agent-emitted catalog now renders as a real PDP without any component changes downstream.
- The price-fallback helper (#1) is generally useful: any future data source whose products have no variant matrix (a CT-backed source, mock data, etc.) gets PDP price visibility for free.
- Both schema extensions (#2 and #3) are strictly additive. A v1 fixture authored before this change continues to work; agents that want richer output can opt into multi-image and canonical variants by emitting the new fields. No migration is required.

## Apply when

- The storefront is generated or seeded by an external tool that wants a Shopify-equivalent PDP visual without going through Shopify (the canonical case: `vercel-labs/commercetools-store-agent`).
- The storefront has adopted `[[brand-catalog-data-layer-override]]` and the v1 limitations (no variants / single image / no price block under empty variants) are now user-visible papercuts.
- The storefront wants `getUniformDisplayPrice` as a generic price-fallback helper independent of brand-catalog.

## Safe to skip when

- The storefront only ever reads from Shopify and has no brand-catalog / fixture / CT pipeline. The price-fallback helper is unreachable on the Shopify code path (variants is always non-empty); the multi-image and variant schema extensions are no-ops without a fixture file. The change is inert but harmless.
- The storefront has a v1 brand-catalog fixture and is happy with single-image / no-variants PDP rendering. The new fields are optional; ignoring them keeps the v1 visual.

## Notes

- BuyButtons remain hidden under brand-catalog regardless of variants presence (the `isBrandCatalogActive() ? null` guard sits above the variant-rendering branch). Visibility under brand-catalog is a separate HITL decision tracked in [issue #12](https://github.com/dieDeMiguel/vercel-shop-fork-commercetools/issues/12), not addressed here.
- The price-fallback helper is the unit-of-test boundary for change #1. A React Testing Library dep was deliberately not introduced for a component-level test; the helper carries the actual fallback decision and the JSX simply renders its output.
- Schema-extension decisions for #2 and #3 favored two separate optional fields (`featuredImagePath` + `additionalImagePaths`; `variant?: {}` not `hasVariant: boolean`) over single-field replacements. Reasons: (1) v1 callers keep the existing contract verbatim; (2) `images[0] === featuredImage` matches Shopify's shape; (3) `variant: {}` reserves a slot for `selectedOptions` / explicit IDs without a follow-up schema migration.

## Validation

1. `pnpm --filter template test` — 33 brand-catalog and product-helper tests pass (15 prior brand-catalog + 4 new price-helper + 7 new multi-image + 7 new canonical-variant).
2. `pnpm --filter template typecheck` — clean.
3. With a v1 fixture (no `additionalImagePaths`, no `variant`), home / PDP / search / collection pages render identically to before — single image, no variants block, price visible via the fallback path.
4. With a fixture that adds `additionalImagePaths: ["/brand/product-{handle}-2.webp", ...]`, the PDP grid renders all images.
5. With a fixture that adds `variant: {}`, the PDP renders a single-variant block and the price comes from the standard `variants[0]` path (not the fallback).
6. Remove the fixture and reload — Shopify-backed PDP renders identically to upstream, with no regression in price/image/variant blocks.
