<template>
  <CustomerModalShell
    :open="phase !== 'hidden'"
    :title="modalTitle"
    :closable="false"
    :close-disabled="true"
  >
    <div v-if="phase === 'checking'" class="referral-gate__status" aria-live="polite">
      <span class="referral-gate__spinner" aria-hidden="true"></span>
      <p>Проверяем ваш доступ…</p>
    </div>

    <div v-else-if="phase === 'error'" class="referral-gate__status" aria-live="polite">
      <p class="referral-gate__error" role="alert">{{ errorMessage }}</p>
    </div>

    <form
      v-else-if="phase === 'required'"
      id="referral-authorization-form"
      class="referral-gate"
      @submit.prevent="submit"
    >
      <p class="referral-gate__copy">Чтобы посмотреть цены, укажите клиента, который вас пригласил.</p>
      <label class="referral-gate__label" for="global-referral-username">
        Username пригласившего
      </label>
      <div class="referral-gate__input-wrap">
        <span aria-hidden="true">@</span>
        <input
          id="global-referral-username"
          ref="inputRef"
          v-model.trim="inviterUsername"
          class="referral-gate__input"
          type="text"
          inputmode="text"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          placeholder="username"
          :disabled="submitting"
          aria-describedby="global-referral-feedback"
          @input="handleInput"
        />
      </div>
      <div id="global-referral-feedback" aria-live="polite">
        <p v-if="errorMessage" class="referral-gate__error" role="alert">{{ errorMessage }}</p>
        <p class="referral-gate__attempts">Осталось попыток: {{ attemptsRemaining }}</p>
      </div>
    </form>

    <template #footer>
      <button
        v-if="phase === 'required'"
        form="referral-authorization-form"
        type="submit"
        class="referral-gate__cta"
        :disabled="submitting || !inviterUsername.trim()"
      >
        {{ submitting ? "Проверяем…" : "Пройти авторизацию" }}
      </button>
      <button
        v-else-if="phase === 'error'"
        ref="retryButtonRef"
        type="button"
        class="referral-gate__cta"
        @click="handleRetry"
      >
        Повторить
      </button>
    </template>
  </CustomerModalShell>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import CustomerModalShell from "@/components/CustomerModalShell.vue";
import { useCustomerBlock } from "@/composables/useCustomerBlock";
import { getTelegramIdentity } from "@/utils/customerOrders";
import { getTelegramInitData, withTelegramAuthHeaders } from "@/utils/telegramAuth";

type GatePhase = "hidden" | "checking" | "required" | "error";

const emit = defineEmits<{
  authorized: [];
  "gate-active": [active: boolean];
}>();
const { applyBlockFromResponse } = useCustomerBlock();
const phase = ref<GatePhase>("checking");
const inviterUsername = ref("");
const errorMessage = ref("");
const attemptsRemaining = ref(3);
const submitting = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);
const retryButtonRef = ref<HTMLButtonElement | null>(null);

const modalTitle = computed(() => {
  if (phase.value === "checking") return "Проверяем доступ";
  if (phase.value === "error") return "Не удалось проверить доступ";
  return "Кто порекомендовал нас?";
});

async function refreshStatus() {
  const identity = getTelegramIdentity();
  if (!getTelegramInitData() || !identity.telegramId) {
    errorMessage.value = "Откройте приложение через Telegram, чтобы пройти авторизацию.";
    phase.value = "error";
    return;
  }
  phase.value = "checking";
  errorMessage.value = "";
  try {
    if (!identity.telegramUsername) {
      const usernameResponse = await fetch("/api/telegram/username-status", {
        headers: withTelegramAuthHeaders(),
        credentials: "include",
      });
      const usernameStatus = await usernameResponse.json().catch(() => ({}));
      if (usernameResponse.status === 401) {
        errorMessage.value = "Сессия Telegram устарела. Закройте и заново откройте магазин.";
        phase.value = "error";
        return;
      }
      if (!usernameResponse.ok) {
        throw new Error("Не удалось проверить username. Проверьте интернет и повторите.");
      }
      if (usernameStatus?.status === "missing") {
        errorMessage.value = "Установите имя пользователя @username в настройках Telegram";
        phase.value = "error";
        return;
      }
      if (!usernameStatus?.hasUsername) {
        errorMessage.value = usernameStatus?.message
          || "Не удалось получить обновлённый username. Попробуйте ещё раз.";
        phase.value = "error";
        return;
      }
    }
    const response = await fetch("/api/referral-authorization/status", {
      headers: withTelegramAuthHeaders(),
      credentials: "include",
    });
    if (!response.ok) throw new Error("Не удалось проверить доступ. Проверьте интернет и повторите.");
    const status = await response.json();
    attemptsRemaining.value = Number(status?.attempts_remaining ?? 3);
    if (status?.blocked) {
      applyBlockFromResponse({
        reason: status?.block?.reason ?? "Авторизация не пройдена",
        block_until: status?.block?.block_until ?? null,
      });
      phase.value = "hidden";
      return;
    }
    phase.value = status?.enabled && status?.required ? "required" : "hidden";
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Не удалось проверить доступ";
    phase.value = "error";
  }
}

