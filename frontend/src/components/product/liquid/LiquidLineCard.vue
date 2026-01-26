<template>
  <div class="liquid-line-card" :class="{ expanded }">
    <div class="liquid-line-header" @click="toggle">
      <div
        class="liquid-line-main"
        role="button"
        tabindex="0"
        @keyup.enter.prevent="toggle"
        @keyup.space.prevent="toggle"
      >
        <div class="liquid-line-image-wrapper">
          <div v-if="coverUrl" class="liquid-line-image">
            <img :src="coverUrl" :alt="title" />
          </div>
          <div v-else class="liquid-line-image liquid-line-image-placeholder">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#E6E9ED"
              stroke-width="1.5"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        </div>
        <div class="liquid-line-info">
          <h3 class="liquid-line-title">{{ title }}</h3>
          <div
            v-if="!expanded && totalProductCount > 0"
            class="liquid-line-count-badge"
          >
            <span>Ещё {{ totalProductCount }}</span>
          </div>
        </div>
      </div>
      <div class="liquid-line-side">
        <button
          type="button"
          class="liquid-line-toggle"
          :class="{ expanded }"
          @click.stop="toggle"
          aria-label="Переключить линейку"
        >
          <ChevronDownIcon class="liquid-line-toggle-icon" />
        </button>
      </div>
    </div>

    <div
      ref="bodyWrapper"
      class="liquid-line-body-wrapper"
      :style="wrapperStyle"
    >
      <div class="liquid-line-body">
        <!-- Подлинейки (товары с вариантами) - новый дизайн -->
        <div v-if="productsWithVariants.length" class="liquid-sublines">
          <div
            v-for="product in productsWithVariants"
            :key="product.id"
            class="liquid-subline-card"
          >
            <!-- Разделитель сверху -->
            <div class="liquid-subline-divider"></div>

            <!-- Заголовок подлинейки -->
            <div
              class="liquid-subline-header"
              @click="toggleVariantProductExpansion(product.id)"
            >
              <div class="liquid-subline-image-wrapper">
                <div class="liquid-subline-image">
                  <img
                    v-if="getProductImage(product)"
                    :src="getProductImage(product)!"
                    :alt="product.title"
                  />
                  <svg
                    v-else
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#E6E9ED"
                    stroke-width="1.5"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
              </div>
              <div class="liquid-subline-info">
                <h4 class="liquid-subline-title">{{ product.title }}</h4>
                <p v-if="product.variant" class="liquid-subline-description">
                  {{ product.variant }}
                </p>
                <p class="liquid-subline-price">
                  {{ formatPrice(product.priceRub) }} BYN
                </p>
              </div>
              <button
                type="button"
                class="liquid-subline-toggle"
                :class="{ expanded: isVariantProductExpanded(product.id) }"
                @click.stop="toggleVariantProductExpansion(product.id)"
                aria-label="Переключить подлинейку"
              >
                <ChevronDownIcon class="liquid-subline-toggle-icon" />
              </button>
            </div>

            <!-- Раскрытый список вариантов -->
            <Transition name="subline-expand">
              <div
                v-if="isVariantProductExpanded(product.id)"
                class="liquid-variants-list"
              >
                <div
                  v-for="variant in product.variants"
                  :key="variant.id ?? variant.name"
                  class="liquid-variant-row"
                >
                  <!-- Круглое превью варианта -->
                  <div class="liquid-variant-preview">
                    <img
                      v-if="getVariantImage(variant)"
                      :src="getVariantImage(variant)!"
                      :alt="variant.name"
                      class="liquid-variant-preview-img"
                    />
                    <div
                      v-else
                      class="liquid-variant-preview-placeholder"
                    ></div>
                  </div>
                  <div class="liquid-variant-info">
                    <span class="liquid-variant-title">{{ variant.name }}</span>
                    <button
                      v-if="getVariantImage(variant)"
                      type="button"
                      class="liquid-variant-color-link"
                      @click.stop="openColorPreview(variant)"
                    >
                      Как выглядит цвет
                    </button>
                  </div>
                  <div class="liquid-variant-actions">
                    <template
                      v-if="variant.id && getVariantQuantity(variant.id) > 0"
                    >
                      <button
                        type="button"
                        class="liquid-qty-btn liquid-qty-btn-minus"
                        :class="{
                          'is-first':
                            variant.id && getVariantQuantity(variant.id) === 1,
                        }"
                        @click.stop="decrementVariantQuantity(product, variant)"
                        aria-label="Убавить количество"
                      >
                        <MinusIcon class="liquid-qty-icon" />
                      </button>
                      <span class="liquid-qty-field">{{
                        variant.id ? getVariantQuantity(variant.id) : 0
                      }}</span>
                      <button
                        type="button"
                        class="liquid-qty-btn liquid-qty-btn-plus"
                        :class="{
                          'is-disabled': isVariantAtStockLimit(variant),
                        }"
                        @click.stop="handleVariantIncrement(product, variant)"
                        aria-label="Добавить еще"
                      >
                        <PlusIcon class="liquid-qty-icon" />
                      </button>
                    </template>
                    <button
                      v-else
                      type="button"
                      class="liquid-qty-btn liquid-qty-btn-add"
                      :class="{ 'is-disabled': !canAddVariant(variant) }"
                      @click.stop="handleVariantAdd(product, variant)"
                      aria-label="Добавить в корзину"
                    >
                      <PlusIcon class="liquid-qty-icon" />
                    </button>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>

        <!-- Обычные товары без вариантов -->
        <ul v-if="productsWithoutVariants.length" class="liquid-flavor-list">
          <li
            v-for="product in productsWithoutVariants"
            :key="product.id"
            class="liquid-flavor-row"
          >
            <div class="liquid-flavor-info">
              <span class="liquid-flavor-title">{{ product.title }}</span>
            </div>
            <div class="liquid-flavor-actions">
              <template v-if="getQuantity(product.id) > 0">
                <button
                  type="button"
                  class="liquid-qty-btn liquid-qty-btn-minus"
                  :class="{ 'is-first': getQuantity(product.id) === 1 }"
                  @click.stop="decrementQuantity(product)"
                  aria-label="Убавить количество"
                >
                  <MinusIcon class="liquid-qty-icon" />
                </button>
                <span class="liquid-qty-field">{{
                  getQuantity(product.id)
                }}</span>
                <button
                  type="button"
                  class="liquid-qty-btn liquid-qty-btn-plus"
                  :class="{ 'is-disabled': isAtStockLimit(product) }"
                  @click.stop="handleIncrement(product)"
                  aria-label="Добавить еще"
                >
                  <PlusIcon class="liquid-qty-icon" />
                </button>
              </template>
              <button
                v-else
                type="button"
                class="liquid-qty-btn liquid-qty-btn-add"
                :class="{ 'is-disabled': !canAdd(product) }"
                @click.stop="handleAdd(product)"
                aria-label="Добавить в корзину"
              >
                <PlusIcon class="liquid-qty-icon" />
              </button>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <!-- Модальное окно для просмотра цвета -->
    <ColorPreviewModal
      :is-open="colorPreviewOpen"
      :image-url="colorPreviewImage"
      :title="colorPreviewTitle"
      @close="closeColorPreview"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue";
