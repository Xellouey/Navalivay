<template>
  <div class="group-line-item">
    <!-- Заголовок линейки -->
    <div 
      class="group-line-header"
      :class="{ expanded: isExpanded, 'has-children': hasChildren || hasProducts }"
      @click="toggle"
    >
      <div class="group-line-main">
        <div v-if="node.coverImage" class="group-line-image">
          <img :src="node.coverImage" :alt="node.name" />
        </div>
        <div class="group-line-info">
          <h3 class="group-line-title" :style="{ paddingLeft: `${node.depth * 1.5}rem` }">
            {{ node.name }}
          </h3>
          <p class="group-line-meta">
            {{ node.totalProductCount ?? node.productCount }} товаров
          </p>
        </div>
      </div>
      <div class="group-line-side">
        <button
          v-if="hasChildren || hasProducts"
          type="button"
          class="group-line-toggle"
          :class="{ expanded: isExpanded }"
          @click.stop="toggle"
          aria-label="Развернуть/свернуть"
        >
          <ChevronRightIcon class="group-line-toggle-icon" />
        </button>
      </div>
    </div>

    <!-- Содержимое (товары + подлинейки) -->
    <div ref="contentWrapper" class="group-line-content-wrapper" :style="wrapperStyle">
      <div class="group-line-content">
      <!-- Товары линейки -->
      <div v-if="node.products.length" ref="productsContainer" class="group-line-products">
        <!-- Товары с вариантами: сначала компактная карточка, потом полная -->
        <div v-for="product in productsWithVariants" :key="product.id" class="product-card-transition-wrapper">
          <Transition name="product-card-fade" mode="out-in">
            <!-- Компактная карточка -->
            <ProductCompactCard
              v-if="!isProductExpanded(product.id)"
              :key="`compact-${product.id}`"
              :product="product"
              @click="toggleProductExpansion(product.id)"
            />
            
            <!-- Полная карточка с вариантами -->
            <ProductVariantCard
              v-else
              :key="`expanded-${product.id}`"
              :product="product"
              @productClick="$emit('productClick', $event)"
              @showToast="(payload) => $emit('showToast', payload.message, payload.type)"
              @collapse="toggleProductExpansion(product.id)"
            />
          </Transition>
        </div>
        
        <!-- Обычные товары без вариантов -->
        <div
          v-for="product in productsWithoutVariants"
          :key="product.id"
          class="liquid-line-card-single"
        >
          <div class="liquid-line-single-header">
            <div class="liquid-line-single-main">
              <div v-if="getProductImage(product)" class="liquid-line-image">
                <img :src="getProductImage(product)!" :alt="product.title" />
              </div>
              <div class="liquid-line-info">
                <h3 class="liquid-line-title">{{ product.title }}</h3>
                <p v-if="product.description" class="liquid-line-description">{{ product.description }}</p>
              </div>
            </div>
            <div class="liquid-line-single-side">
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
              <div class="liquid-line-price">
                <span class="price-value">{{ formatPrice(product.priceRub) }}</span>
                <span class="price-currency">₽</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Подлинейки (рекурсивно) -->
      <div v-if="node.children.length" class="group-line-children">
        <GroupLineItem
          v-for="child in node.children"
          :key="child.id"
          :node="child"
          :expanded-groups="expandedGroups"
          @toggle="$emit('toggle', $event)"
          @productClick="$emit('productClick', $event)"
          @showToast="$emit('showToast', $event.message, $event.type)"
          @heightChanged="handleChildHeightChange"
        />
      </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted } from 'vue'
import { ChevronRightIcon, PlusIcon, MinusIcon } from '@heroicons/vue/24/outline'
import { useCartStore } from '@/stores/cart'
import type { Product } from '@/stores/catalog'
import ProductVariantCard from '@/components/product/ProductVariantCard.vue'
import ProductCompactCard from '@/components/product/ProductCompactCard.vue'

