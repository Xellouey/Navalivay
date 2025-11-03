<template>
  <div class="product-variant-card">
    <!-- Кнопка сворачивания -->
    <button
      type="button"
      class="variant-collapse-btn"
      @click.stop="$emit('collapse')"
      aria-label="Свернуть"
      title="Свернуть товар"
    >
      <ChevronUpIcon class="collapse-icon" />
    </button>
    
    <!-- Основное содержимое: изображение слева, информация справа -->
    <div class="variant-card-main">
      <!-- Блок изображения -->
      <div class="variant-image-block">
        <div v-if="currentVariantImage" class="variant-image-wrapper">
          <img :src="currentVariantImage" :alt="product.title" />
        </div>
        <div v-else class="variant-image-placeholder">
          <span class="placeholder-text">Нет фото</span>
        </div>
      </div>

      <!-- Блок информации -->
      <div class="variant-info-block">
        <div class="variant-header-row">
          <h4 class="variant-title">{{ product.title }}</h4>
          <!-- Выбор цветов на одной строке с названием -->
          <div class="variant-colors-inline">
            <button
              v-for="variant in product.variants"
              :key="variant.id"
              type="button"
              class="color-dot"
              :class="{ 
                'is-selected': selectedVariantId === variant.id,
                'is-disabled': !isVariantAvailable(variant),
                'no-color': !variant.colorCode
              }"
              :disabled="!isVariantAvailable(variant)"
              @click.stop="selectVariant(variant.id!)"
              :title="variant.name"
              :style="variant.colorCode ? { backgroundColor: variant.colorCode } : {}"
            >
              <span v-if="selectedVariantId === variant.id" class="dot-check">✓</span>
            </button>
          </div>
        </div>
        <p v-if="product.description" class="variant-description">{{ product.description }}</p>
        
        <!-- Цена и кнопка на одной строке -->
        <div class="variant-footer-row">
          <span class="variant-price">{{ formatPrice(currentPrice) }} ₽</span>
          
          <!-- Кнопки управления количеством -->
          <div class="liquid-flavor-actions">
            <div
              v-if="getQuantity(product.id, selectedVariantId) > 0"
              class="liquid-flavor-quantity"
              :class="{ 'is-limit': isAtStockLimit() }"
            >
              <button
                type="button"
                class="flavor-qty-btn flavor-qty-btn-minus"
                @click.stop="decrementQuantity()"
                aria-label="Убавить количество"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true" data-slot="icon" class="flavor-qty-icon">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14"></path>
                </svg>
              </button>
              <span class="flavor-qty-value">{{ getQuantity(product.id, selectedVariantId) }}</span>
              <button
                type="button"
                class="flavor-qty-btn flavor-qty-btn-plus"
                :class="{ 'is-disabled': isAtStockLimit() }"
                @click.stop="handleIncrement()"
                aria-label="Добавить еще"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true" data-slot="icon" class="flavor-qty-icon">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"></path>
                </svg>
              </button>
            </div>
            <button
              v-else
              type="button"
              class="liquid-flavor-add"
              :class="{ 'is-disabled': !canAdd() }"
              @click.stop="handleAdd()"
              aria-label="Добавить в корзину"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true" data-slot="icon" class="flavor-add-icon">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { PlusIcon, MinusIcon, ChevronUpIcon } from '@heroicons/vue/24/outline'
import { useCartStore } from '@/stores/cart'
import type { Product, ProductVariant } from '@/stores/catalog'

const props = defineProps<{
  product: Product
}>()

const emit = defineEmits<{
  (e: 'productClick', product: Product): void
  (e: 'showToast', payload: { message: string; type: 'error' | 'success' | 'info' }): void
  (e: 'collapse'): void
}>()

const cartStore = useCartStore()

// Локальное состояние выбранного варианта
const selectedVariantId = ref<string | null>(null)

// Инициализация: выбираем первый доступный вариант
watch(() => props.product.variants, (variants) => {
  if (variants && variants.length > 0 && !selectedVariantId.value) {
    // Выбираем первый вариант с наличием, или просто первый
    const firstAvailable = variants.find(v => (v.stock === null || v.stock === undefined || v.stock > 0))
    selectedVariantId.value = (firstAvailable || variants[0]).id || null
  }
}, { immediate: true })

// Текущий выбранный вариант
const currentVariant = computed(() => {
  if (!props.product.variants || !selectedVariantId.value) return null
  return props.product.variants.find(v => v.id === selectedVariantId.value) || props.product.variants[0]
})

