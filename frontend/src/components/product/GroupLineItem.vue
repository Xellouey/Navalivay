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
          <ChevronDownIcon class="group-line-toggle-icon" />
        </button>
      </div>
    </div>

    <!-- Содержимое (товары + подлинейки) -->
    <div ref="contentWrapper" class="group-line-content-wrapper" :style="wrapperStyle">
      <div class="group-line-content">
      <!-- Товары линейки -->
      <div v-if="node.products.length" class="group-line-products">
        <div
          v-for="product in node.products"
          :key="product.id"
          class="product-item"
          @click="$emit('productClick', product)"
        >
          <div class="product-info">
            <div v-if="getProductImage(product)" class="product-image">
              <img :src="getProductImage(product)!" :alt="product.title" />
            </div>
            <div class="product-details">
              <h4 class="product-title">{{ product.title }}</h4>
              <p class="product-price">{{ formatPrice(product.priceRub) }} Br</p>
            </div>
          </div>
          <div class="product-actions">
            <div
              v-if="getQuantity(product.id) > 0"
              class="product-quantity"
              :class="{ 'is-limit': isAtStockLimit(product) }"
            >
              <button
                type="button"
                class="qty-btn qty-btn-minus"
                @click.stop="decrementQuantity(product)"
                aria-label="Убавить количество"
              >
                <MinusIcon class="qty-icon" />
              </button>
              <span class="qty-value">{{ getQuantity(product.id) }}</span>
              <button
                type="button"
                class="qty-btn qty-btn-plus"
                :class="{ 'is-disabled': isAtStockLimit(product) }"
                @click.stop="handleIncrement(product)"
                aria-label="Добавить еще"
              >
                <PlusIcon class="qty-icon" />
              </button>
            </div>
            <button
              v-else
              type="button"
              class="product-add"
              :class="{ 'is-disabled': !canAdd(product) }"
              @click.stop="handleAdd(product)"
              aria-label="Добавить в корзину"
            >
              <PlusIcon class="add-icon" />
            </button>
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
import { computed, ref, watch, nextTick } from 'vue'
import { ChevronDownIcon, PlusIcon, MinusIcon } from '@heroicons/vue/24/outline'
import { useCartStore } from '@/stores/cart'
import type { Product } from '@/stores/catalog'

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
  (e: 'showToast', payload: { message: string; type: 'error' | 'success' | 'info' }): void
  (e: 'heightChanged'): void
}>()

const cartStore = useCartStore()

const contentWrapper = ref<HTMLElement | null>(null)
const contentHeight = ref(0)

const isExpanded = computed(() => props.expandedGroups[props.node.id] ?? false)
const hasChildren = computed(() => props.node.children.length > 0)
const hasProducts = computed(() => props.node.products.length > 0)

const wrapperStyle = computed(() => {
  if (!isExpanded.value) {
    return { maxHeight: '0px' }
  }
  if (contentHeight.value > 0) {
    return { maxHeight: `${contentHeight.value}px` }
  }
  return { maxHeight: 'none' }
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
    await calculateHeight()
    // Множественные пересчёты для сглаживания
    setTimeout(() => calculateHeight(), 50)
    setTimeout(() => calculateHeight(), 100)
    setTimeout(() => calculateHeight(), 150)
    setTimeout(() => calculateHeight(), 200)
    setTimeout(() => calculateHeight(), 300)
    setTimeout(() => calculateHeight(), 400)
    setTimeout(() => calculateHeight(), 500)
  }
})

// Пересчитываем высоту при изменении количества товаров в корзине
watch(() => cartStore.items.length, async () => {
  if (isExpanded.value) {
    await calculateHeight()
  }
})

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
      emit('showToast', { message: 'Товара нет в наличии', type: 'error' })
    } else {
      emit('showToast', { message: 'В наличии больше нет', type: 'error' })
    }
    return
  }
  cartStore.addItem(product, 1)
}

function handleIncrement(product: Product) {
  if (!canAdd(product)) {
    if (product.isAvailable === false || (typeof product.stock === 'number' && product.stock <= 0)) {
      emit('showToast', { message: 'Товара нет в наличии', type: 'error' })
    } else {
      emit('showToast', { message: 'В наличии больше нет', type: 'error' })
    }
    return
  }
  cartStore.addItem(product, 1)
}

function decrementQuantity(product: Product) {
  cartStore.removeItem(product.id)
}
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
  @apply p-2 rounded-lg transition-transform duration-200;
}

.group-line-toggle.expanded {
  @apply rotate-180;
}

.group-line-toggle-icon {
  @apply w-5 h-5 text-gray-600;
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

.product-item {
  @apply flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-brand-dark cursor-pointer transition-all;
}

.product-info {
  @apply flex items-center gap-3 flex-1;
}

.product-image {
  @apply w-12 h-12 rounded-lg overflow-hidden flex-shrink-0;
}

.product-image img {
  @apply w-full h-full object-cover;
}

.product-details {
  @apply flex-1;
}

.product-title {
  @apply text-sm font-semibold text-gray-900;
}

.product-price {
  @apply text-xs text-gray-600;
}

.product-actions {
  @apply flex-shrink-0;
}

.product-quantity {
  @apply flex items-center gap-2 bg-white rounded-lg border border-gray-300 px-2 py-1;
}

.product-quantity.is-limit {
  @apply border-orange-400 bg-orange-50;
}

.qty-btn {
  @apply p-1 rounded transition-colors;
}

.qty-btn:hover {
  @apply bg-gray-100;
}

.qty-btn.is-disabled {
  @apply opacity-50 cursor-not-allowed;
}

.qty-icon {
  @apply w-4 h-4;
}

.qty-value {
  @apply text-sm font-semibold min-w-[24px] text-center;
}

.product-add {
  @apply p-2 bg-brand-red text-white rounded-lg hover:bg-brand-dark transition-colors;
}

.product-add.is-disabled {
  @apply opacity-50 cursor-not-allowed;
}

.add-icon {
  @apply w-5 h-5;
}

.group-line-children {
  @apply space-y-2;
}
</style>
