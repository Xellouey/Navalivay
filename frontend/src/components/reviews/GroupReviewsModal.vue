<template>
  <CustomerModalShell
    :open="open"
    :title="modalTitle"
    reserve-tab-bar
    max-width="361px"
    @close="emit('close')"
  >
    <div v-if="loading" class="group-reviews-modal__state">
      <div class="group-reviews-modal__loader" aria-hidden="true" />
      <p>Загружаем отзывы…</p>
    </div>

    <div v-else-if="errorMessage" class="group-reviews-modal__state">
      <p>{{ errorMessage }}</p>
    </div>

    <div v-else-if="!items.length" class="group-reviews-modal__state">
      <p>Пока нет опубликованных отзывов.</p>
    </div>

    <ul v-else class="group-reviews-modal__list">
      <li v-for="review in items" :key="review.id" class="group-reviews-modal__item">
        <div class="group-reviews-modal__item-head">
          <div class="group-reviews-modal__reviewer">
            <img
              v-if="review.reviewer.photo_url"
              :src="review.reviewer.photo_url"
              :alt="review.reviewer.display_name"
              class="group-reviews-modal__avatar"
            />
            <div v-else class="group-reviews-modal__avatar group-reviews-modal__avatar--placeholder">
              {{ review.reviewer.display_name.charAt(0) }}
            </div>
            <div>
              <strong>{{ review.reviewer.display_name }}</strong>
              <p v-if="review.purchased_variant_name" class="group-reviews-modal__variant">
                {{ review.purchased_variant_name }}
              </p>
            </div>
          </div>
          <div class="group-reviews-modal__stars" aria-hidden="true">
            <span v-for="star in 5" :key="star">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3.5L14.9 9.3L21.2 10.2L16.6 14.6L17.8 21L12 18.1L6.2 21L7.4 14.6L2.8 10.2L9.1 9.3L12 3.5Z"
                  :fill="star <= review.rating ? '#F50302' : 'transparent'"
                  :stroke="star <= review.rating ? '#F50302' : '#D8DDE4'"
                  stroke-width="1.4"
                />
              </svg>
            </span>
          </div>
        </div>

        <p class="group-reviews-modal__body">{{ review.body_text }}</p>

        <div v-if="review.quick_tag_labels.length" class="group-reviews-modal__tags">
          <span v-for="tag in review.quick_tag_labels" :key="tag" class="group-reviews-modal__tag">
            {{ tag }}
          </span>
        </div>

        <p class="group-reviews-modal__date">{{ formatOrderDateTime(review.created_at) }}</p>

        <div v-if="review.manager_reply" class="group-reviews-modal__reply">
          <div class="group-reviews-modal__reply-head">
            <img
              v-if="managerBlock?.avatar_url"
              :src="managerBlock.avatar_url"
              :alt="managerBlock.display_name"
              class="group-reviews-modal__reply-avatar"
            />
            <strong>{{ managerBlock?.display_name || "Ответ магазина" }}</strong>
          </div>
          <p>{{ review.manager_reply }}</p>
        </div>
      </li>
    </ul>
  </CustomerModalShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import CustomerModalShell from "@/components/CustomerModalShell.vue";
import {
  formatOrderDateTime,
  useCustomerOrders,
  type GroupReviewItem,
  type ManagerReviewBlock,
} from "@/composables/useCustomerOrders";

const props = defineProps<{
  open: boolean;
  groupId: string;
  groupName?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { fetchGroupReviews } = useCustomerOrders();

const loading = ref(false);
const errorMessage = ref<string | null>(null);
const items = ref<GroupReviewItem[]>([]);
const reviewCount = ref(0);
const managerBlock = ref<ManagerReviewBlock | null>(null);

const modalTitle = computed(() => {
  const name = props.groupName?.trim();
  const countSuffix =
    reviewCount.value > 0 ? ` (${reviewCount.value})` : "";
  if (name) return `Отзывы · ${name}${countSuffix}`;
  return reviewCount.value > 0 ? `Отзывы (${reviewCount.value})` : "Отзывы";
});

async function loadReviews() {
  if (!props.groupId) return;
  loading.value = true;
  errorMessage.value = null;

  try {
    const data = await fetchGroupReviews(props.groupId, { limit: 30, offset: 0 });
    items.value = data.items;
    reviewCount.value = data.review_count;
    managerBlock.value = data.manager || null;
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error ? error.message : "Не удалось загрузить отзывы";
    items.value = [];
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.open, props.groupId] as const,
  ([isOpen]) => {
    if (isOpen) void loadReviews();
  },
  { immediate: true },
);
</script>

<style scoped>
.group-reviews-modal__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  text-align: center;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 14px;
  line-height: 18px;
  color: #5c6470;
}

.group-reviews-modal__loader {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid #e6e9ed;
  border-top-color: #f50302;
  animation: group-reviews-spin 0.8s linear infinite;
}

@keyframes group-reviews-spin {
  to {
    transform: rotate(360deg);
  }
}

.group-reviews-modal__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.group-reviews-modal__item {
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f2f5;
}

.group-reviews-modal__item:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.group-reviews-modal__item-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.group-reviews-modal__reviewer {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.group-reviews-modal__reviewer strong {
  display: block;
  font-family: "Montserrat", sans-serif;
  font-size: 14px;
  line-height: 18px;
  color: #191919;
}

.group-reviews-modal__avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.group-reviews-modal__avatar--placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  color: #5c6470;
  font-family: "Montserrat", sans-serif;
  font-weight: 700;
  font-size: 14px;
}

.group-reviews-modal__variant {
  margin: 2px 0 0;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 12px;
  line-height: 15px;
  color: #8a93a0;
}

.group-reviews-modal__stars {
  display: inline-flex;
  gap: 1px;
  flex-shrink: 0;
}

.group-reviews-modal__body {
  margin: 10px 0 0;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 15px;
  line-height: 20px;
  color: #191919;
}

.group-reviews-modal__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.group-reviews-modal__tag {
  border-radius: 999px;
  padding: 4px 10px;
  background: #f5f7fa;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 12px;
  line-height: 14px;
  color: #5c6470;
}

.group-reviews-modal__date {
  margin: 8px 0 0;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 12px;
  line-height: 14px;
  color: #aab2bd;
}

.group-reviews-modal__reply {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: #f5f7fa;
}

.group-reviews-modal__reply-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.group-reviews-modal__reply-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.group-reviews-modal__reply-head strong {
  font-family: "Montserrat", sans-serif;
  font-size: 13px;
  line-height: 16px;
  color: #191919;
}

.group-reviews-modal__reply p {
  margin: 0;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 14px;
  line-height: 18px;
  color: #5c6470;
}
</style>