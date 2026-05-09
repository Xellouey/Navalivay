<template>
  <section class="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 shadow-sm">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1">
        <h3 class="flex items-center gap-2 text-sm font-semibold text-blue-900">
          <span class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white" aria-hidden="true">B</span>
          Написать клиенту
        </h3>
        <p class="text-xs text-blue-900/70">
          Свободное сообщение в чат. Уведомления о статусе уходят автоматически.
        </p>
      </div>
      <button
        v-if="!loadingStatus && !botAvailable"
        type="button"
        class="rounded-md border border-blue-300 bg-white px-2.5 py-1 text-xs font-medium text-blue-800 transition hover:bg-blue-100"
        @click="fetchStatus"
      >Обновить</button>
    </div>

    <p v-if="loadingStatus" class="mt-3 text-xs text-blue-700">Проверяем подключение бота…</p>
    <p v-else-if="!botAvailable" class="mt-3 rounded-md bg-amber-100/70 px-3 py-2 text-xs text-amber-900">
      {{ unavailabilityMessage }}
    </p>
    <template v-else>
      <textarea
        v-model="customText"
        class="mt-3 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
        rows="3"
        :maxlength="4000"
        placeholder="Привет! Твой вкус Pineapple Ice уже в наличии, забронировали на сегодня до 21:00."
      />
      <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span class="text-[11px] text-blue-900/60">{{ customText.length }} / 4000</span>
        <button
          type="button"
          class="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!customText.trim() || sending"
          @click="send"
        >
          {{ sending ? 'Отправляем…' : 'Отправить клиенту' }}
        </button>
      </div>

      <p
        v-if="message"
        class="mt-3 rounded-md px-3 py-2 text-xs"
        :class="messageVariant === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'"
      >{{ message }}</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from "vue";

interface Props {
  orderId: string;
}

const props = defineProps<Props>();

interface BotStatus {
  bot_token_configured: boolean;
  bot_token_live: boolean;
  bot_token_error: string | null;
  bot_process_online: boolean;
  active_connection: { id: string; username: string | null } | null;
}

const status = ref<BotStatus | null>(null);
const loadingStatus = ref(false);
const customText = ref<string>("");
const sending = ref(false);
const message = ref<string>("");
const messageVariant = ref<"success" | "error">("success");

const botAvailable = computed(() => {
  if (!status.value) return false;
  if (!status.value.bot_token_configured) return false;
  if (!status.value.bot_token_live) return false;
  if (!status.value.active_connection) return false;
  return true;
});

const unavailabilityMessage = computed(() => {
  if (!status.value) return "";
  if (!status.value.bot_token_configured) return "Нет токена бота.";
  if (!status.value.bot_token_live) return "Токен не принят.";
  if (!status.value.active_connection) return "Бот не подключён.";
  return "Бот недоступен.";
});

async function fetchStatus() {
  loadingStatus.value = true;
  try {
    const response = await fetch("/api/admin/crm/bot/status", { credentials: "include" });
    if (!response.ok) throw new Error("Не удалось загрузить статус бота");
    status.value = (await response.json()) as BotStatus;
  } catch (err) {
    message.value = err instanceof Error ? err.message : String(err);
    messageVariant.value = "error";
  } finally {
    loadingStatus.value = false;
  }
}

async function send() {
  const text = customText.value.trim();
  if (!text) return;
  sending.value = true;
  message.value = "";
  try {
    const response = await fetch("/api/admin/crm/bot/send-custom", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: props.orderId, text }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errorCode = (data as { error?: string }).error;
      throw new Error(messageFromError(errorCode, response.status, data));
    }
    message.value = "Сообщение отправлено клиенту.";
    messageVariant.value = "success";
    customText.value = "";
  } catch (err) {
    message.value = err instanceof Error ? err.message : String(err);
    messageVariant.value = "error";
  } finally {
    sending.value = false;
  }
}

function messageFromError(code: string | undefined, httpStatus: number, data: unknown): string {
  switch (code) {
    case "text_required":
      return "Введите текст.";
    case "text_too_long":
      return "Слишком длинное сообщение.";
    case "no_active_connection":
      return "Бот не подключён.";
    case "customer_has_no_telegram_id":
      return "У клиента нет Telegram.";
    case "order_not_found":
      return "Заказ не найден.";
    case "send_failed":
      return "Telegram не принял сообщение.";
    default:
      return (data as { message?: string })?.message || `Ошибка ${httpStatus}`;
  }
}

onMounted(() => {
  fetchStatus();
});
</script>
