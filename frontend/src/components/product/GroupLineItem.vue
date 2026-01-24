<template>
  <div class="group-line-card" :class="{ expanded: isExpanded }">
    <div class="group-line-header" @click="toggle">
      <div
        class="group-line-main"
        role="button"
        tabindex="0"
        @keyup.enter.prevent="toggle"
        @keyup.space.prevent="toggle"
      >
        <div class="group-line-image-wrapper">
          <div v-if="node.coverImage" class="group-line-image">
            <img :src="node.coverImage" :alt="node.name" />
          </div>
          <div v-else class="group-line-image group-line-image-placeholder">
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
        <div class="group-line-info">
          <h3 class="group-line-title">{{ node.name }}</h3>
          <div
            v-if="!isExpanded && totalProductCount > 0"
            class="group-line-count-badge"
          >
            <span>Ещё {{ totalProductCount }}</span>
          </div>
        </div>
      </div>
      <div class="group-line-side">
        <button
          type="button"
          class="group-line-toggle"
          :class="{ expanded: isExpanded }"
          @click.stop="toggle"
          aria-label="Переключить линейку"
        >
          <ChevronDownIcon class="group-line-toggle-icon" />
        </button>
      </div>
    </div>

    <div
      ref="bodyWrapper"
      class="group-line-body-wrapper"
      :style="wrapperStyle"
    >
      <div class="group-line-body">
        <!-- Товары с вариантами (устройства) -->
        <div v-if="productsWithVariants.length" class="group-sublines">
          <div
            v-for="product in productsWithVariants"
            :key="product.id"
            class="group-subline-card"
          >
            <!-- Разделитель сверху -->
            <div class="group-subline-divider"></div>

            <!-- Заголовок товара -->
            <div
              class="group-subline-header"
              @click="toggleProductExpansion(product.id)"
            >
              <div class="group-subline-image-wrapper">
                <div class="group-subline-image">
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
              <div class="group-subline-info">
                <h4 class="group-subline-title">{{ product.title }}</h4>
                <p v-if="product.variant" class="group-subline-description">
                  {{ product.variant }}
                </p>
                <p class="group-subline-price">
                  {{ formatPrice(product.priceRub) }} BYN
                </p>
              </div>
              <button
                type="button"
                class="group-subline-toggle"
                :class="{ expanded: isProductExpanded(product.id) }"
                @click.stop="toggleProductExpansion(product.id)"
                aria-label="Переключить варианты"
              >
                <ChevronDownIcon class="group-subline-toggle-icon" />
              </button>
            </div>

            <!-- Раскрытый список вариантов -->
            <Transition name="subline-expand">
              <div
                v-if="isProductExpanded(product.id)"
                class="group-variants-list"
              >
                <div
                  v-for="variant in product.variants"
                  :key="variant.id ?? variant.name"
                  class="group-variant-row"
                >
                  <!-- Круглое превью цвета/изображения -->
                  <div class="group-variant-color-wrapper">
                    <div
                      class="group-variant-color"
                      :style="getVariantColorStyle(variant)"
                    >
                      <img
                        v-if="variant.colorImage || variant.images?.[0]"
                        :src="variant.colorImage || variant.images?.[0]"
                        :alt="variant.name"
                      />
                    </div>
                  </div>
                  <div class="group-variant-info">
                    <span class="group-variant-title">{{ variant.name }}</span>
                    <button
                      v-if="variant.colorImage || variant.images?.[0]"
                      type="button"
                      class="group-variant-color-link"
                      @click.stop="showColorPreview(variant)"
                    >
                      Как выглядит цвет
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <circle cx="6" cy="6" r="5.5" stroke="currentColor" />
                        <text
                          x="6"
                          y="9"
                          text-anchor="middle"
                          font-size="8"
                          fill="currentColor"
                        >
                          ?
                        </text>
                      </svg>
                    </button>
                  </div>
                  <div class="group-variant-actions">
                    <template
                      v-if="variant.id && getVariantQuantity(variant.id) > 0"
                    >
                      <button
                        type="button"
                        class="group-qty-btn group-qty-btn-minus"
                        :class="{
                          'is-first':
                            variant.id && getVariantQuantity(variant.id) === 1,
                        }"
                        @click.stop="decrementVariantQuantity(product, variant)"
                        aria-label="Убавить количество"
                      >
                        <MinusIcon class="group-qty-icon" />
                      </button>
                      <span class="group-qty-field">{{
                        variant.id ? getVariantQuantity(variant.id) : 0
                      }}</span>
                      <button
                        type="button"
                        class="group-qty-btn group-qty-btn-plus"
                        :class="{
                          'is-disabled': isVariantAtStockLimit(variant),
                        }"
                        @click.stop="handleVariantIncrement(product, variant)"
                        aria-label="Добавить еще"
                      >
                        <PlusIcon class="group-qty-icon" />
                      </button>
                    </template>
                    <button
                      v-else
                      type="button"
                      class="group-qty-btn group-qty-btn-add"
                      :class="{ 'is-disabled': !canAddVariant(variant) }"
                      @click.stop="handleVariantAdd(product, variant)"
                      aria-label="Добавить в корзину"
                    >
                      <PlusIcon class="group-qty-icon" />
                    </button>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>

        <!-- Обычные товары без вариантов -->
        <ul v-if="productsWithoutVariants.length" class="group-product-list">
          <li
            v-for="product in productsWithoutVariants"
            :key="product.id"
            class="group-product-row"
          >
            <div class="group-product-info">
              <span class="group-product-title">{{ product.title }}</span>
            </div>
            <div class="group-product-actions">
              <template v-if="getQuantity(product.id) > 0">
                <button
                  type="button"
                  class="group-qty-btn group-qty-btn-minus"
                  :class="{ 'is-first': getQuantity(product.id) === 1 }"
                  @click.stop="decrementQuantity(product)"
                  aria-label="Убавить количество"
                >
                  <MinusIcon class="group-qty-icon" />
                </button>
                <span class="group-qty-field">{{
                  getQuantity(product.id)
                }}</span>
                <button
                  type="button"
                  class="group-qty-btn group-qty-btn-plus"
                  :class="{ 'is-disabled': isAtStockLimit(product) }"
                  @click.stop="handleIncrement(product)"
                  aria-label="Добавить еще"
                >
                  <PlusIcon class="group-qty-icon" />
                </button>
              </template>
              <button
                v-else
                type="button"
                class="group-qty-btn group-qty-btn-add"
                :class="{ 'is-disabled': !canAdd(product) }"
                @click.stop="handleAdd(product)"
                aria-label="Добавить в корзину"
              >
                <PlusIcon class="group-qty-icon" />
              </button>
            </div>
          </li>
        </ul>

        <!-- Подлинейки (рекурсивно) -->
        <div v-if="node.children.length" class="group-line-children">
          <GroupLineItem
            v-for="child in node.children"
            :key="child.id"
            :node="child"
            :expanded-groups="expandedGroups"
            @toggle="$emit('toggle', $event)"
            @productClick="$emit('productClick', $event)"
            @showToast="
              (msg: string, type: 'error' | 'success' | 'info') =>
                $emit('showToast', msg, type)
            "
          />
        </div>
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
import type { Product, ProductVariant } from "@/stores/catalog";
import ColorPreviewModal from "@/components/product/ColorPreviewModal.vue";

