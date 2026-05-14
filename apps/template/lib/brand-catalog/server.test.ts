import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BrandCatalog, BrandCatalogEntry } from "./server";
import {
  isBrandCatalogActive,
  loadBrandCatalog,
  resetBrandCatalogCacheForTests,
  toProductCard,
  toProductDetails,
} from "./server";

const baseEntry: BrandCatalogEntry = {
  id: "gid://brand-catalog/Product/aero-driver-gloves",
  handle: "aero-driver-gloves",
  title: "Aero Driver Gloves",
  vendor: "Aero",
  description: "Italian-leather racing gloves with reinforced palm.",
  descriptionHtml: "<p>Italian-leather racing gloves with reinforced palm.</p>",
  price: { amount: "189.00", currencyCode: "USD" },
  featuredImagePath: "/brand/product-aero-driver-gloves.webp",
  altText: "Aero driver gloves on display",
  tags: ["gloves", "leather"],
  availableForSale: true,
};

describe("toProductCard", () => {
  it("emits a synthetic GID and maps featuredImagePath to featuredImage.url", () => {
    const card = toProductCard(baseEntry, "Aero");

    expect(card.id).toBe("gid://brand-catalog/Product/aero-driver-gloves");
    expect(card.featuredImage?.url).toBe("/brand/product-aero-driver-gloves.webp");
    expect(card.featuredImage?.altText).toBe("Aero driver gloves on display");
  });

  it("passes price through unchanged", () => {
    const card = toProductCard(baseEntry, "Aero");
    expect(card.price).toEqual({ amount: "189.00", currencyCode: "USD" });
  });

  it("returns undefined compareAtPrice when omitted (not null or 0)", () => {
    const card = toProductCard(baseEntry, "Aero");
    expect(card.compareAtPrice).toBeUndefined();
  });

  it("passes compareAtPrice through when present", () => {
    const card = toProductCard(
      { ...baseEntry, compareAtPrice: { amount: "229.00", currencyCode: "USD" } },
      "Aero",
    );
    expect(card.compareAtPrice).toEqual({ amount: "229.00", currencyCode: "USD" });
  });

  it("falls back to brandName when entry vendor is empty", () => {
    const card = toProductCard({ ...baseEntry, vendor: "" }, "Aero");
    expect(card.vendor).toBe("Aero");
  });

  it("preserves entry vendor when present", () => {
    const card = toProductCard(baseEntry, "Aero");
    expect(card.vendor).toBe("Aero");
  });

  it("propagates availableForSale", () => {
    const inStock = toProductCard(baseEntry, "Aero");
    const outOfStock = toProductCard({ ...baseEntry, availableForSale: false }, "Aero");
    expect(inStock.availableForSale).toBe(true);
    expect(outOfStock.availableForSale).toBe(false);
  });

  it("maps independent entries without shared state", () => {
    const a = toProductCard(baseEntry, "Aero");
    const b = toProductCard(
      { ...baseEntry, handle: "kilo-gloves", id: "gid://brand-catalog/Product/kilo-gloves" },
      "Aero",
    );
    expect(a.handle).toBe("aero-driver-gloves");
    expect(b.handle).toBe("kilo-gloves");
    expect(a.id).not.toBe(b.id);
  });

  it("returns images as [featuredImage] when additionalImagePaths is omitted (backward compat)", () => {
    const card = toProductCard(baseEntry, "Aero");
    expect(card.images).toHaveLength(1);
    expect(card.images[0]?.url).toBe("/brand/product-aero-driver-gloves.webp");
  });

  it("treats additionalImagePaths: [] as equivalent to omitting it", () => {
    const card = toProductCard({ ...baseEntry, additionalImagePaths: [] }, "Aero");
    expect(card.images).toHaveLength(1);
    expect(card.images[0]?.url).toBe("/brand/product-aero-driver-gloves.webp");
  });

  it("prepends featuredImage and preserves order of additionalImagePaths", () => {
    const card = toProductCard(
      {
        ...baseEntry,
        additionalImagePaths: [
          "/brand/product-aero-driver-gloves-2.webp",
          "/brand/product-aero-driver-gloves-3.webp",
          "/brand/product-aero-driver-gloves-4.webp",
        ],
      },
      "Aero",
    );
    expect(card.images.map((img) => img.url)).toEqual([
      "/brand/product-aero-driver-gloves.webp",
      "/brand/product-aero-driver-gloves-2.webp",
      "/brand/product-aero-driver-gloves-3.webp",
      "/brand/product-aero-driver-gloves-4.webp",
    ]);
  });

  it("applies entry altText to all additional images", () => {
    const card = toProductCard(
      {
        ...baseEntry,
        additionalImagePaths: ["/brand/product-aero-driver-gloves-2.webp"],
      },
      "Aero",
    );
    expect(card.images.every((img) => img.altText === "Aero driver gloves on display")).toBe(true);
  });
});