function handleRetry() {
  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light");
  void refreshStatus();
}

watch(
  phase,
  async (nextPhase) => {
    emit("gate-active", nextPhase !== "hidden");
    await nextTick();
    if (nextPhase === "required") inputRef.value?.focus();
    if (nextPhase === "error") retryButtonRef.value?.focus();
  },
  { immediate: true },
);

function handleInput(event: Event) {
  const input = event.target as HTMLInputElement | null;
  inviterUsername.value = String(input?.value || "").trimStart().replace(/^@+/, "");
  errorMessage.value = "";
}

async function submit() {
  if (submitting.value || !inviterUsername.value.trim()) return;
  submitting.value = true;
  errorMessage.value = "";
  try {
    const response = await fetch("/api/referral-authorization/authorize", {
      method: "POST",
      headers: withTelegramAuthHeaders({ "Content-Type": "application/json" }),
      credentials: "include",
      body: JSON.stringify({ inviter_username: inviterUsername.value.trim() }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      attemptsRemaining.value = Number(result?.attempts_remaining ?? attemptsRemaining.value);
      if (result?.error === "customer_blocked") {
        applyBlockFromResponse(result?.block ?? { reason: "Авторизация не пройдена", block_until: null });
        phase.value = "hidden";
        return;
      }
      errorMessage.value = result?.message || "Не удалось проверить пригласившего";
      return;
    }
    phase.value = "hidden";
    emit("authorized");
  } catch {
    errorMessage.value = "Не удалось проверить доступ. Проверьте интернет и повторите.";
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  window.addEventListener("referral-authorization-required", refreshStatus);
  void refreshStatus();
});

onBeforeUnmount(() => {
  window.removeEventListener("referral-authorization-required", refreshStatus);
});
</script>

<style scoped>
.referral-gate,
.referral-gate__status {
  display: grid;
  gap: 14px;
}

.referral-gate__copy,
.referral-gate__status p,
.referral-gate__attempts,
.referral-gate__error {
  margin: 0;
  font-family: "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 14px;
  line-height: 20px;
}

.referral-gate__copy {
  color: #626975;
}

.referral-gate__label {
  font-family: "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: #30343b;
}

.referral-gate__input-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 58px;
  padding: 0 18px;
  border: 1px solid #d8dce2;
  border-radius: 18px;
  background: #fff;
  color: #737b87;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.referral-gate__input-wrap:focus-within {
  border-color: #f50302;
  box-shadow: 0 0 0 3px rgba(245, 3, 2, 0.1);
}

.referral-gate__input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  font: inherit;
  font-size: 16px;
  color: #191919;
}

.referral-gate__error {
  margin-top: 10px;
  color: #b42318;
}

.referral-gate__attempts {
  margin-top: 6px;
  color: #7a828e;
}

.referral-gate__cta {
  width: 100%;
  min-height: 54px;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(106.76deg, #f50302 -2.64%, #a90f0e 85.78%);
  color: #fff;
  font-family: "Montserrat", sans-serif;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.16s ease, opacity 0.16s ease;
}

.referral-gate__cta:active:not(:disabled) {
  transform: scale(0.985);
}

.referral-gate__cta:disabled {
  cursor: wait;
  opacity: 0.58;
}

.referral-gate__status {
  justify-items: center;
  padding: 10px 0 2px;
  color: #626975;
  text-align: center;
}

.referral-gate__spinner {
  width: 26px;
  height: 26px;
  border: 3px solid #eceff3;
  border-top-color: #d20a09;
  border-radius: 50%;
  animation: referral-gate-spin 0.75s linear infinite;
}

@keyframes referral-gate-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .referral-gate__spinner { animation-duration: 1.5s; }
  .referral-gate__cta { transition: none; }
}
</style>
