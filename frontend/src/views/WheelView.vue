<template>
  <div class="wheel-page">
    <header class="wheel-hero">
      <div class="wheel-hero__top">
        <button
          type="button"
          class="wheel-hero__back"
          aria-label="Назад"
          @click="goBack"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M12 4L6 10L12 16"
              stroke="#FFFFFF"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <h1 class="wheel-hero__title">Рулетка призов</h1>
        <button
          type="button"
          class="wheel-hero__help"
          aria-label="Как работает"
          @click="goToHowTo"
        >
          ?
        </button>
      </div>

      <div class="wheel-hero__strip-wrap">
        <template v-if="showSkeleton">
          <div class="wheel-hero__strip-skeleton" aria-hidden="true">
            <span
              v-for="n in 5"
              :key="n"
              class="wheel-hero__strip-skeleton-card"
            ></span>
          </div>
        </template>
        <template v-else>
          <WheelStrip
            ref="stripRef"
            :prizes="strippedPrizes"
          />
        </template>
      </div>

      <div v-if="showSkeleton" class="wheel-hero__progress">
        <div
          class="wheel-hero__progress-track"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow="0"
          aria-label="Загрузка прогресса"
        >
          <span class="wheel-hero__progress-fill wheel-hero__progress-fill--skeleton"></span>
        </div>
        <p class="wheel-hero__progress-text">Загружаем рулетку…</p>
      </div>
      <div class="wheel-hero__progress" v-else-if="showProgress">
        <div
          class="wheel-hero__progress-track"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="progressPercent"
          :aria-label="progressAriaLabel"
        >
          <span
            class="wheel-hero__progress-fill"
            :style="{ width: `${progressPercent}%` }"
          ></span>
        </div>
        <p class="wheel-hero__progress-text">{{ progressLabel }}</p>
      </div>

      <button
        type="button"
        class="wheel-hero__cta"
        :class="{ 'wheel-hero__cta--disabled': isSpinDisabled }"
        :disabled="isSpinDisabled"
        :aria-busy="wheelStore.isSpinning || isAnimating"
        @click="spin"
      >
        <template v-if="showSkeleton">Загрузка…</template>
        <template v-else-if="wheelStore.isSpinning || isAnimating">Крутится...</template>
        <template v-else-if="hasSpins">Крутить</template>
        <template v-else>Скоро будет спин</template>
      </button>

      <p v-if="showSkeleton" class="wheel-hero__balance wheel-hero__balance--skeleton" aria-hidden="true">
        &nbsp;
      </p>
      <p v-else class="wheel-hero__balance">
        Осталось {{ spinsAvailable }} {{ spinsWord }}
      </p>
    </header>

    <section class="wheel-main">
      <WheelLiveFeed :items="wheelStore.feed" class="wheel-main__feed" />

      <router-link to="/wheel/my-prizes" class="wheel-main__row">
        <span class="wheel-main__row-icon">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M4 6.5C4 5.67157 4.67157 5 5.5 5H14.5C15.3284 5 16 5.67157 16 6.5V14C16 14.5523 15.5523 15 15 15H5C4.44772 15 4 14.5523 4 14V6.5Z"
              stroke="#1F2933"
              stroke-width="1.5"
            />
            <path
              d="M7 5V3.5C7 3.22386 7.22386 3 7.5 3H12.5C12.7761 3 13 3.22386 13 3.5V5"
              stroke="#1F2933"
              stroke-width="1.5"
            />
          </svg>
        </span>
        <span class="wheel-main__row-text">Мои активные призы</span>
        <span class="wheel-main__row-count">{{ activePrizesCount }}</span>
        <span class="wheel-main__row-arrow" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M5 3L9 7L5 11"
              stroke="#1F2933"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
      </router-link>

      <router-link to="/wheel/how-it-works" class="wheel-main__row">
        <span class="wheel-main__row-icon wheel-main__row-icon--quiet">?</span>
        <span class="wheel-main__row-text">Как работает рулетка</span>
        <span class="wheel-main__row-arrow" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M5 3L9 7L5 11"
              stroke="#1F2933"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
      </router-link>
    </section>

    <CustomerModalShell
      :open="showResult"
      :title="modalTitle"
      reserve-tab-bar
      @close="closeResult"
    >
      <div v-if="lastResult?.prize" class="wheel-result-body">
        <div
          v-if="lastResult.prize.rarity_code"
          class="wheel-result-body__rarity-band"
          :style="{ background: rarityColor(lastResult.prize.rarity_code) }"
        >
          {{ rarityLabel(lastResult.prize.rarity_code) }}
        </div>
        <p class="wheel-result-body__kicker">{{ resultKicker }}</p>
        <h3 class="wheel-result-body__title">
          {{ lastResult.prize.title || '—' }}
        </h3>
        <p v-if="lastResult.prize.description" class="wheel-result-body__desc">
          {{ lastResult.prize.description }}
        </p>
        <div v-if="lastResult.promo_code" class="wheel-result-body__promo">
          <span class="wheel-result-body__promo-label">Промокод</span>
          <span class="wheel-result-body__promo-code">{{ lastResult.promo_code }}</span>
        </div>
        <p v-if="lastResult.promo_valid_until" class="wheel-result-body__valid">
          Действует до {{ formatDate(lastResult.promo_valid_until) }}
        </p>
      </div>

      <template #footer>
        <button type="button" class="wheel-result-cta" @click="closeResult">
          Забрать
        </button>
      </template>
    </CustomerModalShell>

    <WheelConsentModal
      :open="showConsentModal"
      :busy="wheelStore.isUpdatingConsent"
      @decide="handleConsentDecision"
      @close="dismissConsentModal"
    />

    <ToastNotification
      v-if="toastMessage"
      :key="toastKey"
      :message="toastMessage"
      type="error"
      @close="toastMessage = ''"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import WheelStrip from '@/components/wheel/WheelStrip.vue'
