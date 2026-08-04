import type { Product, ProductVariant } from "@/stores/catalog";

type PriceGroupNode = {
  products?: Product[];
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
  const ownMinPrice = getMinPriceForProducts(node.products || []);
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

/**
 * Скидка у товара или у любого его вкуса: скидка на отдельный вкус не поднимает
 * флаг у самого товара, поэтому одного `hasDiscount` мало.
 */
export function hasDiscountForProduct(product: Product): boolean {
  return Boolean(product.hasDiscount)
    || getSafeVariants(product).some((variant) => variant.hasDiscount);
}

/** Есть ли скидка где-то в линейке, включая вложенные линейки. */
export function hasDiscountInTree(node: PriceGroupNode): boolean {
  return (node.products || []).some(hasDiscountForProduct)
    || (node.children || []).some(hasDiscountInTree);
}

/**
 * Цену позиции прячем, когда она совпадает с ценой линейки, чтобы не дублировать
 * одно и то же число. Но скидочная позиция цену показывает всегда: именно рядом
 * с ней живут зачёркнутая старая цена и процент.
 */
export function shouldShowPrice(
  item: { priceRub?: number | null; hasDiscount?: boolean },
  reference: number | null,
): boolean {
  if (!hasPositivePrice(item.priceRub)) return false;
  return Boolean(item.hasDiscount) || item.priceRub !== reference;
}

/** Глубина скидки в процентах. Одна формула на витрину и на админку. */
export function discountPercent(basePrice: number, discountPrice: number): number {
  if (!Number.isFinite(basePrice) || basePrice <= 0) return 0;
  return Math.round(((basePrice - discountPrice) / basePrice) * 100);
}