// Изображение текущего варианта
const currentVariantImage = computed(() => {
  if (!currentVariant.value || !currentVariant.value.images?.length) return null
  return currentVariant.value.images[0]
})

// Цена текущего варианта
const currentPrice = computed(() => {
  if (currentVariant.value?.priceRub) {
    return currentVariant.value.priceRub
  }
  return props.product.priceRub || 0
})

function selectVariant(variantId: string) {
  selectedVariantId.value = variantId
}

function isVariantAvailable(variant: ProductVariant): boolean {
  return variant.stock === null || variant.stock === undefined || variant.stock > 0
}

function formatPrice(price: number): string {
  return price.toLocaleString('ru-RU')
}

function getQuantity(productId: string, variantId: string | null): number {
  const item = cartStore.items.find(item => item.productId === productId && item.variantId === variantId)
  return item ? item.quantity : 0
}

function canAdd(): boolean {
  if (!currentVariant.value) return false
  if (!isVariantAvailable(currentVariant.value)) return false
  
  const currentQty = getQuantity(props.product.id, selectedVariantId.value)
  if (typeof currentVariant.value.stock === 'number') {
    return currentQty < currentVariant.value.stock
  }
  return true
}

function isAtStockLimit(): boolean {
  if (!currentVariant.value) return true
  if (!isVariantAvailable(currentVariant.value)) return true
  
  if (typeof currentVariant.value.stock === 'number') {
    const stock = Math.max(currentVariant.value.stock, 0)
    if (stock === 0) return true
    return getQuantity(props.product.id, selectedVariantId.value) >= stock
  }
  return false
}

function handleAdd() {
  if (!canAdd()) {
    emit('showToast', { message: 'Товара нет в наличии', type: 'error' })
    return
  }
  cartStore.addItem(props.product, 1, selectedVariantId.value || undefined)
}

function handleIncrement() {
  if (!canAdd()) {
    emit('showToast', { message: 'В наличии больше нет', type: 'error' })
    return
  }
  cartStore.addItem(props.product, 1, selectedVariantId.value || undefined)
}

function decrementQuantity() {
  const currentQty = getQuantity(props.product.id, selectedVariantId.value)
  if (currentQty > 1) {
    cartStore.updateQuantity(props.product.id, currentQty - 1, selectedVariantId.value || undefined)
  } else if (currentQty === 1) {
    cartStore.removeItem(props.product.id, selectedVariantId.value || undefined)
  }
}
</script>

<style scoped>
.product-variant-card {
  @apply mb-2 bg-white rounded-lg border border-gray-200 overflow-hidden relative;
}

/* Кнопка сворачивания */
.variant-collapse-btn {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 10;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 9999px;
  background: #f5f5f5;
  border: none;
  transition: all 0.2s ease;
  cursor: pointer;
  opacity: 0;
  animation: fadeIn 0.3s ease 0.1s forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.variant-collapse-btn:hover {
  background: #fef2f2;
  transform: scale(1.05);
}

.collapse-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #4b5563;
  transition: color 0.2s ease;
}

.variant-collapse-btn:hover .collapse-icon {
  color: #4b5563;
}

/* Основной блок с изображением и информацией */
.variant-card-main {
  @apply flex gap-3 p-3;
  padding-right: 3.5rem;
}

/* Блок изображения */
.variant-image-block {
  @apply flex-shrink-0 w-40 h-40 sm:w-48 sm:h-48;
}

.variant-image-wrapper {
  @apply w-full h-full rounded-md overflow-hidden bg-gray-50;
}

.variant-image-wrapper img {
  @apply w-full h-full object-cover;
}

.variant-image-placeholder {
  @apply w-full h-full rounded-md bg-gray-50 flex items-center justify-center;
}

.placeholder-text {
  @apply text-xs text-gray-400 font-medium;
}

/* Блок информации */
.variant-info-block {
  @apply flex-1 flex flex-col justify-between min-w-0;
}

/* Строка с названием и цветами */
.variant-header-row {
  @apply flex items-center justify-between gap-2 mb-1;
}

.variant-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 900;
  letter-spacing: -0.01em;
  text-transform: uppercase;
  color: #000000;
  line-height: 1.15;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Инлайн выбор цветов */
.variant-colors-inline {
  @apply flex gap-2 flex-shrink-0;
}