import {
  ChevronDownIcon,
  PlusIcon,
  MinusIcon,
} from "@heroicons/vue/24/outline";
import { useCartStore } from "@/stores/cart";
import type { Product } from "@/stores/catalog";
import ColorPreviewModal from "@/components/product/ColorPreviewModal.vue";

interface SubgroupInfo {
  id: string;
  name: string;
  slug?: string;
  productCount?: number;
}

const props = defineProps<{
  groupId: string;
  title: string;
  products: Product[];
  expanded: boolean;
  coverImage?: string | null;
  fallbackImage?: string;
  subgroups?: SubgroupInfo[];
  badge?: string;
  badgeColor?: string;
}>();

const emit = defineEmits<{
  (e: "toggle", groupId: string): void;
  (e: "showToast", message: string, type: "error" | "success" | "info"): void;
}>();

const cartStore = useCartStore();
const bodyWrapper = ref<HTMLElement | null>(null);
const contentHeight = ref(0);
const expandedVariantProducts = ref<Record<string, boolean>>({});

// Разделение товаров на те, у которых есть варианты, и без них
const productsWithVariants = computed(() =>
  props.products.filter(
    (p) => p.hasVariants && p.variants && p.variants.length > 0,
  ),
);

const productsWithoutVariants = computed(() =>
  props.products.filter((p) => !p.hasVariants),
);

