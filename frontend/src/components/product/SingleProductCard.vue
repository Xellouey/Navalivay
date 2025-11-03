<template>
  <div class="liquid-line-card-single">
    <div class="liquid-line-single-header">
      <div class="liquid-line-single-main">
        <div v-if="productImage" class="liquid-line-image">
          <img :src="productImage" :alt="product.title" />
        </div>
        <div class="liquid-line-info">
          <span
            v-for="(badge, badgeIndex) in badges"
            :key="`${badge.type || 'badge'}-${badgeIndex}`"
            class="liquid-line-badge"
            :style="getBadgeStyle(badge)"
          >
            {{ getBadgeLabel(badge) }}
          </span>
          <h3 class="liquid-line-title">{{ product.title || 'Без названия' }}</h3>
          <p v-if="product.description" class="liquid-line-description">{{ product.description }}</p>
        </div>
      </div>
      <div class="liquid-line-single-side">
        <div
          v-if="quantity > 0"
          class="liquid-flavor-quantity"
          :class="{ 'is-limit': isAtStockLimit }"
        >
          <button
            type="button"
            class="flavor-qty-btn flavor-qty-btn-minus"
            @click.stop="$emit('decrement')"
            aria-label="Убавить количество"
          >
            <MinusIcon class="flavor-qty-icon" />
          </button>
          <span class="flavor-qty-value">{{ quantity }}</span>
          <button
            type="button"
            class="flavor-qty-btn flavor-qty-btn-plus"
            :class="{ 'is-disabled': isAtStockLimit }"
            @click.stop="$emit('increment')"
            aria-label="Добавить еще"
          >
            <PlusIcon class="flavor-qty-icon" />
          </button>
        </div>
        <button
          v-else
          type="button"
          class="liquid-flavor-add"
          :class="{ 'is-disabled': !canAdd }"
          @click.stop="$emit('add')"
          aria-label="Добавить в корзину"
        >
          <PlusIcon class="flavor-add-icon" />
        </button>
        <div class="liquid-line-price">
          <span class="price-value">{{ formattedPrice }}</span>
          <span class="price-currency">₽</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { PlusIcon, MinusIcon } from '@heroicons/vue/24/outline'
import type { Product, ProductBadge } from '@/stores/catalog'

interface Props {
  product: Product
  quantity?: number
}

const props = withDefaults(defineProps<Props>(), {
  quantity: 0
})

defineEmits<{
  (e: 'add'): void
  (e: 'increment'): void
  (e: 'decrement'): void
}>()

const productImage = computed(() => {
  // Для товаров с вариантами берём изображение первого варианта
  if (props.product.hasVariants && props.product.variants?.length && props.product.variants[0].images?.length) {
    return props.product.variants[0].images[0]
  }
  
  if (props.product.images?.[0]) return props.product.images[0]
  if (props.product.links?.length) {
    for (const link of props.product.links) {
      const url = link.url?.toLowerCase() || ''
      if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i)) {
        return link.url
      }
    }
    return props.product.links[0]?.url || null
  }
  return null
})

const badges = computed(() => {
  if (!Array.isArray(props.product.badges)) {
    return []
  }
  return props.product.badges.filter((badge): badge is ProductBadge => Boolean(badge && (badge.label || badge.type)))
})

const formattedPrice = computed(() => {
  return props.product.priceRub.toLocaleString('ru-RU')
})

const canAdd = computed(() => {
  if (props.product.isAvailable === false) return false
  if (typeof props.product.stock === 'number') {
    const stock = Math.max(props.product.stock, 0)
    if (stock === 0) return false
    return props.quantity < stock
  }
  return true
})

const isAtStockLimit = computed(() => {
  if (props.product.isAvailable === false) return true
  if (typeof props.product.stock === 'number') {
    const stock = Math.max(props.product.stock, 0)
    if (stock === 0) return true
    return props.quantity >= stock
  }
  return false
})

function getBadgeLabel(badge: ProductBadge) {
  return badge.label || badge.type || ''
}

function getBadgeStyle(badge: ProductBadge) {
  const style: Record<string, string> = {}
  if (badge.color) {
    style.backgroundColor = badge.color
    style.borderColor = badge.color
  }
  return style
}
</script>

<style scoped>
/* Все стили вынесены в общий файл через CSS-переменные */
/* См. SingleProductCard.css или основной файл стилей */

