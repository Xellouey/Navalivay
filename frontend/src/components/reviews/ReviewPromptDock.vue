<template>
  <Transition name="review-dock">
    <div
      v-if="visible"
      class="review-prompt-dock"
      role="region"
      aria-label="Напоминание об отзыве"
    >
      <div class="review-prompt-dock__copy">
        <span class="review-prompt-dock__kicker">Оцените покупку</span>
        <strong class="review-prompt-dock__title">
          {{ prompt?.group_name || "Ваш заказ" }}
        </strong>
        <p v-if="variantLabel" class="review-prompt-dock__variant">{{ variantLabel }}</p>
        <p v-if="lotteryHint" class="review-prompt-dock__hint">{{ lotteryHint }}</p>
      </div>

      <div class="review-prompt-dock__stars" aria-label="Выберите оценку">
        <button
          v-for="star in 5"
          :key="star"
          type="button"
          class="review-prompt-dock__star"
          :aria-label="`${star} из 5`"
          @click="openWithRating(star)"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 3.5L14.9 9.3L21.2 10.2L16.6 14.6L17.8 21L12 18.1L6.2 21L7.4 14.6L2.8 10.2L9.1 9.3L12 3.5Z"
              fill="transparent"
              stroke="rgba(255,255,255,0.92)"
              stroke-width="1.6"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCustomerOrders } from "@/composables/useCustomerOrders";

const props = withDefaults(
  defineProps<{
    autoLoad?: boolean;
  }>(),
  { autoLoad: true },
);

const route = useRoute();
const router = useRouter();
const { reviewPrompt, fetchReviewPrompt } = useCustomerOrders();
const dockHeight = ref(0);

const prompt = computed(() => reviewPrompt.value);
const visible = computed(() => Boolean(prompt.value?.show && prompt.value.order_id));

const variantLabel = computed(() => {
  const name = prompt.value?.purchased_variant_name?.trim();
  return name || null;
});

const lotteryHint = computed(() => {
  const text = prompt.value?.lottery_hint_text?.trim();
  if (text) return text;
  if ((prompt.value?.pending_review_count || 0) > 1) {
    return "Оставьте отзывы — участвуйте в розыгрыше";
  }
  return "Оставьте отзыв — участвуйте в розыгрыше";
});

function openWithRating(rating: number) {
  const orderId = prompt.value?.order_id;
  const groupId = prompt.value?.group_id;
  if (!orderId) return;

  router.push({
    name: "order-detail",
    params: { orderId },
    query: {
      rating: String(rating),
      ...(groupId ? { groupId } : {}),
    },
  });
}

function syncDockHeight(isVisible: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(
    "--app-review-dock-height",
    isVisible ? "72px" : "0px",
  );
}

watch(visible, (isVisible) => syncDockHeight(isVisible), { immediate: true });

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

defineExpose({ dockHeight });
</script>

<style scoped>
.review-prompt-dock {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: calc(var(--app-bottom-tab-bar-height, 130px) + 8px);
  z-index: 95;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 64px;
  padding: 12px 14px;
  border-radius: 20px;
  background: linear-gradient(145deg, #191919 0%, #363636 100%);
  color: #ffffff;
  box-shadow: 0 8px 24px rgba(25, 25, 25, 0.18);
}

.review-prompt-dock__copy {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.review-prompt-dock__kicker {
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 11px;
  line-height: 13px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.58);
}

.review-prompt-dock__title {
  font-family: "Montserrat", sans-serif;
  font-size: 15px;
  line-height: 18px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.review-prompt-dock__variant,
.review-prompt-dock__hint {
  margin: 0;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 12px;
  line-height: 15px;
  color: rgba(255, 255, 255, 0.72);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.review-prompt-dock__stars {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.review-prompt-dock__star {
  border: none;
  background: transparent;
  padding: 2px;
  cursor: pointer;
  line-height: 0;
  -webkit-tap-highlight-color: transparent;
}

.review-prompt-dock__star:active {
  transform: scale(0.94);
}

.review-dock-enter-active,
.review-dock-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.review-dock-enter-from,
.review-dock-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 360px) {
  .review-prompt-dock {
    left: 12px;
    right: 12px;
    padding: 10px 12px;
  }

  .review-prompt-dock__title {
    font-size: 14px;
  }
}
</style>