const productNames = computed(() =>
  props.products.map((p) => p.title.toUpperCase()),
);
const badgeLabel = computed(() => (props.badge || "").trim() || null);
const badgeStyle = computed(() =>
  props.badgeColor ? { backgroundColor: props.badgeColor } : undefined,
);

const countLabel = computed(() => {
  // Если есть подгруппы, показываем их названия
  if (props.subgroups && props.subgroups.length > 0) {
    const maxVisible = 3;
    const subgroupNames = props.subgroups.map((sg) => sg.name.toUpperCase());

    if (subgroupNames.length <= maxVisible) {
      return subgroupNames.join("\n");
    } else {
      const visible = subgroupNames.slice(0, maxVisible);
      const remaining = subgroupNames.length - maxVisible;
      return visible.join("\n") + `\nи еще ${remaining} других...`;
    }
  }

  // Иначе ничего не показываем
  return "";
});

const coverUrl = computed(() => props.coverImage || props.fallbackImage);

// Общее количество товаров для бейджа "Ещё N"
const totalProductCount = computed(() => {
  let count = props.products.length;
  // Добавляем товары из подгрупп
  if (props.subgroups && props.subgroups.length > 0) {
    props.subgroups.forEach((subgroup) => {
      count += subgroup.productCount ?? 0;
    });
  }
  return count;
});

const summaryPreview = computed(() => {
  // summaryPreview больше не используется, всегда показываем countLabel
  return [];
});

const minPriceLabel = computed(() => {
  const prices: number[] = [];

  props.products.forEach((product) => {
    // Для товаров с вариантами берем цены из вариантов
    if (
      product.hasVariants &&
      product.variants &&
      product.variants.length > 0
    ) {
      product.variants.forEach((variant) => {
        if (
          variant.priceRub &&
          typeof variant.priceRub === "number" &&
          !Number.isNaN(variant.priceRub)
        ) {
          prices.push(variant.priceRub);
        }
      });
    } else {
      // Для обычных товаров берем основную цену
      if (
        typeof product.priceRub === "number" &&
        !Number.isNaN(product.priceRub)
      ) {
        prices.push(product.priceRub);
      }
    }
  });

  if (!prices.length) return null;
  const minPrice = Math.min(...prices);

  // Проверяем, есть ли товары с вариантами
  const hasVariants = props.products.some(
    (p) => p.hasVariants && p.variants && p.variants.length > 0,
  );

  return hasVariants ? `от ${formatPrice(minPrice)}` : formatPrice(minPrice);
});

const wrapperStyle = computed(() => {
  if (!props.expanded) {
    return { maxHeight: "0px" };
  }
  // Всегда используем конкретное значение высоты для плавной анимации
  const height = contentHeight.value > 0 ? contentHeight.value : 5000;
  return { maxHeight: `${height}px` };
});

// Функция для расчета высоты
const calculateHeight = async () => {
  await nextTick();
  if (bodyWrapper.value) {
    // Используем scrollHeight самого wrapper для учета всех padding и margin
    contentHeight.value = bodyWrapper.value.scrollHeight;
  }
};

// Пересчитываем высоту при раскрытии
watch(
  () => props.expanded,
  async (newVal) => {
    if (newVal) {
      // Сначала рассчитываем высоту для плавной анимации
      await nextTick();
      await calculateHeight();
      // Дополнительные пересчёты для плавности
      setTimeout(() => calculateHeight(), 50);
      setTimeout(() => calculateHeight(), 150);
      setTimeout(() => calculateHeight(), 350);
    } else {
      // При сворачивании сбрасываем высоту
      contentHeight.value = 0;
    }
  },
);

// Пересчитываем высоту при изменении количества товаров в корзине
watch(
  () => cartStore.items.length,
  async () => {
    if (props.expanded) {
      await calculateHeight();
    }
  },
);

// Пересчитываем высоту при изменении состояния развёрнутости товаров
watch(
  expandedVariantProducts,
  async () => {
    if (props.expanded) {
      await calculateHeight();
      setTimeout(() => calculateHeight(), 50);
      setTimeout(() => calculateHeight(), 150);
      setTimeout(() => calculateHeight(), 350);
    }
  },
  { deep: true },
);

