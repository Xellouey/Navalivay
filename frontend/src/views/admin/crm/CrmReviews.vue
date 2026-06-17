<template>
  <div class="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
    <div class="mx-auto w-full max-w-7xl space-y-8">
      <div class="flex flex-col gap-3">
        <button
          class="inline-flex w-fit items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
          @click="$router.push('/admin/crm/orders')"
        >
          Назад к заказам
        </button>

        <div>
          <h1 class="text-2xl font-bold text-gray-900 sm:text-3xl">Отзывы</h1>
          <p class="mt-2 text-sm text-gray-600">Модерация, быстрые теги и розыгрыш</p>
        </div>
      </div>

      <section class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 class="text-lg font-semibold text-gray-900">Настройки</h2>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <label class="block text-sm">
            <span class="font-medium text-gray-700">Кулдаун (дней)</span>
            <input
              v-model.number="settings.cooldown_days"
              type="number"
              min="1"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <label class="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input v-model="settings.dev_test_mode" type="checkbox" />
            Тестовый режим отзывов
          </label>
        </div>
        <label class="mt-4 block text-sm">
          <span class="font-medium text-gray-700">Текст про подарки</span>
          <input
            v-model="settings.lottery_hint_text"
            type="text"
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <button
          class="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          @click="saveSettings"
        >
          Сохранить настройки
        </button>
      </section>

      <section class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold text-gray-900">
            На модерации
            <span v-if="pendingCount" class="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
              {{ pendingCount }}
            </span>
          </h2>
          <button
            class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            @click="loadReviews"
          >
            Обновить
          </button>
        </div>

        <div v-if="loading" class="py-8 text-center text-gray-500">Загрузка...</div>
        <div v-else-if="pendingReviews.length === 0" class="py-8 text-center text-gray-500">
          Новых отзывов нет
        </div>
        <div v-else class="mt-4 space-y-4">
          <article
            v-for="review in pendingReviews"
            :key="review.id"
            class="rounded-lg border border-gray-200 p-4"
          >
            <div class="flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <strong class="text-gray-900">Заказ №{{ review.order_number }}</strong>
              <span>{{ review.group_name }}</span>
              <span>{{ "★".repeat(review.rating) }}</span>
            </div>
            <p class="mt-2 whitespace-pre-wrap text-sm text-gray-800">{{ review.body_text }}</p>
            <p class="mt-1 text-xs text-gray-500">
              {{ review.first_name }} @{{ review.telegram_username || "—" }}
              <span v-if="review.purchased_variant_name">· {{ review.purchased_variant_name }}</span>
            </p>
            <div class="mt-3 flex gap-2">
              <button
                class="rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
                @click="moderate(review.id, 'approve')"
              >
                Одобрить
              </button>
              <button
                class="rounded-md bg-gray-700 px-3 py-1.5 text-sm text-white hover:bg-gray-800"
                @click="moderate(review.id, 'reject')"
              >
                Отклонить
              </button>
            </div>
          </article>
        </div>
      </section>

      <section class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold text-gray-900">Розыгрыш месяца</h2>
          <button
            class="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            @click="runDraw"
          >
            Запустить розыгрыш
          </button>
        </div>
        <div v-if="draws.length" class="mt-4 space-y-3">
          <article
            v-for="draw in draws"
            :key="draw.id"
            class="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm"
          >
            <p class="font-medium text-gray-900">{{ draw.period_key }}</p>
            <ul class="mt-2 space-y-1 text-gray-700">
              <li v-for="winner in draw.winners" :key="winner.id">
                Место {{ winner.seat_number }}:
                @{{ winner.telegram_username || winner.first_name || winner.customer_id }}
                <button
                  class="ml-2 text-blue-600 hover:underline"
                  @click="reroll(draw.id, winner.seat_number)"
                >
                  Переразыграть
                </button>
              </li>
            </ul>
          </article>
        </div>
        <p v-else class="mt-4 text-sm text-gray-500">Розыгрышей пока нет</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useAdminStore } from "@/stores/admin";

const adminStore = useAdminStore();
const loading = ref(false);
const pendingCount = ref(0);
const pendingReviews = ref<any[]>([]);
const draws = ref<any[]>([]);
const settings = ref({
  cooldown_days: 90,
  lottery_hint_text: "",
  dev_test_mode: false,
  manager_display_name: "Manager Rezonsky",
});

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminStore.token}`,
  };
}

async function loadSettings() {
  const response = await fetch("/api/admin/crm/review-settings", { headers: authHeaders() });
  if (response.ok) {
    settings.value = await response.json();
  }
}

async function saveSettings() {
  await fetch("/api/admin/crm/review-settings", {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(settings.value),
  });
  await loadSettings();
}

async function loadReviews() {
  loading.value = true;
  try {
    const [listRes, countRes, drawsRes] = await Promise.all([
      fetch("/api/admin/crm/product-reviews?status=pending", { headers: authHeaders() }),
      fetch("/api/admin/crm/product-reviews/pending-count", { headers: authHeaders() }),
      fetch("/api/admin/crm/review-monthly-draws", { headers: authHeaders() }),
    ]);
    if (listRes.ok) {
      const data = await listRes.json();
      pendingReviews.value = data.items || [];
    }
    if (countRes.ok) {
      const data = await countRes.json();
      pendingCount.value = Number(data.count || 0);
    }
    if (drawsRes.ok) {
      const data = await drawsRes.json();
      draws.value = data.items || [];
    }
  } finally {
    loading.value = false;
  }
}

async function moderate(id: string, action: "approve" | "reject") {
  await fetch(`/api/admin/crm/product-reviews/${id}/${action}`, {
    method: "POST",
    headers: authHeaders(),
  });
  await loadReviews();
}

async function runDraw() {
  const response = await fetch("/api/admin/crm/review-monthly-draws/run", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    alert(data?.error || "Не удалось запустить розыгрыш");
    return;
  }
  await loadReviews();
}

async function reroll(drawId: string, seatNumber: number) {
  const response = await fetch(`/api/admin/crm/review-monthly-draws/${drawId}/reroll`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ seat_number: seatNumber }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    alert(data?.error || "Не удалось переразыграть");
    return;
  }
  await loadReviews();
}

onMounted(async () => {
  await Promise.all([loadSettings(), loadReviews()]);
});
</script>