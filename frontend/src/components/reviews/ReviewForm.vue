<template>
  <form class="review-form" @submit.prevent="handleSubmit">
    <div class="review-form__stars" role="radiogroup" aria-label="Оценка">
      <button
        v-for="star in 5"
        :key="star"
        type="button"
        class="review-form__star"
        :class="{ 'review-form__star--active': star <= rating }"
        :aria-checked="rating === star"
        role="radio"
        :disabled="disabled"
        @click="setRating(star)"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3.5L14.9 9.3L21.2 10.2L16.6 14.6L17.8 21L12 18.1L6.2 21L7.4 14.6L2.8 10.2L9.1 9.3L12 3.5Z"
            :fill="star <= rating ? '#F50302' : 'transparent'"
            :stroke="star <= rating ? '#F50302' : '#AAB2BD'"
            stroke-width="1.6"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>

    <div v-if="rating > 0 && quickTags.length" class="review-form__tags">
      <button
        v-for="tag in quickTags"
        :key="tag.id"
        type="button"
        class="review-form__tag"
        :class="{ 'review-form__tag--used': usedTagIds.has(tag.id) }"
        :disabled="disabled"
        @click="appendTag(tag)"
      >
        {{ tag.label }}
      </button>
    </div>

    <label class="review-form__field">
      <span class="review-form__label">Ваш отзыв</span>
      <textarea
        v-model="bodyText"
        class="review-form__textarea"
        rows="4"
        :disabled="disabled"
        placeholder="Расскажите, что понравилось или не понравилось"
        @input="emit('update:bodyText', bodyText)"
      />
      <span class="review-form__counter" :class="{ 'review-form__counter--ok': bodyText.trim().length >= 20 }">
        {{ bodyText.trim().length }} / 20
      </span>
    </label>

    <label class="review-form__anonymous">
      <input
        v-model="anonymous"
        type="checkbox"
        class="review-form__anonymous-input"
        :disabled="disabled"
        @change="emit('update:anonymous', anonymous)"
      />
      <span>Опубликовать анонимно</span>
    </label>

    <p v-if="errorMessage" class="review-form__error">{{ errorMessage }}</p>

    <button
      type="submit"
      class="review-form__submit"
      :disabled="disabled || !canSubmit"
    >
      {{ submitting ? "Отправляем…" : "Отправить отзыв" }}
    </button>
  </form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { QuickTag } from "@/composables/useCustomerOrders";

const props = withDefaults(
  defineProps<{
    initialRating?: number;
    initialBodyText?: string;
    initialAnonymous?: boolean;
    quickTags?: QuickTag[];
    disabled?: boolean;
    submitting?: boolean;
    errorMessage?: string | null;
  }>(),
  {
    initialRating: 0,
    initialBodyText: "",
    initialAnonymous: false,
    quickTags: () => [],
    disabled: false,
    submitting: false,
    errorMessage: null,
  },
);

const emit = defineEmits<{
  submit: [
    payload: {
      rating: number;
      body_text: string;
      quick_tag_ids: string[];
      is_anonymous: boolean;
    },
  ];
  "update:rating": [value: number];
  "update:bodyText": [value: string];
  "update:anonymous": [value: boolean];
}>();

const rating = ref(props.initialRating);
const bodyText = ref(props.initialBodyText);
const anonymous = ref(props.initialAnonymous);
const usedTagIds = ref<Set<string>>(new Set());

const canSubmit = computed(
  () => rating.value >= 1 && rating.value <= 5 && bodyText.value.trim().length >= 20,
);

watch(
  () => props.initialRating,
  (value) => {
    if (value > 0) rating.value = value;
  },
);

watch(
  () => props.initialAnonymous,
  (value) => {
    anonymous.value = value;
  },
);

function setRating(value: number) {
  rating.value = value;
  emit("update:rating", value);
}

function appendTag(tag: QuickTag) {
  const text = (tag.insert_text || tag.label || "").trim();
  if (!text) return;

  const current = bodyText.value.trim();
  bodyText.value = current ? `${current} ${text}` : text;
  usedTagIds.value = new Set([...usedTagIds.value, tag.id]);
  emit("update:bodyText", bodyText.value);
}

function handleSubmit() {
  if (!canSubmit.value || props.disabled || props.submitting) return;
  emit("submit", {
    rating: rating.value,
    body_text: bodyText.value.trim(),
    quick_tag_ids: [...usedTagIds.value],
    is_anonymous: anonymous.value,
  });
}
</script>

<style scoped>
.review-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.review-form__stars {
  display: flex;
  align-items: center;
  gap: 4px;
}

.review-form__star {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  line-height: 0;
}

.review-form__star:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.review-form__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.review-form__tag {
  border: none;
  border-radius: 999px;
  padding: 8px 12px;
  background: #f5f7fa;
  color: #191919;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 13px;
  line-height: 16px;
  cursor: pointer;
}

.review-form__tag--used {
  background: rgba(245, 3, 2, 0.1);
  color: #a90f0e;
}

.review-form__tag:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.review-form__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.review-form__label {
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 13px;
  line-height: 16px;
  color: #5c6470;
}

.review-form__textarea {
  width: 100%;
  min-height: 96px;
  border: 1px solid #e6e9ed;
  border-radius: 16px;
  padding: 12px 14px;
  resize: vertical;
  box-sizing: border-box;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 15px;
  line-height: 20px;
  color: #191919;
  background: #ffffff;
}

.review-form__textarea:focus {
  outline: 2px solid rgba(245, 3, 2, 0.2);
  border-color: rgba(245, 3, 2, 0.45);
}

.review-form__counter {
  align-self: flex-end;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 12px;
  line-height: 14px;
  color: #aab2bd;
}

.review-form__counter--ok {
  color: #16a34a;
}

.review-form__anonymous {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 14px;
  line-height: 17px;
  color: #191919;
}

.review-form__anonymous-input {
  width: 18px;
  height: 18px;
  accent-color: #f50302;
}

.review-form__error {
  margin: 0;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 13px;
  line-height: 17px;
  color: #be123c;
}

.review-form__submit {
  width: 100%;
  min-height: 52px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(106.76deg, #f50302 -2.64%, #a90f0e 85.78%);
  color: #ffffff;
  font-family: "Montserrat", sans-serif;
  font-weight: 600;
  font-size: 15px;
  line-height: 19px;
  cursor: pointer;
}

.review-form__submit:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>