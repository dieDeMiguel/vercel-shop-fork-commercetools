---
title: Components consume brand tokens instead of fixed `foreground`/`background` utilities
changeKey: components-consume-brand-tokens
introducedOn: 2026-05-14
changeType: refactor
defaultAction: adopt
appliesTo:
  - all
paths:
  - apps/template/app/globals.css
  - apps/template/app/not-found.tsx
  - apps/template/app/search/page.tsx
  - apps/template/components/account/page-header.tsx
  - apps/template/components/cart-page/empty-cart.tsx
  - apps/template/components/cart-page/header.tsx
  - apps/template/components/cart-page/summary.tsx
  - apps/template/components/cart/overlay-content.tsx
  - apps/template/components/collections/collection-page.tsx
  - apps/template/components/footer/index.tsx
  - apps/template/components/footer/social-links.tsx
  - apps/template/components/nav/mobile-menu.tsx
  - apps/template/components/nav/quick-links.tsx
  - apps/template/components/nav/search-modal.tsx
  - apps/template/components/product-detail/buy-buttons.tsx
  - apps/template/components/product-detail/product-detail-section.tsx
  - apps/template/components/product-detail/product-info.tsx
  - apps/template/components/product/products-grid.tsx
  - apps/template/components/product/related-products-section.tsx
  - apps/template/components/sections/banner-section.tsx
  - apps/template/components/ui/slider.tsx
---

## Summary

Many components had hardcoded `bg-foreground`/`text-background`/`hover:text-foreground` utility classes for their primary CTAs, link hovers, and section headings. Because `--foreground` and `--background` are intentionally fixed-tone tokens in `app/globals.css`, edits to brand tokens (`--primary`, `--accent`) had no visible effect on those elements. This pass rewires component JSX so token-configurable surfaces reference the brand tokens directly.

The change is a token swap, not a redesign. With upstream defaults (`--primary: #000000`, `--accent: #e9e9e9`), every affected element renders visually identical to before. With a custom theme that sets brand colors on `--primary` / `--primary-foreground` / `--accent` / `--accent-foreground` in `:root` (or under a `data-theme` selector), the same CTAs, hovers, and hero buttons pick up the brand color with no further component edits.

A new theme token, `--font-display`, is also added to `@theme` and defaults to `var(--font-geist-sans)`. Section/page headings (`<h1>`, `<h2>`, slider titles) now use the `font-display` utility. With no override, headings render identical to upstream. A storefront that wants a distinct display face imports the font in `app/layout.tsx` and points `--font-display` at its variable in `@theme`.

### Token mapping applied

- Primary CTAs (`buy-buttons.tsx`, cart overlay continue/checkout, cart-page summary + empty-cart, search-modal view-all, `not-found.tsx`): `bg-foreground text-background hover:bg-foreground/90` → `bg-primary text-primary-foreground hover:bg-primary/90`.
- Link hovers on user-prominent navigation surfaces (footer links, social links, nav quick-links, mobile menu, products-grid "View all"): `hover:text-foreground` → `hover:text-primary`.
- Hero CTA on `BannerSection` over a dark hero image: `bg-background text-foreground` → `bg-accent text-accent-foreground`. Default visual diff is imperceptible (`#e9e9e9` vs `#ffffff`); a brand-set `--accent` lets the hero CTA pop.
- Section/page headings: `font-sans` (implicit) → `font-display` utility.

### Token mapping NOT applied (intentionally)

- `bg-shop` (Shopify Pay's locked purple) is a third-party brand color — untouched.
- Internal selection-state and inverted-style chrome (search `SuggestionChip` selected state, collection-filter icon button, tooltip) stay on the `foreground`/`background` pair. They are utility affordances, not user-prominent brand surfaces.
- Filter/AI/agent/cart-overlay internal hovers stay on `hover:text-foreground` for the same reason.

## Why it matters

- Storefronts that customize `:root` brand tokens get a visibly branded storefront end-to-end without editing component JSX.
- Component code no longer hardcodes assumptions about the foreground/background relationship being the brand's primary surface — that pair is reserved for body text and page background, where it belongs.
- The new `--font-display` token gives downstream storefronts a single seam for swapping the heading face without touching every heading element.

## Apply when

- The storefront has not heavily customized `buy-buttons.tsx`, the cart summary/overlay, footer links, or hero CTA markup.
- The storefront wants brand customization to be driven by editing tokens in `globals.css` / a theme file, not by editing component classes.

## Safe to skip when

- The storefront has deliberately decoupled its primary CTA color from `--primary` (e.g. CTAs intentionally locked to black regardless of brand color).
- The storefront has already migrated to a different token convention (e.g. CTAs reference a bespoke `--brand` token).

## Notes

- Pairs naturally with the brand-catalog data-layer override (see `feat(brand-catalog)` commits). That work ensures the *products* are brand-aligned; this work ensures the *chrome around them* is brand-aligned too. Either change is independently useful.
- The "Add to bag" CTA in `product-detail-section.tsx` is hidden when `isBrandCatalogActive()` returns true, so its swap to `bg-primary` is latent in agent-generated stores until cart wiring lands. For non-agent storefronts the change is immediately visible.

## Validation

1. `pnpm --filter template typecheck` — clean.
2. `pnpm --filter template test` — brand-catalog suite still green.
3. With upstream `globals.css` unchanged: load home, PDP, search, cart, and footer. CTAs and link hovers should be visually indistinguishable from before.
4. Set `--primary: #2C3E50` and `--primary-foreground: #ffffff` in `:root` of `globals.css`. CTAs across home/PDP/cart and link hovers across footer/nav/products-grid should render in slate-blue.
5. Set `--accent: #E67E22` and `--accent-foreground: #ffffff`. The hero CTA on the homepage banner should render orange.