.liquid-line-card-single {
  padding: 1rem 0 !important;
  border-bottom: 1px solid #e5e5e5 !important;
  background: white !important;
}

.liquid-line-card-single:first-of-type {
  padding-top: 0 !important;
}

.liquid-line-single-header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 0.75rem !important;
  min-height: 90px !important;
}

.liquid-line-single-main {
  display: flex !important;
  align-items: center !important;
  gap: 0.75rem !important;
  flex: 1 !important;
  min-width: 0 !important;
}

.liquid-line-image {
  width: 70px !important;
  height: 93px !important;
  flex-shrink: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  overflow: hidden !important;
  border-radius: 6px !important;
}

.liquid-line-image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.liquid-line-info {
  display: flex !important;
  flex-direction: column !important;
  gap: 0.25rem !important;
  min-width: 0 !important;
  flex: 1 !important;
  justify-content: center !important;
}

.liquid-line-badge {
  align-self: flex-start !important;
  padding: 0.25rem 0.5rem !important;
  border-radius: 4px !important;
  background: #ed1d24 !important;
  color: #ffffff !important;
  font-size: 0.6rem !important;
  font-weight: 900 !important;
  letter-spacing: 0.02em !important;
  text-transform: uppercase !important;
  line-height: 1 !important;
}

.liquid-line-title {
  margin: 0 !important;
  font-size: 0.85rem !important;
  font-weight: 900 !important;
  letter-spacing: -0.01em !important;
  text-transform: uppercase !important;
  color: #000000 !important;
  line-height: 1.1 !important;
  word-wrap: break-word !important;
  overflow-wrap: break-word !important;
}

.liquid-line-description {
  font-size: 0.65rem !important;
  font-weight: 600 !important;
  letter-spacing: 0.01em !important;
  text-transform: uppercase !important;
  color: #a5a5a5 !important;
  line-height: 1.15 !important;
  margin: 0 !important;
  word-wrap: break-word !important;
  overflow-wrap: break-word !important;
}

.liquid-line-single-side {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  gap: 0.6rem !important;
  flex-shrink: 0 !important;
}

.liquid-line-price {
  display: flex !important;
  flex-direction: row !important;
  align-items: baseline !important;
  gap: 0.2rem !important;
  font-weight: 900 !important;
  color: #ed1d24 !important;
  line-height: 1 !important;
}

.price-value {
  font-size: 1.25rem !important;
  letter-spacing: -0.02em !important;
}

.price-currency {
  font-size: 0.85rem !important;
}

