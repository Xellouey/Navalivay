<template>
  <router-link
    to="/wheel"
    class="wheel-home-widget"
    :class="`wheel-home-widget--${variant}`"
    aria-label="Открыть рулетку призов"
  >
    <div class="wheel-home-widget__glow" aria-hidden="true"></div>
    <div class="wheel-home-widget__icon" aria-hidden="true">
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        <circle cx="22" cy="22" r="21" :stroke="iconStroke" stroke-width="1.6" stroke-opacity="0.6" />
        <circle cx="22" cy="22" r="13" :stroke="iconStroke" stroke-width="1.6" />
        <circle cx="22" cy="22" r="2.6" :fill="iconStroke" />
        <path
          d="M22 4 V18"
          :stroke="iconStroke"
          stroke-width="1.6"
          stroke-linecap="round"
        />
        <path
          d="M22 26 V40"
          :stroke="iconStroke"
          stroke-width="1.6"
          stroke-linecap="round"
        />
        <path
          d="M4 22 H18"
          :stroke="iconStroke"
          stroke-width="1.6"
          stroke-linecap="round"
        />
        <path
          d="M26 22 H40"
          :stroke="iconStroke"
          stroke-width="1.6"
          stroke-linecap="round"
        />
      </svg>
    </div>
    <div class="wheel-home-widget__copy">
      <p class="wheel-home-widget__kicker">Рулетка призов</p>
      <p class="wheel-home-widget__title">
        <template v-if="hasSpins">
          У тебя {{ spinsAvailable }} {{ spinsLabel }}
        </template>
        <template v-else>
          Копи спины с покупок
        </template>
      </p>
      <p class="wheel-home-widget__hint">
        <template v-if="hasSpins">Жми, чтобы крутить</template>
        <template v-else>
          {{ accumulated }} из {{ threshold }} BYN до спина
        </template>
      </p>
    </div>
    <div class="wheel-home-widget__arrow" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="M6 4L12 9L6 14"
          :stroke="arrowStroke"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>
  </router-link>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useWheelStore } from '@/stores/wheel'

type WheelHomeWidgetVariant = 'red' | 'subtle'

const props = withDefaults(
  defineProps<{
    autoLoad?: boolean
    variant?: WheelHomeWidgetVariant
  }>(),
  { autoLoad: true, variant: 'red' },
)

const wheelStore = useWheelStore()

onMounted(() => {
  if (props.autoLoad && !wheelStore.prizes.length) {
    wheelStore.fetchState().catch(() => {
      // Виджет работает в degraded-режиме, ошибку логируем тихо.
    })
  }
})

const spinsAvailable = computed(() => wheelStore.balance.spins_available)
const accumulated = computed(() =>
  Math.round(wheelStore.balance.accumulated_byn),
)
const threshold = computed(() =>
  Math.round(wheelStore.balance.threshold_byn || 40),
)
const hasSpins = computed(() => spinsAvailable.value > 0)

const spinsLabel = computed(() => {
  const n = spinsAvailable.value
  if (n % 10 === 1 && n % 100 !== 11) return 'спин'
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'спина'
  return 'спинов'
})

// C2-UX: when HomeView already shows a red active-order banner directly
// above the widget, two stacked red gradients break the "aggressive red
// only where attention is needed" canon. The `subtle` variant mirrors
// the canonical white profile-card language: white surface, red kicker,
// dark body text, soft restrained shadow.
const iconStroke = computed(() => (props.variant === 'subtle' ? '#F50302' : '#FFFFFF'))
const arrowStroke = computed(() => (props.variant === 'subtle' ? '#1F2933' : '#FFFFFF'))
</script>

<style scoped>
.wheel-home-widget {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 16px 16px 18px;
  border-radius: 22px;
  text-decoration: none;
  overflow: hidden;
}

.wheel-home-widget--red {
  background: linear-gradient(106.76deg, #f50302 -2.64%, #a90f0e 85.78%);
  color: #ffffff;
  box-shadow: 0 8px 16px rgba(97, 1, 0, 0.16);
}

/* C2-UX subtle variant — белая карточка с красным акцентом, парная
   к канону loyalty-/profile- белых блоков. Используется когда выше
   уже есть красная плашка (например, баннер активного заказа). */
.wheel-home-widget--subtle {
  background: #ffffff;
  color: #1f2933;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
}

.wheel-home-widget__glow {
  position: absolute;
  width: 240px;
  height: 240px;
  right: -90px;
  top: -120px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.32) 0%, rgba(255, 255, 255, 0) 70%);
  pointer-events: none;
}

.wheel-home-widget--subtle .wheel-home-widget__glow {
  background: radial-gradient(circle, rgba(245, 3, 2, 0.06) 0%, rgba(245, 3, 2, 0) 70%);
}

.wheel-home-widget__icon {
  flex: 0 0 56px;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 18px;
  backdrop-filter: blur(6px);
}

.wheel-home-widget--subtle .wheel-home-widget__icon {
  background: rgba(245, 3, 2, 0.08);
  backdrop-filter: none;
}

.wheel-home-widget__copy {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wheel-home-widget__kicker {
  margin: 0;
  font-family: 'SF Pro Display', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.78);
}

.wheel-home-widget--subtle .wheel-home-widget__kicker {
  color: #f50302;
}

.wheel-home-widget__title {
  margin: 0;
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: 17px;
  line-height: 1.2;
}

.wheel-home-widget--subtle .wheel-home-widget__title {
  color: #1f2933;
}

.wheel-home-widget__hint {
  margin: 0;
  font-family: 'SF Pro Display', system-ui, sans-serif;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
}

.wheel-home-widget--subtle .wheel-home-widget__hint {
  color: #5c6470;
}

.wheel-home-widget__arrow {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
}

.wheel-home-widget--subtle .wheel-home-widget__arrow {
  background: rgba(15, 23, 42, 0.06);
}
</style>
