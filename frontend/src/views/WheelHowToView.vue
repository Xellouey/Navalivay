<template>
  <div class="wheel-howto-page">
    <header class="wheel-howto-header">
      <button type="button" class="wheel-howto-back" aria-label="Назад" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M12 4L6 10L12 16"
            stroke="#1F2933"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <h1 class="wheel-howto-title">Как работает рулетка</h1>
    </header>

    <main class="wheel-howto-content">
      <section class="wheel-howto-card">
        <h2 class="wheel-howto-card__title">Как получить спин</h2>
        <p class="wheel-howto-card__text">
          За каждые {{ retailThreshold }} BYN покупок копится один спин. Считаются только
          выданные заказы, без промокодов и бонусных списаний.
        </p>
      </section>

      <section class="wheel-howto-card">
        <h2 class="wheel-howto-card__title">Что внутри</h2>
        <p class="wheel-howto-card__text">
          В рулетке несколько уровней редкости. Чем редче приз, тем меньше его шанс.
          Призы выдаются автоматически — промокод сразу появится в карточке «Мои
          активные призы».
        </p>
        <ul class="wheel-howto-rarities">
          <li
            v-for="rarity in rarities"
            :key="rarity.code"
            class="wheel-howto-rarity"
            :style="{ background: rarity.bgColor, color: rarity.textColor }"
          >
            {{ rarity.label }}
          </li>
        </ul>
      </section>

      <section class="wheel-howto-card">
        <h2 class="wheel-howto-card__title">Гарантии</h2>
        <p class="wheel-howto-card__text">
          После {{ pityThreshold }} «пустых» прокруток подряд следующий спин
          гарантированно даст приз. Очень редкие призы достаются только постоянным
          клиентам — это работает автоматически по истории покупок.
        </p>
      </section>

      <section class="wheel-howto-card">
        <h2 class="wheel-howto-card__title">Важно</h2>
        <ul class="wheel-howto-list">
          <li>Спины не сгорают, копятся неограниченно.</li>
          <li>Срок жизни промокода указан на карточке приза.</li>
          <li>В одном заказе можно использовать только один промокод.</li>
        </ul>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWheelStore } from '@/stores/wheel'

const wheelStore = useWheelStore()
const router = useRouter()

const rarities = computed(() =>
  wheelStore.rarities.filter((rarity) => rarity.code !== 'nothing'),
)
const retailThreshold = computed(() => wheelStore.settings.spin_byn_retail || 40)
const pityThreshold = computed(() => wheelStore.settings.pity_threshold || 3)

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/wheel')
  }
}

onMounted(() => {
  // P3-UX: silent fetch использует TTL-кэш store. Если данные свежие,
  // ничего не происходит; если устарели или ещё не загружены, тихо
  // подтянем — у этого экрана нет скелетона, так что показывать
  // isLoading смысла нет.
  wheelStore.fetchState({ silent: true }).catch(() => undefined)
})
</script>

<style scoped>
.wheel-howto-page {
  min-height: 100vh;
  background: #f5f7fa;
  padding-bottom: 24px;
}

.wheel-howto-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 16px 12px;
}

.wheel-howto-back {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
}

/* S2-3: visual chip 36×36, tap area 44×44 via invisible ::before. */
.wheel-howto-back::before {
  content: "";
  position: absolute;
  inset: -4px;
  border-radius: inherit;
}

.wheel-howto-title {
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: 18px;
  color: #1f2933;
  margin: 0;
}

.wheel-howto-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 16px 24px;
}

.wheel-howto-card {
  background: #ffffff;
  border-radius: 22px;
  padding: 18px 18px 16px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
}

.wheel-howto-card__title {
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: 16px;
  color: #1f2933;
  margin: 0 0 8px;
}

.wheel-howto-card__text {
  font-family: 'SF Pro Display', system-ui, sans-serif;
  font-size: 14px;
  color: #5c6470;
  margin: 0;
  line-height: 1.4;
}

.wheel-howto-rarities {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.wheel-howto-rarity {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 12px;
  border-radius: 999px;
  font-family: 'Montserrat', sans-serif;
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.wheel-howto-list {
  margin: 12px 0 0;
  padding-left: 20px;
  font-family: 'SF Pro Display', system-ui, sans-serif;
  font-size: 14px;
  color: #5c6470;
  line-height: 1.5;
}
</style>
