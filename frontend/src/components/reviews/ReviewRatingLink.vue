<template>
  <div v-if="ready" class="review-rating-row">
    <template v-if="count > 0">
      <span class="review-rating-row__score" aria-hidden="true">
        <span class="review-rating-row__star">★</span>
        <span class="review-rating-row__average">{{ formattedAverage }}</span>
        <span class="review-rating-row__count">({{ count }})</span>
      </span>
      <button
        type="button"
        class="review-rating-row__action"
        :aria-label="actionAriaLabel"
        @click.stop="emit('click')"
      >
        посмотреть отзывы
      </button>
    </template>
    <p v-else class="review-rating-row__empty">
      <span class="review-rating-row__star" aria-hidden="true">★</span>
      нет отзывов
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    count: number;
    averageRating: number | null;
    ready?: boolean;
  }>(),
  { ready: true },
);

const emit = defineEmits<{
  click: [];
}>();

const formattedAverage = computed(() => {
  if (props.averageRating == null) return "—";
  const rounded = Math.round(props.averageRating * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
});

const actionAriaLabel = computed(() => {
  const reviewsWord = props.count === 1 ? "отзыв" : props.count < 5 ? "отзыва" : "отзывов";
  return `Посмотреть ${props.count} ${reviewsWord}, средняя оценка ${formattedAverage.value} из 5`;
});
</script>

<style scoped>
.review-rating-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
  min-height: 16px;
}

.review-rating-row__score {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 13px;
  line-height: 16px;
}

.review-rating-row__star {
  color: #f50302;
  font-size: 14px;
  line-height: 1;
}

.review-rating-row__average {
  font-weight: 600;
  color: #191919;
}

.review-rating-row__count {
  color: #8a93a0;
}

.review-rating-row__action {
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 13px;
  line-height: 16px;
  font-weight: 500;
  color: #2f6fed;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.review-rating-row__action:active {
  opacity: 0.72;
}

.review-rating-row__empty {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 13px;
  line-height: 16px;
  font-weight: 500;
  color: #a35b5b;
}
</style>