<template>
  <Transition name="review-dock">
    <button
      v-if="visible"
      ref="dockRef"
      type="button"
      class="review-prompt-dock"
      :aria-label="dockAriaLabel"
      @click="openOrderDetail"
    >
      <span class="review-prompt-dock__order">{{ orderLabel }}</span>

      <span class="review-prompt-dock__cta">
        <span class="review-prompt-dock__cta-text">Оцените заказ:</span>
        <span class="review-prompt-dock__stars" aria-hidden="true">
          <svg
            v-for="star in 3"
            :key="star"
            class="review-prompt-dock__star"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M12 3.5L14.9 9.3L21.2 10.2L16.6 14.6L17.8 21L12 18.1L6.2 21L7.4 14.6L2.8 10.2L9.1 9.3L12 3.5Z"
              fill="currentColor"
              stroke="currentColor"
              stroke-width="0.8"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <svg
          class="review-prompt-dock__chevron"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M9 6L15 12L9 18"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
    </button>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCustomerOrders } from "@/composables/useCustomerOrders";
import {
  TAB_BAR_NOTCH_FLOOR_CSS,
  TAB_BAR_SHAPE_HEIGHT,
  computeReviewDockExtrusion,
  parseTabBarHeightCss,
} from "@/utils/reviewDockGeometry";
import { isReviewDockVisible } from "@/utils/reviewDockVisibility";

const props = withDefaults(
  defineProps<{
    autoLoad?: boolean;
  }>(),
  { autoLoad: true },
);

const route = useRoute();
const router = useRouter();
const { reviewPrompt, fetchReviewPrompt } = useCustomerOrders();
const dockRef = ref<HTMLButtonElement | null>(null);

const prompt = computed(() => reviewPrompt.value);
const visible = computed(() =>
  isReviewDockVisible(
    {
      path: route.path,
      name: route.name,
      params: route.params,
    },
    prompt.value,
  ),
);

const orderLabel = computed(() => {
  const orderNumber = prompt.value?.order_number;
  return orderNumber ? `Заказ №${orderNumber}` : "Ваш заказ";
});

const dockAriaLabel = computed(() => `${orderLabel.value}. Оцените заказ`);

function readTabBarHeight(): number {
  if (typeof document === "undefined") return TAB_BAR_SHAPE_HEIGHT;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    "--app-bottom-tab-bar-height",
  );
  return parseTabBarHeightCss(raw, TAB_BAR_SHAPE_HEIGHT);
}

function syncDockHeight(isVisible: boolean) {
  if (typeof document === "undefined") return;

  if (!isVisible || !dockRef.value) {
    document.documentElement.style.setProperty("--app-review-dock-height", "0px");
    return;
  }

  const extrusion = computeReviewDockExtrusion(
    dockRef.value.offsetHeight,
    readTabBarHeight(),
  );
  document.documentElement.style.setProperty(
    "--app-review-dock-height",
    `${extrusion}px`,
  );
}

function openOrderDetail() {
  const orderId = prompt.value?.order_id;
  const groupId = prompt.value?.group_id;
  if (!orderId) return;

  router.push({
    name: "order-detail",
    params: { orderId },
    query: groupId ? { groupId } : {},
  });
}

watch(visible, (isVisible) => syncDockHeight(isVisible), { immediate: true });

watch(orderLabel, () => {
  if (!visible.value) return;
  requestAnimationFrame(() => syncDockHeight(true));
});

onMounted(async () => {
  if (!props.autoLoad) return;
  if (route.path.startsWith("/profile/orders")) return;
  try {
    await fetchReviewPrompt();
  } catch (error) {
    console.warn("[review-dock] prompt fetch failed", error);
  }
});

watch(
  () => route.fullPath,
  async () => {
    if (!props.autoLoad) return;
    if (route.path.startsWith("/profile/orders")) return;
    try {
      await fetchReviewPrompt();
    } catch {
      // ignore transient errors
    }
  },
);

defineExpose({ syncDockHeight, TAB_BAR_NOTCH_FLOOR_CSS });
</script>

<style scoped>
.review-prompt-dock {
  --review-dock-height: clamp(44px, calc(100vw * 48 / 393), 48px);
  position: fixed;
  left: clamp(14px, calc(100vw * 16 / 393), 18px);
  right: clamp(14px, calc(100vw * 16 / 393), 18px);
  bottom: calc(v-bind(TAB_BAR_NOTCH_FLOOR_CSS) + env(safe-area-inset-bottom, 0px));
  z-index: 99;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: auto;
  min-height: var(--review-dock-height);
  padding: 10px clamp(14px, calc(100vw * 16 / 393), 18px);
  border: none;
  border-radius: 18px;
  background: #ffffff;
  box-shadow:
    0 4px 18px rgba(15, 23, 42, 0.1),
    0 1px 0 rgba(255, 255, 255, 0.9),
    inset 0 0 0 0.5px rgba(15, 23, 42, 0.04);
  color: #111827;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.review-prompt-dock:active {
  transform: translateY(1px) scale(0.995);
  box-shadow:
    0 2px 12px rgba(15, 23, 42, 0.08),
    inset 0 0 0 0.5px rgba(15, 23, 42, 0.05);
}

.review-prompt-dock__order {
  flex: 0 1 auto;
  min-width: 0;
  font-family: "Montserrat", sans-serif;
  font-size: 13px;
  line-height: 16px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.review-prompt-dock__cta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  min-width: 0;
}

.review-prompt-dock__cta-text {
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 12px;
  line-height: 15px;
  font-weight: 500;
  color: #64748b;
  white-space: nowrap;
}

.review-prompt-dock__stars {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  flex-shrink: 0;
  color: #e8b020;
}

.review-prompt-dock__star {
  display: block;
  width: 17px;
  height: 17px;
  filter: drop-shadow(0 1px 0 rgba(180, 120, 0, 0.1));
}

.review-prompt-dock__chevron {
  flex-shrink: 0;
  color: #cbd5e1;
}

.review-dock-enter-active,
.review-dock-leave-active {
  transition:
    opacity 0.24s ease,
    transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.review-dock-enter-from,
.review-dock-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

@media (max-width: 360px) {
  .review-prompt-dock {
    left: 12px;
    right: 12px;
    gap: 8px;
    padding-inline: 12px;
  }

  .review-prompt-dock__order,
  .review-prompt-dock__cta-text {
    font-size: 11px;
  }

  .review-prompt-dock__star {
    width: 15px;
    height: 15px;
  }

  .review-prompt-dock__chevron {
    width: 12px;
    height: 12px;
  }
}
</style>