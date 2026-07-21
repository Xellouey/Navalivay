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
        <input
          id="global-referral-username"
          ref="inputRef"
          class="referral-gate__input"
          type="text"
          inputmode="text"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          placeholder="@username или username"
          aria-describedby="global-referral-feedback"
          @pointerdown="handleInputPointerDown"
          @pointercancel="handleInputPointerCancel"
          @focus="handleInputFocus"
          @blur="handleInputBlur"
          @beforeinput="handleBeforeInput"
          @input="handleInput"
          @paste="handlePaste"
        />
      </div>
      <div id="global-referral-feedback" aria-live="polite">
        <p v-if="errorMessage" class="referral-gate__error" role="alert">{{ errorMessage }}</p>
        <p class="referral-gate__attempts">Осталось попыток: {{ attemptsRemaining }}</p>
      </div>
    </form>

    <template #footer>
      <div class="referral-gate__actions">
        <button
          v-if="phase === 'required'"
          ref="submitButtonRef"
          form="referral-authorization-form"
          type="submit"
          class="referral-gate__cta"
          :disabled="submitting"
        >
          {{ submitting ? "Проверяем…" : "Пройти авторизацию" }}
        </button>
        <template v-else-if="phase === 'error'">
          <button
            ref="retryButtonRef"
            type="button"
            class="referral-gate__cta"
            @click="handleRetry"
          >
            Повторить
          </button>
          <button
            v-if="canCloseMiniApp"
            type="button"
            class="referral-gate__close-app"
            @click="closeMiniApp"
          >
            Закрыть магазин
          </button>
        </template>
        <button
          v-else-if="phase === 'checking' && canCloseMiniApp"
          type="button"
          class="referral-gate__close-app"
          @click="closeMiniApp"
        >
          Закрыть магазин
        </button>
      </div>
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
type InputDiagnosticEvent = {
  name: string;
  at_ms: number;
  active: string;
  related?: string;
  input_type?: string;
  composing?: boolean;
  connected: boolean;
  inner_height: number;
  visual_height: number | null;
};

const USERNAME_RETRY_DELAYS_MS = [0, 1200, 2400, 4000] as const;
const USERNAME_RETRY_TIMEOUT_MS = 16000;
const STATUS_CHECK_TIMEOUT_MS = 14000;
const ANDROID_INPUT_REFOCUS_DELAY_MS = 100;
const ANDROID_INPUT_INTENT_TIMEOUT_MS = 800;

const emit = defineEmits<{
  authorized: [];
  "gate-active": [active: boolean];
}>();
const { applyBlockFromResponse } = useCustomerBlock();
const phase = ref<GatePhase>("checking");
const errorMessage = ref("");
const attemptsRemaining = ref(3);
const submitting = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);
const submitButtonRef = ref<HTMLButtonElement | null>(null);
const retryButtonRef = ref<HTMLButtonElement | null>(null);
let refreshRunId = 0;
let activeRefreshController: AbortController | null = null;
let submittedInputValue = "";
let androidInputFocusIntent: HTMLInputElement | null = null;
let androidInputFocusReadyFor: HTMLInputElement | null = null;
let androidInputFocusPendingFor: HTMLInputElement | null = null;
let androidInputFocusTimer: number | null = null;
let androidInputFocusIntentTimer: number | null = null;
const inputDiagnosticStartedAt = performance.now();
const inputDiagnosticSessionId = globalThis.crypto?.randomUUID?.()
  ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const inputDiagnosticEvents: InputDiagnosticEvent[] = [];
let inputDiagnosticReportTimer: number | null = null;
let inputDiagnosticHasInput = false;
let inputDiagnosticSent = false;

const modalTitle = computed(() => {
  if (phase.value === "checking") return "Проверяем доступ";
  if (phase.value === "error") return "Не удалось проверить доступ";
  return "Кто порекомендовал нас?";
});

const canCloseMiniApp = computed(() => typeof window.Telegram?.WebApp?.close === "function");
const isTelegramAndroid = computed(() => {
  const platform = String(window.Telegram?.WebApp?.platform || "").toLowerCase();
  return platform === "android" || /android/i.test(window.navigator.userAgent);
});

