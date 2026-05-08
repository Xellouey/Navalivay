<template>
  <section class="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 shadow-sm">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1">
        <h3 class="flex items-center gap-2 text-sm font-semibold text-blue-900">
          <span class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white" aria-hidden="true">B</span>
          Уведомить клиента через бота
        </h3>
        <p class="text-xs text-blue-900/70">
          Сообщение уйдёт от имени менеджера в Telegram-Business чате с клиентом. Тексты редактируются в Настройках → Бот.
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
      <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="space-y-1 text-xs font-medium text-blue-900">
          Событие
          <select
            v-model="selectedEvent"
            class="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
            @change="loadPreview"
          >
            <option v-for="opt in eventOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </label>
        <div class="flex items-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-800 transition hover:bg-blue-100"
            :disabled="loadingPreview"
            @click="loadPreview"
          >
            {{ loadingPreview ? 'Готовим…' : 'Показать текст' }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!preview?.ok || sending"
            @click="send"
          >
            {{ sending ? 'Отправляем…' : 'Отправить клиенту' }}
          </button>
        </div>
      </div>

      <div v-if="preview" class="mt-3">
        <p v-if="!preview.ok" class="rounded-md bg-amber-100/70 px-3 py-2 text-xs text-amber-900">
          {{ previewErrorMessage(preview.reason) }}
        </p>
        <pre
          v-else
          class="whitespace-pre-wrap rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs text-gray-800"
        >{{ preview.text }}</pre>
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
import { computed, onMounted, ref, watch } from "vue";

interface Props {
  orderId: string;
  orderStatus?: string;
}

const props = defineProps<Props>();

interface BotStatus {
  bot_token_configured: boolean;
  bot_token_live: boolean;
  bot_token_error: string | null;
  bot_process_online: boolean;
  active_connection: { id: string; username: string | null } | null;
  status_templates: Array<{ event: string; title: string; is_active: 0 | 1 }>;
}

interface PreviewPayload {
  ok: boolean;
  reason?: string;
  text?: string;
  chatId?: string;
  templateEvent?: string;
}

const status = ref<BotStatus | null>(null);
const loadingStatus = ref(false);
const selectedEvent = ref<string>("order_assembled");
const preview = ref<PreviewPayload | null>(null);
const loadingPreview = ref(false);
const sending = ref(false);
const message = ref<string>("");
const messageVariant = ref<"success" | "error">("success");

const STATUS_EVENT_LABELS: Record<string, string> = {
  order_assembled: "Заказ собран",
  order_issued: "Заказ выдан",
  order_cancelled: "Заказ отменён",
  price_list: "Прайс с кодом доступа",
  welcome: "Приветствие",
};

const eventOptions = computed(() => {
  if (!status.value) return [];
  return status.value.status_templates
    .filter((t) => t.is_active === 1)
    .map((t) => ({
      value: t.event,
      label: STATUS_EVENT_LABELS[t.event] || t.title || t.event,
    }));
});

const botAvailable = computed(() => {
  if (!status.value) return false;
  if (!status.value.bot_token_configured) return false;
  if (!status.value.bot_token_live) return false;
  if (!status.value.active_connection) return false;
  return eventOptions.value.length > 0;
});

const unavailabilityMessage = computed(() => {
  if (!status.value) return "";
  if (!status.value.bot_token_configured) {
    return "Не указан токен бота. Попросите администратора прописать его на сервере и перезапустить бота.";
  }
  if (!status.value.bot_token_live) {
    const reason = status.value.bot_token_error;
    return reason
      ? `Telegram не принял токен бота. Причина: ${reason}. Обновите токен и перезапустите бота.`
      : "Telegram не принял токен бота. Обновите токен и перезапустите бота.";
  }
  if (!status.value.active_connection) {
    return "Бот не подключён к менеджерскому аккаунту. Подключите его в Telegram: Настройки → Деловой режим → Чат-боты.";
  }
  if (!eventOptions.value.length) {
    return "Нет активных шаблонов событий. Включите хотя бы один в Настройках бота.";
  }
  return "Бот сейчас недоступен.";
});

function previewErrorMessage(reason: string | undefined): string {
  switch (reason) {
    case "order_not_found":
      return "Заказ не найден.";
    case "order_has_no_customer":
      return "К заказу не привязан клиент. Некому слать сообщение.";
    case "customer_has_no_telegram_id":
      return "У клиента нет telegram_id. Не сможем найти его в Business-чате.";
    case "template_inactive_or_missing":
      return "Шаблон для этого события не активен. Включите в Настройках.";
    case "invalid_event":
      return "Неизвестное событие.";
    case "template_empty":
      return "Шаблон пустой. Заполните текст в Настройках → Бот.";
    default:
      if (reason && reason.startsWith("http_")) {
        return `Ошибка ${reason.replace("http_", "HTTP ")}. Попробуйте обновить страницу.`;
      }
      return reason || "Не удалось подготовить сообщение.";
  }
}

function pickDefaultEventByStatus(status: string | undefined) {
  switch (status) {
    case "in_progress":
      return "order_assembled";
    case "completed":
    case "delivered":
      return "order_issued";
    case "cancelled":
      return "order_cancelled";
    default:
      return "order_assembled";
  }
}

async function fetchStatus() {
  loadingStatus.value = true;
  try {
    const response = await fetch("/api/admin/crm/bot/status", { credentials: "include" });
    if (!response.ok) throw new Error("Не удалось загрузить статус бота");
    status.value = (await response.json()) as BotStatus;
    const initial = pickDefaultEventByStatus(props.orderStatus);
    const exists = status.value.status_templates.find(
      (t) => t.event === initial && t.is_active === 1,
    );
    selectedEvent.value = exists
      ? initial
      : status.value.status_templates.find((t) => t.is_active === 1)?.event ||
        initial;
  } catch (err) {
    message.value = err instanceof Error ? err.message : String(err);
    messageVariant.value = "error";
  } finally {
    loadingStatus.value = false;
  }
}

async function loadPreview() {
  if (!props.orderId || !selectedEvent.value) return;
  loadingPreview.value = true;
  message.value = "";
  try {
    const response = await fetch("/api/admin/crm/bot/notify-status/preview", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: props.orderId, event: selectedEvent.value }),
    });
    if (!response.ok) {
      // Эндпоинт отвечает 200 даже когда prepared.ok=false; 4xx/5xx
      // случаются если протух авторизация или упал бэк. Превращаем в
      // понятную причину для UI вместо тихого «не удалось подготовить».
      preview.value = { ok: false, reason: `http_${response.status}` };
      return;
    }
    preview.value = (await response.json()) as PreviewPayload;
  } catch (err) {
    preview.value = { ok: false, reason: err instanceof Error ? err.message : String(err) };
  } finally {
    loadingPreview.value = false;
  }
}