import WheelLiveFeed from '@/components/wheel/WheelLiveFeed.vue'
import WheelConsentModal from '@/components/wheel/WheelConsentModal.vue'
import CustomerModalShell from '@/components/CustomerModalShell.vue'
import ToastNotification from '@/components/ToastNotification.vue'
import { useWheelStore, type WheelPrize, type WheelSpinResult } from '@/stores/wheel'

const wheelStore = useWheelStore()
const router = useRouter()
const stripRef = ref<InstanceType<typeof WheelStrip> | null>(null)
const showResult = ref(false)
const lastResult = ref<WheelSpinResult | null>(null)
const toastMessage = ref('')
const toastKey = ref(0)
const hasLoadedOnce = ref(false)
// C1-UX: `wheelStore.isSpinning` flips back to `false` as soon as the
// /api/wheel/spin response is received (~300ms), but the CSGO strip
// animation runs for ~5.4s after that. A second click during those
// seconds would commit a second server-side spin and burn the spin
// counter without ever showing the user the second result. `isAnimating`
// is the local "ongoing visual reveal" flag that stays true for the
// whole spin → animation → modal flow.
const isAnimating = ref(false)

// Q6: live-feed PII consent. We show the modal once per customer,
// the very first time they land on /wheel after the migration. The
// backend reports `feed_consent_required` based on
// customers.wheel_feed_consent_at being NULL — so a single accept
// or decline closes the modal forever. We additionally guard with a
// session-local flag so the user does not see the modal pop again
// while they navigate away and back within the same Mini App session
// before the state refresh lands.
const showConsentModal = ref(false)
const consentDismissedThisSession = ref(false)

const strippedPrizes = computed<WheelPrize[]>(() => wheelStore.sortedPrizes)
const spinsAvailable = computed(() => wheelStore.balance.spins_available)
const accumulated = computed(() =>
  Math.round(wheelStore.balance.accumulated_byn),
)
const threshold = computed(() => Math.round(wheelStore.balance.threshold_byn || 40))
const progressPercent = computed(() => wheelStore.balance.progress_percent)
const hasSpins = computed(() => wheelStore.hasSpins)
const activePrizesCount = computed(() => wheelStore.myActivePrizes.length)

