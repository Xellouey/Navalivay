<template>
  <div class="liquid-line-card" :class="{ expanded }">
    <div class="liquid-line-header" @click="toggle">
      <div
        class="liquid-line-main"
        role="button"
        tabindex="0"
        @keyup.enter.prevent="toggle"
        @keyup.space.prevent="toggle"
      >
        <div v-if="coverUrl" class="liquid-line-image">
          <img :src="coverUrl" :alt="title" />
        </div>
        <div class="liquid-line-info">
          <span v-if="badgeLabel" class="liquid-line-badge" :style="badgeStyle">{{ badgeLabel }}</span>
          <h3 class="liquid-line-title">{{ title }}</h3>
          <div v-if="!expanded" class="liquid-line-summary">
            <template v-if="summaryPreview.length > 0">
              <span
                v-for="(line, idx) in summaryPreview"
                :key="`summary-${idx}`"
                class="liquid-line-summary-line"
              >
                {{ line }}
              </span>
            </template>
            <template v-else>
              <span class="liquid-line-summary-line">{{ countLabel }}</span>
            </template>
          </div>
        </div>
      </div>
      <div class="liquid-line-side">
        <button
          type="button"
          class="liquid-line-toggle"
          :class="{ expanded }"
          @click.stop="toggle"
          aria-label="Переключить линейку"
        >
          <ChevronRightIcon class="liquid-line-toggle-icon" />
        </button>
        <div v-if="minPriceLabel" class="liquid-line-price">
          <span class="price-value">{{ minPriceLabel }}</span>
          <span class="price-currency">Br</span>
        </div>
      </div>
    </div>

    <div ref="bodyWrapper" class="liquid-line-body-wrapper" :style="wrapperStyle">
      <div class="liquid-line-body">
        <!-- Товары с вариантами -->
        <div v-if="productsWithVariants.length" class="space-y-3 mb-3">
          <div v-for="product in productsWithVariants" :key="product.id" class="product-card-transition-wrapper">
            <Transition name="product-card-fade" mode="out-in">
              <!-- Компактная карточка -->
              <ProductCompactCard
                v-if="!isVariantProductExpanded(product.id)"
                :key="`compact-${product.id}`"
                :product="product"
                @click="toggleVariantProductExpansion(product.id)"
              />
              
              <!-- Полная карточка с вариантами -->
              <ProductVariantCard
                v-else
                :key="`expanded-${product.id}`"
                :product="product"
                @productClick="() => {}"
                @showToast="(payload) => emit('showToast', payload.message, payload.type)"
                @collapse="toggleVariantProductExpansion(product.id)"
              />
            </Transition>
          </div>
        </div>
        
        <!-- Обычные товары без вариантов -->
        <ul v-if="productsWithoutVariants.length" class="liquid-flavor-list">
          <li
            v-for="product in productsWithoutVariants"
            :key="product.id"
            class="liquid-flavor-row"
          >
            <div class="liquid-flavor-info">
              <span class="liquid-flavor-title">{{ product.title }}</span>
            </div>
            <div class="liquid-flavor-actions">
              <div
                v-if="getQuantity(product.id) > 0"
                class="liquid-flavor-quantity"
                :class="{ 'is-limit': isAtStockLimit(product) }"
              >
                <button
                  type="button"
                  class="flavor-qty-btn flavor-qty-btn-minus"
                  @click.stop="decrementQuantity(product)"
                  aria-label="Убавить количество"
                >
                  <MinusIcon class="flavor-qty-icon" />
                </button>
                <span class="flavor-qty-value">{{ getQuantity(product.id) }}</span>
                <button
                  type="button"
                  class="flavor-qty-btn flavor-qty-btn-plus"
                  :class="{ 'is-disabled': isAtStockLimit(product) }"
                  @click.stop="handleIncrement(product)"
                  aria-label="Добавить еще"
                >
                  <PlusIcon class="flavor-qty-icon" />
                </button>
              </div>
              <button
                v-else
                type="button"
                class="liquid-flavor-add"
                :class="{ 'is-disabled': !canAdd(product) }"
                @click.stop="handleAdd(product)"
                aria-label="Добавить в корзину"
              >
                <PlusIcon class="flavor-add-icon" />
              </button>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { ChevronRightIcon, ChevronDownIcon, PlusIcon, MinusIcon } from '@heroicons/vue/24/outline'
