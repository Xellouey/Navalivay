<template>
  <div v-if="open" class="loyalty-popup-backdrop" @click.self="$emit('close')">
    <div class="loyalty-popup-card">
      <p class="loyalty-popup-kicker">Скидки за покупки</p>
      <h3 class="loyalty-popup-title">У вас уже есть доступные бонусы</h3>
      <p class="loyalty-popup-text">
        {{ categorySummary }}
      </p>

      <div class="loyalty-popup-actions">
        <button type="button" class="loyalty-popup-secondary" @click="$emit('close')">
          Позже
        </button>
        <button type="button" class="loyalty-popup-primary" @click="$emit('open-profile')">
          Открыть профиль
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface PopupCategory {
  key: string
  title: string
  available_bonus_count: number
}

const props = defineProps<{
  open: boolean
  categories: PopupCategory[]
}>()

defineEmits<{
  (event: 'close'): void
  (event: 'open-profile'): void
}>()

const categorySummary = computed(() => {
  const relevant = props.categories
    .filter((category) => Number(category.available_bonus_count || 0) > 0)
    .map((category) => `${category.title}: ${category.available_bonus_count}`)

  if (!relevant.length) {
    return 'Откройте профиль, чтобы посмотреть доступные скидки и применить их в заказе.'
  }

  return `${relevant.join(' • ')}. Откройте профиль, чтобы посмотреть детали.`
})
</script>

<style scoped>
.loyalty-popup-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(25, 25, 25, 0.44);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 16px;
}

.loyalty-popup-card {
  width: min(100%, 420px);
  border-radius: 24px;
  background: #ffffff;
  padding: 24px 20px 20px;
  box-shadow: 0 24px 64px rgba(25, 25, 25, 0.18);
}

.loyalty-popup-kicker {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 14px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #a90f0e;
  font-weight: 700;
}

.loyalty-popup-title {
  margin: 0 0 10px;
  font-family: "Montserrat", sans-serif;
  font-size: 22px;
  line-height: 26px;
  color: #191919;
}

.loyalty-popup-text {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  color: #5f6772;
}

.loyalty-popup-actions {
  margin-top: 18px;
  display: flex;
  gap: 10px;
}

.loyalty-popup-secondary,
.loyalty-popup-primary {
  flex: 1;
  min-height: 48px;
  border-radius: 16px;
  border: none;
  font-family: "Montserrat", sans-serif;
  font-size: 14px;
  font-weight: 700;
}

.loyalty-popup-secondary {
  background: #eef1f4;
  color: #191919;
}

.loyalty-popup-primary {
  background: linear-gradient(135deg, #f50302 0%, #a90f0e 100%);
  color: #ffffff;
}
</style>
