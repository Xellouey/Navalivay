<template>
  <div class="group-line-card" :class="{ expanded: isExpanded }">
    <button
      :id="headerId"
      type="button"
      class="group-line-header"
      :aria-expanded="isExpanded"
      :aria-controls="panelId"
      @click="toggle"
    >
      <span class="group-line-main">
        <span class="group-line-image-wrapper">
          <span v-if="coverImage" class="group-line-image">
            <img :src="coverImage" :alt="node.name" loading="lazy" decoding="async" />
          </span>
          <span v-else class="group-line-image group-line-image-placeholder">
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
          </span>
        </span>

        <span class="group-line-info">
          <span class="group-line-title">{{ node.name }}</span>
          <span v-if="metaText" class="group-line-meta">{{ metaText }}</span>
          <span v-if="firstProductPrice" class="group-line-price">
            {{ formatPrice(firstProductPrice) }} BYN
          </span>
          <span
            v-if="!isExpanded && totalProductCount > 0"
            class="group-line-count-badge"
          >
            <span>Ещё {{ totalProductCount }}</span>
          </span>
        </span>
      </span>

      <span class="group-line-side">
        <span class="group-line-toggle" :class="{ expanded: isExpanded }" aria-hidden="true">
          <ChevronDownIcon class="group-line-toggle-icon" />
        </span>
      </span>
    </button>

    <Transition
      :css="false"
      @before-enter="onBeforeEnter"
      @enter="onEnter"
      @after-enter="onAfterEnter"
      @before-leave="onBeforeLeave"
      @leave="onLeave"
      @after-leave="onAfterLeave"
      @enter-cancelled="onCancelled"
      @leave-cancelled="onCancelled"
    >
      <div
        v-if="isExpanded"
        :id="panelId"
        ref="bodyWrapper"
        class="group-line-body-wrapper"
        role="region"
        :aria-labelledby="headerId"
      >
        <div class="group-line-body">
          <GroupLineItemContent
            :node="node"
            :category-image="categoryImage"
            @showToast="forwardToast"
          />

          <div v-if="node.children.length" class="group-line-children">
            <GroupLineItem
              v-for="child in node.children"
              :key="child.id"
              :node="child"
              :category-image="categoryImage"
              :expanded-groups="expandedGroups"
              @toggle="$emit('toggle', $event)"
              @productClick="$emit('productClick', $event)"
              @heightChanged="handleNestedHeightChanged"
              @showToast="forwardToast"
            />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  ref,
} from "vue";
import { ChevronDownIcon } from "@heroicons/vue/24/outline";
import { useCatalogStore, type Product } from "@/stores/catalog";
import GroupLineItemContent from "@/components/product/GroupLineItemContent.vue";

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

const catalogStore = useCatalogStore();
const bodyWrapper = ref<HTMLElement | null>(null);
const headerId = computed(() => `group-line-header-${props.node.id}`);
const panelId = computed(() => `group-line-panel-${props.node.id}`);
const isExpanded = computed(() => props.expandedGroups[props.node.id] ?? false);
const coverImage = computed(
  () => props.node.coverImage || catalogStore.getGroupImage(props.node.id) || null,
);

let transitionTimer: ReturnType<typeof setTimeout> | null = null;

const totalProductCount = computed(() => {
  return props.node.products.length + props.node.children.reduce((count, child) => {
    return count + (child.totalProductCount ?? child.productCount ?? 0);
  }, 0);
});

function findFirstProduct(node: GroupNode): Product | null {
  const directProduct = node.products.find(Boolean);
  if (directProduct) return directProduct;

  for (const child of node.children) {
    const nestedProduct = findFirstProduct(child);
    if (nestedProduct) return nestedProduct;
  }

  return null;
}

const firstProductPrice = computed(() => {
  const product = findFirstProduct(props.node);
  if (!product) return null;

  if (product.hasVariants && Array.isArray(product.variants)) {
    return product.variants[0]?.priceRub ?? null;
  }

  return product.priceRub ?? null;
});

const metaText = computed(() => {
  const label = (props.node.metaLabel ?? "").trim();
  const value = (props.node.metaValue ?? "").trim();
  if (label && value) {
    return `${label} ${value}`;
  }
  return label || value;
});

function clearTransitionTimer() {
  if (transitionTimer === null) return;
  clearTimeout(transitionTimer);
  transitionTimer = null;
}

function queueNextFrame(callback: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(callback);
  });
}

function getBodyHeight(element: HTMLElement) {
  return Math.max(Math.ceil(element.scrollHeight), 1);
}