// S2-8: progress bar should stay visible whenever there is meaningful
// progress to show — both when the customer has zero spins (motivates
// the next purchase) and when they already hold spins but are halfway
// to the next one. Hide it only when there is literally nothing to
// progress toward (no balance row yet, threshold misconfigured).
const showProgress = computed(() => {
  if (threshold.value <= 0) return false
  if (!hasSpins.value) return true
  return accumulated.value > 0
})

const progressLabel = computed(() => {
  const remaining = Math.max(0, threshold.value - accumulated.value)
  if (hasSpins.value && accumulated.value > 0) {
    return `Ещё ${remaining} BYN до следующего спина`
  }
  return `${accumulated.value} из ${threshold.value} BYN до начисления спина`
})

const progressAriaLabel = computed(() => `Прогресс до следующего спина: ${progressPercent.value}%`)

// S16: skeleton until first /api/wheel/state has actually returned. Until
// then we don't know whether the user has spins, what the threshold is,
// or even whether the wheel is enabled. Showing concrete copy ("Скоро
// будет спин", "Осталось 0 прокруток") for that empty in-between state
// is misleading.
const showSkeleton = computed(
  () => !hasLoadedOnce.value && wheelStore.isLoading,
)

const isSpinDisabled = computed(
  () => showSkeleton.value || !hasSpins.value || wheelStore.isSpinning || isAnimating.value,
)

const spinsWord = computed(() => {
  const n = spinsAvailable.value
  if (n % 10 === 1 && n % 100 !== 11) return 'прокрутка'
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) {
    return 'прокрутки'
  }
  return 'прокруток'
})

const resultKicker = computed(() => {
  if (lastResult.value?.is_epic_release) return 'Эпическая выдача'
  if (lastResult.value?.is_pity_release) return 'Гарантированный приз'
  return 'Тебе выпало'
})

const modalTitle = computed(() => {
  if (lastResult.value?.is_epic_release) return 'Эпический приз'
  if (lastResult.value?.is_pity_release) return 'Гарантированный приз'
  return 'Поздравляем'
})

function rarityColor(code: string): string {
  const rarity = wheelStore.rarities.find((r) => r.code === code)
  return rarity?.bgColor || '#1F2933'
}

function rarityLabel(code: string): string {
  const rarity = wheelStore.rarities.find((r) => r.code === code)
  return rarity?.label || code
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function showToast(message: string) {
  toastMessage.value = message
  toastKey.value += 1
}

function spinErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code
  if (code === 'not_enough_spins') {
    return 'Недостаточно спинов. Сделай заказ, чтобы получить ещё.'
  }
  if (code === 'wheel_disabled') {
    return 'Рулетка временно недоступна. Попробуй позже.'
  }
  if (code === 'no_prizes_configured' || code === 'no_prizes_available') {
    return 'Призы пока не настроены. Скоро всё заработает.'
  }
  if (code === 'customer_not_found') {
    return 'Не получилось найти твой профиль. Открой Mini App заново.'
  }
  return 'Не удалось крутить рулетку. Проверь интернет и попробуй снова.'
}

async function spin() {
  // C1-UX guard: block while either the network spin is in-flight OR the
  // CSGO animation is still rolling. Either condition means a second
  // server-side spin would happen "for free" without the user ever seeing
  // the previous result.
  if (!hasSpins.value || wheelStore.isSpinning || isAnimating.value) return

  isAnimating.value = true
  let result: WheelSpinResult | null = null
  try {
    try {
      result = await wheelStore.spin()
      lastResult.value = result
    } catch (error) {
      console.error('[wheel] spin error', error)
      showToast(spinErrorMessage(error))
      return
    }

    // S12: even if the strip animation can't run (e.g. prize_id missing
    // from the local pool, ref unmounted, animation throw), the spin is
    // already committed server-side and the customer paid one spin. Show
    // the result modal regardless so they see what they won.
    try {
      await stripRef.value?.runSpin({
        prizeId: result.prize.id,
        seed: result.animation_seed,
      })
    } catch (animError) {
      console.warn('[wheel] strip animation error (non-fatal)', animError)
    }
    showResult.value = true
    // S2-6: refresh state in the background so live-feed and balance
    // reflect the new spin while the user is still reading the modal.
    // Closing the modal no longer triggers a second fetch.
    wheelStore.fetchState().catch(() => undefined)
  } finally {
    isAnimating.value = false
  }
}