interface GroupNode {
  id: string;
  name: string;
  slug: string;
  order: number;
  coverImage?: string | null;
  productCount: number;
  totalProductCount?: number;
  depth: number;
  parentId?: string | null;
  children: GroupNode[];
  products: Product[];
}

const props = defineProps<{
  node: GroupNode;
  expandedGroups: Record<string, boolean>;
}>();

const emit = defineEmits<{
  (e: "toggle", groupId: string): void;
  (e: "productClick", product: Product): void;
  (e: "showToast", message: string, type: "error" | "success" | "info"): void;
}>();

const cartStore = useCartStore();
const bodyWrapper = ref<HTMLElement | null>(null);
const contentHeight = ref(0);
const expandedProducts = ref<Record<string, boolean>>({});

// Состояние для модального окна просмотра цвета
const colorPreviewOpen = ref(false);
const colorPreviewImage = ref<string | null>(null);
const colorPreviewTitle = ref("");

const isExpanded = computed(() => props.expandedGroups[props.node.id] ?? false);

// Общее количество товаров
const totalProductCount = computed(() => {
  let count = props.node.products.length;
  if (props.node.children.length > 0) {
    props.node.children.forEach((child) => {
      count += child.productCount ?? 0;
    });
  }
  return count;
});

// Разделяем товары на с вариантами и без
const productsWithVariants = computed(() =>
  props.node.products.filter(
    (p) => p.hasVariants && p.variants && p.variants.length > 0,
  ),
);