function wait(ms: number, signal: AbortSignal) {
  return new Promise<boolean>((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolve(true);
    }, ms);
    function handleAbort() {
      window.clearTimeout(timer);
      resolve(false);
    }
    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

async function checkLiveUsername(runId: number, retryUntilUpdated: boolean, signal: AbortSignal) {
  const delays = retryUntilUpdated ? USERNAME_RETRY_DELAYS_MS : [0];
  let lastStatus: Record<string, unknown> = {};

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    const delay = delays[attempt] ?? 0;
    if (delay > 0 && !await wait(delay, signal)) return false;
    if (runId !== refreshRunId || signal.aborted) return false;

    const cacheBuster = `${Date.now()}-${attempt}`;
    const usernameResponse = await fetch(`/api/telegram/username-status?check=${cacheBuster}`, {
      headers: withTelegramAuthHeaders(),
      credentials: "include",
      cache: "no-store",
      signal,
    });
    const usernameStatus = await usernameResponse.json().catch(() => ({}));
    if (runId !== refreshRunId) return false;
    if (usernameResponse.status === 401) {
      errorMessage.value = "Сессия Telegram устарела. Закройте и заново откройте магазин.";
      phase.value = "error";
      return false;
    }
    if (!usernameResponse.ok) {
      throw new Error("Не удалось проверить username. Проверьте интернет и повторите.");
    }
    if (usernameStatus?.hasUsername) return true;
    lastStatus = usernameStatus;
  }

  if (retryUntilUpdated) {
    errorMessage.value = "Telegram ещё не обновил username. Подождите 10–20 секунд и повторите проверку.";
  } else if (lastStatus?.status === "missing") {
    errorMessage.value = "Установите имя пользователя @username в настройках Telegram";
  } else {
    errorMessage.value = String(lastStatus?.message || "Не удалось получить обновлённый username. Попробуйте ещё раз.");
  }
  phase.value = "error";
  return false;
}

