<template>
  <div
    class="blocked-screen"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="blocked-screen-title"
    data-no-smoke
  >
    <div class="blocked-card">
      <div class="blocked-icon" aria-hidden="true">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
      </div>

      <h1 id="blocked-screen-title" class="blocked-title">Доступ к заказам ограничен</h1>

      <p v-if="reason" class="blocked-reason">
        {{ reason }}
      </p>

      <div class="blocked-info">
        <p class="blocked-info-label">{{ countdownLabel }}</p>
        <p v-if="countdownValue" class="blocked-info-value">{{ countdownValue }}</p>
      </div>

      <p class="blocked-hint">
        Если считаешь, что блокировка — ошибка, напиши менеджеру.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useCustomerBlock } from '@/composables/useCustomerBlock'

const props = defineProps<{
  /** Причина блокировки, видна клиенту (опционально). */
  reason?: string | null
  /** ISO datetime в формате 'YYYY-MM-DD HH:MM:SS' (UTC) или ISO с 'T' и 'Z'. null = бессрочно. */
  blockUntil?: string | null
}>()

const { refreshBlock } = useCustomerBlock()

const now = ref(Date.now())
let timerId: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  // Тикаем каждые 30 секунд (для минут/часов хватает с запасом).
  // Дополнительно: если срок уже истёк (clock skew между клиентом и сервером
  // может удерживать `remainingMs` на нуле без срабатывания watch ниже),
  // дёргаем refreshBlock сами на каждом тике — пока сервер не подтвердит снятие.
  timerId = setInterval(() => {
    now.value = Date.now()
    if (
      blockUntilMs.value !== null &&
      blockUntilMs.value <= now.value
    ) {
      refreshBlock()
    }
  }, 30_000)
})

onBeforeUnmount(() => {
  if (timerId !== null) {
    clearInterval(timerId)
    timerId = null
  }
})

const blockUntilMs = computed(() => {
  if (!props.blockUntil) return null
  const normalized = props.blockUntil.includes('T')
    ? props.blockUntil
    : props.blockUntil.replace(' ', 'T') + 'Z'
  const t = new Date(normalized).getTime()
  return Number.isFinite(t) ? t : null
})

const remainingMs = computed(() => {
  if (blockUntilMs.value === null) return null
  return Math.max(0, blockUntilMs.value - now.value)
})

// Первичный триггер: момент перехода remainingMs в 0. Дальнейшие повторы
// делает setInterval-tick (см. onMounted), потому что Vue watcher не
// перевызывается на не-меняющемся значении.
watch(remainingMs, (val) => {
  if (val === 0) {
    refreshBlock()
  }
})

const reason = computed(() => (props.reason || '').trim() || null)

/**
 * Метка-описатель и значение в зависимости от срока:
 *   - бессрочно → «Блокировка бессрочна»
 *   - меньше 24 часов → таймер «Доступ откроется через X»
 *   - сутки и больше → дата и время «15 апреля в 14:45»
 */
const countdownLabel = computed(() => {
  if (blockUntilMs.value === null) return 'Блокировка бессрочна'
  // Срок истёк, но сервер ещё не подтвердил снятие (или часы клиента опережают).
  // На каждом тике setInterval мы уже дёргаем refreshBlock — экран снимется как
  // только бэкенд тоже посчитает блок истёкшим.
  if (remainingMs.value === 0) return 'Проверяем доступ…'
  if (remainingMs.value !== null && remainingMs.value < 24 * 60 * 60 * 1000) {
    return 'Доступ к заказам откроется через'
  }
  return 'Доступ к заказам откроется'
})

const countdownValue = computed(() => {
  if (blockUntilMs.value === null) return ''
  if (remainingMs.value === 0) return ''

  if (remainingMs.value !== null && remainingMs.value < 24 * 60 * 60 * 1000) {
    return formatRemainingShort(remainingMs.value)
  }
  return new Date(blockUntilMs.value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
})

function formatRemainingShort(ms: number): string {
  const totalMin = Math.ceil(ms / 60_000)
  if (totalMin < 60) {
    return `${totalMin} ${pluralizeMinutes(totalMin)}`
  }
  const hours = Math.floor(totalMin / 60)
  const min = totalMin % 60
  if (min === 0) {
    return `${hours} ${pluralizeHours(hours)}`
  }
  return `${hours} ${pluralizeHours(hours)} ${min} ${pluralizeMinutes(min)}`
}

function pluralizeMinutes(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'минуту'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'минуты'
  return 'минут'
}

function pluralizeHours(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'час'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'часа'
  return 'часов'
}
</script>

<style scoped>
.blocked-screen {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(245, 247, 250, 0.96);
  backdrop-filter: blur(6px);
}

.blocked-card {
  width: 100%;
  max-width: 420px;
  background: #ffffff;
  border-radius: 24px;
  padding: 28px 24px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
}

.blocked-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: rgba(211, 47, 47, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--navalivay-red, #d32f2f);
}

.blocked-title {
  margin: 0;
  font-family: 'Montserrat', sans-serif;
  font-size: 20px;
  line-height: 26px;
  font-weight: 700;
  color: #191919;
}

.blocked-reason {
  margin: 0;
  font-family: -apple-system, 'SF Pro Display', sans-serif;
  font-size: 15px;
  line-height: 20px;
  color: #4b5563;
  font-weight: 500;
}

.blocked-info {
  width: 100%;
  background: #f5f7fa;
  border-radius: 14px;
  padding: 14px 16px;
}

.blocked-info-label {
  margin: 0;
  font-size: 13px;
  line-height: 16px;
  color: #6b7280;
}

.blocked-info-value {
  margin: 6px 0 0;
  font-family: 'Montserrat', sans-serif;
  font-size: 18px;
  line-height: 22px;
  font-weight: 700;
  color: var(--navalivay-red, #d32f2f);
}

.blocked-hint {
  margin: 0;
  font-size: 12px;
  line-height: 16px;
  color: #9ca3af;
}
</style>