import { useCartStore } from '@/stores/cart'
import type { Product, CategoryGroup } from '@/stores/catalog'
import ProductVariantCard from '@/components/product/ProductVariantCard.vue'
import ProductCompactCard from '@/components/product/ProductCompactCard.vue'

const props = defineProps<{
  groupId: string
  title: string
  products: Product[]
  expanded: boolean
  coverImage?: string | null
  fallbackImage?: string
  subgroups?: CategoryGroup[]
  badge?: string
  badgeColor?: string
}>()

const emit = defineEmits<{
  (e: 'toggle', groupId: string): void
  (e: 'showToast', message: string, type: 'error' | 'success' | 'info'): void
}>()

const cartStore = useCartStore()
const bodyWrapper = ref<HTMLElement | null>(null)
const contentHeight = ref(0)
const expandedVariantProducts = ref<Record<string, boolean>>({})

// Разделение товаров на те, у которых есть варианты, и без них
const productsWithVariants = computed(() => 
  props.products.filter(p => p.hasVariants && p.variants && p.variants.length > 0)
)

const productsWithoutVariants = computed(() => 
  props.products.filter(p => !p.hasVariants)
)

const productNames = computed(() => props.products.map(p => p.title.toUpperCase()))
const badgeLabel = computed(() => (props.badge || '').trim() || null)
const badgeStyle = computed(() => (props.badgeColor ? { backgroundColor: props.badgeColor } : undefined))

const countLabel = computed(() => {
  // Если есть подгруппы, показываем их названия
  if (props.subgroups && props.subgroups.length > 0) {
    const maxVisible = 3
    const subgroupNames = props.subgroups.map(sg => sg.name.toUpperCase())
    
    if (subgroupNames.length <= maxVisible) {
      return subgroupNames.join("\n")
    } else {
      const visible = subgroupNames.slice(0, maxVisible)
      const remaining = subgroupNames.length - maxVisible
      return visible.join("\n") + `\nи еще ${remaining} других...`
    }
  }
  
  // Иначе ничего не показываем
  return ""
})

const coverUrl = computed(() => props.coverImage || props.fallbackImage)
const summaryPreview = computed(() => {
  // summaryPreview больше не используется, всегда показываем countLabel
  return []
})

const minPriceLabel = computed(() => {
  const prices: number[] = []
  
  props.products.forEach(product => {
    // Для товаров с вариантами берем цены из вариантов
    if (product.hasVariants && product.variants && product.variants.length > 0) {
      product.variants.forEach(variant => {
        if (variant.priceRub && typeof variant.priceRub === 'number' && !Number.isNaN(variant.priceRub)) {
          prices.push(variant.priceRub)
        }
      })
    } else {
      // Для обычных товаров берем основную цену
      if (typeof product.priceRub === 'number' && !Number.isNaN(product.priceRub)) {
        prices.push(product.priceRub)
      }
    }
  })
  
  if (!prices.length) return null
  const minPrice = Math.min(...prices)
  
  // Проверяем, есть ли товары с вариантами
  const hasVariants = props.products.some(p => p.hasVariants && p.variants && p.variants.length > 0)
  
  return hasVariants ? `от ${formatPrice(minPrice)}` : formatPrice(minPrice)
})

const wrapperStyle = computed(() => {
  if (!props.expanded) {
    return { maxHeight: '0px' }
  }
  // Всегда используем конкретное значение высоты для плавной анимации
  const height = contentHeight.value > 0 ? contentHeight.value : 5000
  return { maxHeight: `${height}px` }
})

// Функция для расчета высоты
const calculateHeight = async () => {
  await nextTick()
  if (bodyWrapper.value) {
    // Используем scrollHeight самого wrapper для учета всех padding и margin
    contentHeight.value = bodyWrapper.value.scrollHeight
  }
}

// Пересчитываем высоту при раскрытии
watch(() => props.expanded, async (newVal) => {
  if (newVal) {
    // Сначала рассчитываем высоту для плавной анимации
    await nextTick()
    await calculateHeight()
    // Дополнительные пересчёты для плавности
    setTimeout(() => calculateHeight(), 50)
    setTimeout(() => calculateHeight(), 150)
    setTimeout(() => calculateHeight(), 350)
  } else {
    // При сворачивании сбрасываем высоту
    contentHeight.value = 0
  }
})

// Пересчитываем высоту при изменении количества товаров в корзине
watch(() => cartStore.items.length, async () => {
  if (props.expanded) {
    await calculateHeight()
  }
})