function toggle() {
  emit("toggle", props.groupId);
}

function formatPrice(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("ru-RU");
}

function getQuantity(productId: string): number {
  const item = cartStore.items.find((item) => item.productId === productId);
  return item ? item.quantity : 0;
}

function canAdd(product: Product) {
  if (product.isAvailable === false) {
    return false;
  }
  if (typeof product.stock === "number") {
    const stock = Math.max(product.stock, 0);
    if (stock === 0) {
      return false;
    }
    return getQuantity(product.id) < stock;
  }
  return true;
}

function isAtStockLimit(product: Product) {
  if (product.isAvailable === false) {
    return true;
  }
  if (typeof product.stock === "number") {
    const stock = Math.max(product.stock, 0);
    if (stock === 0) {
      return true;
    }
    return getQuantity(product.id) >= stock;
  }
  return false;
}

function handleAdd(product: Product) {
  if (!canAdd(product)) {
    if (
      product.isAvailable === false ||
      (typeof product.stock === "number" && product.stock <= 0)
    ) {
      emit("showToast", "Товара нет в наличии", "error");
    } else {
      emit("showToast", "В наличии больше нет", "error");
    }
    return;
  }
  addToCart(product);
}

function addToCart(product: Product) {
  cartStore.addItem(product, 1);
}

function handleIncrement(product: Product) {
  if (!canAdd(product)) {
    if (
      product.isAvailable === false ||
      (typeof product.stock === "number" && product.stock <= 0)
    ) {
      emit("showToast", "Товара нет в наличии", "error");
    } else {
      emit("showToast", "В наличии больше нет", "error");
    }
    return;
  }
  incrementQuantity(product);
}

function incrementQuantity(product: Product) {
  const currentQty = getQuantity(product.id);
  if (currentQty > 0) {
    cartStore.updateQuantity(product.id, currentQty + 1);
  } else {
    cartStore.addItem(product, 1);
  }
}

function decrementQuantity(product: Product) {
  const currentQty = getQuantity(product.id);
  if (currentQty > 1) {
    cartStore.updateQuantity(product.id, currentQty - 1);
  } else if (currentQty === 1) {
    cartStore.removeItem(product.id);
  }
}

// Функции для работы с товарами с вариантами
function isVariantProductExpanded(productId: string): boolean {
  return expandedVariantProducts.value[productId] ?? false;
}

function toggleVariantProductExpansion(productId: string) {
  expandedVariantProducts.value = {
    ...expandedVariantProducts.value,
    [productId]: !isVariantProductExpanded(productId),
  };
}

// Функции для работы с изображениями товаров
function getProductImage(product: Product): string | null {
  // Для товаров с вариантами берём изображение первого варианта
  if (
    product.hasVariants &&
    product.variants?.length &&
    product.variants[0].images?.length
  ) {
    return product.variants[0].images[0];
  }
  // Сначала проверяем загруженные изображения
  if (product.images?.[0]) {
    return product.images[0];
  }
  // Если нет изображений, ищем ссылку на картинку в links
  if (product.links?.length) {
    for (const link of product.links) {
      const url = link.url?.toLowerCase() || "";
      if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i)) {
        return link.url;
      }
    }
    return product.links[0]?.url || null;
  }
  return null;
}

// Функции для работы с вариантами
function getVariantQuantity(variantId: string): number {
  const item = cartStore.items.find((item) => item.variantId === variantId);
  return item ? item.quantity : 0;
}

function canAddVariant(variant: {
  id?: string;
  stock?: number | null;
  isAvailable?: boolean;
}) {
  if (!variant.id) return false;
  if (variant.isAvailable === false) {
    return false;
  }
  if (typeof variant.stock === "number") {
    const stock = Math.max(variant.stock, 0);
    if (stock === 0) {
      return false;
    }
    return getVariantQuantity(variant.id) < stock;
  }
  return true;
}

function isVariantAtStockLimit(variant: {
  id?: string;
  stock?: number | null;
  isAvailable?: boolean;
}) {
  if (!variant.id) return true;
  if (variant.isAvailable === false) {
    return true;
  }
  if (typeof variant.stock === "number") {
    const stock = Math.max(variant.stock, 0);
    if (stock === 0) {
      return true;
    }
    return getVariantQuantity(variant.id) >= stock;
  }
  return false;
}