const productsWithoutVariants = computed(() =>
  props.node.products.filter((p) => !p.hasVariants),
);

const wrapperStyle = computed(() => {
  if (!isExpanded.value) {
    return { maxHeight: "0px" };
  }
  const height = contentHeight.value > 0 ? contentHeight.value : 5000;
  return { maxHeight: `${height}px` };
});

// Функция для расчета высоты
const calculateHeight = async () => {
  await nextTick();
  if (bodyWrapper.value) {
    contentHeight.value = bodyWrapper.value.scrollHeight;
  }
};

// Пересчитываем высоту при раскрытии
watch(
  () => isExpanded.value,
  async (newVal) => {
    if (newVal) {
      await nextTick();
      await calculateHeight();
      setTimeout(() => calculateHeight(), 50);
      setTimeout(() => calculateHeight(), 150);
      setTimeout(() => calculateHeight(), 350);
    } else {
      contentHeight.value = 0;
    }
  },
);

// Пересчитываем высоту при изменении корзины
watch(
  () => cartStore.items.length,
  async () => {
    if (isExpanded.value) {
      await calculateHeight();
    }
  },
);

// Пересчитываем высоту при изменении состояния раскрытых товаров
watch(
  expandedProducts,
  async () => {
    if (isExpanded.value) {
      await calculateHeight();
      setTimeout(() => calculateHeight(), 50);
      setTimeout(() => calculateHeight(), 150);
      setTimeout(() => calculateHeight(), 350);
    }
  },
  { deep: true },
);

function toggle() {
  emit("toggle", props.node.id);
}

function toggleProductExpansion(productId: string) {
  expandedProducts.value = {
    ...expandedProducts.value,
    [productId]: !expandedProducts.value[productId],
  };
}

function isProductExpanded(productId: string): boolean {
  return expandedProducts.value[productId] ?? false;
}

function formatPrice(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("ru-RU");
}

