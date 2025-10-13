<template>
  <li class="liquid-product" @click="handleClick">
    <div class="liquid-product-info">
      <span class="liquid-product-title">
        {{ product.title || 'Без названия' }}
      </span>
      <span v-if="product.variant" class="liquid-product-variant">
        {{ product.variant }}
      </span>
      <span v-if="product.strength" class="liquid-product-strength">
        {{ product.strength }}
      </span>
      <div v-if="displayBadges.length" class="liquid-product-badges">
        <span
          v-for="(badge, index) in displayBadges"
          :key="`${badge.type || 'badge'}-${index}`"
          class="liquid-product-badge"
          :style="badgeStyle(badge)"
        >
          {{ badge.label || badge.type }}
        </span>
      </div>
    </div>
    <div class="liquid-product-meta">
      <span class="liquid-product-price">{{ formattedPrice }} ₽</span>
      <span class="liquid-product-stock" :class="stockClass">
        {{ availabilityLabel }}
        <template v-if="stockText">
          · {{ stockText }}
        </template>
      </span>
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Product, ProductBadge } from '@/stores/catalog'

const props = defineProps<{
  product: Product
}>()

const emit = defineEmits<{
  (e: 'select', product: Product): void
}>()

const isAvailable = computed(() => {
  if (typeof props.product.isAvailable === 'boolean') {
    return props.product.isAvailable
  }
  if (typeof props.product.stock === 'number') {
    return props.product.stock > 0
  }
  return true
})

const isLowStock = computed(() => {
  const stock = props.product.stock
  const minStock = props.product.minStock
  if (typeof stock !== 'number' || stock <= 0) {
    return false
  }
  if (typeof minStock !== 'number' || minStock <= 0) {
    return false
  }
  return stock <= minStock
})

const stockText = computed(() => {
  if (typeof props.product.stock !== 'number') {
    return ''
  }
  return `остаток: ${Math.max(props.product.stock, 0)}`
})

const stockClass = computed(() => ({
  low: isLowStock.value,
  available: isAvailable.value,
  unavailable: !isAvailable.value
}))

const availabilityLabel = computed(() => {
  if (!isAvailable.value) {
    return 'нет в наличии'
  }
  return isLowStock.value ? 'в наличии (мало)' : 'в наличии'
})

const formattedPrice = computed(() => {
  return props.product.priceRub.toLocaleString('ru-RU')
})

const displayBadges = computed<ProductBadge[]>(() => {
  if (!Array.isArray(props.product.badges)) {
    return []
  }
  return props.product.badges.filter((badge) => badge && (badge.label || badge.type))
})

function badgeStyle(badge: ProductBadge) {
  const style: Record<string, string> = {}
  if (badge.color) {
    style.backgroundColor = badge.color
    style.borderColor = badge.color
  }
  return style
}

function handleClick() {
  emit('select', props.product)
}
</script>

<style scoped>
.liquid-product {
  cursor: pointer;
}

.liquid-product-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.liquid-product-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  background: rgba(230, 0, 0, 0.08);
  border: 1px solid rgba(230, 0, 0, 0.35);
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--navalivay-black);
}

.liquid-product-stock.available {
  color: var(--navalivay-gray);
}

.liquid-product-stock.low {
  color: var(--navalivay-red);
}

.liquid-product-stock.unavailable {
  color: var(--navalivay-red);
  text-transform: uppercase;
}

@media (max-width: 640px) {
  .liquid-product {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .liquid-product-meta {
    align-items: flex-start;
  }
}
</style>