async function send() {
  if (!preview.value?.ok) {
    await loadPreview();
    if (!preview.value?.ok) return;
  }
  sending.value = true;
  message.value = "";
  try {
    const response = await fetch("/api/admin/crm/bot/notify-status", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: props.orderId, event: selectedEvent.value }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errorCode = (data as { error?: string }).error;
      throw new Error(
        errorCode === "no_active_connection"
          ? "Бот не подключён к менеджерскому аккаунту. Подключите его в Telegram: Настройки → Деловой режим → Чат-боты."
          : errorCode === "send_failed"
            ? "Telegram не принял сообщение. Смотрите подробности в журнале бота."
            : (data as { message?: string }).message || `Ошибка ${response.status}`,
      );
    }
    message.value = "Сообщение отправлено клиенту.";
    messageVariant.value = "success";
  } catch (err) {
    message.value = err instanceof Error ? err.message : String(err);
    messageVariant.value = "error";
  } finally {
    sending.value = false;
  }
}

watch(
  () => props.orderStatus,
  (next) => {
    const guess = pickDefaultEventByStatus(next);
    if (status.value?.status_templates.find((t) => t.event === guess && t.is_active === 1)) {
      selectedEvent.value = guess;
      preview.value = null;
    }
  },
);

onMounted(() => {
  fetchStatus();
});
</script>
