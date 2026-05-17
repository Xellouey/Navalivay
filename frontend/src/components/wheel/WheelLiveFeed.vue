<template>
  <div v-if="items.length" class="wheel-live-feed" aria-label="Последние выигрыши">
    <div class="wheel-live-feed__inner">
      <div class="wheel-live-feed__row" :style="{ animationDuration: `${animationSeconds}s` }">
        <div
          v-for="(item, index) in repeated"
          :key="`${item.id}-${index}`"
          class="wheel-live-feed__item"
        >
          <div class="wheel-live-feed__avatar">
            <img v-if="item.photo" :src="item.photo" :alt="item.first_name" />
            <span v-else>{{ item.first_name.slice(0, 1).toUpperCase() }}</span>
          </div>
          <div class="wheel-live-feed__copy">
            <p class="wheel-live-feed__line wheel-live-feed__line--name">
              {{ item.first_name }}{{ item.last_initial ? ` ${item.last_initial}.` : '' }}
            </p>
            <p class="wheel-live-feed__line wheel-live-feed__line--prize">
              {{ item.prize_title }}
            </p>
          </div>
          <span
            v-if="item.rarity"
            class="wheel-live-feed__rarity"
            :style="{ background: item.rarity.bgColor, color: item.rarity.textColor }"
          >
            {{ item.rarity.label }}
          </span>
          <span class="wheel-live-feed__time">{{ formatRelative(item.spun_at) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WheelFeedItem } from '@/stores/wheel'

const props = defineProps<{
  items: WheelFeedItem[]
}>()

const repeated = computed(() => {
  if (!props.items.length) return []
  return [...props.items, ...props.items]
})

const animationSeconds = computed(() => Math.max(20, props.items.length * 3))

function formatRelative(iso: string): string {
  if (!iso) return ''
  const date = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
  const diff = Date.now() - date.getTime()
  if (Number.isNaN(diff) || diff < 0) return 'только что'
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'только что'
  if (minutes < 60) return `${minutes} мин назад`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ч назад`
  const days = Math.floor(hours / 24)
  return `${days} дн назад`
}
</script>

<style scoped>
.wheel-live-feed {
  width: 100%;
  background: #ffffff;
  border-radius: 22px;
  padding: 12px 0;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
}

.wheel-live-feed__inner {
  width: 100%;
  overflow: hidden;
  position: relative;
  mask-image: linear-gradient(
    90deg,
    transparent 0,
    #000 40px,
    #000 calc(100% - 40px),
    transparent 100%
  );
}

.wheel-live-feed__row {
  display: flex;
  gap: 18px;
  width: max-content;
  animation-name: wheel-feed-marquee;
  animation-iteration-count: infinite;
  animation-timing-function: linear;
}

.wheel-live-feed__item {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px;
  border-radius: 14px;
  background: rgba(245, 247, 250, 0.7);
}

.wheel-live-feed__avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #ECEEF2;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Montserrat', sans-serif;
  font-weight: 600;
  font-size: 13px;
  color: #5C6470;
  overflow: hidden;
}

.wheel-live-feed__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.wheel-live-feed__copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-family: 'SF Pro Display', system-ui, sans-serif;
  white-space: nowrap;
}

.wheel-live-feed__line {
  margin: 0;
  font-size: 13px;
  line-height: 1.2;
}

.wheel-live-feed__line--name {
  color: #1F2933;
  font-weight: 600;
}

.wheel-live-feed__line--prize {
  color: #5C6470;
}

.wheel-live-feed__rarity {
  display: inline-flex;
  height: 20px;
  padding: 0 10px;
  border-radius: 999px;
  font-family: 'Montserrat', sans-serif;
  font-weight: 600;
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  align-items: center;
}

.wheel-live-feed__time {
  font-family: 'SF Pro Display', system-ui, sans-serif;
  font-size: 12px;
  color: #9AA0A6;
  margin-left: 4px;
}

@keyframes wheel-feed-marquee {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(-50%, 0, 0);
  }
}
</style>
