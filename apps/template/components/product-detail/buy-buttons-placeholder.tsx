import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ShopLogo } from "./shop-logo";

export interface BuyButtonsPlaceholderViewProps {
  addToCartLabel: string;
  availableForSale: boolean;
  buyWithShopLabel: string;
}

export function BuyButtonsPlaceholderView({
  addToCartLabel,
  availableForSale,
  buyWithShopLabel,
}: BuyButtonsPlaceholderViewProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5" data-slot="buy-buttons-placeholder">
      <button
        type="button"
        aria-disabled="true"
        disabled
        tabIndex={-1}
        className={cn(
          "flex flex-1 items-center justify-center gap-1.5 rounded-lg h-12 bg-shop text-white opacity-60 cursor-not-allowed",
          !availableForSale && "invisible",
        )}
      >
        <span className="text-sm font-medium">{buyWithShopLabel}</span>
        <ShopLogo className="h-4 w-auto" />
      </button>
      <Button
        type="button"
        aria-disabled="true"
        disabled
        tabIndex={-1}
        className="flex-1 justify-center h-12 bg-primary text-primary-foreground opacity-60 cursor-not-allowed"
      >
        {addToCartLabel}
      </Button>
    </div>
  );
}

export async function BuyButtonsPlaceholder({ availableForSale }: { availableForSale: boolean }) {
  const t = await getTranslations("product");
  return (
    <BuyButtonsPlaceholderView
      addToCartLabel={t("addToCart")}
      availableForSale={availableForSale}
      buyWithShopLabel={t("buyWithShop")}
    />
  );
}
