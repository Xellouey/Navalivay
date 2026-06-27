import type { Product, ProductVariant } from "@/stores/catalog";

type PriceGroupNode = {
  products: Product[];
  children?: PriceGroupNode[];
};

export function hasPositivePrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function getSafeVariants(product: Product): ProductVariant[] {
  if (!Array.isArray(product.variants)) return [];
  return product.variants.filter(
    (variant): variant is ProductVariant => Boolean(variant),
  );
}

function getProductPrices(product: Product): number[] {
  if (product.hasVariants) {
    const variantsWithPrice = getSafeVariants(product).filter((variant) =>
      hasPositivePrice(variant.priceRub),
    );

    if (!variantsWithPrice.length) {
      return hasPositivePrice(product.priceRub) ? [product.priceRub] : [];
    }

    const inStockVariants = variantsWithPrice.filter(
      (variant) => typeof variant.stock !== "number" || variant.stock > 0,
    );
    const source = inStockVariants.length ? inStockVariants : variantsWithPrice;

    return source
      .map((variant) => variant.priceRub)
      .filter(hasPositivePrice);
  }

  return hasPositivePrice(product.priceRub) ? [product.priceRub] : [];
}

export function getMinPriceForProducts(products: Product[]): number | null {
  const prices = products.flatMap(getProductPrices);
  if (!prices.length) return null;
  return Math.min(...prices);
}

export function getMinPriceForGroupTree(node: PriceGroupNode): number | null {
  const ownMinPrice = getMinPriceForProducts(node.products);
  const childMinPrices = (node.children || [])
    .map(getMinPriceForGroupTree)
    .filter((price): price is number => price !== null);

  const prices = [
    ...(ownMinPrice !== null ? [ownMinPrice] : []),
    ...childMinPrices,
  ];

  if (!prices.length) return null;
  return Math.min(...prices);
}
