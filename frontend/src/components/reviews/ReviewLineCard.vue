<template>
  <article
    :id="anchorId"
    class="review-line-card"
    :class="{ 'review-line-card--highlight': highlighted }"
  >
    <div class="review-line-card__header">
      <div class="review-line-card__media">
        <img
          v-if="coverImage"
          :src="coverImage"
          :alt="line.group_name"
          loading="lazy"
          decoding="async"
        />
        <div v-else class="review-line-card__media-placeholder" aria-hidden="true" />
      </div>
      <div class="review-line-card__copy">
        <h3 class="review-line-card__title">{{ line.group_name }}</h3>
        <p v-if="line.purchased_variant_name" class="review-line-card__variant">
          {{ line.purchased_variant_name }}
        </p>
        <p v-if="line.items.length" class="review-line-card__meta">
          {{ line.items.length }} поз. · {{ formatPrice(lineTotal) }} BYN
        </p>
      </div>
    </div>

    <ReviewForm
      v-if="showForm"
      :initial-rating="initialRating"
      :initial-anonymous="preferAnonymous"
      :quick-tags="quickTags"
      :disabled="submitting"
      :submitting="submitting"
      :error-message="errorMessage"
      @submit="handleSubmit"
      @update:rating="onRatingChange"
    />

    <div v-else-if="state === 'cooldown'" class="review-line-card__state">
      <p class="review-line-card__state-title">Отзыв уже оставлен</p>
      <p class="review-line-card__state-text">
        Следующий отзыв на эту линейку можно оставить
        {{ formatOrderDateTime(line.eligibility.cooldownEndsAt) }}.
      </p>
    </div>

    <div v-else-if="state === 'pending'" class="review-line-card__state">
      <p class="review-line-card__state-title">Отзыв на модерации</p>
      <p class="review-line-card__state-text">
        Мы проверим ваш отзыв и опубликуем его после одобления.
      </p>
      <div v-if="line.latest_review" class="review-line-card__rating" aria-hidden="true">
        <span v-for="star in 5" :key="star" class="review-line-card__rating-star">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3.5L14.9 9.3L21.2 10.2L16.6 14.6L17.8 21L12 18.1L6.2 21L7.4 14.6L2.8 10.2L9.1 9.3L12 3.5Z"
              :fill="star <= line.latest_review.rating ? '#F50302' : 'transparent'"
              :stroke="star <= line.latest_review.rating ? '#F50302' : '#D8DDE4'"
              stroke-width="1.4"
            />
          </svg>
        </span>
      </div>
    </div>

    <div v-else-if="state === 'done'" class="review-line-card__state">
      <p class="review-line-card__state-title">Спасибо за отзыв</p>
      <p class="review-line-card__state-text">
        Ваш отзыв учтён. Он помогает другим покупателям выбрать товар.
      </p>
      <div v-if="line.latest_review" class="review-line-card__rating" aria-hidden="true">
        <span v-for="star in 5" :key="star" class="review-line-card__rating-star">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3.5L14.9 9.3L21.2 10.2L16.6 14.6L17.8 21L12 18.1L6.2 21L7.4 14.6L2.8 10.2L9.1 9.3L12 3.5Z"
              :fill="star <= line.latest_review.rating ? '#F50302' : 'transparent'"
              :stroke="star <= line.latest_review.rating ? '#F50302' : '#D8DDE4'"
              stroke-width="1.4"
            />
          </svg>
        </span>
      </div>
    </div>

    <div v-else class="review-line-card__state">
      <p class="review-line-card__state-title">Отзыв недоступен</p>
      <p class="review-line-card__state-text">{{ unavailableCopy }}</p>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ReviewForm from "@/components/reviews/ReviewForm.vue";
import {
  formatOrderDateTime,
  useCustomerOrders,
  type QuickTag,
  type ReviewableLine,
} from "@/composables/useCustomerOrders";