function handleVariantAdd(
  product: Product,
  variant: { id?: string; stock?: number | null; isAvailable?: boolean },
) {
  if (!variant.id) return;
  if (!canAddVariant(variant)) {
    if (
      variant.isAvailable === false ||
      (typeof variant.stock === "number" && variant.stock <= 0)
    ) {
      emit("showToast", "Товара нет в наличии", "error");
    } else {
      emit("showToast", "В наличии больше нет", "error");
    }
    return;
  }
  cartStore.addItem(product, 1, variant.id);
}

function handleVariantIncrement(
  product: Product,
  variant: { id?: string; stock?: number | null; isAvailable?: boolean },
) {
  if (!variant.id) return;
  if (!canAddVariant(variant)) {
    if (
      variant.isAvailable === false ||
      (typeof variant.stock === "number" && variant.stock <= 0)
    ) {
      emit("showToast", "Товара нет в наличии", "error");
    } else {
      emit("showToast", "В наличии больше нет", "error");
    }
    return;
  }
  const currentQty = getVariantQuantity(variant.id);
  if (currentQty > 0) {
    cartStore.updateQuantity(product.id, currentQty + 1, variant.id);
  } else {
    cartStore.addItem(product, 1, variant.id);
  }
}

function decrementVariantQuantity(product: Product, variant: { id?: string }) {
  if (!variant.id) return;
  const currentQty = getVariantQuantity(variant.id);
  if (currentQty > 1) {
    cartStore.updateQuantity(product.id, currentQty - 1, variant.id);
  } else if (currentQty === 1) {
    cartStore.removeItem(product.id, variant.id);
  }
}

// Функция для получения изображения варианта
function getVariantImage(variant: { images?: string[] }): string | null {
  if (variant.images?.length) {
    return variant.images[0];
  }
  return null;
}

// Состояние для модального окна просмотра цвета
const colorPreviewOpen = ref(false);
const colorPreviewImage = ref<string | null>(null);
const colorPreviewTitle = ref("");

function openColorPreview(variant: { name: string; images?: string[] }) {
  const image = getVariantImage(variant);
  if (image) {
    colorPreviewImage.value = image;
    colorPreviewTitle.value = variant.name;
    colorPreviewOpen.value = true;
  }
}

function closeColorPreview() {
  colorPreviewOpen.value = false;
}
</script>

<style scoped>
/* Figma Redesign - Карточка линейки жидкостей */
.liquid-line-card {
  box-sizing: border-box;
  background: #ffffff;
  border-radius: 20px;
  padding: 16px;
  margin-bottom: 0;
}

.liquid-line-card:last-of-type {
  margin-bottom: 0;
}

.liquid-line-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
}

.liquid-line-main {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  cursor: pointer;
  outline: none;
  min-width: 0;
}

.liquid-line-image-wrapper {
  flex-shrink: 0;
}

.liquid-line-image {
  width: 88px;
  height: 104px;
  background: #ffffff;
  border: 1px solid #e6e9ed;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-sizing: border-box;
}

.liquid-line-image img {
  max-width: 65px;
  max-height: 66px;
  object-fit: contain;
}

.liquid-line-image-placeholder {
  background: #fafafa;
}

.liquid-line-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.liquid-line-title {
  margin: 0;
  font-family: "Montserrat", sans-serif;
  font-style: normal;
  font-weight: 700;
  font-size: 16px;
  line-height: 20px;
  color: #191919;
}

.liquid-line-count-badge {
  display: inline-flex;
  align-self: flex-start;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  padding: 10px 8px;
  gap: 10px;
  background: #f5f7fa;
  border-radius: 24px;
}

.liquid-line-count-badge span {
  font-family:
    "SF Pro Display",
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  font-style: normal;
  font-weight: 400;
  font-size: 12px;
  line-height: 14px;
  color: #aab2bd;
}

.liquid-line-side {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-shrink: 0;
}