function applyTransitionStyles(element: HTMLElement) {
  element.style.overflow = "hidden";
  element.style.willChange = "height, opacity";
  element.style.transition =
    "height 360ms cubic-bezier(0.4, 0, 0.2, 1), opacity 220ms ease";
}

function resetTransitionStyles(element: HTMLElement) {
  element.style.transition = "";
  element.style.willChange = "";
}

function waitForHeightTransition(element: HTMLElement, done: () => void) {
  clearTransitionTimer();

  const finish = () => {
    element.removeEventListener("transitionend", handleTransitionEnd);
    clearTransitionTimer();
    done();
  };

  const handleTransitionEnd = (event: TransitionEvent) => {
    if (event.target !== element || event.propertyName !== "height") return;
    finish();
  };

  element.addEventListener("transitionend", handleTransitionEnd);
  transitionTimer = setTimeout(finish, 520);
}

function onBeforeEnter(element: Element) {
  const panel = element as HTMLElement;
  clearTransitionTimer();
  panel.style.height = "0px";
  panel.style.opacity = "0";
  panel.style.overflow = "hidden";
}

function onEnter(element: Element, done: () => void) {
  const panel = element as HTMLElement;
  applyTransitionStyles(panel);

  queueNextFrame(() => {
    panel.style.height = `${getBodyHeight(panel)}px`;
    panel.style.opacity = "1";
  });

  waitForHeightTransition(panel, done);
}

function onAfterEnter(element: Element) {
  const panel = element as HTMLElement;
  clearTransitionTimer();
  resetTransitionStyles(panel);
  panel.style.height = "auto";
  panel.style.opacity = "1";
  panel.style.overflow = "visible";
  emit("heightChanged");
}

function onBeforeLeave(element: Element) {
  const panel = element as HTMLElement;
  clearTransitionTimer();
  panel.style.height = `${getBodyHeight(panel)}px`;
  panel.style.opacity = "1";
  panel.style.overflow = "hidden";
}

function onLeave(element: Element, done: () => void) {
  const panel = element as HTMLElement;
  applyTransitionStyles(panel);

  queueNextFrame(() => {
    panel.style.height = "0px";
    panel.style.opacity = "0";
  });

  waitForHeightTransition(panel, done);
}

function onAfterLeave(element: Element) {
  const panel = element as HTMLElement;
  clearTransitionTimer();
  resetTransitionStyles(panel);
  panel.style.height = "0px";
  panel.style.opacity = "0";
  panel.style.overflow = "hidden";
  emit("heightChanged");
}

function onCancelled(element: Element) {
  const panel = element as HTMLElement;
  clearTransitionTimer();
  resetTransitionStyles(panel);

  if (isExpanded.value) {
    panel.style.height = "auto";
    panel.style.opacity = "1";
    panel.style.overflow = "visible";
  } else {
    panel.style.height = "0px";
    panel.style.opacity = "0";
    panel.style.overflow = "hidden";
  }
}

async function handleNestedHeightChanged() {
  await nextTick();
  if (bodyWrapper.value && bodyWrapper.value.style.height !== "auto") {
    bodyWrapper.value.style.height = `${getBodyHeight(bodyWrapper.value)}px`;
  }
  emit("heightChanged");
}

function toggle() {
  emit("toggle", props.node.id);
}

function forwardToast(
  message: string,
  type: "error" | "success" | "info",
) {
  emit("showToast", message, type);
}

function formatPrice(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("ru-RU");
}

onBeforeUnmount(() => {
  clearTransitionTimer();
});
</script>

<style scoped>
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
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.group-line-header:focus-visible {
  outline: 2px solid rgba(25, 25, 25, 0.18);
  outline-offset: 4px;
  border-radius: 20px;
}

.group-line-main {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
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

.group-line-title,
.group-line-meta,
.group-line-price {
  display: block;
  margin: 0;
}

.group-line-title {
  font-family: "Montserrat", sans-serif;
  font-style: normal;
  font-weight: 700;
  font-size: 16px;
  line-height: 20px;
  color: #191919;
}

.group-line-meta {
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
  background: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background-color 0.2s ease,
    transform 0.2s ease;
  flex-shrink: 0;
}

.group-line-header:hover .group-line-toggle {
  background: #e6e9ed;
}

.group-line-toggle.expanded .group-line-toggle-icon {
  transform: rotate(0deg);
}

.group-line-toggle-icon {
  width: 12px;
  height: 12px;
  color: #191919;
  transition: transform 0.3s ease;
  transform: rotate(-90deg);
}

.group-line-body-wrapper {
  overflow: hidden;
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
