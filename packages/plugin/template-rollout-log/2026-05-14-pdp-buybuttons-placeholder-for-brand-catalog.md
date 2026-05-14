---
title: PDP renders BuyButtons as a disabled placeholder under brand-catalog mode
changeKey: pdp-buybuttons-placeholder-for-brand-catalog
introducedOn: 2026-05-14
changeType: feature
defaultAction: adopt
appliesTo:
  - brand-catalog-enabled
paths:
  - apps/template/components/product-detail/buy-buttons-placeholder.tsx
  - apps/template/components/product-detail/buy-buttons-placeholder.test.tsx
  - apps/template/components/product-detail/product-detail-section.tsx
---

## Summary

Under brand-catalog mode the PDP previously rendered `null` in place of the two checkout CTAs via `{isBrandCatalogActive() ? null : <BuyButtons …/>}`, leaving a conspicuous gap in the product-info column. This entry replaces the `null` with a `<BuyButtonsPlaceholder availableForSale={…} />` server component that emits the same two-button visual treatment as the upstream PDP (Buy with Shop + Add to Cart) but inert — disabled, unfocusable, no click handler, no checkout endpoint reachable.

The live `<BuyButtons>` branch (Shopify-backed checkout) is untouched. The change activates only when `isBrandCatalogActive()` is true.

### Component shape

A new `BuyButtonsPlaceholder` lives at `components/product-detail/buy-buttons-placeholder.tsx`, split into two exports:

- `BuyButtonsPlaceholderView` — a pure presentational component taking already-translated labels and `availableForSale`. Renders real `<button disabled aria-disabled="true" tabIndex={-1}>` semantics with `cursor-not-allowed` + `opacity-60` for the disabled affordance. The Buy-with-Shop button uses `invisible` when `availableForSale` is false, exactly like the live component, so the grid keeps its two-column shape.
- `BuyButtonsPlaceholder` — an async server-component wrapper that resolves the i18n strings via `getTranslations("product")` and renders the view.

The split lets the placeholder be unit-tested via `renderToStaticMarkup` without booting the next-intl runtime — the same pure-function test pattern used by [[pdp-improvements-for-brand-catalog]] for the price-helper.

## Why it matters

- Pairs with [[brand-catalog-data-layer-override]] and [[pdp-improvements-for-brand-catalog]]. Those entries lifted the v1 brand-catalog PDP from "single image, no variants" to "real PDP with multi-image gallery and a canonical variant block"; this entry closes the last visual gap by giving the brand-catalog PDP the same CTA shape as the upstream Vercel Shop PDP.
- Disabled `<button>` is an honest signal: assistive tech announces the button as disabled, keyboard users can't focus it, and a real Shopify cart endpoint is never reachable from a synthetic GID. A click-handler variant (e.g. a "demo mode" toast) was rejected because it commits to a click that doesn't really do anything — worse UX than visibly inert buttons.
- The Shopify-backed checkout flow has no regression. The `isBrandCatalogActive()` guard sits above the placeholder; storefronts that don't run a brand-catalog fixture never reach this code path.

## Apply when

- The storefront has adopted [[brand-catalog-data-layer-override]] and the empty space where BuyButtons used to render is a user-visible papercut.
- The storefront wants the brand-catalog PDP to visually match the upstream Vercel Shop PDP one-to-one.

## Safe to skip when

- The storefront only reads from Shopify and never runs in brand-catalog mode. The placeholder code path is unreachable; the import is inert.
- The storefront prefers the v1 behavior of hiding BuyButtons entirely under brand-catalog mode (the upstream `null` branch). The placeholder is opt-in via the same `isBrandCatalogActive()` guard — reverting to `null` is a one-line change.

## Notes

- No tooltip / "demo mode" explanatory copy is included in v1. If usability review surfaces "users still try to click them," the follow-up is a tooltip via the existing tooltip primitives — no API change required.
- The placeholder deliberately does not reuse the Suspense fallback block from `product-detail-section.tsx`. The fallback is a transient flash during async resolution and uses presentational `<div>`s with no accessibility semantics; the brand-catalog state is permanent for the page lifetime and deserves real `<button disabled>` semantics for screen readers.
- `cursor-not-allowed` is the canonical disabled-element cursor per the template's `AGENTS.md` rule ("Disabled interactive elements must use cursor-not-allowed").

## Validation

1. `pnpm --filter template test` — 39 tests pass (33 prior + 6 new placeholder tests: two disabled buttons emitted, `aria-disabled="true"` on both, `cursor-not-allowed` present, no `onClick` attribute in static markup, labels passthrough, `invisible` class on Buy-with-Shop when `availableForSale=false`, `tabIndex=-1` on both).
2. `pnpm --filter template typecheck` — clean.
3. With a brand-catalog fixture loaded, the PDP renders two disabled buttons in the product-info column. Hovering shows `cursor-not-allowed`; the buttons are not focusable via Tab; assistive tech announces them as disabled.
4. Remove the fixture and reload — Shopify-backed PDP renders the live `<BuyButtons>` and clicking Buy with Shop / Add to Cart still works identically to upstream.
