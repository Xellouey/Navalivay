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
          <p v-if="metaText" class="group-line-meta">{{ metaText }}</p>
          <p v-if="firstProductPrice" class="group-line-price">
            {{ formatPrice(firstProductPrice) }} BYN
          </p>
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
        <GroupLineItemContent
          :node="node"
          :category-image="categoryImage"
          @showToast="
            (msg: string, type: 'error' | 'success' | 'info') =>
              emit('showToast', msg, type)
          "
        />

        <!-- Подлинейки (рекурсивно) -->
        <div v-if="node.children.length" class="group-line-children">
          <GroupLineItem
            v-for="child in node.children"
            :key="child.id"
            :node="child"
            :category-image="categoryImage"
            :expanded-groups="expandedGroups"
            @toggle="$emit('toggle', $event)"
            @productClick="$emit('productClick', $event)"
            @heightChanged="onChildHeightChanged"
            @showToast="
              (msg: string, type: 'error' | 'success' | 'info') =>
                $emit('showToast', msg, type)
            "
          />
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, defineAsyncComponent } from "vue";
import { ChevronDownIcon } from "@heroicons/vue/24/outline";
import { useCartStore } from "@/stores/cart";
import type { Product } from "@/stores/catalog";
import GroupLineItemContent from "@/components/product/GroupLineItemContent.vue";

// Рекурсивный импорт через defineAsyncComponent для избежания циклических зависимостей
const GroupLineItem = defineAsyncComponent(
  () => import("@/components/product/GroupLineItem.vue"),
);

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
  metaLabel?: string | null;
  metaValue?: string | null;
  children: GroupNode[];
  products: Product[];
}

const props = defineProps<{
  categoryImage?: string | null;
  node: GroupNode;
  expandedGroups: Record<string, boolean>;
}>();

const emit = defineEmits<{
  (e: "toggle", groupId: string): void;
  (e: "productClick", product: Product): void;
  (e: "showToast", message: string, type: "error" | "success" | "info"): void;
  (e: "heightChanged"): void;
}>();

const cartStore = useCartStore();
const bodyWrapper = ref<HTMLElement | null>(null);
const contentHeight = ref(0);

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

// Цена первого товара для отображения в заголовке
const firstProductPrice = computed(() => {
  const firstProduct = props.node.products.find((p) => Boolean(p));
  if (!firstProduct) return null;

  // Если товар с вариантами, берем цену первого варианта
  if (firstProduct.hasVariants && Array.isArray(firstProduct.variants)) {
    return firstProduct.variants[0]?.priceRub ?? null;
  }

  // Иначе берем цену самого товара
  return firstProduct.priceRub ?? null;
});

const metaText = computed(() => {
  const label = (props.node.metaLabel ?? "").trim();
  const value = (props.node.metaValue ?? "").trim();
  if (label && value) {
    return `${label} ${value}`;
  }
  return label || value;
});

