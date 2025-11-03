<template>
  <li class="liquid-product" @click="handleClick">
    <div class="liquid-product-col liquid-product-primary">
      <span class="liquid-product-title">
        {{ product.title || 'Без названия' }}
      </span>
      <span v-if="product.variant" class="liquid-product-variant">
        {{ product.variant }}
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
    <div class="liquid-product-col liquid-product-strength-col">
      <span v-if="product.strength && product.strength.trim() && product.strength !== '0'" class="liquid-product-strength">
        {{ product.strength }}
      </span>
      <span v-else class="liquid-product-strength placeholder">—</span>
    </div>
    <div class="liquid-product-col liquid-product-price-col">
      <span class="liquid-product-price">{{ formattedPrice }} ₽</span>
    </div>
    <div class="liquid-product-col liquid-product-stock-col">
      <span class="liquid-product-stock" :class="stockClass">
        {{ availabilityLabel }}
      </span>
      <span v-if="stockText" class="liquid-product-stock-note">
        {{ stockText }}
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
  display: grid;
  grid-template-columns: minmax(0, 2.4fr) minmax(0, 1fr) minmax(110px, 0.8fr) minmax(110px, 0.9fr);
  grid-template-areas: 'primary strength price stock';
  gap: 0.9rem;
  align-items: center;
  padding: 0.85rem 1rem;
  border-radius: 18px;
  border: 2px solid rgba(0, 0, 0, 0.06);
  background: linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(247,247,247,0.98) 100%);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.liquid-product:hover {
  transform: translate(-3px, -3px);
  box-shadow: var(--navalivay-shadow-hover);
}

.liquid-product-col {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.liquid-product-primary {
  gap: 0.4rem;
  grid-area: primary;
}

.liquid-product-title {
  font-weight: 800;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--navalivay-black);
  line-height: 1.35;
}

.liquid-product-variant {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--navalivay-gray);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.liquid-product-strength {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--navalivay-gray);
  letter-spacing: 0.08em;
  text-transform: uppercase;
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
  padding: 0.3rem 0.65rem;
  border-radius: 9999px;
  background: #e60000;
  border: 2px solid #ffffff;
  font-size: 0.6rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(230, 0, 0, 0.35), 0 2px 4px rgba(0, 0, 0, 0.15);
}

.liquid-product-strength-col {
  justify-content: center;
  grid-area: strength;
}

.liquid-product-strength.placeholder {
  color: rgba(0, 0, 0, 0.35);
}

.liquid-product-price-col {
  justify-content: center;
  grid-area: price;
}

.liquid-product-price {
  font-weight: 900;
  color: var(--navalivay-red);
  font-size: 0.95rem;
  letter-spacing: 0.05em;
}

.liquid-product-stock-col {
  align-items: flex-end;
  justify-content: center;
  gap: 0.2rem;
  grid-area: stock;
}

.liquid-product-stock {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--navalivay-gray);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.liquid-product-stock-note {
  font-size: 0.65rem;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.45);
  letter-spacing: 0.04em;
  text-transform: uppercase;
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

@media (max-width: 1024px) {
  .liquid-product {
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(110px, 0.7fr) minmax(110px, 0.8fr);
    grid-template-areas: 'primary strength price stock';
  }
}

@media (max-width: 768px) {
  .liquid-product {
    grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
    grid-template-areas:
      'primary price'
      'strength stock';
    gap: 0.65rem;
    padding: 0.8rem 0.85rem;
  }

  .liquid-product-price-col {
    align-items: flex-start;
  }

  .liquid-product-stock-col {
    align-items: flex-start;
  }
}

@media (max-width: 560px) {
  .liquid-product {
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 0.9fr);
    grid-template-areas:
      'primary price'
      'primary stock'
      'strength stock';
    gap: 0.55rem;
    border-radius: 16px;
    padding: 0.75rem 0.8rem;
  }

  .liquid-product-primary {
    gap: 0.35rem;
  }

  .liquid-product-title {
    font-size: 0.85rem;
    line-height: 1.3;
  }

  .liquid-product-variant {
    font-size: 0.65rem;
  }

  .liquid-product-price-col,
  .liquid-product-stock-col {
    align-items: flex-start;
  }

  .liquid-product-price {
    font-size: 0.92rem;
  }

  .liquid-product-stock {
    font-size: 0.6rem;
  }

  .liquid-product-stock-note {
    font-size: 0.58rem;
  }
}
</style>