interface GroupNode {
  id: string
  name: string
  slug: string
  order: number
  coverImage: string | null
  productCount: number
  totalProductCount?: number
  depth: number
  parentId?: string | null
  children: GroupNode[]
  products: Product[]
}

const props = defineProps<{
  node: GroupNode
  expandedGroups: Record<string, boolean>
}>()

const emit = defineEmits<{
  (e: 'toggle', groupId: string): void
  (e: 'productClick', product: Product): void
  (e: 'showToast', message: string, type: 'error' | 'success' | 'info'): void
  (e: 'heightChanged'): void
}>()

const cartStore = useCartStore()

const contentWrapper = ref<HTMLElement | null>(null)
const contentHeight = ref(0)
const expandedProducts = ref<Record<string, boolean>>({})
const productsContainer = ref<HTMLElement | null>(null)

const isExpanded = computed(() => props.expandedGroups[props.node.id] ?? false)
const hasChildren = computed(() => props.node.children.length > 0)
const hasProducts = computed(() => props.node.products.length > 0)

// Разделяем товары на с вариантами и без
const productsWithVariants = computed(() => 
  props.node.products.filter(p => p.hasVariants && p.variants && p.variants.length > 0)
)

const productsWithoutVariants = computed(() => 
  props.node.products.filter(p => !p.hasVariants)
)

// Функция для переключения раскрытия товара
function toggleProductExpansion(productId: string) {
  expandedProducts.value = {
    ...expandedProducts.value,
    [productId]: !expandedProducts.value[productId]
  }
  // Пересчитываем высоту после изменения с задержками для плавной анимации
  nextTick(() => {
    calculateHeight()
    setTimeout(() => calculateHeight(), 50)
    setTimeout(() => calculateHeight(), 150)
    setTimeout(() => calculateHeight(), 350)
  })
}

function isProductExpanded(productId: string): boolean {
  return expandedProducts.value[productId] ?? false
}

const wrapperStyle = computed(() => {
  if (!isExpanded.value) {
    return { maxHeight: '0px' }
  }
  // Всегда используем конкретное значение высоты для плавной анимации
  // Если высота ещё не рассчитана, используем большое значение, но с transition
  const height = contentHeight.value > 0 ? contentHeight.value : 5000
  return { maxHeight: `${height}px` }
})

// Функция для расчёта высоты
const calculateHeight = async () => {
  await nextTick()
  if (contentWrapper.value) {
    contentHeight.value = contentWrapper.value.scrollHeight
    // Уведомляем родителя об изменении высоты
    emit('heightChanged')
  }
}

// Пересчитываем высоту при раскрытии
watch(() => isExpanded.value, async (newVal) => {
  if (newVal) {
    // Сначала устанавливаем высоту контента для плавной анимации
    await nextTick()
    await calculateHeight()
    // Дополнительные пересчёты для плавности (на случай отложенной загрузки контента)
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
  if (isExpanded.value) {
    await calculateHeight()
    // Множественные пересчёты для плавности
    setTimeout(() => calculateHeight(), 50)
    setTimeout(() => calculateHeight(), 150)
    setTimeout(() => calculateHeight(), 300)
  }
}, { deep: true })

// Пересчитываем при изменении состояния дочерних элементов
watch(() => props.expandedGroups, async () => {
  if (isExpanded.value) {
    await calculateHeight()
    setTimeout(() => calculateHeight(), 50)
    setTimeout(() => calculateHeight(), 150)
    setTimeout(() => calculateHeight(), 300)
  }
}, { deep: true })

// Обработчик изменения высоты дочерних элементов
function handleChildHeightChange() {
  if (isExpanded.value) {
    calculateHeight()
  }
}

function toggle() {
  emit('toggle', props.node.id)
}


function getProductImage(product: Product): string | null {
  // Для товаров с вариантами берём изображение первого варианта
  if (product.hasVariants && product.variants?.length && product.variants[0].images?.length) {
    return product.variants[0].images[0]
  }
  
  if (product.images?.[0]) return product.images[0]
  if (product.links?.length) {
    for (const link of product.links) {
      const url = link.url?.toLowerCase() || ''
      if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i)) {
        return link.url
      }
    }
    return product.links[0]?.url || null
  }
  return null
}

