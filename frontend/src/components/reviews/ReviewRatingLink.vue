<template>
  <button
    v-if="count > 0"
    type="button"
    class="review-rating-link"
    :aria-label="ariaLabel"
    @click.stop="emit('click')"
  >
    <span class="review-rating-link__star" aria-hidden="true">★</span>
    <span class="review-rating-link__average">{{ formattedAverage }}</span>
    <span class="review-rating-link__count">({{ count }})</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  count: number;
  averageRating: number | null;
}>();

const emit = defineEmits<{
  click: [];
}>();

const formattedAverage = computed(() => {
  if (props.averageRating == null) return "—";
  const rounded = Math.round(props.averageRating * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
});

const ariaLabel = computed(() => {
  const rating = formattedAverage.value;
  const reviewsWord = props.count === 1 ? "отзыв" : props.count < 5 ? "отзыва" : "отзывов";
  return `Средняя оценка ${rating} из 5, ${props.count} ${reviewsWord}. Посмотреть отзывы`;
});
</script>

<style scoped>
.review-rating-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  padding: 0;
  border: none;
  background: none;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 13px;
  line-height: 16px;
  color: #5c6470;
  cursor: pointer;
}

.review-rating-link__star {
  color: #f50302;
  font-size: 14px;
  line-height: 1;
}

.review-rating-link__average {
  font-weight: 600;
  color: #191919;
}

.review-rating-link__count {
  color: #8a93a0;
}
</style>