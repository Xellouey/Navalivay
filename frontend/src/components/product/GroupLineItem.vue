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
    <div class="group-line-content-wrapper" :class="{ 'is-expanded': isExpanded }" :data-group-id="node.id">
      <div class="group-line-content">
      <!-- Товары линейки -->
      <div v-if="node.products.length" class="group-line-products">
        <!-- Товары с вариантами: сначала компактная карточка, потом полная -->
        <div v-for="product in productsWithVariants" :key="product.id" class="product-card-transition-wrapper" :data-product-id="product.id">
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
        <SingleProductCard
          v-for="product in productsWithoutVariants"
          :key="product.id"
          :product="product"
          :quantity="getQuantity(product.id)"
          @add="handleAdd(product)"
          @increment="handleIncrement(product)"
          @decrement="decrementQuantity(product)"
        />
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
import { computed, ref } from 'vue'
import { ChevronRightIcon } from '@heroicons/vue/24/outline'
import { useCartStore } from '@/stores/cart'
import type { Product } from '@/stores/catalog'
import ProductVariantCard from '@/components/product/ProductVariantCard.vue'
import ProductCompactCard from '@/components/product/ProductCompactCard.vue'
import SingleProductCard from '@/components/product/SingleProductCard.vue'

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

const expandedProducts = ref<Record<string, boolean>>({})

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
}

function isProductExpanded(productId: string): boolean {
  return expandedProducts.value[productId] ?? false
}

// Обработчик изменения высоты дочерних элементов (оставляем для совместимости)
function handleChildHeightChange() {
  // Больше не нужен с фиксированным max-height
}

function toggle() {
  emit('toggle', props.node.id)
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
</script>

<style scoped>
.group-line-item {
  @apply mb-4;
  animation: fadeInItem 0.5s ease-out 0.3s both;
}

@keyframes fadeInItem {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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
  display: grid;
  grid-template-rows: 0fr;
  overflow: hidden;
  transition: grid-template-rows 400ms cubic-bezier(0.4, 0, 0.2, 1);
}

.group-line-content-wrapper.is-expanded {
  grid-template-rows: 1fr;
}

.group-line-content-wrapper > .group-line-content {
  min-height: 0;
  overflow: hidden;
  opacity: 0;
  transform: translateY(-16px) scale(0.98);
  transform-origin: top center;
  transition: opacity 200ms ease-out, transform 200ms ease-out;
}

.group-line-content-wrapper.is-expanded > .group-line-content {
  opacity: 1;
  transform: translateY(0) scale(1);
  /* Задержка чтобы grid успел начать раскрываться */
  transition: opacity 350ms cubic-bezier(0.4, 0, 0.2, 1) 50ms, transform 350ms cubic-bezier(0.4, 0, 0.2, 1) 50ms;
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
.product-card-fade-enter-active {
  transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1), 
              transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.product-card-fade-leave-active {
  transition: opacity 0.2s ease-out, 
              transform 0.2s ease-out,
              max-height 0.25s ease-out;
  overflow: hidden;
}

.product-card-fade-enter-from {
  opacity: 0;
  transform: translateY(-12px) scale(0.98);
  max-height: 0;
}

.product-card-fade-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
  max-height: 800px;
}

.product-card-fade-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
  max-height: 200px;
}

.product-card-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
  max-height: 0;
  margin-bottom: 0 !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}

/* Стили для обычных товаров теперь в SingleProductCard.vue */

.group-line-children {
  @apply space-y-2;
}
</style>