.color-dot {
  @apply w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-gray-200 shadow-sm flex items-center justify-center transition-all;
  @apply hover:scale-105 active:scale-95;
}

.color-dot.is-selected {
  @apply ring-2 ring-brand-primary border-white scale-105;
}

.color-dot.is-disabled {
  @apply opacity-40 cursor-not-allowed;
}

.color-dot.no-color {
  @apply bg-gray-300;
}

.dot-check {
  @apply text-white text-sm font-bold drop-shadow;
}

.variant-description {
  @apply text-xs text-gray-600 mb-2 line-clamp-1;
}

/* Строка с ценой и кнопкой */
.variant-footer-row {
  @apply flex items-center justify-between gap-3;
  margin-top: 0.5rem;
}

.variant-price {
  font-size: 1.5rem;
  font-weight: 900;
  color: #ed1d24;
  letter-spacing: -0.02em;
  line-height: 48px;
  height: 48px;
  display: flex;
  align-items: center;
}

/* Точное копирование стилей из liquid компонентов */
.liquid-flavor-actions {
  display: flex;
  align-items: center;
}

.liquid-flavor-add {
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 16px;
  background: linear-gradient(180deg, #ff6666 0%, #e60000 100%);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
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
  width: 24px;
  height: 24px;
  stroke-width: 3;
}

.liquid-flavor-quantity {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.flavor-qty-btn {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: linear-gradient(180deg, #ff6666 0%, #e60000 100%);
  color: #ffffff;
  flex-shrink: 0;
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
  background: linear-gradient(180deg, #d0d0d0 0%, #b0b0b0 100%);
  color: #666666;
}

.flavor-qty-icon {
  width: 20px;
  height: 20px;
  stroke-width: 3;
}

.flavor-qty-value {
  font-size: 1.1rem;
  font-weight: 800;
  color: #000000;
  min-width: 2rem;
  text-align: center;
  flex-shrink: 0;
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .variant-card-main {
    @apply flex-col gap-3 p-3;
  }
  
  .variant-image-block {
    @apply w-full h-auto aspect-square;
  }
}

@media (max-width: 768px) {
  .variant-title {
    font-size: 0.9rem;
  }
  
  .variant-price {
    font-size: 1.35rem;
    line-height: 46px;
    height: 46px;
  }
  
  .liquid-flavor-add,
  .flavor-qty-btn {
    width: 46px;
    height: 46px;
  }
  
  .flavor-add-icon,
  .flavor-qty-icon {
    width: 19px;
    height: 19px;
  }
}

@media (max-width: 640px) {
  .variant-title {
    font-size: 0.85rem;
  }
  
  .variant-price {
    font-size: 1.25rem;
    line-height: 42px;
    height: 42px;
  }
  
  .color-dot {
    @apply w-7 h-7;
  }
  
  .variant-footer-row {
    @apply gap-2;
  }
  
  .liquid-flavor-add,
  .flavor-qty-btn {
    width: 42px;
    height: 42px;
  }
  
  .flavor-add-icon,
  .flavor-qty-icon {
    width: 18px;
    height: 18px;
  }
}

@media (max-width: 480px) {
  .variant-title {
    font-size: 0.8rem;
  }
  
  .variant-price {
    font-size: 1.15rem;
    line-height: 40px;
    height: 40px;
  }
  
  .variant-footer-row {
    margin-top: 0.4rem;
  }
  
  .liquid-flavor-add,
  .flavor-qty-btn {
    width: 40px;
    height: 40px;
    border-radius: 11px;
  }
  
  .flavor-add-icon,
  .flavor-qty-icon {
    width: 16px;
    height: 16px;
  }
  
  .flavor-qty-value {
    font-size: 0.88rem;
    min-width: 1.35rem;
  }
}

@media (max-width: 360px) {
  .variant-title {
    font-size: 0.75rem;
  }
  
  .variant-price {
    font-size: 1.05rem;
    line-height: 38px;
    height: 38px;
  }
  
  .variant-footer-row {
    margin-top: 0.35rem;
  }
  
  .liquid-flavor-add,
  .flavor-qty-btn {
    width: 38px;
    height: 38px;
    border-radius: 10px;
  }
  
  .flavor-add-icon,
  .flavor-qty-icon {
    width: 15px;
    height: 15px;
  }
  
  .flavor-qty-value {
    font-size: 0.85rem;
    min-width: 1.25rem;
  }
  
  .color-dot {
    @apply w-6 h-6;
  }
}
</style>