async function refreshStatus(options: { retryUsername?: boolean } = {}) {
  const runId = ++refreshRunId;
  activeRefreshController?.abort();
  const controller = new AbortController();
  activeRefreshController = controller;
  const timeout = window.setTimeout(
    () => controller.abort(),
    options.retryUsername ? USERNAME_RETRY_TIMEOUT_MS : STATUS_CHECK_TIMEOUT_MS,
  );
  const identity = getTelegramIdentity();
  if (!getTelegramInitData() || !identity.telegramId) {
    window.clearTimeout(timeout);
    if (activeRefreshController === controller) activeRefreshController = null;
    errorMessage.value = "Откройте приложение через Telegram, чтобы пройти авторизацию.";
    phase.value = "error";
    return;
  }
  phase.value = "checking";
  errorMessage.value = "";
  try {
    if (!identity.telegramUsername) {
      const hasLiveUsername = await checkLiveUsername(
        runId,
        Boolean(options.retryUsername),
        controller.signal,
      );
      if (runId !== refreshRunId) return;
      if (controller.signal.aborted) throw new DOMException("Проверка прервана", "AbortError");
      if (!hasLiveUsername) return;
    }
    const response = await fetch("/api/referral-authorization/status", {
      headers: withTelegramAuthHeaders(),
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
    if (runId !== refreshRunId || controller.signal.aborted) return;
    if (!response.ok) throw new Error("Не удалось проверить доступ. Проверьте интернет и повторите.");
    const status = await response.json();
    if (runId !== refreshRunId || controller.signal.aborted) return;
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
    if (runId !== refreshRunId) return;
    if (controller.signal.aborted) {
      errorMessage.value = "Telegram отвечает дольше обычного. Подождите несколько секунд и повторите проверку.";
      phase.value = "error";
      return;
    }
    errorMessage.value = error instanceof Error ? error.message : "Не удалось проверить доступ";
    phase.value = "error";
  } finally {
    window.clearTimeout(timeout);
    if (activeRefreshController === controller) activeRefreshController = null;
  }
}

function handleRetry() {
  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light");
  void refreshStatus({ retryUsername: true });
}

function handleTelegramActivated() {
  if (phase.value === "error" && !getTelegramIdentity().telegramUsername) {
    void refreshStatus({ retryUsername: true });
  }
}

function closeMiniApp() {
  window.Telegram?.WebApp?.close?.();
}

function handleAuthorizationRequired() {
  void refreshStatus();
}

watch(
  phase,
  async (nextPhase) => {
    emit("gate-active", nextPhase !== "hidden");
    if (nextPhase !== "required") resetAndroidInputFocusWorkaround();
    await nextTick();
    // Android Telegram WebView can create an unstable input connection when a
    // field is focused before a real tap: the keyboard then closes on the
    // first typed character. Let the user's tap establish focus on Android.
    if (nextPhase === "required") {
      if (isTelegramAndroid.value) submitButtonRef.value?.focus({ preventScroll: true });
      else inputRef.value?.focus();
    }
    if (nextPhase === "error") retryButtonRef.value?.focus();
  },
  { immediate: true },
);

function handleBeforeInput(event: InputEvent) {
  recordInputDiagnostic("beforeinput", {
    input_type: event.inputType,
    composing: event.isComposing,
  });
  if (submitting.value) event.preventDefault();
}

function activeElementLabel(element: EventTarget | Element | null = document.activeElement) {
  if (!(element instanceof Element)) return "none";
  const id = element.id ? `#${element.id}` : "";
  return `${element.tagName.toLowerCase()}${id}`.slice(0, 48);
}

function recordInputDiagnostic(
  name: string,
  extra: Partial<Pick<InputDiagnosticEvent, "related" | "input_type" | "composing">> = {},
) {
  if (inputDiagnosticSent || inputDiagnosticEvents.length >= 30) return;
  inputDiagnosticEvents.push({
    name,
    at_ms: Math.round(performance.now() - inputDiagnosticStartedAt),
    active: activeElementLabel(),
    connected: Boolean(inputRef.value?.isConnected),
    inner_height: Math.round(window.innerHeight),
    visual_height: window.visualViewport ? Math.round(window.visualViewport.height) : null,
    ...extra,
  });
}

function sendInputDiagnostic() {
  if (inputDiagnosticSent || !inputDiagnosticHasInput) return;
  inputDiagnosticSent = true;
  if (inputDiagnosticReportTimer !== null) window.clearTimeout(inputDiagnosticReportTimer);
  inputDiagnosticReportTimer = null;
  const telegram = window.Telegram?.WebApp;
  try {
    void Promise.resolve(fetch("/api/referral-authorization/input-diagnostic", {
      method: "POST",
      headers: withTelegramAuthHeaders({ "Content-Type": "application/json" }),
      credentials: "include",
      keepalive: true,
      body: JSON.stringify({
        context: {
          session_id: inputDiagnosticSessionId,
          telegram_platform: telegram?.platform || "",
          telegram_version: telegram?.version || "",
          screen: `${window.screen.width}x${window.screen.height}@${window.devicePixelRatio}`,
        },
        events: inputDiagnosticEvents,
      }),
    })).catch(() => undefined);
  } catch {
    // Диагностика не должна влиять на авторизацию даже при сломанном fetch.
  }
}

function scheduleInputDiagnostic() {
  if (inputDiagnosticSent) return;
  if (inputDiagnosticReportTimer !== null) window.clearTimeout(inputDiagnosticReportTimer);
  inputDiagnosticReportTimer = window.setTimeout(sendInputDiagnostic, 900);
}

function handleInputBlur(event: FocusEvent) {
  recordInputDiagnostic("blur", { related: activeElementLabel(event.relatedTarget) });
  if (inputDiagnosticHasInput) scheduleInputDiagnostic();
}

function handleInputViewportChange() {
  recordInputDiagnostic("viewport_resize");
}

function handleInputVisibilityChange() {
  recordInputDiagnostic(`visibility_${document.visibilityState}`);
}

function resetAndroidInputFocusWorkaround() {
  if (androidInputFocusTimer !== null) window.clearTimeout(androidInputFocusTimer);
  if (androidInputFocusIntentTimer !== null) window.clearTimeout(androidInputFocusIntentTimer);
  androidInputFocusTimer = null;
  androidInputFocusIntentTimer = null;
  androidInputFocusIntent = null;
  androidInputFocusPendingFor = null;
  androidInputFocusReadyFor = null;
}

function handleInputPointerDown(event: PointerEvent) {
  recordInputDiagnostic("pointerdown");
  if (!isTelegramAndroid.value) return;
  androidInputFocusIntent = event.currentTarget as HTMLInputElement | null;
  if (androidInputFocusIntentTimer !== null) window.clearTimeout(androidInputFocusIntentTimer);
  androidInputFocusIntentTimer = window.setTimeout(() => {
    androidInputFocusIntentTimer = null;
    androidInputFocusIntent = null;
  }, ANDROID_INPUT_INTENT_TIMEOUT_MS);
}

function handleInputPointerCancel(event: PointerEvent) {
  recordInputDiagnostic("pointercancel");
  if (androidInputFocusIntent !== event.currentTarget) return;
  if (androidInputFocusIntentTimer !== null) window.clearTimeout(androidInputFocusIntentTimer);
  androidInputFocusIntentTimer = null;
  androidInputFocusIntent = null;
}

function handleInputFocus(event: FocusEvent) {
  recordInputDiagnostic("focus");
  const input = event.currentTarget as HTMLInputElement | null;
  if (
    !input
    || !isTelegramAndroid.value
    || androidInputFocusIntent !== input
    || androidInputFocusReadyFor === input
  ) return;

  androidInputFocusIntent = null;
  if (androidInputFocusIntentTimer !== null) window.clearTimeout(androidInputFocusIntentTimer);
  androidInputFocusIntentTimer = null;
  if (androidInputFocusTimer !== null) window.clearTimeout(androidInputFocusTimer);
  const selectionStart = input.selectionStart;
  const selectionEnd = input.selectionEnd;
  androidInputFocusPendingFor = input;
  recordInputDiagnostic("workaround_blur");
  input.blur();
  androidInputFocusTimer = window.setTimeout(() => {
    androidInputFocusTimer = null;
    if (
      phase.value !== "required"
      || androidInputFocusPendingFor !== input
      || !input.isConnected
      || (document.activeElement !== document.body && document.activeElement !== null)
    ) {
      if (androidInputFocusPendingFor === input) androidInputFocusPendingFor = null;
      return;
    }
    androidInputFocusPendingFor = null;
    androidInputFocusReadyFor = input;
    recordInputDiagnostic("workaround_refocus");
    input.focus({ preventScroll: true });
    if (selectionStart !== null && selectionEnd !== null) {
      input.setSelectionRange(selectionStart, selectionEnd);
    }
  }, ANDROID_INPUT_REFOCUS_DELAY_MS);
}

function handleInput(event: Event) {
  const inputEvent = event as InputEvent;
  inputDiagnosticHasInput = true;
  recordInputDiagnostic("input", {
    input_type: inputEvent.inputType,
    composing: inputEvent.isComposing,
  });
  scheduleInputDiagnostic();
  if (submitting.value && inputRef.value) {
    inputRef.value.value = submittedInputValue;
    return;
  }
  if (errorMessage.value) errorMessage.value = "";
}

function handlePaste(event: ClipboardEvent) {
  if (submitting.value) {
    event.preventDefault();
    return;
  }
  const input = event.currentTarget as HTMLInputElement | null;
  const clipboardText = event.clipboardData?.getData("text");
  if (!input || typeof clipboardText !== "string") return;

  const normalizedPaste = clipboardText.trim().replace(/^@+/, "");
  const selectionStart = input.selectionStart ?? input.value.length;
  const selectionEnd = input.selectionEnd ?? selectionStart;
  event.preventDefault();
  input.setRangeText(normalizedPaste, selectionStart, selectionEnd, "end");
  if (errorMessage.value) errorMessage.value = "";
}

async function submit() {
  const normalizedUsername = String(inputRef.value?.value || "").trim().replace(/^@+/, "");
  if (submitting.value) return;
  if (!normalizedUsername) {
    errorMessage.value = "Введите username пригласившего";
    inputRef.value?.focus({ preventScroll: true });
    return;
  }
  submittedInputValue = inputRef.value?.value || "";
  submitting.value = true;
  errorMessage.value = "";
  try {
    const response = await fetch("/api/referral-authorization/authorize", {
      method: "POST",
      headers: withTelegramAuthHeaders({ "Content-Type": "application/json" }),
      credentials: "include",
      body: JSON.stringify({ inviter_username: normalizedUsername }),
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
    submittedInputValue = "";
  }
}

onMounted(() => {
  window.addEventListener("referral-authorization-required", handleAuthorizationRequired);
  window.Telegram?.WebApp?.onEvent?.("activated", handleTelegramActivated);
  window.addEventListener("resize", handleInputViewportChange);
  window.visualViewport?.addEventListener("resize", handleInputViewportChange);
  document.addEventListener("visibilitychange", handleInputVisibilityChange);
  void refreshStatus();
});

onBeforeUnmount(() => {
  refreshRunId += 1;
  activeRefreshController?.abort();
  activeRefreshController = null;
  if (inputDiagnosticHasInput) sendInputDiagnostic();
  if (inputDiagnosticReportTimer !== null) window.clearTimeout(inputDiagnosticReportTimer);
  inputDiagnosticReportTimer = null;
  resetAndroidInputFocusWorkaround();
  window.removeEventListener("referral-authorization-required", handleAuthorizationRequired);
  window.Telegram?.WebApp?.offEvent?.("activated", handleTelegramActivated);
  window.removeEventListener("resize", handleInputViewportChange);
  window.visualViewport?.removeEventListener("resize", handleInputViewportChange);
  document.removeEventListener("visibilitychange", handleInputVisibilityChange);
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

.referral-gate__actions {
  display: grid;
  gap: 10px;
  width: 100%;
}

.referral-gate__close-app {
  min-height: 44px;
  padding: 2px 12px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #626975;
  font-family: "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.referral-gate__close-app:active {
  opacity: 0.6;
}

.referral-gate__close-app:focus-visible {
  outline: 2px solid rgba(210, 10, 9, 0.32);
  outline-offset: 2px;
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
