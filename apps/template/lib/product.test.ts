import { describe, expect, it } from "vitest";

import { getUniformDisplayPrice } from "./product";
import type { ProductVariant } from "./types";

const variant: ProductVariant = {
  id: "gid://shopify/ProductVariant/1",
  title: "Default",
  availableForSale: true,
  price: { amount: "100.00", currencyCode: "USD" },
  selectedOptions: [],
  image: null,
};

const priceRange = {
  minVariantPrice: { amount: "189.00", currencyCode: "USD" },
};

describe("getUniformDisplayPrice", () => {
  it("returns variant price when a variant is present", () => {
    const display = getUniformDisplayPrice([variant], priceRange);
    expect(display).toEqual({
      amount: "100.00",
      currencyCode: "USD",
      compareAtAmount: undefined,
    });
  });

  it("passes compareAtAmount through when the variant has one", () => {
    const display = getUniformDisplayPrice(
      [{ ...variant, compareAtPrice: { amount: "120.00", currencyCode: "USD" } }],
      priceRange,
    );
    expect(display.compareAtAmount).toBe("120.00");
  });

  it("falls back to priceRange.minVariantPrice when variants is empty", () => {
    const display = getUniformDisplayPrice([], priceRange);
    expect(display).toEqual({
      amount: "189.00",
      currencyCode: "USD",
    });
  });

  it("does not invent a compareAtAmount in the fallback path", () => {
    const display = getUniformDisplayPrice([], priceRange);
    expect(display.compareAtAmount).toBeUndefined();
  });
});