const props = withDefaults(
  defineProps<{
    line: ReviewableLine;
    orderId: string;
    preferAnonymous?: boolean;
    initialRating?: number;
    highlighted?: boolean;
  }>(),
  {
    preferAnonymous: false,
    initialRating: 0,
    highlighted: false,
  },
);

const emit = defineEmits<{
  submitted: [];
}>();

const { fetchQuickTags, submitReview } = useCustomerOrders();

const quickTags = ref<QuickTag[]>([]);
const activeRating = ref(props.initialRating);
const submitting = ref(false);
const errorMessage = ref<string | null>(null);

const anchorId = computed(() => `review-line-${props.line.group_id}`);
const coverImage = computed(
  () => props.line.group_cover_image || props.line.category_cover_image || null,
);
const lineTotal = computed(() =>
  props.line.items.reduce((sum, item) => sum + Number(item.total_price || 0), 0),
);

const state = computed(() => {
  if (props.line.eligibility.canReview) return "form";
  if (props.line.eligibility.reason === "cooldown") return "cooldown";
  if (props.line.eligibility.reason === "pending_moderation") return "pending";
  if (
    props.line.latest_review?.status === "approved" ||
    props.line.latest_review?.status === "rejected"
  ) {
    return "done";
  }
  return "unavailable";
});

const showForm = computed(() => state.value === "form");

const unavailableCopy = computed(() => {
  if (props.line.eligibility.reason === "not_purchased") {
    return "Отзыв можно оставить только на купленные товары.";
  }
  return "Сейчас нельзя оставить отзыв на эту позицию.";
});

watch(
  () => props.initialRating,
  (value) => {
    if (value > 0) activeRating.value = value;
  },
  { immediate: true },
);

watch(
  [() => props.line.review_category_key, activeRating],
  async ([categoryKey, rating]) => {
    if (!categoryKey || rating < 1) {
      quickTags.value = [];
      return;
    }
    try {
      quickTags.value = await fetchQuickTags(categoryKey, rating);
    } catch {
      quickTags.value = [];
    }
  },
  { immediate: true },
);

function onRatingChange(value: number) {
  activeRating.value = value;
}

function formatPrice(value: number) {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

async function handleSubmit(payload: {
  rating: number;
  body_text: string;
  quick_tag_ids: string[];
  is_anonymous: boolean;
}) {
  submitting.value = true;
  errorMessage.value = null;

  try {
    await submitReview({
      order_id: props.orderId,
      group_id: props.line.group_id,
      order_item_id: props.line.order_item_id,
      rating: payload.rating,
      body_text: payload.body_text,
      quick_tag_ids: payload.quick_tag_ids,
      is_anonymous: payload.is_anonymous,
    });
    emit("submitted");
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error ? error.message : "Не удалось отправить отзыв";
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.review-line-card {
  background: #ffffff;
  border-radius: 20px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
  scroll-margin-top: 16px;
}

.review-line-card--highlight {
  box-shadow: 0 0 0 2px rgba(245, 3, 2, 0.18), 0 8px 20px rgba(15, 23, 42, 0.06);
}

.review-line-card__header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.review-line-card__media,
.review-line-card__media-placeholder {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  flex-shrink: 0;
  overflow: hidden;
  background: #f5f7fa;
}

.review-line-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.review-line-card__copy {
  min-width: 0;
}

.review-line-card__title {
  margin: 0;
  font-family: "Montserrat", sans-serif;
  font-weight: 700;
  font-size: 16px;
  line-height: 20px;
  color: #191919;
}

.review-line-card__variant,
.review-line-card__meta {
  margin: 4px 0 0;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 13px;
  line-height: 17px;
  color: #5c6470;
}

.review-line-card__state {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.review-line-card__state-title {
  margin: 0;
  font-family: "Montserrat", sans-serif;
  font-weight: 600;
  font-size: 15px;
  line-height: 19px;
  color: #191919;
}

.review-line-card__state-text {
  margin: 0;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 14px;
  line-height: 18px;
  color: #5c6470;
}

.review-line-card__rating {
  display: flex;
  gap: 2px;
  margin-top: 4px;
}
</style>