describe("toProductDetails", () => {
  it("synthesizes priceRange from entry.price", () => {
    const details = toProductDetails(baseEntry, "Aero");
    expect(details.priceRange.minVariantPrice).toEqual(baseEntry.price);
    expect(details.priceRange.maxVariantPrice).toEqual(baseEntry.price);
  });

  it("populates description and descriptionHtml", () => {
    const details = toProductDetails(baseEntry, "Aero");
    expect(details.description).toBe(baseEntry.description);
    expect(details.descriptionHtml).toBe(baseEntry.descriptionHtml);
  });

  it("falls back manufacturerName to brandName when vendor empty", () => {
    const details = toProductDetails({ ...baseEntry, vendor: "" }, "Aero");
    expect(details.manufacturerName).toBe("Aero");
  });

  it("renders a single image when additionalImagePaths is omitted (backward compat)", () => {
    const details = toProductDetails(baseEntry, "Aero");
    expect(details.images).toHaveLength(1);
    expect(details.images[0]?.url).toBe("/brand/product-aero-driver-gloves.webp");
  });

  it("populates images with the full set when additionalImagePaths is present", () => {
    const details = toProductDetails(
      {
        ...baseEntry,
        additionalImagePaths: [
          "/brand/product-aero-driver-gloves-2.webp",
          "/brand/product-aero-driver-gloves-3.webp",
          "/brand/product-aero-driver-gloves-4.webp",
        ],
      },
      "Aero",
    );
    expect(details.images.map((img) => img.url)).toEqual([
      "/brand/product-aero-driver-gloves.webp",
      "/brand/product-aero-driver-gloves-2.webp",
      "/brand/product-aero-driver-gloves-3.webp",
      "/brand/product-aero-driver-gloves-4.webp",
    ]);
  });

  it("keeps featuredImage as the single featuredImagePath even when additional images exist", () => {
    const details = toProductDetails(
      {
        ...baseEntry,
        additionalImagePaths: ["/brand/product-aero-driver-gloves-2.webp"],
      },
      "Aero",
    );
    expect(details.featuredImage?.url).toBe("/brand/product-aero-driver-gloves.webp");
  });

  it("emits variants: [] and options: [] when variant is omitted (backward compat)", () => {
    const details = toProductDetails(baseEntry, "Aero");
    expect(details.variants).toEqual([]);
    expect(details.options).toEqual([]);
  });

  it("emits a single canonical variant when variant is present", () => {
    const details = toProductDetails({ ...baseEntry, variant: {} }, "Aero");
    expect(details.variants).toHaveLength(1);
    expect(details.options).toEqual([]);
  });

  it("synthesises canonical variant id and title when variant is empty object", () => {
    const details = toProductDetails({ ...baseEntry, variant: {} }, "Aero");
    const [variant] = details.variants;
    expect(variant?.id).toBe("gid://brand-catalog/ProductVariant/aero-driver-gloves");
    expect(variant?.title).toBe("Default Title");
  });

  it("respects caller-provided variant id and title", () => {
    const details = toProductDetails(
      {
        ...baseEntry,
        variant: { id: "gid://brand-catalog/ProductVariant/custom", title: "One Size" },
      },
      "Aero",
    );
    const [variant] = details.variants;
    expect(variant?.id).toBe("gid://brand-catalog/ProductVariant/custom");
    expect(variant?.title).toBe("One Size");
  });

  it("canonical variant inherits price, compareAtPrice and availableForSale from the entry", () => {
    const details = toProductDetails(
      {
        ...baseEntry,
        compareAtPrice: { amount: "229.00", currencyCode: "USD" },
        availableForSale: false,
        variant: {},
      },
      "Aero",
    );
    const [variant] = details.variants;
    expect(variant?.price).toEqual({ amount: "189.00", currencyCode: "USD" });
    expect(variant?.compareAtPrice).toEqual({ amount: "229.00", currencyCode: "USD" });
    expect(variant?.availableForSale).toBe(false);
  });

  it("canonical variant carries no selectedOptions (single canonical, no matrix yet)", () => {
    const details = toProductDetails({ ...baseEntry, variant: {} }, "Aero");
    expect(details.variants[0]?.selectedOptions).toEqual([]);
  });

  it("canonical variant image matches featuredImagePath", () => {
    const details = toProductDetails({ ...baseEntry, variant: {} }, "Aero");
    expect(details.variants[0]?.image?.url).toBe("/brand/product-aero-driver-gloves.webp");
  });
});

describe("loadBrandCatalog", () => {
  let tmp: string;
  let filePath: string;

  beforeEach(() => {
    resetBrandCatalogCacheForTests();
    delete process.env.BRAND_CATALOG_DISABLE;
    tmp = mkdtempSync(path.join(tmpdir(), "brand-catalog-"));
    filePath = path.join(tmp, "catalog.json");
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    resetBrandCatalogCacheForTests();
    delete process.env.BRAND_CATALOG_DISABLE;
    vi.restoreAllMocks();
  });

  it("returns null when the file does not exist", () => {
    expect(loadBrandCatalog(filePath)).toBeNull();
  });

  it("parses and returns the catalog when the file exists", () => {
    const catalog: BrandCatalog = {
      brandName: "Aero",
      currency: "USD",
      products: [baseEntry],
    };
    writeFileSync(filePath, JSON.stringify(catalog));

    const loaded = loadBrandCatalog(filePath);
    expect(loaded?.brandName).toBe("Aero");
    expect(loaded?.products).toHaveLength(1);
    expect(loaded?.products[0]?.handle).toBe("aero-driver-gloves");
  });

  it("memoizes — the second call does not re-read the file", () => {
    const catalog: BrandCatalog = {
      brandName: "Aero",
      currency: "USD",
      products: [baseEntry],
    };
    writeFileSync(filePath, JSON.stringify(catalog));

    const first = loadBrandCatalog(filePath);
    rmSync(filePath);
    const second = loadBrandCatalog(filePath);

    expect(second).toBe(first);
    expect(second?.brandName).toBe("Aero");
  });

  it("returns null when BRAND_CATALOG_DISABLE=1 even if the file exists", () => {
    const catalog: BrandCatalog = {
      brandName: "Aero",
      currency: "USD",
      products: [baseEntry],
    };
    writeFileSync(filePath, JSON.stringify(catalog));

    process.env.BRAND_CATALOG_DISABLE = "1";
    expect(loadBrandCatalog(filePath)).toBeNull();
    expect(isBrandCatalogActive()).toBe(false);
  });
});