// Пересчитываем высоту при изменении состояния развёрнутости товаров
watch(expandedVariantProducts, async () => {
  if (props.expanded) {
    await calculateHeight()
    setTimeout(() => calculateHeight(), 50)
    setTimeout(() => calculateHeight(), 150)
    setTimeout(() => calculateHeight(), 350)
  }
}, { deep: true })

function toggle() {
  emit('toggle', props.groupId)
}

function formatPrice(value?: number | null) {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString('ru-RU')
}

function getQuantity(productId: string): number {
  const item = cartStore.items.find(item => item.productId === productId)
  return item ? item.quantity : 0
}

function canAdd(product: Product) {
  if (product.isAvailable === false) {
    return false
  }
  if (typeof product.stock === 'number') {
    const stock = Math.max(product.stock, 0)
    if (stock === 0) {
      return false
    }
    return getQuantity(product.id) < stock
  }
  return true
}

function isAtStockLimit(product: Product) {
  if (product.isAvailable === false) {
    return true
  }
  if (typeof product.stock === 'number') {
    const stock = Math.max(product.stock, 0)
    if (stock === 0) {
      return true
    }
    return getQuantity(product.id) >= stock
  }
  return false
}


function handleAdd(product: Product) {
  if (!canAdd(product)) {
    if (product.isAvailable === false || (typeof product.stock === 'number' && product.stock <= 0)) {
      emit('showToast', 'Товара нет в наличии', 'error')
    } else {
      emit('showToast', 'В наличии больше нет', 'error')
    }
    return
  }
  addToCart(product)
}

function addToCart(product: Product) {
  cartStore.addItem(product, 1)
}

function handleIncrement(product: Product) {
  if (!canAdd(product)) {
    if (product.isAvailable === false || (typeof product.stock === 'number' && product.stock <= 0)) {
      emit('showToast', 'Товара нет в наличии', 'error')
    } else {
      emit('showToast', 'В наличии больше нет', 'error')
    }
    return
  }
  incrementQuantity(product)
}

function incrementQuantity(product: Product) {
  const currentQty = getQuantity(product.id)
  if (currentQty > 0) {
    cartStore.updateQuantity(product.id, currentQty + 1)
  } else {
    cartStore.addItem(product, 1)
  }
}

function decrementQuantity(product: Product) {
  const currentQty = getQuantity(product.id)
  if (currentQty > 1) {
    cartStore.updateQuantity(product.id, currentQty - 1)
  } else if (currentQty === 1) {
    cartStore.removeItem(product.id)
  }
}

// Функции для работы с товарами с вариантами
function isVariantProductExpanded(productId: string): boolean {
  return expandedVariantProducts.value[productId] ?? false
}

function toggleVariantProductExpansion(productId: string) {
  expandedVariantProducts.value = {
    ...expandedVariantProducts.value,
    [productId]: !isVariantProductExpanded(productId)
  }
}
</script>

<style scoped>
.liquid-line-card {
  padding: 1.25rem 0;
  border-bottom: 1px solid #e5e5e5;
  background: white;
}

.liquid-line-card:first-of-type {
  padding-top: 0;
}

.liquid-line-card:last-of-type {
  border-bottom: none;
}

.liquid-line-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  cursor: pointer;
}

.liquid-line-main {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
  cursor: pointer;
  outline: none;
}

.liquid-line-image {
  width: 110px;
  height: 147px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.liquid-line-image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.liquid-line-info {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
  flex: 1;
}

.liquid-line-badge {
  align-self: flex-start;
  padding: 0.35rem 0.75rem;
  border-radius: 5px;
  background: #ed1d24;
  color: #ffffff;
  font-size: 0.65rem;
  font-weight: 900;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  line-height: 1;
}

.liquid-line-title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 900;
  letter-spacing: -0.01em;
  text-transform: uppercase;
  color: #000000;
  line-height: 1.15;
}

.liquid-line-summary {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  text-transform: uppercase;
  color: #a5a5a5;
  line-height: 1.25;
}

.liquid-line-summary-line {
  display: block;
}

.liquid-line-side {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 1rem;
  flex-shrink: 0;
}

.liquid-line-price {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  font-weight: 900;
  color: #ed1d24;
  line-height: 1;
  order: 1;
}

.price-value {
  font-size: 1.5rem;
  letter-spacing: -0.02em;
}

.price-currency {
  font-size: 1rem;
}

