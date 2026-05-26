<template>
  <div
    class="wheel-prize-card"
    :class="{
      'wheel-prize-card--exhausted': prize.is_exhausted,
      'wheel-prize-card--nothing': prize.rarity?.code === 'nothing',
    }"
    :style="cardStyle"
  >
    <div
      class="wheel-prize-card__image"
      :style="{ background: imageBackground }"
    >
      <img
        v-if="prize.image_url && !imgFailed"
        :src="prize.image_url"
        :alt="prize.title"
        class="wheel-prize-card__img"
        @error="onImageError"
      />
      <div
        v-else
        class="wheel-prize-card__icon-default"
        :style="defaultIconStyle"
        role="img"
        :aria-label="prize.title"
      ></div>
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
import defaultPrizeImage from '@/assets/wheel-default-prize.png'

const props = defineProps<{
  prize: WheelPrize
}>()

const imgFailed = ref(false)

function onImageError() {
  imgFailed.value = true
}

const borderColor = computed(() => {
  if (props.prize.rarity?.code === 'nothing') return '#E2E5EA'
  return props.prize.rarity?.bgColor || '#E2E5EA'
})

const cardStyle = computed(() => ({
  borderColor: borderColor.value,
}))

const imageBackground = computed(() => {
  if (props.prize.image_url && !imgFailed.value) return '#FFFFFF'
  const color = props.prize.rarity?.bgColor || '#E2E5EA'
  return `linear-gradient(135deg, ${color}1A, ${color}33)`
})

const defaultIconStyle = computed(() => {
  const tint = props.prize.rarity?.bgColor || '#9AA0A6'
  return {
    backgroundColor: tint,
    '--wheel-default-prize-image': `url('${defaultPrizeImage}')`,
  }
})
</script>

<style scoped>
.wheel-prize-card {
  width: 140px;
  flex: 0 0 140px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  border-radius: 22px;
  background: #ffffff;
  border: 2px solid #e2e5ea;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.wheel-prize-card--exhausted {
  opacity: 0.55;
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
  max-width: 78%;
  max-height: 78%;
  object-fit: contain;
}

.wheel-prize-card__icon-default {
  width: 60%;
  aspect-ratio: 1 / 1;
  background-color: var(--wheel-default-prize-tint, #9aa0a6);
  -webkit-mask-image: var(--wheel-default-prize-image);
  mask-image: var(--wheel-default-prize-image);
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
}

.wheel-prize-card__rarity {
  display: inline-flex;
  align-self: center;
  align-items: center;
  justify-content: center;
  height: 18px;
  padding: 0 10px;
  border-radius: 999px;
  font-family: 'Montserrat', sans-serif;
  font-weight: 600;
  font-size: 9px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin: 0 8px 8px;
  max-width: calc(100% - 16px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wheel-prize-card--nothing .wheel-prize-card__rarity {
  background: #eceef2 !important;
  color: #5c6470 !important;
}
</style>
