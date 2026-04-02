<template>
  <nav ref="statusBarRef" class="wholesale-status-bar" aria-label="Статус оптового заказа">
    <div class="wholesale-status-card">
      <div class="wholesale-status-copy">
        <p class="wholesale-status-kicker">{{ wholesaleStore.wholesaleLabel || 'Оптовый прайс' }}</p>
        <p class="wholesale-status-amount">В корзине {{ totalAmountLabel }} BYN</p>
        <p class="wholesale-status-meta">
          {{ statusText }}
        </p>
      </div>

      <button
        type="button"
        class="wholesale-status-button"
        :disabled="!cartStore.items.length"
        @click="goToCheckout"
      >
        {{ actionLabel }}
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useCartStore } from '@/stores/cart'
import { useWholesaleStore } from '@/stores/wholesale'

const router = useRouter()
const cartStore = useCartStore()
const wholesaleStore = useWholesaleStore()

const statusBarRef = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null

const totalAmountLabel = computed(() => Number(cartStore.totalAmount || 0).toFixed(2))
const remainingAmount = computed(() => wholesaleStore.remainingToMinimum(cartStore.totalAmount))
const meetsMinimum = computed(() => wholesaleStore.meetsMinimum(cartStore.totalAmount))

const statusText = computed(() => {
  if (!cartStore.items.length) {
    return `Минимальный заказ ${Number(wholesaleStore.minOrderAmount || 0).toFixed(0)} BYN`
  }

  if (meetsMinimum.value) {
    return 'Минимум выполнен, можно оформлять заказ'
  }

  return `Не хватает ${remainingAmount.value.toFixed(2)} BYN до минимального заказа`
})

const actionLabel = computed(() => {
  if (!cartStore.items.length) {
    return 'Корзина пуста'
  }

  return meetsMinimum.value ? 'К оформлению' : 'Проверить корзину'
})

function syncStatusBarHeight() {
  if (typeof document === 'undefined' || !statusBarRef.value) {
    return
  }

  document.documentElement.style.setProperty(
    '--app-bottom-tab-bar-height',
    `${statusBarRef.value.offsetHeight + 8}px`,
  )
}

function goToCheckout() {
  if (!cartStore.items.length) {
    return
  }

  router.push('/checkout')
}

onMounted(() => {
  nextTick(syncStatusBarHeight)

  if (typeof ResizeObserver !== 'undefined' && statusBarRef.value) {
    resizeObserver = new ResizeObserver(syncStatusBarHeight)
    resizeObserver.observe(statusBarRef.value)
  }

  window.addEventListener('resize', syncStatusBarHeight)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  window.removeEventListener('resize', syncStatusBarHeight)
})
</script>

<style scoped>
.wholesale-status-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 110;
  padding: 0 12px calc(env(safe-area-inset-bottom, 0px) + 12px);
  pointer-events: none;
}

.wholesale-status-card {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 28px;
  background: linear-gradient(106.76deg, #f50302 -2.64%, #a90f0e 85.78%);
  color: #fff;
  padding: 14px 16px;
  box-shadow: 0 12px 24px rgba(97, 1, 0, 0.18);
}

.wholesale-status-copy {
  min-width: 0;
  flex: 1 1 auto;
}

.wholesale-status-kicker {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.72);
}

.wholesale-status-amount {
  margin: 4px 0 0;
  font-family: "Montserrat", sans-serif;
  font-size: 16px;
  font-weight: 700;
  line-height: 20px;
}

.wholesale-status-meta {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 16px;
  color: rgba(255, 255, 255, 0.85);
}

.wholesale-status-button {
  flex-shrink: 0;
  border: none;
  border-radius: 18px;
  background: #fff;
  color: #191919;
  padding: 12px 14px;
  font-size: 13px;
  font-weight: 700;
  line-height: 16px;
}

.wholesale-status-button:disabled {
  opacity: 0.5;
}
</style>
