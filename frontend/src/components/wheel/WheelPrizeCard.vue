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

// CSS `border-color` does not accept gradient values, but `bg_color` from
// the wheel_rarities table can now be a `linear-gradient(...)` string.
// Pull the first hex out of the gradient as a sensible solid border —
// otherwise Vue silently drops the invalid value and the card loses its
// rarity-tinted border entirely.
function extractFirstHex(value: string | undefined | null): string {
  if (!value) return '#E2E5EA'
  const match = value.match(/#([0-9a-fA-F]{3}){1,2}\b/)
  return match ? match[0] : value
}

const borderColor = computed(() => {
  if (props.prize.rarity?.code === 'nothing') return '#E2E5EA'
  return extractFirstHex(props.prize.rarity?.bgColor)
})

const cardStyle = computed(() => {
  if (props.prize.image_url && !imgFailed.value) {
    return {
      borderColor: borderColor.value,
      background: '#FFFFFF',
    }
  }
  // Tinted backdrop for the default placeholder. Use the extracted solid
  // hex so gradient rarities still get a soft tint instead of an opaque
  // gradient that would compete with the icon glyph.
  const tint = extractFirstHex(props.prize.rarity?.bgColor)
  return {
    borderColor: borderColor.value,
    background: `linear-gradient(135deg, ${tint}1A, ${tint}33)`,
  }
})

const imageBackground = computed(() => 'transparent')

const defaultIconStyle = computed(() => {
  const tint = extractFirstHex(props.prize.rarity?.bgColor)
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
  border-radius: 24px;
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
  width: 100%;
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
  padding: 4px 10px;
  border-radius: 6px;
  font-family: 'Montserrat', sans-serif;
  font-weight: 500;
  font-size: 10px;
  line-height: 12px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #ffffff;
  margin: 0 8px 10px;
  max-width: calc(100% - 16px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* "Nothing" rarity already ships with #8D8D8D bg + white text from the
   DB — we just guard against the previous override that forced a light
   grey chip with dark text. */
.wheel-prize-card--nothing .wheel-prize-card__rarity {
  background: #8D8D8D;
  color: #ffffff;
}
</style>
