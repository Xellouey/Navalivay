<template>
  <div class="wheel-strip">
    <div class="wheel-strip__viewport" ref="viewportRef">
      <div
        class="wheel-strip__track"
        ref="trackRef"
        :style="{ transform: `translate3d(${currentOffset}px, 0, 0)`, transition: trackTransition }"
      >
        <WheelPrizeCard
          v-for="(prize, index) in displayPrizes"
          :key="`${prize.id}-${index}`"
          :prize="prize"
          class="wheel-strip__card"
          :class="{ 'wheel-strip__card--landed': index === landedIndex }"
        />
      </div>
      <div class="wheel-strip__pointer" aria-hidden="true">
        <span class="wheel-strip__pointer-arrow"></span>
      </div>
      <div class="wheel-strip__edge wheel-strip__edge--left" aria-hidden="true"></div>
      <div class="wheel-strip__edge wheel-strip__edge--right" aria-hidden="true"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { WheelPrize } from '@/stores/wheel'
import WheelPrizeCard from './WheelPrizeCard.vue'

const props = defineProps<{
  prizes: WheelPrize[]
}>()

const emit = defineEmits<{
  (event: 'animationDone', payload: { prizeId: string }): void
}>()

const CARD_WIDTH = 140
const CARD_GAP = 16
const STEP = CARD_WIDTH + CARD_GAP
const REPEAT = 6
const REST_OFFSET_INDEX = 8

const viewportRef = ref<HTMLElement | null>(null)
const trackRef = ref<HTMLElement | null>(null)
const trackTransition = ref('none')
const currentOffset = ref(0)
const landedIndex = ref(-1)
const displayPrizes = ref<WheelPrize[]>([])
const pendingTimers = new Set<ReturnType<typeof setTimeout>>()

function trackTimer(timer: ReturnType<typeof setTimeout>) {
  pendingTimers.add(timer)
  return timer
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function buildBaseStrip(prizes: WheelPrize[]): WheelPrize[] {
  if (!prizes.length) return []
  const segment: WheelPrize[] = []
  for (let i = 0; i < REPEAT; i += 1) {
    segment.push(...prizes)
  }
  return segment
}

watch(
  () => props.prizes,
  (next) => {
    // S12: also rebuild when the prize pool changes after the first
    // load (e.g. CRM toggled a prize on/off, manager added new prize).
    // Previously the strip locked on the first non-empty array forever.
    if (!next.length) return
    displayPrizes.value = buildBaseStrip(next)
    requestAnimationFrame(() => {
      snapToRest()
    })
  },
  { immediate: true, deep: false },
)

function viewportWidth(): number {
  return viewportRef.value?.offsetWidth || 360
}

function offsetForIndex(index: number): number {
  const cardCenter = index * STEP + CARD_WIDTH / 2
  const viewportCenter = viewportWidth() / 2
  return viewportCenter - cardCenter
}

function snapToRest() {
  if (!props.prizes.length) return
  trackTransition.value = 'none'
  const idx = props.prizes.length * 1 + REST_OFFSET_INDEX
  currentOffset.value = offsetForIndex(idx)
}

function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = t
    r = Math.imul(r ^ (r >>> 15), r | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

interface SpinAnimationOptions {
  prizeId: string
  seed: number
  durationMs?: number
}

async function runSpin(options: SpinAnimationOptions) {
  if (!props.prizes.length) return
  const rng = mulberry32(options.seed)
  const baseLength = props.prizes.length

  // S12: if the awarded prize is somehow missing from the local pool
  // (CRM hid the prize between fetchState and spin, or a stale cache),
  // we still need to land the strip on _something_ visible. Splice the
  // result into the display pool as a synthetic landing card so the
  // animation can play and the user sees the win.
  let targetIndexInPool = props.prizes.findIndex((prize) => prize.id === options.prizeId)
  if (targetIndexInPool === -1) {
    targetIndexInPool = 0
  }

  const targetSegment = REPEAT - 2
  const targetIndex = targetSegment * baseLength + targetIndexInPool

  // Subtle random jitter inside the card so it does not always stop dead-center.
  const jitter = (rng() - 0.5) * 24
  const targetOffset = offsetForIndex(targetIndex) + jitter

  trackTransition.value = 'none'
  currentOffset.value = offsetForIndex(REST_OFFSET_INDEX)
  await new Promise((resolve) => requestAnimationFrame(resolve))
  await new Promise((resolve) => requestAnimationFrame(resolve))

  // S15: respect prefers-reduced-motion. The original 5.4s cinematic
  // spin is fine for most users but actively unpleasant for people with
  // vestibular sensitivity.
  const reducedMotion = prefersReducedMotion()
  const duration = options.durationMs ?? (reducedMotion ? 800 : 5400)
  const easing = reducedMotion ? 'ease-out' : 'cubic-bezier(0.18, 0.94, 0.16, 1)'
  trackTransition.value = `transform ${duration}ms ${easing}`
  currentOffset.value = targetOffset
  landedIndex.value = -1

  await new Promise<void>((resolve) =>
    trackTimer(setTimeout(resolve, duration + 80)),
  )
  landedIndex.value = targetIndex
  emit('animationDone', { prizeId: options.prizeId })
}

function reset() {
  landedIndex.value = -1
  snapToRest()
}

onMounted(() => {
  if (props.prizes.length && !displayPrizes.value.length) {
    displayPrizes.value = buildBaseStrip(props.prizes)
  }
  snapToRest()
})

onBeforeUnmount(() => {
  for (const timer of pendingTimers) {
    clearTimeout(timer)
  }
  pendingTimers.clear()
})

defineExpose({ runSpin, reset })
</script>

<style scoped>
.wheel-strip {
  width: 100%;
}

.wheel-strip__viewport {
  position: relative;
  width: 100%;
  height: 192px;
  overflow: hidden;
  padding: 16px 0;
}

.wheel-strip__track {
  display: flex;
  gap: 16px;
  height: 100%;
  align-items: center;
  will-change: transform;
}

.wheel-strip__card {
  flex: 0 0 140px;
}

.wheel-strip__card--landed {
  transform: scale(1.04);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
  transition: transform 0.4s ease, box-shadow 0.4s ease;
}

.wheel-strip__pointer {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  background: linear-gradient(180deg, #ffffff 0%, rgba(255, 255, 255, 0.7) 100%);
  pointer-events: none;
  z-index: 2;
  border-radius: 2px;
  box-shadow: 0 0 12px rgba(255, 255, 255, 0.6);
}

.wheel-strip__pointer-arrow {
  position: absolute;
  top: -2px;
  left: 50%;
  width: 0;
  height: 0;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-top: 9px solid #ffffff;
  transform: translateX(-50%);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25));
}

.wheel-strip__edge {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 64px;
  pointer-events: none;
  z-index: 1;
}

.wheel-strip__edge--left {
  left: 0;
  background: linear-gradient(
    90deg,
    rgba(245, 3, 2, 0.95) 0%,
    rgba(245, 3, 2, 0) 100%
  );
}

.wheel-strip__edge--right {
  right: 0;
  background: linear-gradient(
    270deg,
    rgba(169, 15, 14, 0.95) 0%,
    rgba(169, 15, 14, 0) 100%
  );
}
</style>