.liquid-line-toggle {
  width: 40px;
  height: 40px;
  border-radius: 512px;
  border: none;
  background: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.liquid-line-toggle:hover {
  background: #e6e9ed;
}

.liquid-line-toggle.expanded .liquid-line-toggle-icon {
  transform: rotate(-90deg) rotate(90deg);
}

.liquid-line-toggle-icon {
  width: 12px;
  height: 12px;
  color: #191919;
  transition: transform 0.3s ease;
  transform: rotate(-90deg);
}

/* ========== Подлинейки (sublines) ========== */
.liquid-sublines {
  margin-top: 0;
}

.liquid-subline-card {
  position: relative;
}

.liquid-subline-divider {
  width: 100%;
  height: 1px;
  background: #e6e9ed;
  margin: 16px 0;
}

.liquid-subline-header {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.liquid-subline-image-wrapper {
  flex-shrink: 0;
}

.liquid-subline-image {
  width: 88px;
  height: 104px;
  background: #ffffff;
  border: 1px solid #e6e9ed;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-sizing: border-box;
}

.liquid-subline-image img {
  max-width: 65px;
  max-height: 66px;
  object-fit: contain;
}

.liquid-subline-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.liquid-subline-title {
  margin: 0;
  font-family: "Montserrat", sans-serif;
  font-style: normal;
  font-weight: 700;
  font-size: 16px;
  line-height: 20px;
  color: #191919;
}

.liquid-subline-description {
  margin: 0;
  font-family:
    "SF Pro Display",
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  font-style: normal;
  font-weight: 400;
  font-size: 14px;
  line-height: 17px;
  color: #aab2bd;
}

.liquid-subline-price {
  margin: 0;
  font-family: "Montserrat", sans-serif;
  font-style: normal;
  font-weight: 700;
  font-size: 20px;
  line-height: 24px;
  color: #191919;
}

.liquid-subline-toggle {
  width: 40px;
  height: 40px;
  border-radius: 512px;
  border: none;
  background: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.liquid-subline-toggle:hover {
  background: #e6e9ed;
}

.liquid-subline-toggle.expanded .liquid-subline-toggle-icon {
  transform: rotate(180deg);
}

.liquid-subline-toggle-icon {
  width: 12px;
  height: 12px;
  color: #191919;
  transition: transform 0.3s ease;
  transform: rotate(90deg);
}

/* ========== Список вариантов (variants) ========== */
.liquid-variants-list {
  margin-top: 16px;
}

.liquid-variant-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid #e6e9ed;
}

.liquid-variant-row:first-child {
  padding-top: 0;
}

.liquid-variant-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

/* Превью варианта (круглое изображение) */
.liquid-variant-preview {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid #e6e9ed;
}

.liquid-variant-preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.liquid-variant-preview-placeholder {
  width: 100%;
  height: 100%;
  background: #f5f7fa;
}

/* Инфо варианта (название + ссылка) */
.liquid-variant-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.liquid-variant-title {
  font-family: "Montserrat", sans-serif;
  font-style: normal;
  font-weight: 700;
  font-size: 16px;
  line-height: 20px;
  color: #191919;
}

.liquid-variant-color-link {
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  font-family:
    "SF Pro Display",
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  font-style: normal;
  font-weight: 400;
  font-size: 12px;
  line-height: 14px;
  color: #0273f5;
  cursor: pointer;
  text-align: left;
  text-decoration: none;
}

.liquid-variant-color-link:hover {
  text-decoration: underline;
}

.liquid-variant-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* ========== Новые кнопки +/- согласно Figma ========== */
.liquid-qty-btn {
  width: 40px;
  height: 40px;
  border-radius: 512px;
  border: none;
  background: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.liquid-qty-btn:hover:not(:disabled):not(.is-disabled) {
  background: #e6e9ed;
}

.liquid-qty-btn.is-disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.liquid-qty-btn.is-first {
  opacity: 0.4;
}

.liquid-qty-btn-minus {
  background: #f5f7fa;
}

.liquid-qty-btn-plus,
.liquid-qty-btn-add {
  background: #f5f7fa;
}

.liquid-qty-icon {
  width: 18px;
  height: 18px;
  color: #191919;
  stroke-width: 2;
}

.liquid-qty-field {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;
  background: #ffffff;
  border: 1px solid #e6e9ed;
  border-radius: 12px;
  font-family:
    "SF Pro Display",
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  font-style: normal;
  font-weight: 500;
  font-size: 16px;
  line-height: 19px;
  color: #191919;
}

/* ========== Анимация раскрытия подлинейки ========== */
.subline-expand-enter-active {
  transition:
    max-height 0.4s ease,
    opacity 0.3s ease;
  overflow: hidden;
}

.subline-expand-leave-active {
  transition:
    max-height 0.3s ease,
    opacity 0.2s ease;
  overflow: hidden;
}

.subline-expand-enter-from,
.subline-expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.subline-expand-enter-to,
.subline-expand-leave-from {
  max-height: 1000px;
  opacity: 1;
}

/* ========== Список вкусов (обычные товары) ========== */
.liquid-flavor-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.liquid-flavor-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid #e6e9ed;
}

.liquid-flavor-row:first-child {
  border-top: 1px solid #e6e9ed;
  margin-top: 16px;
}

.liquid-flavor-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.liquid-flavor-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}

.liquid-flavor-title {
  font-family: "Montserrat", sans-serif;
  font-style: normal;
  font-weight: 700;
  font-size: 16px;
  line-height: 20px;
  color: #191919;
}

.liquid-flavor-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.liquid-line-body-wrapper {
  overflow: hidden;
  transition: max-height 500ms cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 0;
}

.liquid-line-body {
  margin-top: 0;
  padding: 0;
}

/* Адаптивные стили */

@media (max-width: 1024px) {
  .liquid-line-card {
    padding: 11px;
  }

  .liquid-line-image {
    width: 60px;
    height: 60px;
    border-radius: 12px;
  }

  .liquid-subline-image {
    width: 80px;
    height: 96px;
  }

  .liquid-line-title {
    font-size: 14px;
  }

  .liquid-subline-title {
    font-size: 15px;
  }

  .liquid-line-toggle {
    width: 32px;
    height: 32px;
  }

  .liquid-subline-toggle {
    width: 36px;
    height: 36px;
  }

  .liquid-line-toggle-icon {
    width: 13px;
    height: 13px;
  }

  .liquid-subline-toggle-icon {
    width: 14px;
    height: 14px;
  }

  .liquid-subline-price {
    font-size: 18px;
  }

  .liquid-qty-btn {
    width: 36px;
    height: 36px;
  }

  .liquid-qty-field {
    width: 36px;
    height: 36px;
    font-size: 15px;
  }
}

@media (max-width: 768px) {
  .liquid-line-card {
    padding: 10px;
    border-radius: 14px;
    margin-bottom: 0;
  }

  .liquid-line-header {
    gap: 8px;
  }

  .liquid-subline-header {
    gap: 10px;
  }

  .liquid-line-main {
    gap: 7px;
  }

  .liquid-line-image {
    width: 72px;
    height: 88px;
    border-radius: 12px;
  }

  .liquid-subline-image {
    width: 72px;
    height: 88px;
    border-radius: 14px;
  }

  .liquid-line-info {
    gap: 4px;
  }

  .liquid-line-title {
    font-size: 13px;
    line-height: 16px;
  }

  .liquid-subline-title {
    font-size: 14px;
    line-height: 18px;
  }

  .liquid-line-count-badge {
    padding: 3px 5px;
  }

  .liquid-line-count-badge span {
    font-size: 8px;
    line-height: 10px;
  }

  .liquid-line-toggle {
    width: 30px;
    height: 30px;
  }

  .liquid-subline-toggle {
    width: 34px;
    height: 34px;
  }

  .liquid-line-toggle-icon {
    width: 11px;
    height: 11px;
  }

  .liquid-subline-toggle-icon {
    width: 13px;
    height: 13px;
  }

  .liquid-subline-description {
    font-size: 13px;
  }

  .liquid-subline-price {
    font-size: 16px;
    line-height: 20px;
  }

  .liquid-flavor-row,
  .liquid-variant-row {
    padding: 12px 0;
  }

  .liquid-flavor-title,
  .liquid-variant-title {
    font-size: 14px;
  }

  .liquid-qty-btn {
    width: 34px;
    height: 34px;
  }

  .liquid-qty-field {
    width: 34px;
    height: 34px;
    font-size: 14px;
    border-radius: 10px;
  }

  .liquid-qty-icon {
    width: 16px;
    height: 16px;
  }
}

@media (max-width: 480px) {
  .liquid-line-card {
    padding: 9px;
    border-radius: 14px;
  }

  .liquid-line-header {
    gap: 7px;
  }

  .liquid-subline-header {
    gap: 8px;
  }

  .liquid-line-main {
    gap: 8px;
  }

  .liquid-line-image {
    width: 64px;
    height: 78px;
    border-radius: 10px;
  }

  .liquid-subline-image {
    width: 64px;
    height: 78px;
    border-radius: 12px;
  }

  .liquid-line-info {
    gap: 5px;
  }

  .liquid-line-title {
    font-size: 12px;
    line-height: 15px;
  }

  .liquid-subline-title {
    font-size: 13px;
    line-height: 16px;
  }

  .liquid-line-count-badge {
    padding: 2px 4px;
    border-radius: 18px;
  }

  .liquid-line-count-badge span {
    font-size: 10px;
    line-height: 12px;
  }

  .liquid-line-toggle {
    width: 28px;
    height: 28px;
  }

  .liquid-subline-toggle {
    width: 32px;
    height: 32px;
  }

  .liquid-line-toggle-icon {
    width: 10px;
    height: 10px;
  }

  .liquid-subline-toggle-icon {
    width: 12px;
    height: 12px;
  }

  .liquid-subline-divider {
    margin: 12px 0;
  }

  .liquid-subline-description {
    font-size: 12px;
  }

  .liquid-subline-price {
    font-size: 14px;
    line-height: 18px;
  }

  .liquid-flavor-row,
  .liquid-variant-row {
    padding: 10px 0;
  }

  .liquid-flavor-title,
  .liquid-variant-title {
    font-size: 13px;
    line-height: 16px;
  }

  .liquid-qty-btn {
    width: 32px;
    height: 32px;
  }

  .liquid-qty-field {
    width: 32px;
    height: 32px;
    font-size: 13px;
    border-radius: 8px;
  }

  .liquid-qty-icon {
    width: 14px;
    height: 14px;
  }

  .liquid-variant-actions,
  .liquid-flavor-actions {
    gap: 6px;
  }
}

@media (max-width: 360px) {
  .liquid-line-card {
    padding: 8px;
    border-radius: 12px;
  }

  .liquid-line-header {
    gap: 6px;
  }

  .liquid-subline-header {
    gap: 6px;
  }

  .liquid-line-main {
    gap: 6px;
  }

  .liquid-line-image {
    width: 56px;
    height: 68px;
    border-radius: 8px;
  }

  .liquid-subline-image {
    width: 56px;
    height: 68px;
    border-radius: 10px;
  }

  .liquid-line-info {
    gap: 4px;
  }

  .liquid-line-title {
    font-size: 11px;
    line-height: 14px;
  }

  .liquid-subline-title {
    font-size: 12px;
    line-height: 15px;
  }

  .liquid-line-count-badge {
    padding: 2px 4px;
    border-radius: 14px;
  }

  .liquid-line-count-badge span {
    font-size: 9px;
    line-height: 11px;
  }

  .liquid-line-toggle {
    width: 26px;
    height: 26px;
  }

  .liquid-subline-toggle {
    width: 28px;
    height: 28px;
  }

  .liquid-line-toggle-icon {
    width: 9px;
    height: 9px;
  }

  .liquid-subline-toggle-icon {
    width: 10px;
    height: 10px;
  }

  .liquid-subline-divider {
    margin: 10px 0;
  }

  .liquid-subline-description {
    font-size: 11px;
  }

  .liquid-subline-price {
    font-size: 13px;
    line-height: 16px;
  }

  .liquid-flavor-row,
  .liquid-variant-row {
    padding: 8px 0;
  }

  .liquid-flavor-title,
  .liquid-variant-title {
    font-size: 12px;
    line-height: 15px;
  }

  .liquid-qty-btn {
    width: 28px;
    height: 28px;
  }

  .liquid-qty-field {
    width: 28px;
    height: 28px;
    font-size: 12px;
    border-radius: 6px;
  }

  .liquid-qty-icon {
    width: 12px;
    height: 12px;
  }

  .liquid-variant-actions,
  .liquid-flavor-actions {
    gap: 4px;
  }
}
</style>