function closeResult() {
  showResult.value = false
}

async function handleConsentDecision(consent: boolean) {
  consentDismissedThisSession.value = true
  showConsentModal.value = false
  try {
    await wheelStore.setFeedConsent(consent)
  } catch (error) {
    console.warn('[wheel] failed to save consent', error)
    showToast('Не удалось сохранить выбор. Попробуй ещё раз из профиля.')
  }
}

function dismissConsentModal() {
  // The user can dismiss the modal via the X button without making a
  // choice. We do not POST consent in that case — they will see the
  // modal again next visit until they explicitly accept or decline.
  consentDismissedThisSession.value = true
  showConsentModal.value = false
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/')
  }
}

function goToHowTo() {
  router.push('/wheel/how-it-works')
}

onMounted(async () => {
  try {
    await wheelStore.fetchState()
    if (
      wheelStore.feedConsentRequired &&
      !consentDismissedThisSession.value
    ) {
      showConsentModal.value = true
    }
  } catch (error) {
    console.error('[wheel] state error', error)
    showToast('Не удалось загрузить рулетку. Открой страницу заново.')
  } finally {
    hasLoadedOnce.value = true
  }
})
</script>

<style scoped>
.wheel-page {
  min-height: 100vh;
  background: #f5f7fa;
  padding-bottom: 24px;
}

.wheel-hero {
  background: linear-gradient(106.76deg, #f50302 -2.64%, #a90f0e 85.78%);
  color: #ffffff;
  padding: 18px 0 32px;
  border-bottom-left-radius: 32px;
  border-bottom-right-radius: 32px;
  box-shadow: 0 16px 40px rgba(97, 1, 0, 0.16);
}

.wheel-hero__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  margin-bottom: 18px;
}

.wheel-hero__back,
.wheel-hero__help {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-family: 'Montserrat', sans-serif;
  font-weight: 600;
  font-size: 18px;
  cursor: pointer;
}

/* S2-3: keep the visual chip at 36px but expand the actual hit-target
   to 44×44 via an invisible ::before so iOS finger taps near the edge
   still register. */
.wheel-hero__back::before,
.wheel-hero__help::before {
  content: "";
  position: absolute;
  inset: -4px;
  border-radius: inherit;
}

.wheel-hero__title {
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 1.2;
  margin: 0;
}

.wheel-hero__strip-wrap {
  margin-bottom: 18px;
}

.wheel-hero__strip-skeleton {
  display: flex;
  gap: 16px;
  height: 192px;
  align-items: center;
  padding: 16px;
  overflow: hidden;
}

.wheel-hero__strip-skeleton-card {
  flex: 0 0 140px;
  height: 156px;
  border-radius: 22px;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.18) 0%,
    rgba(255, 255, 255, 0.32) 50%,
    rgba(255, 255, 255, 0.18) 100%
  );
  background-size: 200% 100%;
  animation: wheel-skeleton-pulse 1.6s ease-in-out infinite;
}

@keyframes wheel-skeleton-pulse {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.wheel-hero__progress {
  margin: 0 24px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wheel-hero__progress-track {
  position: relative;
  width: 100%;
  height: 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.22);
  overflow: hidden;
}

.wheel-hero__progress-fill {
  position: absolute;
  inset: 0;
  width: 0%;
  background: #ffffff;
  transition: width 0.4s ease;
}

.wheel-hero__progress-fill--skeleton {
  width: 40%;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.4) 0%,
    rgba(255, 255, 255, 0.85) 50%,
    rgba(255, 255, 255, 0.4) 100%
  );
  background-size: 200% 100%;
  animation: wheel-skeleton-pulse 1.6s ease-in-out infinite;
}