const wrapperStyle = computed(() => {
  if (!isExpanded.value) {
    return { maxHeight: "0px" };
  }
  const height = Math.max(contentHeight.value, 10000);
  return { maxHeight: height + "px" };
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
      setTimeout(() => {
        calculateHeight();
        emit("heightChanged");
      }, 350);
    } else {
      contentHeight.value = 0;
      emit("heightChanged");
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

async function onChildHeightChanged() {
  if (!isExpanded.value) return;
  await calculateHeight();
  setTimeout(() => calculateHeight(), 50);
  setTimeout(() => calculateHeight(), 150);
  setTimeout(() => {
    calculateHeight();
    emit("heightChanged");
  }, 350);
}

function toggle() {
  emit("toggle", props.node.id);
}

function formatPrice(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("ru-RU");
}
</script>

<style scoped>
/* Figma Redesign - Карточка группы/линейки устройств */
.group-line-card {
  box-sizing: border-box;
  background: #ffffff;
  border-radius: 20px;
  padding: 16px;
  margin-bottom: 0;
}

.group-line-card:last-of-type {
  margin-bottom: 0;
}

.group-line-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
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
  padding: 6px;
}

.group-line-image img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.group-line-image-placeholder {
  background: #fafafa;
}

.group-line-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
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

.group-line-meta {
  margin: 0;
  font-family:
    "SF Pro Display",
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  font-style: normal;
  font-weight: 500;
  font-size: 14.4px;
  line-height: 17.3px;
  color: #aab2bd;
}

.group-line-price {
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
  padding: 10px 8px;
  gap: 10px;
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
  transform: rotate(-90deg) rotate(90deg);
}

.group-line-toggle-icon {
  width: 12px;
  height: 12px;
  color: #191919;
  transition: transform 0.3s ease;
  transform: rotate(-90deg);
}

/* ========== Анимация раскрытия ========== */
.group-line-body-wrapper {
  overflow: hidden;
  transition: max-height 650ms cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 0;
}

.group-line-body {
  margin-top: 0;
  padding: 0;
}

.group-line-children {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Адаптивные стили */

@media (max-width: 1024px) {
  .group-line-card {
    padding: 16px;
  }

  .group-line-image {
    width: 88px;
    height: 104px;
    border-radius: 16px;
    padding: 6px;
  }

  .group-line-image img {
    max-width: 100%;
    max-height: 100%;
  }

  .group-line-title {
    font-size: 16px;
    line-height: 20px;
  }

  .group-line-price {
    font-size: 16px;
    line-height: 20px;
  }

  .group-line-header {
    gap: 10px;
  }

  .group-line-main {
    gap: 12px;
  }

  .group-line-toggle {
    width: 40px;
    height: 40px;
  }

  .group-line-toggle-icon {
    width: 12px;
    height: 12px;
  }
}

@media (max-width: 768px) {
  .group-line-card {
    padding: 16px;
    border-radius: 20px;
    margin-bottom: 0;
  }

  .group-line-header {
    gap: 10px;
  }

  .group-line-main {
    gap: 12px;
  }

  .group-line-image {
    width: 88px;
    height: 104px;
    border-radius: 16px;
    padding: 6px;
  }

  .group-line-image img {
    max-width: 100%;
    max-height: 100%;
  }

  .group-line-info {
    gap: 6px;
  }

  .group-line-title {
    font-size: 16px;
    line-height: 20px;
  }

  .group-line-price {
    font-size: 16px;
    line-height: 20px;
  }

  .group-line-count-badge {
    padding: 10px 8px;
  }

  .group-line-count-badge span {
    font-size: 12px;
    line-height: 14px;
  }

  .group-line-toggle {
    width: 40px;
    height: 40px;
  }

  .group-line-toggle-icon {
    width: 12px;
    height: 12px;
  }
}

@media (max-width: 480px) {
  .group-line-card {
    padding: 16px;
    border-radius: 20px;
  }

  .group-line-header {
    gap: 10px;
  }

  .group-line-main {
    gap: 12px;
  }

  .group-line-image {
    width: 88px;
    height: 104px;
    border-radius: 16px;
    padding: 6px;
  }

  .group-line-image img {
    max-width: 100%;
    max-height: 100%;
  }

  .group-line-info {
    gap: 6px;
  }

  .group-line-title {
    font-size: 16px;
    line-height: 20px;
  }

  .group-line-price {
    font-size: 16px;
    line-height: 20px;
  }

  .group-line-count-badge {
    padding: 10px 8px;
  }

  .group-line-count-badge span {
    font-size: 12px;
    line-height: 14px;
  }

  .group-line-toggle {
    width: 40px;
    height: 40px;
  }

  .group-line-toggle-icon {
    width: 12px;
    height: 12px;
  }
}

@media (max-width: 360px) {
  .group-line-card {
    padding: 14px;
    border-radius: 18px;
  }

  .group-line-header {
    gap: 8px;
  }

  .group-line-main {
    gap: 10px;
  }

  .group-line-image {
    width: 80px;
    height: 96px;
    border-radius: 14px;
    padding: 4px;
  }

  .group-line-image img {
    max-width: 100%;
    max-height: 100%;
  }

  .group-line-info {
    gap: 5px;
  }

  .group-line-title {
    font-size: 15px;
    line-height: 19px;
  }

  .group-line-price {
    font-size: 15px;
    line-height: 19px;
  }

  .group-line-count-badge {
    padding: 8px 6px;
  }

  .group-line-count-badge span {
    font-size: 11px;
    line-height: 13px;
  }

  .group-line-toggle {
    width: 36px;
    height: 36px;
  }

  .group-line-toggle-icon {
    width: 11px;
    height: 11px;
  }
}
</style>