function formatPrice(price: number): string {
  return price.toLocaleString('ru-RU')
}

function getQuantity(productId: string): number {
  const item = cartStore.items.find(item => item.productId === productId)
  return item ? item.quantity : 0
}

function canAdd(product: Product): boolean {
  const currentQty = getQuantity(product.id)
  if (product.isAvailable === false) return false
  if (typeof product.stock === 'number') {
    const stock = Math.max(product.stock, 0)
    if (stock === 0) return false
    return currentQty < stock
  }
  return true
}

function isAtStockLimit(product: Product): boolean {
  if (product.isAvailable === false) return true
  if (typeof product.stock === 'number') {
    const stock = Math.max(product.stock, 0)
    if (stock === 0) return true
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
  cartStore.addItem(product, 1)
}

function decrementQuantity(product: Product) {
  cartStore.removeItem(product.id)
}

// Функция для динамической подстройки размера шрифта
async function adjustFontSize() {
  await nextTick()
  
  if (!contentWrapper.value) return
  
  const cards = contentWrapper.value.querySelectorAll('.liquid-line-card-single')
  
  cards.forEach((card: Element) => {
    const cardEl = card as HTMLElement
    const infoBlock = cardEl.querySelector('.liquid-line-info') as HTMLElement
    if (!infoBlock) return
    
    const title = infoBlock.querySelector('.liquid-line-title') as HTMLElement
    const description = infoBlock.querySelector('.liquid-line-description') as HTMLElement
    
    if (!title) return
    
    // Базовые размеры шрифта
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize)
    const baseTitleSize = rootFontSize * 1.35
    const baseDescSize = rootFontSize * 0.75
    
    // Сбрасываем стили
    title.style.fontSize = ''
    if (description) description.style.fontSize = ''
    
    // Измеряем высоту info блока
    const initialHeight = infoBlock.offsetHeight
    const maxAllowedHeight = 100 // Максимальная высота в пикселях
    
    // Если блок слишком высокий, уменьшаем шрифт
    if (initialHeight > maxAllowedHeight) {
      let titleSize = baseTitleSize
      let descSize = description ? baseDescSize : 0
      let iterations = 0
      
      while (infoBlock.offsetHeight > maxAllowedHeight && iterations < 20) {
        titleSize = Math.max(titleSize - 1, baseTitleSize * 0.5)
        title.style.fontSize = `${titleSize}px`
        
        if (description && descSize > baseDescSize * 0.5) {
          descSize = Math.max(descSize - 0.5, baseDescSize * 0.5)
          description.style.fontSize = `${descSize}px`
        }
        
        iterations++
      }
    }
  })
}

// Вызываем оптимизацию при монтировании и при изменении состояния
onMounted(() => {
  setTimeout(() => adjustFontSize(), 100)
})

// Пересчитываем при раскрытии
watch(() => isExpanded.value, async (newVal) => {
  if (newVal) {
    setTimeout(() => adjustFontSize(), 350)
  }
})

// Пересчитываем при изменении корзины
watch(() => cartStore.items.length, () => {
  if (isExpanded.value) {
    setTimeout(() => adjustFontSize(), 100)
  }
}, { deep: true })
</script>

<style scoped>
.group-line-item {
  @apply mb-4;
}

.group-line-header {
  @apply flex items-center justify-between p-4 bg-white rounded-xl border-2 border-gray-200 cursor-pointer transition-all duration-200;
}

.group-line-header:hover {
  @apply border-brand-dark;
}

.group-line-header.expanded {
  @apply border-brand-red bg-red-50;
}

.group-line-main {
  @apply flex items-center gap-4 flex-1;
}

.group-line-image {
  @apply w-16 h-16 rounded-lg overflow-hidden flex-shrink-0;
}

.group-line-image img {
  @apply w-full h-full object-cover;
}