.wheel-hero__progress-text {
  margin: 0;
  font-family: 'SF Pro Display', system-ui, sans-serif;
  font-size: 13px;
  text-align: center;
  color: rgba(255, 255, 255, 0.92);
}

.wheel-hero__cta {
  display: block;
  width: calc(100% - 48px);
  margin: 0 auto 8px;
  height: 56px;
  border-radius: 28px;
  border: none;
  background: #ffffff;
  color: #1f2933;
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.2s ease;
}

.wheel-hero__cta:active {
  transform: scale(0.98);
}

.wheel-hero__cta--disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.wheel-hero__balance {
  margin: 0;
  text-align: center;
  font-family: 'SF Pro Display', system-ui, sans-serif;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  min-height: 16px;
}

.wheel-hero__balance--skeleton {
  visibility: hidden;
}

.wheel-main {
  margin: -22px 16px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
  z-index: 2;
}

.wheel-main__feed {
  margin: 0;
}

.wheel-main__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: #ffffff;
  border-radius: 20px;
  text-decoration: none;
  color: #1f2933;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
}

.wheel-main__row-icon {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(245, 3, 2, 0.08);
  color: #f50302;
  font-family: 'Montserrat', sans-serif;
  font-weight: 600;
}

.wheel-main__row-icon--quiet {
  background: rgba(15, 23, 42, 0.06);
  color: #1f2933;
}

.wheel-main__row-text {
  flex: 1 1 auto;
  font-family: 'SF Pro Display', system-ui, sans-serif;
  font-size: 15px;
  color: #1f2933;
  font-weight: 500;
}

.wheel-main__row-count {
  min-width: 22px;
  height: 22px;
  border-radius: 11px;
  background: rgba(245, 3, 2, 0.12);
  color: #f50302;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  font-family: 'Montserrat', sans-serif;
  font-weight: 600;
  font-size: 12px;
}

.wheel-main__row-arrow {
  display: inline-flex;
}

.wheel-result-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  padding-top: 4px;
}

.wheel-result-body__rarity-band {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 14px;
  border-radius: 999px;
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #ffffff;
  margin-bottom: 4px;
}

.wheel-result-body__kicker {
  margin: 0;
  font-family: 'SF Pro Display', system-ui, sans-serif;
  font-size: 13px;
  color: #5c6470;
}

.wheel-result-body__title {
  margin: 0;
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: 22px;
  color: #1f2933;
}

.wheel-result-body__desc {
  margin: 0;
  font-family: 'SF Pro Display', system-ui, sans-serif;
  font-size: 14px;
  color: #5c6470;
}

.wheel-result-body__promo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  background: rgba(245, 3, 2, 0.08);
  padding: 12px 16px;
  border-radius: 16px;
  width: 100%;
}

.wheel-result-body__promo-label {
  font-family: 'SF Pro Display', system-ui, sans-serif;
  font-size: 12px;
  color: #5c6470;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.wheel-result-body__promo-code {
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: 18px;
  color: #f50302;
  letter-spacing: 0.05em;
}

.wheel-result-body__valid {
  margin: 0;
  font-family: 'SF Pro Display', system-ui, sans-serif;
  font-size: 12px;
  color: #9aa0a6;
}

.wheel-result-cta {
  width: 100%;
  height: 48px;
  border: none;
  border-radius: 24px;
  background: linear-gradient(106.76deg, #f50302 -2.64%, #a90f0e 85.78%);
  color: #ffffff;
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
}

@media (prefers-reduced-motion: reduce) {
  .wheel-hero__strip-skeleton-card,
  .wheel-hero__progress-fill--skeleton {
    animation: none;
  }
}
</style>
