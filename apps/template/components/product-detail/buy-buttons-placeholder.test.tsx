import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BuyButtonsPlaceholderView } from "./buy-buttons-placeholder";

function render(props: Parameters<typeof BuyButtonsPlaceholderView>[0]) {
  return renderToStaticMarkup(<BuyButtonsPlaceholderView {...props} />);
}

describe("BuyButtonsPlaceholderView", () => {
  const baseProps = {
    addToCartLabel: "Add to Cart",
    availableForSale: true,
    buyWithShopLabel: "Buy with",
  };

  it("emits two disabled buttons with aria-disabled='true'", () => {
    const html = render(baseProps);
    const disabledButtons = html.match(/<button[^>]*disabled[^>]*>/g) ?? [];
    expect(disabledButtons.length).toBe(2);
    expect(html.match(/aria-disabled="true"/g)?.length).toBe(2);
  });

  it("uses cursor-not-allowed for the disabled affordance", () => {
    const html = render(baseProps);
    expect(html).toContain("cursor-not-allowed");
  });

  it("renders no onClick handler attribute in the static markup", () => {
    const html = render(baseProps);
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("onClick");
  });

  it("renders the provided labels", () => {
    const html = render(baseProps);
    expect(html).toContain("Add to Cart");
    expect(html).toContain("Buy with");
  });

  it("hides the buy-with-shop button when availableForSale is false", () => {
    const html = render({ ...baseProps, availableForSale: false });
    const buyButton = html.match(/<button[^>]*bg-shop[^>]*>/)?.[0] ?? "";
    expect(buyButton).toContain("invisible");
  });

  it("removes the buy-with-shop button from the tab order", () => {
    const html = render(baseProps);
    expect(html.match(/tabindex="-1"/g)?.length).toBe(2);
  });
});
