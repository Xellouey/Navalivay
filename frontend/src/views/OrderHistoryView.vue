<template>
  <div class="order-history-page">
    <header class="order-history-header">
      <button type="button" class="order-history-back" aria-label="Назад в профиль" @click="goBack">
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none" aria-hidden="true">
          <path
            d="M6 1L1 6L6 11"
            stroke="#191919"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <h1 class="order-history-title">Мои заказы</h1>
    </header>

    <div class="order-history-container">
      <div v-if="loading && !items.length" class="order-history-state">
        <div class="order-history-loader" aria-hidden="true" />
        <p>Загружаем историю…</p>
      </div>

      <div v-else-if="errorMessage && !items.length" class="order-history-state">
        <p>{{ errorMessage }}</p>
        <button type="button" class="order-history-retry" @click="reload">Повторить</button>
      </div>

      <div v-else-if="!items.length" class="order-history-state">
        <p>Здесь появятся завершённые заказы.</p>
        <button type="button" class="order-history-retry" @click="router.push('/')">
          На главную
        </button>
      </div>

      <ul v-else class="order-history-list">
        <li v-for="order in items" :key="order.id">
          <button type="button" class="order-history-card" @click="openOrder(order.id)">
            <div class="order-history-card__main">
              <div class="order-history-card__icons" aria-hidden="true">
                <div
                  v-for="(icon, index) in order.category_icons"
                  :key="`${order.id}-${icon.category_id || index}`"
                  class="order-history-card__icon"
                  :style="{ zIndex: 4 - index }"
                >
                  <img v-if="icon.image" :src="icon.image" :alt="icon.category_name || ''" />
                  <span v-else class="order-history-card__icon-placeholder" />
                </div>
                <span
                  v-if="order.category_icons_overflow > 0"
                  class="order-history-card__overflow"
                >
                  +{{ order.category_icons_overflow }}
                </span>
              </div>

              <div class="order-history-card__copy">
                <strong>Заказ №{{ order.order_number }}</strong>
                <span>{{ formatOrderDate(order.completed_at || order.created_at) }}</span>
                <span>{{ formatOrderStatus(order.status) }} · {{ formatPrice(order.final_amount) }} BYN</span>
              </div>
            </div>

            <span v-if="order.pending_review_count > 0" class="order-history-card__badge">
              Оценить
            </span>
          </button>
        </li>
      </ul>

      <button
        v-if="nextCursor"
        type="button"
        class="order-history-more"
        :disabled="loadingMore"
        @click="loadMore"
      >
        {{ loadingMore ? "Загружаем…" : "Показать ещё" }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  formatOrderDate,
  formatOrderStatus,
  useCustomerOrders,
  type OrderHistoryItem,
} from "@/composables/useCustomerOrders";

const router = useRouter();
const { fetchOrderHistory } = useCustomerOrders();

const items = ref<OrderHistoryItem[]>([]);
const nextCursor = ref<string | null>(null);
const loading = ref(false);
const loadingMore = ref(false);
const errorMessage = ref<string | null>(null);

async function reload() {
  loading.value = true;
  errorMessage.value = null;

  try {
    const data = await fetchOrderHistory({ limit: 20 });
    items.value = data.items;
    nextCursor.value = data.next_cursor;
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error ? error.message : "Не удалось загрузить историю";
    items.value = [];
    nextCursor.value = null;
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (!nextCursor.value || loadingMore.value) return;
  loadingMore.value = true;

  try {
    const data = await fetchOrderHistory({
      cursor: nextCursor.value,
      limit: 20,
    });
    items.value = [...items.value, ...data.items];
    nextCursor.value = data.next_cursor;
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error ? error.message : "Не удалось загрузить ещё заказы";
  } finally {
    loadingMore.value = false;
  }
}

function openOrder(orderId: string) {
  router.push({ name: "order-detail", params: { orderId } });
}

function goBack() {
  router.push({ name: "profile" });
}

function formatPrice(value: number) {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

onMounted(() => {
  void reload();
});
</script>

<style scoped>
.order-history-page {
  min-height: 100vh;
  background: #f5f7fa;
}

.order-history-header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 12px;
  padding:
    calc(12px + env(safe-area-inset-top, 0px))
    16px
    12px;
  background: rgba(245, 247, 250, 0.96);
  backdrop-filter: blur(12px);
}

.order-history-back {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
}

.order-history-title {
  margin: 0;
  font-family: "Montserrat", sans-serif;
  font-weight: 700;
  font-size: 20px;
  line-height: 24px;
  color: #191919;
}

.order-history-container {
  width: min(393px, 100%);
  margin: 0 auto;
  padding: 8px 16px 24px;
  box-sizing: border-box;
}

.order-history-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 16px;
  text-align: center;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 14px;
  line-height: 18px;
  color: #5c6470;
}

.order-history-loader {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid #e6e9ed;
  border-top-color: #f50302;
  animation: order-history-spin 0.8s linear infinite;
}

@keyframes order-history-spin {
  to {
    transform: rotate(360deg);
  }
}

.order-history-retry,
.order-history-more {
  border: none;
  border-radius: 999px;
  min-height: 44px;
  padding: 0 18px;
  background: #ffffff;
  color: #191919;
  font-family: "Montserrat", sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
}

.order-history-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.order-history-card {
  width: 100%;
  border: none;
  border-radius: 20px;
  background: #ffffff;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
}

.order-history-card__main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.order-history-card__icons {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.order-history-card__icon,
.order-history-card__icon-placeholder {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 2px solid #ffffff;
  margin-left: -10px;
  overflow: hidden;
  background: #f5f7fa;
}

.order-history-card__icon:first-child,
.order-history-card__icon-placeholder:first-child {
  margin-left: 0;
}

.order-history-card__icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.order-history-card__overflow {
  margin-left: 6px;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 12px;
  line-height: 14px;
  color: #8a93a0;
}

.order-history-card__copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.order-history-card__copy strong {
  font-family: "Montserrat", sans-serif;
  font-size: 15px;
  line-height: 19px;
  color: #191919;
}

.order-history-card__copy span {
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 13px;
  line-height: 16px;
  color: #8a93a0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.order-history-card__badge {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 6px 10px;
  background: rgba(245, 3, 2, 0.1);
  color: #a90f0e;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 12px;
  line-height: 14px;
  font-weight: 600;
}

.order-history-more {
  width: 100%;
  margin-top: 12px;
}

@media (max-width: 360px) {
  .order-history-container {
    padding-inline: 12px;
  }
}
</style>