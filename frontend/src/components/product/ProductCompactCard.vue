<template>
  <div class="product-compact-card" @click="$emit('click')">
    <!-- Основное содержимое -->
    <div class="compact-card-main">
      <!-- Изображение первого варианта -->
      <div class="compact-image-block">
        <div v-if="firstVariantImage" class="compact-image-wrapper">
          <img :src="firstVariantImage" :alt="product.title" />
        </div>
        <div v-else class="compact-image-placeholder">
          <span class="placeholder-text">Нет фото</span>
        </div>
      </div>

      <!-- Информация -->
      <div class="compact-info-block">
        <h4 class="compact-title">{{ product.title }}</h4>
        <div class="compact-meta">
          <span class="compact-price">от {{ formatPrice(minPrice) }} ₽</span>
          <span class="compact-variants">{{ variantCount }} {{ variantLabel }}</span>
        </div>
      </div>

      <!-- Иконка раскрытия -->
      <div class="compact-arrow">
        <ChevronRightIcon class="arrow-icon" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRightIcon } from '@heroicons/vue/24/outline'
import type { Product } from '@/stores/catalog'

const props = defineProps<{
  product: Product
}>()

defineEmits<{
  (e: 'click'): void
}>()

// Первое изображение первого варианта
const firstVariantImage = computed(() => {
  if (props.product.variants?.length && props.product.variants[0].images?.length) {
    return props.product.variants[0].images[0]
  }
  return props.product.images?.[0] || null
})

// Минимальная цена среди вариантов
const minPrice = computed(() => {
  if (!props.product.variants?.length) {
    return props.product.priceRub || 0
  }
  
  const prices = props.product.variants
    .map(v => v.priceRub)
    .filter((p): p is number => p !== null && p !== undefined)
  
  return prices.length > 0 ? Math.min(...prices) : props.product.priceRub || 0
})

// Количество вариантов
const variantCount = computed(() => {
  return props.product.variants?.length || 0
})

// Правильное склонение для вариантов
const variantLabel = computed(() => {
  const count = variantCount.value
  if (count === 1) return 'цвет'
  if (count >= 2 && count <= 4) return 'цвета'
  return 'цветов'
})

function formatPrice(price: number): string {
  return price.toLocaleString('ru-RU')
}
</script>

<style scoped>
.product-compact-card {
  @apply mb-2 bg-white rounded-lg border-2 border-gray-200 overflow-hidden cursor-pointer;
}

.compact-card-main {
  @apply flex items-center gap-3 p-3;
}

/* Блок изображения */
.compact-image-block {
  @apply flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20;
}

.compact-image-wrapper {
  @apply w-full h-full rounded-md overflow-hidden bg-gray-50;
}

.compact-image-wrapper img {
  @apply w-full h-full object-cover;
}

.compact-image-placeholder {
  @apply w-full h-full rounded-md bg-gray-50 flex items-center justify-center;
}

.placeholder-text {
  @apply text-xs text-gray-400 font-medium;
}

/* Блок информации */
.compact-info-block {
  @apply flex-1 min-w-0;
}

.compact-title {
  @apply text-sm sm:text-base font-bold text-brand-dark mb-1 truncate;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: -0.01em;
}

.compact-meta {
  @apply flex items-center gap-2 text-xs sm:text-sm;
}

.compact-price {
  @apply font-bold text-brand-red;
  font-size: 1rem;
}

.compact-variants {
  @apply text-gray-600 font-medium;
}

/* Иконка */
.compact-arrow {
  flex-shrink: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 2rem !important;
  height: 2rem !important;
  border-radius: 9999px !important;
  background: #f5f5f5 !important;
  transition: all 0.2s ease !important;
}

.product-compact-card:hover .compact-arrow {
  background: #fef2f2 !important;
}

.arrow-icon {
  width: 1.25rem !important;
  height: 1.25rem !important;
  color: #4b5563 !important;
  transition: color 0.2s ease !important;
}

.product-compact-card:hover .arrow-icon {
  color: #4b5563 !important;
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .compact-title {
    font-size: 0.85rem;
  }
  
  .compact-price {
    font-size: 0.9rem;
  }
  
  .compact-variants {
    font-size: 0.75rem;
  }
}

@media (max-width: 480px) {
  .compact-title {
    font-size: 0.8rem;
  }
  
  .compact-price {
    font-size: 0.85rem;
  }
}
</style>
