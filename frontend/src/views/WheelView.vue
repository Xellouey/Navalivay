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
        <WheelStrip
          ref="stripRef"
          :prizes="strippedPrizes"
        />
      </div>

      <div class="wheel-hero__progress" v-if="!hasSpins">
        <div class="wheel-hero__progress-track">
          <span
            class="wheel-hero__progress-fill"
            :style="{ width: `${progressPercent}%` }"
          ></span>
        </div>
        <p class="wheel-hero__progress-text">
          {{ accumulated }} из {{ threshold }} BYN до начисления спина
        </p>
      </div>

      <button
        type="button"
        class="wheel-hero__cta"
        :class="{ 'wheel-hero__cta--disabled': !hasSpins || wheelStore.isSpinning }"
        :disabled="!hasSpins || wheelStore.isSpinning"
        @click="spin"
      >
        <template v-if="wheelStore.isSpinning">Крутится...</template>
        <template v-else-if="hasSpins">Крутить</template>
        <template v-else>Скоро будет спин</template>
      </button>

      <p class="wheel-hero__balance">
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

    <Transition name="wheel-modal-fade">
      <div v-if="showResult" class="wheel-result-overlay" @click.self="closeResult">
        <div class="wheel-result-card">
          <div
            v-if="lastResult?.prize"
            class="wheel-result-card__rarity-band"
            :style="{ background: rarityColor(lastResult.prize.rarity_code) }"
          >
            {{ rarityLabel(lastResult.prize.rarity_code) }}
          </div>
          <p class="wheel-result-card__kicker">
            {{ lastResult?.is_epic_release ? 'Эпическая выдача' : lastResult?.is_pity_release ? 'Гарантированный приз' : 'Тебе выпало' }}
          </p>
          <h2 class="wheel-result-card__title">
            {{ lastResult?.prize?.title || '—' }}
          </h2>
          <p v-if="lastResult?.prize?.description" class="wheel-result-card__desc">
            {{ lastResult.prize.description }}
          </p>
          <p v-if="lastResult?.promo_code" class="wheel-result-card__promo">
            <span class="wheel-result-card__promo-label">Промокод</span>
            <span class="wheel-result-card__promo-code">{{ lastResult.promo_code }}</span>
          </p>
          <p v-if="lastResult?.promo_valid_until" class="wheel-result-card__valid">
            Действует до {{ formatDate(lastResult.promo_valid_until) }}
          </p>
          <button type="button" class="wheel-result-card__cta" @click="closeResult">
            Забрать
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import WheelStrip from '@/components/wheel/WheelStrip.vue'
import WheelLiveFeed from '@/components/wheel/WheelLiveFeed.vue'
import { useWheelStore, type WheelPrize, type WheelSpinResult } from '@/stores/wheel'

const wheelStore = useWheelStore()
const router = useRouter()
const stripRef = ref<InstanceType<typeof WheelStrip> | null>(null)
const showResult = ref(false)
const lastResult = ref<WheelSpinResult | null>(null)

const strippedPrizes = computed<WheelPrize[]>(() => wheelStore.sortedPrizes)
const spinsAvailable = computed(() => wheelStore.balance.spins_available)
const accumulated = computed(() =>
  Math.round(wheelStore.balance.accumulated_byn),
)
const threshold = computed(() => Math.round(wheelStore.balance.threshold_byn || 40))
const progressPercent = computed(() => wheelStore.balance.progress_percent)
const hasSpins = computed(() => wheelStore.hasSpins)
const activePrizesCount = computed(() => wheelStore.myActivePrizes.length)

const spinsWord = computed(() => {
  const n = spinsAvailable.value
  if (n % 10 === 1 && n % 100 !== 11) return 'прокрутка'
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) {
    return 'прокрутки'
  }
  return 'прокруток'
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

async function spin() {
  if (!hasSpins.value || wheelStore.isSpinning) return
  try {
    const result = await wheelStore.spin()
    lastResult.value = result
    await stripRef.value?.runSpin({
      prizeId: result.prize.id,
      seed: result.animation_seed,
    })
    showResult.value = true
  } catch (error) {
    console.error('[wheel] spin error', error)
  }
}

function closeResult() {
  showResult.value = false
  // refresh state silently to update feed and active prizes after a result.
  wheelStore.fetchState().catch(() => undefined)
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
  } catch (error) {
    console.error('[wheel] state error', error)
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
  box-shadow: 0 16px 40px rgba(245, 3, 2, 0.14);
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

.wheel-result-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 200;
}

.wheel-result-card {
  width: 100%;
  max-width: 340px;
  background: #ffffff;
  border-radius: 28px;
  padding: 28px 24px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  position: relative;
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.24);
}

.wheel-result-card__rarity-band {
  position: absolute;
  top: -12px;
  padding: 6px 14px;
  border-radius: 999px;
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.wheel-result-card__kicker {
  margin: 8px 0 6px;
  font-family: 'SF Pro Display', system-ui, sans-serif;
  font-size: 13px;
  color: #5c6470;
}

.wheel-result-card__title {
  margin: 0 0 8px;
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: 22px;
  color: #1f2933;
}

.wheel-result-card__desc {
  margin: 0 0 16px;
  font-family: 'SF Pro Display', system-ui, sans-serif;
  font-size: 14px;
  color: #5c6470;
}

.wheel-result-card__promo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin: 0 0 8px;
  background: rgba(245, 3, 2, 0.08);
  padding: 12px 16px;
  border-radius: 16px;
  width: 100%;
}

.wheel-result-card__promo-label {
  font-family: 'SF Pro Display', system-ui, sans-serif;
  font-size: 12px;
  color: #5c6470;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.wheel-result-card__promo-code {
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: 18px;
  color: #f50302;
  letter-spacing: 0.05em;
}

.wheel-result-card__valid {
  margin: 0 0 16px;
  font-family: 'SF Pro Display', system-ui, sans-serif;
  font-size: 12px;
  color: #9aa0a6;
}

.wheel-result-card__cta {
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

.wheel-modal-fade-enter-active,
.wheel-modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.wheel-modal-fade-enter-from,
.wheel-modal-fade-leave-to {
  opacity: 0;
}
</style>