.liquid-flavor-add {
  width: 42px !important;
  height: 42px !important;
  border: none !important;
  border-radius: 12px !important;
  background: linear-gradient(180deg, #ff6666 0%, #e60000 100%) !important;
  color: #ffffff !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
  flex-shrink: 0 !important;
}

.liquid-flavor-add:hover:not(:disabled) {
  opacity: 0.9;
}

.liquid-flavor-add:disabled,
.liquid-flavor-add.is-disabled {
  background: #d9d9d9;
  color: #9b9b9b;
  cursor: not-allowed;
  pointer-events: auto;
}

.flavor-add-icon {
  width: 20px !important;
  height: 20px !important;
  stroke-width: 3 !important;
}

.liquid-flavor-quantity {
  display: flex !important;
  align-items: center !important;
  gap: 0.4rem !important;
  flex-shrink: 0 !important;
}

.flavor-qty-btn {
  width: 42px !important;
  height: 42px !important;
  border-radius: 12px !important;
  border: none !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
  background: linear-gradient(180deg, #ff6666 0%, #e60000 100%) !important;
  color: #ffffff !important;
  flex-shrink: 0 !important;
}

.flavor-qty-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.flavor-qty-btn:disabled,
.flavor-qty-btn.is-disabled {
  background: #d9d9d9;
  color: #9b9b9b;
  cursor: not-allowed;
  opacity: 0.6;
  pointer-events: auto;
}

.flavor-qty-btn-minus {
  background: linear-gradient(180deg, #d0d0d0 0%, #b0b0b0 100%) !important;
  color: #666666 !important;
}

.flavor-qty-icon {
  width: 18px !important;
  height: 18px !important;
  stroke-width: 3 !important;
}

.flavor-qty-value {
  font-size: 1rem !important;
  font-weight: 800 !important;
  color: #000000 !important;
  min-width: 1.75rem !important;
  text-align: center !important;
  flex-shrink: 0 !important;
}

/* Адаптивность для планшетов */
@media (max-width: 768px) {
  .liquid-line-card-single {
    padding: 0.875rem 0 !important;
  }

  .liquid-line-single-header {
    min-height: 108px !important;
    gap: 0.75rem !important;
  }
  
  .liquid-line-single-main {
    gap: 0.75rem !important;
  }
  
  .liquid-line-image {
    width: 81px !important;
    height: 108px !important;
  }
  
  .liquid-line-title {
    font-size: 1.00625rem !important;
  }
  
  .liquid-line-description {
    font-size: 0.71875rem !important;
  }
  
  .liquid-line-badge {
    font-size: 0.6325rem !important;
    padding: 0.23rem 0.46rem !important;
  }

  .liquid-flavor-add,
  .flavor-qty-btn {
    width: 40px !important;
    height: 40px !important;
  }

  .flavor-add-icon,
  .flavor-qty-icon {
    width: 18px !important;
    height: 18px !important;
  }

  .flavor-qty-value {
    font-size: 0.95rem !important;
    min-width: 1.5rem !important;
  }

  .price-value {
    font-size: 1.3225rem !important;
  }

  .price-currency {
    font-size: 0.92rem !important;
  }
}

/* Оптимизация для мобильных устройств */
@media (max-width: 480px) {
  .liquid-line-card-single {
    padding: 0.75rem 0 !important;
  }

  .liquid-line-single-header {
    min-height: auto !important;
    gap: 0.625rem !important;
  }
  
  .liquid-line-single-main {
    gap: 0.625rem !important;
    flex: 1 !important;
    min-width: 0 !important;
  }
  
  .liquid-line-image {
    width: 74.25px !important;
    height: 98.55px !important;
    border-radius: 10.8px !important;
  }

  .liquid-line-info {
    gap: 0.25rem !important;
  }
  
  .liquid-line-title {
    font-size: 0.92rem !important;
    line-height: 1.2 !important;
  }
  
  .liquid-line-description {
    font-size: 0.69rem !important;
    line-height: 1.2 !important;
  }

  .liquid-line-badge {
    font-size: 0.575rem !important;
    padding: 0.23rem 0.46rem !important;
  }

  .liquid-line-single-side {
    gap: 0.5rem !important;
    flex-shrink: 0 !important;
  }
  
  .liquid-flavor-add,
  .flavor-qty-btn {
    width: 38px !important;
    height: 38px !important;
    border-radius: 12px !important;
  }
  
  .flavor-add-icon,
  .flavor-qty-icon {
    width: 18px !important;
    height: 18px !important;
    stroke-width: 3 !important;
  }

  .liquid-flavor-quantity {
    gap: 0.35rem !important;
  }
  
  .flavor-qty-value {
    font-size: 0.9rem !important;
    min-width: 1.3rem !important;
  }
  
  .price-value {
    font-size: 1.265rem !important;
  }
  
  .price-currency {
    font-size: 0.8625rem !important;
  }
}

/* Оптимизация для маленьких экранов */
@media (max-width: 360px) {
  .liquid-line-card-single {
    padding: 0.625rem 0 !important;
  }

  .liquid-line-single-header {
    gap: 0.5rem !important;
  }

  .liquid-line-single-main {
    gap: 0.5rem !important;
  }

  .liquid-line-image {
    width: 64.8px !important;
    height: 86.4px !important;
  }

  .liquid-line-title {
    font-size: 0.8625rem !important;
  }

  .liquid-line-description {
    font-size: 0.6325rem !important;
  }

  .liquid-line-badge {
    font-size: 0.5175rem !important;
    padding: 0.17rem 0.4rem !important;
  }

  .liquid-line-single-side {
    gap: 0.45rem !important;
  }

  .liquid-flavor-add,
  .flavor-qty-btn {
    width: 36px !important;
    height: 36px !important;
  }

  .flavor-add-icon,
  .flavor-qty-icon {
    width: 16px !important;
    height: 16px !important;
  }

  .flavor-qty-value {
    font-size: 0.85rem !important;
    min-width: 1.2rem !important;
  }

  .price-value {
    font-size: 1.15rem !important;
  }

  .price-currency {
    font-size: 0.805rem !important;
  }
}
</style>
