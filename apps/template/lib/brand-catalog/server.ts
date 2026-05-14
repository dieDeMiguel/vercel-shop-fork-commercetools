import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { Money, ProductCard, ProductDetails } from "@/lib/types";

export interface BrandCatalogEntry {
  id: string;
  handle: string;
  title: string;
  vendor: string;
  description: string;
  descriptionHtml: string;
  price: Money;
  compareAtPrice?: Money;
  featuredImagePath: string;
  additionalImagePaths?: string[];
  altText: string;
  tags: string[];
  availableForSale: boolean;
}

export interface BrandCatalog {
  brandName: string;
  currency: string;
  products: BrandCatalogEntry[];
}

const CATALOG_PATH = path.join(process.cwd(), "lib", "brand-catalog", "catalog.json");

type LoadState = { loaded: false } | { loaded: true; value: BrandCatalog | null };

let cache: LoadState = { loaded: false };

export function resetBrandCatalogCacheForTests(): void {
  cache = { loaded: false };
}

export function isBrandCatalogDisabled(): boolean {
  return process.env.BRAND_CATALOG_DISABLE === "1";
}

function readCatalogFromDisk(filePath: string): BrandCatalog | null {
  if (!existsSync(filePath)) return null;
  const raw = readFileSync(filePath, "utf8");
  return JSON.parse(raw) as BrandCatalog;
}

export function loadBrandCatalog(filePath: string = CATALOG_PATH): BrandCatalog | null {
  if (isBrandCatalogDisabled()) return null;
  if (cache.loaded) return cache.value;
  const value = readCatalogFromDisk(filePath);
  cache = { loaded: true, value };
  return value;
}

export function isBrandCatalogActive(): boolean {
  return loadBrandCatalog() !== null;
}

export function toProductCard(entry: BrandCatalogEntry, brandName: string): ProductCard {
  const altText = entry.altText ?? entry.title;
  const featuredImage = entry.featuredImagePath
    ? { url: entry.featuredImagePath, altText, width: 0, height: 0 }
    : null;

  const additionalImages = (entry.additionalImagePaths ?? []).map((url) => ({
    url,
    altText,
    width: 0,
    height: 0,
  }));

  const images = featuredImage ? [featuredImage, ...additionalImages] : additionalImages;

  return {
    id: entry.id,
    handle: entry.handle,
    title: entry.title,
    featuredImage,
    images,
    price: entry.price,
    compareAtPrice: entry.compareAtPrice,
    vendor: entry.vendor?.trim() ? entry.vendor : brandName,
    availableForSale: entry.availableForSale,
    defaultVariantSelectedOptions: [],
  };
}

export function toProductDetails(entry: BrandCatalogEntry, brandName: string): ProductDetails {
  const card = toProductCard(entry, brandName);
  const vendor = card.vendor ?? brandName;

  return {
    ...card,
    description: entry.description,
    descriptionHtml: entry.descriptionHtml,
    images: card.images,
    videos: [],
    variants: [],
    options: [],
    tags: entry.tags ?? [],
    seo: {
      title: entry.title,
      description: entry.description,
    },
    category: null,
    updatedAt: new Date(0).toISOString(),
    priceRange: {
      minVariantPrice: entry.price,
      maxVariantPrice: entry.price,
    },
    currencyCode: entry.price.currencyCode,
    manufacturerName: vendor,
    collectionHandles: [],
  };
}