function getProductImage(product: Product): string | null {
  if (
    product.hasVariants &&
    product.variants?.length &&
    product.variants[0].images?.length
  ) {
    return product.variants[0].images[0];
  }
  if (product.images?.[0]) {
    return product.images[0];
  }
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

function getVariantColorStyle(variant: ProductVariant): Record<string, string> {
  if (variant.colorCode) {
    return { backgroundColor: variant.colorCode };
  }
  return { backgroundColor: "#F5F7FA" };
}

function showColorPreview(variant: ProductVariant) {
  // Получаем изображение варианта
  const imageUrl = variant.colorImage || variant.images?.[0] || null;
  colorPreviewImage.value = imageUrl;
  colorPreviewTitle.value = variant.name;
  colorPreviewOpen.value = true;
}

function closeColorPreview() {
  colorPreviewOpen.value = false;
}

// Функции для работы с обычными товарами
function getQuantity(productId: string): number {
  const item = cartStore.items.find((item) => item.productId === productId);
  return item ? item.quantity : 0;
}

function canAdd(product: Product): boolean {
  if (product.isAvailable === false) return false;
  if (typeof product.stock === "number") {
    const stock = Math.max(product.stock, 0);
    if (stock === 0) return false;
    return getQuantity(product.id) < stock;
  }
  return true;
}

function isAtStockLimit(product: Product): boolean {
  if (product.isAvailable === false) return true;
  if (typeof product.stock === "number") {
    const stock = Math.max(product.stock, 0);
    if (stock === 0) return true;
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
  if (variant.isAvailable === false) return false;
  if (typeof variant.stock === "number") {
    const stock = Math.max(variant.stock, 0);
    if (stock === 0) return false;
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
  if (variant.isAvailable === false) return true;
  if (typeof variant.stock === "number") {
    const stock = Math.max(variant.stock, 0);
    if (stock === 0) return true;
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
</script>

<style scoped>
/* Figma Redesign - Карточка группы/линейки устройств */
.group-line-card {
  background: #ffffff;
  border-radius: 20px;
  padding: 16px;
  margin-bottom: 8px;
}

.group-line-card:last-of-type {
  margin-bottom: 0;
}

.group-line-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
}

.group-line-main {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  cursor: pointer;
  outline: none;
  min-width: 0;
}

.group-line-image-wrapper {
  flex-shrink: 0;
}

.group-line-image {
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

.group-line-image img {
  max-width: 90%;
  max-height: 90%;
  object-fit: contain;
}

.group-line-image-placeholder {
  background: #fafafa;
}

.group-line-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.group-line-title {
  margin: 0;
  font-family: "Montserrat", sans-serif;
  font-style: normal;
  font-weight: 700;
  font-size: 16px;
  line-height: 20px;
  color: #191919;
}

.group-line-count-badge {
  display: inline-flex;
  align-self: flex-start;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  padding: 5px 8px;
  background: #f5f7fa;
  border-radius: 24px;
}

.group-line-count-badge span {
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

.group-line-side {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-shrink: 0;
}

.group-line-toggle {
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

.group-line-toggle:hover {
  background: #e6e9ed;
}

.group-line-toggle.expanded .group-line-toggle-icon {
  transform: rotate(180deg);
}

.group-line-toggle-icon {
  width: 16px;
  height: 16px;
  color: #191919;
  transition: transform 0.3s ease;
}

/* ========== Подлинейки (товары с вариантами) ========== */
.group-sublines {
  margin-top: 0;
}

.group-subline-card {
  position: relative;
}

.group-subline-divider {
  width: 100%;
  height: 1px;
  background: #e6e9ed;
  margin: 16px 0;
}

.group-subline-header {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.group-subline-image-wrapper {
  flex-shrink: 0;
}

.group-subline-image {
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

.group-subline-image img {
  max-width: 90%;
  max-height: 90%;
  object-fit: contain;
}

.group-subline-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.group-subline-title {
  margin: 0;
  font-family: "Montserrat", sans-serif;
  font-style: normal;
  font-weight: 700;
  font-size: 16px;
  line-height: 20px;
  color: #191919;
}

.group-subline-description {
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

.group-subline-price {
  margin: 0;
  font-family: "Montserrat", sans-serif;
  font-style: normal;
  font-weight: 700;
  font-size: 20px;
  line-height: 24px;
  color: #191919;
}

.group-subline-toggle {
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

.group-subline-toggle:hover {
  background: #e6e9ed;
}

.group-subline-toggle.expanded .group-subline-toggle-icon {
  transform: rotate(180deg);
}

.group-subline-toggle-icon {
  width: 16px;
  height: 16px;
  color: #191919;
  transition: transform 0.3s ease;
}

/* ========== Список вариантов (цветов) ========== */
.group-variants-list {
  margin-top: 16px;
}

.group-variant-row {
  display: flex;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid #e6e9ed;
  gap: 12px;
}

.group-variant-row:first-child {
  padding-top: 0;
}

.group-variant-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.group-variant-color-wrapper {
  flex-shrink: 0;
}

.group-variant-color {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.group-variant-color img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.group-variant-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.group-variant-title {
  font-family: "Montserrat", sans-serif;
  font-style: normal;
  font-weight: 700;
  font-size: 16px;
  line-height: 20px;
  color: #191919;
}

.group-variant-color-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: none;
  background: none;
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
  transition: opacity 0.2s ease;
}

.group-variant-color-link:hover {
  opacity: 0.8;
}

.group-variant-color-link svg {
  flex-shrink: 0;
}

.group-variant-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* ========== Кнопки +/- согласно Figma ========== */
.group-qty-btn {
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

.group-qty-btn:hover:not(:disabled):not(.is-disabled) {
  background: #e6e9ed;
}

.group-qty-btn.is-disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.group-qty-btn.is-first {
  opacity: 0.4;
}

.group-qty-btn-minus {
  background: #f5f7fa;
}

.group-qty-btn-plus,
.group-qty-btn-add {
  background: #f5f7fa;
}

.group-qty-icon {
  width: 18px;
  height: 18px;
  color: #191919;
  stroke-width: 2;
}

.group-qty-field {
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

/* ========== Анимация раскрытия ========== */
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

/* ========== Список обычных товаров ========== */
.group-product-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.group-product-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid #e6e9ed;
}

.group-product-row:first-child {
  border-top: 1px solid #e6e9ed;
  margin-top: 16px;
}

.group-product-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.group-product-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}

.group-product-title {
  font-family: "Montserrat", sans-serif;
  font-style: normal;
  font-weight: 700;
  font-size: 16px;
  line-height: 20px;
  color: #191919;
}

.group-product-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.group-line-body-wrapper {
  overflow: hidden;
  transition: max-height 500ms cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 0;
}

.group-line-body {
  margin-top: 0;
  padding: 0;
}

.group-line-children {
  margin-top: 16px;
}

/* Адаптивные стили */

@media (max-width: 1024px) {
  .group-line-card {
    padding: 14px;
  }

  .group-line-image,
  .group-subline-image {
    width: 80px;
    height: 96px;
  }

  .group-line-title,
  .group-subline-title {
    font-size: 15px;
  }

  .group-line-toggle,
  .group-subline-toggle {
    width: 36px;
    height: 36px;
  }

  .group-line-toggle-icon,
  .group-subline-toggle-icon {
    width: 14px;
    height: 14px;
  }

  .group-subline-price {
    font-size: 18px;
  }

  .group-qty-btn {
    width: 36px;
    height: 36px;
  }

  .group-qty-field {
    width: 36px;
    height: 36px;
    font-size: 15px;
  }
}

@media (max-width: 768px) {
  .group-line-card {
    padding: 12px;
    border-radius: 18px;
    margin-bottom: 6px;
  }

  .group-line-header,
  .group-subline-header {
    gap: 10px;
  }

  .group-line-main {
    gap: 10px;
  }

  .group-line-image,
  .group-subline-image {
    width: 72px;
    height: 88px;
    border-radius: 14px;
  }

  .group-line-info {
    gap: 6px;
  }

  .group-line-title,
  .group-subline-title {
    font-size: 14px;
    line-height: 18px;
  }

  .group-line-count-badge {
    padding: 4px 6px;
  }

  .group-line-count-badge span {
    font-size: 11px;
    line-height: 13px;
  }

  .group-line-toggle,
  .group-subline-toggle {
    width: 34px;
    height: 34px;
  }

  .group-line-toggle-icon,
  .group-subline-toggle-icon {
    width: 13px;
    height: 13px;
  }

  .group-subline-description {
    font-size: 13px;
  }

  .group-subline-price {
    font-size: 16px;
    line-height: 20px;
  }

  .group-product-row,
  .group-variant-row {
    padding: 12px 0;
  }

  .group-product-title,
  .group-variant-title {
    font-size: 14px;
  }

  .group-qty-btn {
    width: 34px;
    height: 34px;
  }

  .group-qty-field {
    width: 34px;
    height: 34px;
    font-size: 14px;
    border-radius: 10px;
  }

  .group-qty-icon {
    width: 16px;
    height: 16px;
  }
}

@media (max-width: 480px) {
  .group-line-card {
    padding: 10px;
    border-radius: 16px;
  }

  .group-line-header,
  .group-subline-header {
    gap: 8px;
  }

  .group-line-main {
    gap: 8px;
  }

  .group-line-image,
  .group-subline-image {
    width: 64px;
    height: 78px;
    border-radius: 12px;
  }

  .group-line-info {
    gap: 5px;
  }

  .group-line-title,
  .group-subline-title {
    font-size: 13px;
    line-height: 16px;
  }

  .group-line-count-badge {
    padding: 3px 5px;
    border-radius: 20px;
  }

  .group-line-count-badge span {
    font-size: 10px;
    line-height: 12px;
  }

  .group-line-toggle,
  .group-subline-toggle {
    width: 32px;
    height: 32px;
  }

  .group-line-toggle-icon,
  .group-subline-toggle-icon {
    width: 12px;
    height: 12px;
  }

  .group-subline-divider {
    margin: 12px 0;
  }

  .group-subline-description {
    font-size: 12px;
  }

  .group-subline-price {
    font-size: 14px;
    line-height: 18px;
  }

  .group-product-row,
  .group-variant-row {
    padding: 10px 0;
  }

  .group-product-title,
  .group-variant-title {
    font-size: 13px;
    line-height: 16px;
  }

  .group-qty-btn {
    width: 32px;
    height: 32px;
  }

  .group-qty-field {
    width: 32px;
    height: 32px;
    font-size: 13px;
    border-radius: 8px;
  }

  .group-qty-icon {
    width: 14px;
    height: 14px;
  }

  .group-variant-actions,
  .group-product-actions {
    gap: 6px;
  }

  .group-variant-color {
    width: 28px;
    height: 28px;
  }

  .group-variant-color-link {
    font-size: 11px;
  }
}

@media (max-width: 360px) {
  .group-line-card {
    padding: 8px;
    border-radius: 14px;
  }

  .group-line-header,
  .group-subline-header {
    gap: 6px;
  }

  .group-line-main {
    gap: 6px;
  }

  .group-line-image,
  .group-subline-image {
    width: 56px;
    height: 68px;
    border-radius: 10px;
  }

  .group-line-info {
    gap: 4px;
  }

  .group-line-title,
  .group-subline-title {
    font-size: 12px;
    line-height: 15px;
  }

  .group-line-count-badge {
    padding: 2px 4px;
    border-radius: 16px;
  }

  .group-line-count-badge span {
    font-size: 9px;
    line-height: 11px;
  }

  .group-line-toggle,
  .group-subline-toggle {
    width: 28px;
    height: 28px;
  }

  .group-line-toggle-icon,
  .group-subline-toggle-icon {
    width: 10px;
    height: 10px;
  }

  .group-subline-divider {
    margin: 10px 0;
  }

  .group-subline-description {
    font-size: 11px;
  }

  .group-subline-price {
    font-size: 13px;
    line-height: 16px;
  }

  .group-product-row,
  .group-variant-row {
    padding: 8px 0;
  }

  .group-product-title,
  .group-variant-title {
    font-size: 12px;
    line-height: 15px;
  }

  .group-qty-btn {
    width: 28px;
    height: 28px;
  }

  .group-qty-field {
    width: 28px;
    height: 28px;
    font-size: 12px;
    border-radius: 6px;
  }

  .group-qty-icon {
    width: 12px;
    height: 12px;
  }

  .group-variant-actions,
  .group-product-actions {
    gap: 4px;
  }

  .group-variant-color {
    width: 24px;
    height: 24px;
  }

  .group-variant-color-link {
    font-size: 10px;
  }
}
</style>