.liquid-line-toggle {
  width: 2rem;
  height: 2rem;
  border-radius: 9999px;
  border: none;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  order: 2;
  flex-shrink: 0;
}

.liquid-line-toggle:hover {
  background: #fef2f2;
}

.liquid-line-toggle.expanded {
  transform: rotate(90deg);
}

.liquid-line-toggle-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #4b5563;
  transition: color 0.2s ease;
}

.liquid-line-toggle:hover .liquid-line-toggle-icon {
  color: #4b5563;
}

.liquid-flavor-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.liquid-flavor-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #f5f5f5;
}

.liquid-flavor-row:first-child {
  padding-top: 0;
}

.liquid-flavor-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.liquid-flavor-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}

.liquid-flavor-title {
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  text-transform: none;
  color: #000000;
  line-height: 1.3;
}

.liquid-flavor-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.65rem;
  flex-shrink: 0;
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

.liquid-flavor-add:hover:not(:disabled):not(.is-disabled) {
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

.flavor-qty-btn:hover:not(:disabled):not(.is-disabled) {
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

.liquid-line-body-wrapper {
  overflow: hidden;
  transition: max-height 500ms cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 0;
}

.liquid-line-body {
  margin-top: 0.85rem;
  padding-left: calc(110px + 1rem);
}

.liquid-flavor-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Обертка для анимации переключения */
.product-card-transition-wrapper {
  position: relative;
}

/* Анимация переключения между карточками */
.product-card-fade-leave-active {
  transition: max-height 0.3s ease, opacity 0.2s ease;
  overflow: hidden;
}

.product-card-fade-enter-active {
  transition: none;
}

.product-card-fade-enter-from {
  opacity: 1;
}

.product-card-fade-leave-to {
  max-height: 0 !important;
  opacity: 0;
  margin-bottom: 0 !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}

.product-card-fade-enter-to,
.product-card-fade-leave-from {
  opacity: 1;
  max-height: 1000px;
}

@media (max-width: 1024px) {
  .liquid-line-image {
    width: 100px;
    height: 133px;
  }

  .liquid-line-body {
    padding-left: calc(100px + 1rem);
  }

  .liquid-line-title {
    font-size: 1.25rem;
  }

  .liquid-line-summary {
    font-size: 0.7rem;
  }

  .price-value {
    font-size: 1.4rem;
  }

  .price-currency {
    font-size: 0.95rem;
  }

  .liquid-line-toggle {
    width: 1.875rem;
    height: 1.875rem;
  }

  .liquid-line-toggle-icon {
    width: 1.125rem;
    height: 1.125rem;
  }
}

@media (max-width: 768px) {
  .liquid-line-card {
    padding: 1rem 0;
  }

  .liquid-line-header {
    gap: 0.85rem;
  }

  .liquid-line-main {
    gap: 0.85rem;
  }

  .liquid-line-image {
    width: 100px;
    height: 133px;
  }

  .liquid-line-info {
    gap: 0.28rem;
  }

  .liquid-line-badge {
    font-size: 0.56rem;
    padding: 0.26rem 0.58rem;
  }

  .liquid-line-title {
    font-size: 1rem;
  }

  .liquid-line-summary {
    font-size: 0.62rem;
  }

  .liquid-line-side {
    gap: 0.75rem;
  }

  .price-value {
    font-size: 1.25rem;
  }

  .price-currency {
    font-size: 0.85rem;
  }

  .liquid-line-toggle {
    width: 1.75rem;
    height: 1.75rem;
  }

  .liquid-line-toggle-icon {
    width: 1.0625rem;
    height: 1.0625rem;
  }

  .liquid-line-body {
    padding-left: 0;
  }

  .liquid-flavor-row {
    flex-direction: row;
    flex-wrap: nowrap;
    padding: 0.5rem 0;
    gap: 0.75rem;
  }

  .liquid-flavor-row:first-child {
    padding-top: 0.25rem;
  }

  .liquid-flavor-row:last-child {
    padding-bottom: 0.25rem;
  }

  .liquid-flavor-info {
    flex: 1;
    min-width: 0;
  }

  .liquid-flavor-title {
    font-size: 0.9rem;
  }

  .liquid-flavor-actions {
    flex-shrink: 0;
  }
}

@media (max-width: 640px) {
  .liquid-line-card {
    padding: 0.9rem 0;
  }

  .liquid-line-header {
    gap: 0.8rem;
  }

  .liquid-line-main {
    gap: 0.8rem;
  }

  .liquid-line-image {
    width: 95px;
    height: 127px;
  }

  .liquid-line-info {
    gap: 0.26rem;
  }

  .liquid-line-badge {
    font-size: 0.54rem;
    padding: 0.24rem 0.56rem;
  }

  .liquid-line-title {
    font-size: 0.95rem;
  }

  .liquid-line-summary {
    font-size: 0.6rem;
    gap: 0.14rem;
  }

  .liquid-line-side {
    gap: 0.7rem;
  }

  .liquid-line-toggle {
    width: 1.625rem;
    height: 1.625rem;
  }

  .liquid-line-toggle-icon {
    width: 1rem;
    height: 1rem;
  }

  .price-value {
    font-size: 1.2rem;
  }

  .price-currency {
    font-size: 0.82rem;
  }

  .liquid-line-body {
    margin-top: 0.6rem;
  }

  .liquid-flavor-row {
    padding: 0.45rem 0;
    gap: 0.65rem;
  }

  .liquid-flavor-row:first-child {
    padding-top: 0.2rem;
  }

  .liquid-flavor-row:last-child {
    padding-bottom: 0.2rem;
  }

  .liquid-flavor-title {
    font-size: 0.85rem;
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

  .flavor-qty-value {
    font-size: 0.92rem;
    min-width: 1.5rem;
  }
}

@media (max-width: 480px) {
  .liquid-line-card {
    padding: 0.85rem 0;
  }

  .liquid-line-header {
    gap: 0.75rem;
  }

  .liquid-line-main {
    gap: 0.75rem;
  }

  .liquid-line-image {
    width: 90px;
    height: 120px;
  }

  .liquid-line-info {
    gap: 0.24rem;
  }

  .liquid-line-badge {
    font-size: 0.52rem;
    padding: 0.22rem 0.5rem;
  }

  .liquid-line-title {
    font-size: 0.9rem;
    letter-spacing: -0.02em;
  }

  .liquid-line-summary {
    font-size: 0.58rem;
    gap: 0.12rem;
  }

  .liquid-line-side {
    gap: 0.65rem;
  }

  .liquid-line-toggle {
    width: 1.5rem;
    height: 1.5rem;
  }

  .liquid-line-toggle-icon {
    width: 0.9375rem;
    height: 0.9375rem;
  }

  .price-value {
    font-size: 1.15rem;
  }

  .price-currency {
    font-size: 0.8rem;
  }

  .liquid-line-body {
    margin-top: 0.5rem;
  }

  .liquid-flavor-row {
    padding: 0.4rem 0;
    gap: 0.6rem;
  }

  .liquid-flavor-row:first-child {
    padding-top: 0.15rem;
  }

  .liquid-flavor-row:last-child {
    padding-bottom: 0.15rem;
  }

  .liquid-flavor-title {
    font-size: 0.82rem;
  }

  .liquid-flavor-stock-note {
    font-size: 0.6rem;
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
  .liquid-line-card {
    padding: 0.8rem 0;
  }

  .liquid-line-header {
    gap: 0.65rem;
  }

  .liquid-line-main {
    gap: 0.65rem;
  }

  .liquid-line-image {
    width: 80px;
    height: 107px;
  }

  .liquid-line-info {
    gap: 0.22rem;
  }

  .liquid-line-badge {
    font-size: 0.48rem;
    padding: 0.2rem 0.46rem;
  }

  .liquid-line-title {
    font-size: 0.85rem;
  }

  .liquid-line-summary {
    font-size: 0.54rem;
  }

  .liquid-line-side {
    gap: 0.58rem;
  }

  .liquid-line-toggle {
    width: 1.375rem;
    height: 1.375rem;
  }

  .liquid-line-toggle-icon {
    width: 0.875rem;
    height: 0.875rem;
  }

  .price-value {
    font-size: 1.05rem;
  }

  .price-currency {
    font-size: 0.75rem;
  }

  .liquid-line-body {
    margin-top: 0.45rem;
  }

  .liquid-flavor-row {
    padding: 0.35rem 0;
    gap: 0.55rem;
  }

  .liquid-flavor-row:first-child {
    padding-top: 0.12rem;
  }

  .liquid-flavor-row:last-child {
    padding-bottom: 0.12rem;
  }

  .liquid-flavor-title {
    font-size: 0.78rem;
  }

  .liquid-flavor-stock-note {
    font-size: 0.56rem;
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
}
</style>
