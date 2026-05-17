<template>
  <div
    class="wheel-prize-card"
    :class="{
      'wheel-prize-card--exhausted': prize.is_exhausted,
      'wheel-prize-card--nothing': prize.rarity?.code === 'nothing',
    }"
  >
    <div
      class="wheel-prize-card__image"
      :style="{ background: imageBackground }"
    >
      <img
        v-if="prize.image_url"
        :src="prize.image_url"
        :alt="prize.title"
        class="wheel-prize-card__img"
        @error="onImageError"
      />
      <span v-else-if="prize.rarity?.code === 'nothing'" class="wheel-prize-card__nothing">
        ничего
      </span>
      <span v-else class="wheel-prize-card__monogram">
        {{ prize.title.slice(0, 1).toUpperCase() }}
      </span>
    </div>
    <div
      v-if="prize.rarity"
      class="wheel-prize-card__rarity"
      :style="{
        background: prize.rarity.bgColor,
        color: prize.rarity.textColor,
      }"
    >
      {{ prize.rarity.label }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { WheelPrize } from '@/stores/wheel'

const props = defineProps<{
  prize: WheelPrize
}>()

const imgFailed = ref(false)

function onImageError() {
  imgFailed.value = true
}

const imageBackground = computed(() => {
  if (props.prize.image_url && !imgFailed.value) return '#FFFFFF'
  const color = props.prize.rarity?.bgColor || '#E2E5EA'
  return `linear-gradient(135deg, ${color}33, ${color}77)`
})
</script>

<style scoped>
.wheel-prize-card {
  width: 140px;
  flex: 0 0 140px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
  overflow: hidden;
  transition: transform 0.2s ease;
}

.wheel-prize-card--exhausted {
  opacity: 0.6;
  filter: saturate(0.6);
}

.wheel-prize-card__image {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wheel-prize-card__img {
  max-width: 86%;
  max-height: 86%;
  object-fit: contain;
}

.wheel-prize-card__monogram {
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: 44px;
  color: rgba(15, 23, 42, 0.45);
}

.wheel-prize-card__nothing {
  font-family: 'Montserrat', sans-serif;
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(15, 23, 42, 0.55);
}

.wheel-prize-card__rarity {
  display: inline-flex;
  align-self: center;
  align-items: center;
  justify-content: center;
  height: 22px;
  padding: 0 12px;
  border-radius: 999px;
  font-family: 'Montserrat', sans-serif;
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin: 0 12px 12px;
}

.wheel-prize-card--nothing .wheel-prize-card__rarity {
  background: #ECEEF2 !important;
  color: #5C6470 !important;
}
</style>