.group-line-info {
  @apply flex-1;
}

.group-line-title {
  @apply text-lg font-bold text-brand-dark;
}

.group-line-meta {
  @apply text-sm text-gray-600;
}

.group-line-side {
  @apply flex items-center gap-2;
}

.group-line-toggle {
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
}

.group-line-toggle:hover {
  background: #fef2f2;
}

.group-line-toggle.expanded {
  transform: rotate(90deg);
}

.group-line-toggle-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #4b5563;
  transition: color 0.2s ease;
}

.group-line-toggle:hover .group-line-toggle-icon {
  color: #4b5563;
}

.group-line-content-wrapper {
  @apply overflow-hidden;
  transition: max-height 500ms cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 0;
}

.group-line-content {
  @apply mt-2 pl-4;
}

.group-line-products {
  @apply space-y-2 mb-4;
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

/* Стили для обычных товаров - точная копия из HomeView */
.liquid-line-card-single {
  padding: 1.25rem 0;
  border-bottom: 1px solid #e5e5e5;
  background: white;
}

.liquid-line-card-single:first-of-type {
  padding-top: 0;
}

.liquid-line-single-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.liquid-line-single-main {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
  min-width: 0;
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

.liquid-line-title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 900;
  letter-spacing: -0.01em;
  text-transform: uppercase;
  color: #000000;
  line-height: 1.15;
  word-break: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}

.liquid-line-description {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  text-transform: uppercase;
  color: #a5a5a5;
  line-height: 1.25;
  margin: 0;
  word-break: break-word;
  overflow-wrap: break-word;
}

.liquid-line-single-side {
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
}

.price-value {
  font-size: 1.5rem;
  letter-spacing: -0.02em;
}

.price-currency {
  font-size: 1rem;
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

/* Responsive */
@media (max-width: 1024px) {
  .liquid-line-image {
    width: 100px;
    height: 133px;
  }

  .liquid-line-title {
    font-size: 1.25rem;
  }

  .liquid-line-description {
    font-size: 0.7rem;
  }

  .price-value {
    font-size: 1.4rem;
  }

  .price-currency {
    font-size: 0.95rem;
  }
}

@media (max-width: 768px) {
  .liquid-line-card-single {
    padding: 1rem 0;
  }

  .liquid-line-single-header {
    gap: 0.85rem;
  }

  .liquid-line-single-main {
    gap: 0.85rem;
  }

  .liquid-line-image {
    width: 100px;
    height: 133px;
  }

  .liquid-line-info {
    gap: 0.28rem;
  }

  .liquid-line-title {
    font-size: 1rem;
  }

  .liquid-line-description {
    font-size: 0.62rem;
  }

  .liquid-line-single-side {
    gap: 0.75rem;
  }

  .price-value {
    font-size: 1.25rem;
  }

  .price-currency {
    font-size: 0.85rem;
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
  .liquid-line-card-single {
    padding: 0.9rem 0;
  }

  .liquid-line-single-header {
    gap: 0.8rem;
  }

  .liquid-line-single-main {
    gap: 0.8rem;
  }

  .liquid-line-image {
    width: 95px;
    height: 127px;
  }

  .liquid-line-info {
    gap: 0.26rem;
  }

  .liquid-line-title {
    font-size: 0.95rem;
  }

  .liquid-line-description {
    font-size: 0.6rem;
  }

  .liquid-line-single-side {
    gap: 0.7rem;
  }

  .price-value {
    font-size: 1.2rem;
  }

  .price-currency {
    font-size: 0.82rem;
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
  .liquid-line-card-single {
    padding: 0.85rem 0;
  }

  .liquid-line-title {
    font-size: 0.88rem;
  }

  .liquid-line-description {
    font-size: 0.58rem;
  }

  .liquid-flavor-add,
  .flavor-qty-btn {
    width: 40px;
    height: 40px;
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

.add-icon {
  @apply w-5 h-5;
}

.group-line-children {
  @apply space-y-2;
}
</style>
