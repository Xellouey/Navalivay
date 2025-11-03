<template>
  <div class="min-h-screen" style="background: #ffffff;">
    <SmokeParticles :count="4" area="full" />

    <div class="mb-0 relative banner-wrapper">
      <div class="banner-container relative">
        <BannerCarousel
          v-if="catalogStore.banners.length"
          :banners="catalogStore.banners"
          :is-loading="catalogStore.isLoading"
          :auto-play="true"
          :auto-play-interval="5000"
        />
        <div v-else class="w-full aspect-[16/7] bg-gradient-to-r from-red-600 to-blue-600 flex items-center justify-center rounded-2xl">
          <p class="text-white text-2xl font-bold">НАВАЛИВАЙ</p>
        </div>
      </div>
    </div>

    <div class="max-w-screen-xl mx-auto px-4 relative z-10 pb-16">
      <h1 class="navalivay-title text-center mb-6 main-title-adaptive" style="margin-top: 2rem; color: var(--navalivay-black); font-weight: bold;">
        ЧТО ХОТИТЕ КУПИТЬ<span class="question-mark">?</span>
      </h1>

      <section class="space-y-6">
        <Transition name="fade" mode="out-in">
          <div
            v-if="!selectedCategory"
            key="category-grid"
            class="category-grid"
          >
            <button
              v-for="category in categoryCards"
              :key="category.id"
              class="category-card-new"
              :class="{ active: category.isActive }"
              @click="selectCategory(category.slug)"
            >
              <div class="category-card-media" :style="{ backgroundImage: `url(${category.previewImage})` }"></div>
              <div class="category-card-body">
                <span
                  v-if="category.displayMode !== 'default'"
                  class="category-card-mode"
                >
                  {{ category.displayModeLabel }}
                </span>
                <p class="category-card-title">{{ category.name }}</p>
                <div class="flex items-center justify-between">
                  <p class="category-card-meta">{{ category.productCount }} товаров</p>
                  <p v-if="category.groupsCount > 0" class="category-card-badge">
                    {{ category.groupsCount }} {{ category.groupsCount === 1 ? 'линейка' : category.groupsCount < 5 ? 'линейки' : 'линеек' }}
                  </p>
                </div>
              </div>
            </button>
          </div>

          <div
            v-else
            key="category-focus"
            class="liquid-category-header"
          >
            <div class="liquid-category-header-content">
              <button
                class="liquid-back-button"
                @click="backToCategories"
              >
                <svg class="liquid-back-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                <span class="liquid-back-text">На главную страницу</span>
              </button>
              <h1 class="liquid-category-title">
                {{ selectedCategory?.name || 'ЖИДКОСТИ' }}
              </h1>
            </div>
          </div>
        </Transition>
      </section>

      <section v-if="selectedCategory">
        <!-- Cross-sell товары (без заголовка, первыми) -->
        <div v-if="crossSellItems.length" class="px-4" ref="crossSellContainer">
          <SingleProductCard
            v-for="item in crossSellItems"
            :key="item.id"
            :product="item"
            :quantity="getCrossSellQuantity(item.id)"
            @add="handleCrossSellAdd(item)"
            @increment="handleCrossSellIncrement(item)"
            @decrement="decrementCrossSellQuantity(item)"
          />
        </div>

        <Transition name="fade" mode="out-in">
          <div
            v-if="groupCards.length && !showLiquidShowcase && activeGroupCard"
            key="group-focus"
            class="group-focus-panel"
          >
            <div class="group-focus-media" :style="groupFocusStyle"></div>
            <div class="group-focus-overlay"></div>
            <div class="group-focus-content">
              <div class="group-focus-top">
                <button class="back-chip" @click="backToGroups">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                  {{ selectedCategory?.name }}
                </button>
                <span class="group-focus-count">{{ activeGroupCard?.totalProductCount ?? activeGroupCard?.productCount }} вкусов</span>
              </div>
              <h3 class="group-focus-title">{{ activeGroupCard?.name }}</h3>
              <p class="group-focus-meta">Линейка выбрана и готова к просмотру</p>
            </div>
          </div>

          <div
            v-else-if="groupCards.length && !showLiquidShowcase"
            key="group-list"
            class="space-y-4"
          >
            <GroupLineItem
              v-for="group in groupCards"
              :key="group.id"
              :node="group"
              :expanded-groups="groupExpansionState"
              @toggle="toggleGroupExpansion"
              @productClick="openProduct"
              @showToast="showToast"
            />
          </div>
        </Transition>
        <p v-if="!groupCards.length && !showLiquidShowcase" class="text-gray-600 bg-gray-100 border border-dashed border-gray-300 rounded-xl px-5 py-4 text-sm font-medium">
          Для категории пока не добавлены подгруппы — товары будут показаны в общем списке ниже.
        </p>

        <section v-if="showLiquidShowcase" class="px-4 space-y-4" ref="ungroupedContainer">
          <!-- NiCa Booster - always first -->
          <SingleProductCard
            v-if="nicaBoosterProduct"
            :product="nicaBoosterProduct"
            :quantity="getUngroupedQuantity(nicaBoosterProduct.id)"
            @add="handleUngroupedAdd(nicaBoosterProduct)"
            @increment="handleUngroupedIncrement(nicaBoosterProduct)"
            @decrement="decrementUngroupedQuantity(nicaBoosterProduct)"
          />
          
          <LiquidLineTree
            v-for="group in liquidGroups"
            :key="group.id"
            :group="group"
            :expanded-groups="liquidExpansionState"
            @toggle="toggleLiquidExpansion"
            @showToast="showToast"
          />

          <SingleProductCard
            v-for="product in liquidUngrouped"
            :key="product.id"
            :product="product"
            :quantity="getUngroupedQuantity(product.id)"
            @add="handleUngroupedAdd(product)"
            @increment="handleUngroupedIncrement(product)"
            @decrement="decrementUngroupedQuantity(product)"
          />
        </section>
      </section>


      <section v-if="showProducts" class="mt-12">
        <div class="flex items-center justify-between mb-6">
          <button class="back-chip" @click="catalogStore.activeGroup ? backToGroups() : backToCategories()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            {{ catalogStore.activeGroup ? 'Назад к подгруппам' : 'Назад к категориям' }}
          </button>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          <div
            v-if="catalogStore.isLoading && !catalogStore.filteredProducts.length"
            v-for="n in 8"
            :key="`skeleton-${n}`"
            class="animate-pulse"
          >
            <div class="aspect-square bg-gray-200 rounded-lg mb-3" />
            <div class="h-4 bg-gray-200 mb-2 rounded" />
            <div class="h-5 bg-gray-200 w-3/4 rounded" />
          </div>

          <div
            v-for="product in catalogStore.filteredProducts"
            :key="product.id"
            class="product-card"
            @click="openProduct(product)"
          >
            <div class="product-card-media">
              <div v-if="getProductBadges(product).length" class="product-card-badges">
                <span
                  v-for="(badge, index) in getProductBadges(product)"
                  :key="`${badge.type || 'badge'}-${index}`"
                  class="product-card-badge"
                  :style="getBadgeStyle(badge)"
                >
                  {{ getBadgeLabel(badge) }}
                </span>
              </div>
              <img
                v-if="getProductImage(product)"
                :src="getProductImage(product)!"
                :alt="product.title"
                loading="lazy"
              />
              <div v-else class="media-placeholder">
                <PhotoIcon class="w-10 h-10 text-gray-300" />
              </div>
            </div>
            <div class="product-card-body">
              <p class="product-card-title">{{ product.title || 'Без названия' }}</p>
              <p v-if="product.variant" class="product-card-variant">{{ product.variant }}</p>
              <p class="product-card-price">{{ formatPrice(product.priceRub) }}<span class="text-base ml-1">₽</span></p>
            </div>
          </div>
        </div>

        <div v-if="!catalogStore.isLoading && !catalogStore.filteredProducts.length" class="text-center py-20">
          <ExclamationTriangleIcon class="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 class="text-xl font-bold text-black mb-3">Товары не найдены</h3>
          <p class="text-gray-600 mb-6">
            Выберите другую категорию или подгруппу
          </p>
          <button @click="catalogStore.activeGroup ? backToGroups() : backToCategories()" class="btn-navalivay">
            <span>Вернуться</span>
          </button>
        </div>
      </section>
    </div>

    <!-- Cart Button -->
    <Transition name="cart-slide">
      <div
        v-if="totalCartItems > 0"
        class="cart-wrapper"
      >
        <button class="cart-button" @click="goToCheckout">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="cart-icon">
            <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" fill="currentColor" />
          </svg>
          <span class="cart-text">ЗАКАЗ НА {{ totalCartAmount }} BYN</span>
        </button>
      </div>
    </Transition>
    
    <!-- Toast Notification -->
    <ToastNotification v-if="toastMessage" :key="toastKey" :message="toastMessage" :type="toastType" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ExclamationTriangleIcon, PhotoIcon, PlusIcon, MinusIcon } from '@heroicons/vue/24/outline'

import { useCatalogStore, type Product, type Category, type CategoryGroup, type ProductBadge } from '@/stores/catalog'
import { useCartStore } from '@/stores/cart'
import SmokeParticles from '@/components/SmokeParticles.vue'
import BannerCarousel from '@/components/BannerCarousel.vue'
import LiquidLineCard from '@/components/product/liquid/LiquidLineCard.vue'
import LiquidLineTree from '@/components/product/liquid/LiquidLineTree.vue'
import LiquidFlavorRow from '@/components/product/liquid/LiquidFlavorRow.vue'
import ToastNotification from '@/components/ToastNotification.vue'
import GroupLineItem from '@/components/product/GroupLineItem.vue'
import SingleProductCard from '@/components/product/SingleProductCard.vue'
import { useProductCardLayout } from '@/composables/useProductCardLayout'

const catalogStore = useCatalogStore()
const cartStore = useCartStore()
const router = useRouter()

// Toast notification
const toastMessage = ref('')
const toastType = ref<'error' | 'success' | 'info'>('info')
const toastKey = ref(0)

function showToast(message: string, type: 'error' | 'success' | 'info' = 'info') {
  toastMessage.value = message
  toastType.value = type
  toastKey.value++
  
  setTimeout(() => {
    toastMessage.value = ''
  }, 3500)
}

// Контейнеры для адаптации шрифтов
const crossSellContainer = ref<HTMLElement | null>(null)
const ungroupedContainer = ref<HTMLElement | null>(null)

// Используем новый композабл для адаптации шрифтов
const { adjustFontSizes: adjustCrossSellFontSizes } = useProductCardLayout(crossSellContainer)
const { adjustFontSizes: adjustUngroupedFontSizes } = useProductCardLayout(ungroupedContainer)



const PLACEHOLDER_IMAGE = '/placeholder-category.png'

const categories = computed<Category[]>(() => catalogStore.categories)

const displayModeLabels: Record<'default' | 'liquid' | 'visual', string> = {
  default: 'Стандарт',
  liquid: 'Жидкости',
  visual: 'Витрина'
}

const LIQUID_SLUG_KEYWORDS = ['liquid', 'liq', 'zhidk', 'juice', 'salt']
const LIQUID_NAME_KEYWORDS = ['жидк', 'солев', 'liquid', 'juice', 'salt']

function resolveCategoryDisplayMode(category: Category | null): 'default' | 'liquid' | 'visual' {
  if (!category) return 'default'
  if (category.displayMode === 'liquid' || category.displayMode === 'visual') {
    return category.displayMode
  }

  const slug = (category.slug || '').toLowerCase()
  
  // Исключения: категории устройств всегда используют стандартный режим
  if (slug.includes('pod') || slug.includes('disposable') || slug === 'ustrojstva') {
    return 'default'
  }
  
  if (LIQUID_SLUG_KEYWORDS.some(keyword => slug.includes(keyword))) {
    return 'liquid'
  }

  const name = (category.name || '').toLowerCase()
  if (LIQUID_NAME_KEYWORDS.some(keyword => name.includes(keyword))) {
    return 'liquid'
  }

  const productsPool = catalogStore.allProducts.length ? catalogStore.allProducts : catalogStore.products
  if (productsPool.length) {
    const inCategory = productsPool.filter(product => product.categoryId === category.id)
    if (inCategory.length) {
      const withStrength = inCategory.filter(product => typeof product.strength === 'string' && product.strength.trim().length > 0)
      if (withStrength.length >= Math.max(1, Math.round(inCategory.length * 0.4))) {
        return 'liquid'
      }
    }
  }

  return 'default'
}

const categoryCards = computed(() => {
  return categories.value.map(category => {
    const previewImage = category.coverImage || category.groups.find(group => group.coverImage)?.coverImage || PLACEHOLDER_IMAGE
    const displayMode = resolveCategoryDisplayMode(category)
    const visibleGroups = category.groups?.filter(group => (group.totalProductCount ?? group.productCount ?? 0) > 0) ?? []
    return {
      id: category.id,
      slug: category.slug,
      name: category.name,
      order: category.order,
      productCount: category.productCount,
      groupsCount: visibleGroups.length,
      previewImage,
      isActive: catalogStore.activeCategory === category.slug,
      displayMode,
      displayModeLabel: displayModeLabels[displayMode]
    }
  })
})

const selectedCategory = computed<Category | null>(() => {
  if (!catalogStore.activeCategory) return null
  return categories.value.find(category => category.slug === catalogStore.activeCategory) ?? null
})

const selectedCategoryCard = computed(() => {
  if (!selectedCategory.value) return null
  return categoryCards.value.find(card => card.slug === selectedCategory.value?.slug) ?? null
})

const resolvedDisplayMode = computed<'default' | 'liquid' | 'visual'>(() => resolveCategoryDisplayMode(selectedCategory.value))
const isLiquidCategory = computed(() => resolvedDisplayMode.value === 'liquid')
const showLiquidShowcase = computed(() => isLiquidCategory.value)

type GroupCard = CategoryGroup & { depth: number; previewImage: string; isActive: boolean }
type GroupCardNode = GroupCard & { children: GroupCardNode[]; products: Product[] }
type LiquidGroup = {
  id: string
  name: string
  order: number
  coverImage: string | null
  products: Product[]
  badge?: string | null
  badgeColor?: string | null
  children: LiquidGroup[]
}

// Состояние раскрытия для линеек (включая подлинейки)
const groupExpansionState = ref<Record<string, boolean>>({})

function isGroupExpanded(groupId: string): boolean {
  return groupExpansionState.value[groupId] ?? false
}

function toggleGroupExpansion(groupId: string) {
  groupExpansionState.value = {
    ...groupExpansionState.value,
    [groupId]: !isGroupExpanded(groupId)
  }
}

// Строим иерархическое дерево линеек с товарами
const groupCards = computed<GroupCardNode[]>(() => {
  if (!selectedCategory.value) return []

  const groups = selectedCategory.value.groups
  const categoryProducts = catalogStore.products.filter(p => p.categoryId === selectedCategory.value!.id)
  const nodes = new Map<string, GroupCardNode>()

  // Создаём узлы для всех групп
  groups.forEach((group) => {
    const groupProducts = categoryProducts.filter(p => p.groupId === group.id)
    nodes.set(group.id, {
      ...group,
      depth: 0,
      previewImage: group.coverImage || PLACEHOLDER_IMAGE,
      isActive: catalogStore.activeGroup === group.slug,
      children: [],
      products: groupProducts
    })
  })

  const roots: GroupCardNode[] = []

  // Строим иерархию
  nodes.forEach((node) => {
    const parentId = node.parentId ? String(node.parentId) : null
    if (parentId && nodes.has(parentId)) {
      const parent = nodes.get(parentId)!
      node.depth = parent.depth + 1
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  })

  // Сортируем детей рекурсивно
  const sortChildren = (node: GroupCardNode) => {
    node.children.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    node.children.forEach(sortChildren)
  }
  roots.forEach(sortChildren)
  roots.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  return roots.filter(node => (node.totalProductCount ?? node.productCount ?? 0) > 0)
})

const liquidStructure = computed(() => {
  if (!showLiquidShowcase.value || !selectedCategory.value) {
    return { groups: [] as LiquidGroup[], ungrouped: [] as Product[] }
  }

  const category = selectedCategory.value
  const fallbackCover = category.coverImage || PLACEHOLDER_IMAGE
  const categoryProducts = catalogStore.products.filter(p => p.categoryId === category.id)
  
  // Строим иерархическое дерево для liquid-режима
  const buildLiquidTree = (): LiquidGroup[] => {
    const groupMap = new Map<string, LiquidGroup>()
    
    // Создаём узлы для всех групп
    category.groups.forEach(group => {
      const groupProducts = categoryProducts.filter(p => p.groupId === group.id)
      groupMap.set(group.id, {
        id: group.id,
        name: group.name,
        order: group.order ?? 0,
        coverImage: group.coverImage || fallbackCover,
        products: groupProducts,
        badge: group.badge ?? null,
        badgeColor: group.badgeColor ?? null,
        children: []
      })
    })
    
    const roots: LiquidGroup[] = []
    
    // Строим иерархию
    groupMap.forEach(group => {
      const parentId = category.groups.find(g => g.id === group.id)?.parentId
      if (parentId && groupMap.has(parentId)) {
        groupMap.get(parentId)!.children.push(group)
      } else {
        roots.push(group)
      }
    })
    
    // Сортируем рекурсивно
    const sortChildren = (node: LiquidGroup) => {
      node.children.sort((a, b) => a.order - b.order)
      node.children.forEach(sortChildren)
    }
    roots.forEach(sortChildren)
    roots.sort((a, b) => a.order - b.order)
    
    return roots.filter(g => g.products.length > 0 || g.children.length > 0)
  }

  const liquidGroups = buildLiquidTree()
  const ungrouped: Product[] = []
  
  // Find NiCa Booster - ищем среди товаров без группы
  let nicaBooster: Product | null = null

  categoryProducts.forEach(product => {
    const isNicaBooster = product.title.toLowerCase().includes('никобустер') ||
                          product.title.toLowerCase().includes('nikobuster') ||
                          product.title.toLowerCase().includes('nica booster')
    
    if (isNicaBooster) {
      nicaBooster = product
      return
    }
    
    // Товары без группы добавляем в ungrouped
    if (!product.groupId) {
      ungrouped.push(product)
    }
  })
  
  // Add NiCa Booster to ungrouped at the beginning if found
  if (nicaBooster) {
    ungrouped.unshift(nicaBooster)
  }

  return { groups: liquidGroups, ungrouped }
})

const liquidGroups = computed(() => liquidStructure.value.groups)
const liquidUngrouped = computed(() => {
  // Filter out NiCa Booster from ungrouped display
  return liquidStructure.value.ungrouped.filter(product => {
    const title = product.title.toLowerCase()
    return !(title.includes('никобустер') || title.includes('nikobuster') || title.includes('nica booster'))
  })
})
const nicaBoosterProduct = computed(() => {
  if (!selectedCategory.value) return null
  const categoryProducts = catalogStore.products.filter(product => product.categoryId === selectedCategory.value!.id)
  return categoryProducts.find(p => 
    p.title.toLowerCase().includes('никобустер') ||
    p.title.toLowerCase().includes('nikobuster') ||
    p.title.toLowerCase().includes('nica booster')
  ) || null
})
const liquidFallbackImage = computed(() => selectedCategory.value?.coverImage || PLACEHOLDER_IMAGE)

const liquidExpansionState = ref<Record<string, boolean>>({})

watch(
  () => liquidGroups.value.map(group => group.id),
  (ids) => {
    if (!showLiquidShowcase.value) {
      liquidExpansionState.value = {}
      return
    }

    const nextState: Record<string, boolean> = {}
    ids.forEach((id) => {
      nextState[id] = liquidExpansionState.value[id] ?? false
    })
    liquidExpansionState.value = nextState
  },
  { immediate: true }
)

watch(
  () => selectedCategory.value?.id,
  () => {
    liquidExpansionState.value = {}
    groupExpansionState.value = {}
  }
)

const crossSellItems = computed<Product[]>(() => {
  const slug = catalogStore.activeCategory
  if (!slug) return []
  return catalogStore.crossSellProducts[slug] ?? []
})

const activeGroupCard = computed(() => {
  if (!catalogStore.activeGroup) return null
  return groupCards.value.find(group => group.slug === catalogStore.activeGroup) ?? null
})

const categoryFocusStyle = computed(() => {
  const image = selectedCategoryCard.value?.previewImage || selectedCategory.value?.coverImage || PLACEHOLDER_IMAGE
  return { backgroundImage: `url(${image})` }
})

const groupFocusStyle = computed(() => {
  const image = activeGroupCard.value?.previewImage || selectedCategoryCard.value?.previewImage || selectedCategory.value?.coverImage || PLACEHOLDER_IMAGE
  return { backgroundImage: `url(${image})` }
})

const showProducts = computed(() => {
  if (showLiquidShowcase.value) {
    return false
  }
  if (!selectedCategory.value) {
    return false
  }
  if (resolvedDisplayMode.value === 'visual') {
    return true
  }
  if (!selectedCategory.value.groups.length) {
    return true
  }
  return catalogStore.activeGroup !== null
})

const totalCartItems = computed(() => cartStore.totalItems)
const totalCartAmount = computed(() => cartStore.totalAmount.toFixed(2))

function getProductBadges(product: Product): ProductBadge[] {
  if (!Array.isArray(product.badges)) {
    return []
  }
  return product.badges.filter((badge): badge is ProductBadge => Boolean(badge && (badge.label || badge.type)))
}

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

function formatPrice(price: number): string {
  return price.toLocaleString('ru-RU')
}

function getProductImage(product: Product): string | null {
  // Для товаров с вариантами берём изображение первого варианта
  if (product.hasVariants && product.variants?.length && product.variants[0].images?.length) {
    return product.variants[0].images[0]
  }
  
  // Сначала проверяем загруженные изображения
  if (product.images?.[0]) {
    return product.images[0]
  }
  
  // Если нет изображений, ищем ссылку на картинку в links
  if (product.links?.length) {
    for (const link of product.links) {
      // Проверяем что URL ведёт на картинку
      const url = link.url?.toLowerCase() || ''
      if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i)) {
        return link.url
      }
    }
    
    // Если не нашли картинку по расширению, пробуем первую ссылку как потенциальную картинку
    // (для ссылок без расширения в URL, например CDN)
    return product.links[0]?.url || null
  }
  
  return null
}

async function selectCategory(slug: string | null) {
  groupExpansionState.value = {}
  await catalogStore.setActiveCategory(slug)
}

async function backToCategories() {
  await catalogStore.setActiveGroup(null)
  await catalogStore.setActiveCategory(null)
}

async function backToGroups() {
  await catalogStore.setActiveGroup(null)
}

function openProduct(product: Product) {
  catalogStore.currentProduct = product
  router.push({ name: 'product', params: { id: product.id } })
  catalogStore.fetchProduct(product.id)
}

function goToCheckout() {
  router.push('/checkout')
}

function toggleLiquidExpansion(groupId: string) {
  liquidExpansionState.value = {
    ...liquidExpansionState.value,
    [groupId]: !isLiquidGroupExpanded(groupId)
  }
}

function isLiquidGroupExpanded(groupId: string): boolean {
  return liquidExpansionState.value[groupId] ?? false
}


// Cross-sell cart functions
function getCrossSellQuantity(productId: string): number {
  const item = cartStore.items.find(item => item.productId === productId)
  return item ? item.quantity : 0
}

function canAddCrossSell(product: Product) {
  const currentQty = getCrossSellQuantity(product.id)
  
  if (product.isAvailable === false) {
    return false
  }
  if (typeof product.stock === 'number') {
    const stock = Math.max(product.stock, 0)
    if (stock === 0) {
      return false
    }
    return currentQty < stock
  }
  return true
}

function isCrossSellAtStockLimit(product: Product) {
  if (product.isAvailable === false) {
    return true
  }
  if (typeof product.stock === 'number') {
    const stock = Math.max(product.stock, 0)
    if (stock === 0) {
      return true
    }
    return getCrossSellQuantity(product.id) >= stock
  }
  return false
}


function handleCrossSellAdd(product: Product) {
  if (!canAddCrossSell(product)) {
    if (product.isAvailable === false || (typeof product.stock === 'number' && product.stock <= 0)) {
      showToast('Товара нет в наличии', 'error')
    } else {
      showToast('В наличии больше нет', 'error')
    }
    return
  }
  addCrossSellToCart(product)
}

function addCrossSellToCart(product: Product) {
  cartStore.addItem(product, 1)
}

function handleCrossSellIncrement(product: Product) {
  if (!canAddCrossSell(product)) {
    if (product.isAvailable === false || (typeof product.stock === 'number' && product.stock <= 0)) {
      showToast('Товара нет в наличии', 'error')
    } else {
      showToast('В наличии больше нет', 'error')
    }
    return
  }
  incrementCrossSellQuantity(product)
}

function incrementCrossSellQuantity(product: Product) {
  const currentQty = getCrossSellQuantity(product.id)
  if (currentQty > 0) {
    cartStore.updateQuantity(product.id, currentQty + 1)
  } else {
    cartStore.addItem(product, 1)
  }
}

function decrementCrossSellQuantity(product: Product) {
  const currentQty = getCrossSellQuantity(product.id)
  if (currentQty > 1) {
    cartStore.updateQuantity(product.id, currentQty - 1)
  } else if (currentQty === 1) {
    cartStore.removeItem(product.id)
  }
}

// Ungrouped товары без линейки - cart functions
function getUngroupedQuantity(productId: string): number {
  const item = cartStore.items.find(item => item.productId === productId)
  return item ? item.quantity : 0
}

function canAddUngrouped(product: Product) {
  if (product.isAvailable === false) {
    return false
  }
  if (typeof product.stock === 'number') {
    const stock = Math.max(product.stock, 0)
    if (stock === 0) {
      return false
    }
    return getUngroupedQuantity(product.id) < stock
  }
  return true
}

function isUngroupedAtStockLimit(product: Product) {
  if (product.isAvailable === false) {
    return true
  }
  if (typeof product.stock === 'number') {
    const stock = Math.max(product.stock, 0)
    if (stock === 0) {
      return true
    }
    return getUngroupedQuantity(product.id) >= stock
  }
  return false
}


function handleUngroupedAdd(product: Product) {
  if (!canAddUngrouped(product)) {
    if (product.isAvailable === false || (typeof product.stock === 'number' && product.stock <= 0)) {
      showToast('Товара нет в наличии', 'error')
    } else {
      showToast('В наличии больше нет', 'error')
    }
    return
  }
  addUngroupedToCart(product)
}

function addUngroupedToCart(product: Product) {
  cartStore.addItem(product, 1)
}

function handleUngroupedIncrement(product: Product) {
  if (!canAddUngrouped(product)) {
    if (product.isAvailable === false || (typeof product.stock === 'number' && product.stock <= 0)) {
      showToast('Товара нет в наличии', 'error')
    } else {
      showToast('В наличии больше нет', 'error')
    }
    return
  }
  incrementUngroupedQuantity(product)
}

function incrementUngroupedQuantity(product: Product) {
  const currentQty = getUngroupedQuantity(product.id)
  if (currentQty > 0) {
    cartStore.updateQuantity(product.id, currentQty + 1)
  } else {
    cartStore.addItem(product, 1)
  }
}

function decrementUngroupedQuantity(product: Product) {
  const currentQty = getUngroupedQuantity(product.id)
  if (currentQty > 1) {
    cartStore.updateQuantity(product.id, currentQty - 1)
  } else if (currentQty === 1) {
    cartStore.removeItem(product.id)
  }
}

// Watcher для загрузки cross-sell товаров
watch(
  () => catalogStore.activeCategory,
  (slug) => {
    if (slug && !catalogStore.crossSellProducts[slug]) {
      catalogStore.fetchCrossSell(slug)
    }
  }
)

// При изменении cross-sell товаров или корзины - адаптируем шрифты
watch(
  () => [crossSellItems.value.length, cartStore.items.length, cartStore.items.map(i => i.quantity).join(',')],
  () => {
    // Задержка для завершения рендеринга DOM
    nextTick(() => {
      setTimeout(() => {
        adjustCrossSellFontSizes()
        adjustUngroupedFontSizes()
      }, 50)
    })
  },
  { flush: 'post' }
)

onMounted(async () => {
  await catalogStore.initialize()

  if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready()
    window.Telegram.WebApp.expand()
  }
})


</script>

<style scoped>
@font-face {
  font-family: 'Bebas Neue Local';
  src: url('/fonts/BebasNeue.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

.main-title-adaptive {
  font-family: 'Bebas Neue Local', 'Bebas Neue', 'Impact', 'Arial Black', sans-serif !important;
  font-size: 2.5rem;
  max-width: 90%;
  margin-left: auto;
  margin-right: auto;
}

.main-title-adaptive .question-mark {
  display: inline-block;
  font-size: 1.15em;
  line-height: 1;
}

@media (max-width: 768px) {
  .main-title-adaptive {
    font-size: clamp(1.5rem, 8vw, 2.5rem);
  }
}

@media (max-width: 480px) {
  .main-title-adaptive {
    font-size: clamp(1.2rem, 7.5vw, 2rem);
  }
}

.banner-wrapper {
  overflow-x: hidden;
  overflow-y: visible;
}

.banner-container {
  position: relative;
}

.category-card-new {
  display: flex;
  flex-direction: column;
  border-radius: 24px;
  overflow: hidden;
  border: none;
  background: transparent;
  box-shadow: none;
  transition: transform 0.25s ease;
  text-align: center;
  cursor: pointer;
}

.category-card-new:hover,
.category-card-new.active {
  transform: translateY(-4px);
}

.category-grid {
  display: grid;
  gap: clamp(0.75rem, 3vw, 1.5rem);
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

@media (max-width: 768px) {
  .category-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: clamp(0.65rem, 2.5vw, 1rem);
  }
}

@media (max-width: 480px) {
  .category-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: clamp(0.5rem, 2vw, 0.75rem);
  }
}

@media (max-width: 360px) {
  .category-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
  }
}

.category-focus-panel {
  position: relative;
  border-radius: 32px;
  overflow: hidden;
  border: 4px solid var(--navalivay-black);
  background: var(--navalivay-white);
  min-height: 320px;
  box-shadow: var(--navalivay-shadow-hover);
}

.category-focus-media {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  filter: blur(8px) brightness(0.72);
  transform: scale(1.12);
}

.category-focus-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at top right, rgba(255, 255, 255, 0.16), transparent 45%), linear-gradient(135deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.68));
}

.category-focus-content {
  position: relative;
  z-index: 2;
  padding: clamp(1.75rem, 4vw, 3rem);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  color: var(--navalivay-black);
}

.category-focus-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.category-focus-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.4rem 0.9rem;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.08);
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.category-focus-title {
  font-family: var(--font-display);
  font-size: clamp(2rem, 4vw, 2.8rem);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.category-focus-meta {
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(0, 0, 0, 0.6);
}

.group-focus-panel {
  position: relative;
  border-radius: 28px;
  overflow: hidden;
  border: 3px solid var(--navalivay-black);
  background: var(--navalivay-white);
  min-height: 240px;
  box-shadow: var(--navalivay-shadow);
}

.group-focus-media {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  filter: blur(6px) brightness(0.78);
  transform: scale(1.08);
}

.group-focus-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.65));
}

.group-focus-content {
  position: relative;
  padding: clamp(1.5rem, 3vw, 2.4rem);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.group-focus-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.group-focus-count {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(0, 0, 0, 0.55);
}

.group-focus-title {
  font-family: var(--font-display);
  font-size: clamp(1.6rem, 3vw, 2.1rem);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--navalivay-black);
}

.group-focus-meta {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(0, 0, 0, 0.5);
}

@media (max-width: 1024px) {
  .category-focus-panel {
    border-radius: 26px;
  }

  .category-focus-content {
    padding: clamp(1.5rem, 4vw, 2.2rem);
  }

  .group-focus-panel {
    border-radius: 22px;
  }
}

@media (max-width: 768px) {
  .category-focus-panel {
    min-height: 260px;
    border-width: 3px;
  }

  .category-focus-media {
    filter: blur(6px) brightness(0.78);
    transform: scale(1.08);
  }

  .category-focus-content {
    padding: 1.5rem;
    gap: 1rem;
  }

  .category-focus-top {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .category-focus-title {
    font-size: clamp(1.6rem, 7vw, 2.2rem);
  }

  .group-focus-panel {
    min-height: 200px;
    border-width: 2px;
  }

  .group-focus-content {
    padding: 1.25rem;
    gap: 0.75rem;
  }

  .group-focus-top {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .group-focus-title {
    font-size: clamp(1.2rem, 6vw, 1.75rem);
  }
}

@media (max-width: 480px) {
  .category-focus-panel {
    border-radius: 20px;
  }

  .category-focus-content {
    padding: 1.3rem;
  }

  .category-focus-title {
    font-size: clamp(1.4rem, 8vw, 1.9rem);
  }

  .category-focus-meta {
    font-size: 0.75rem;
  }

  .group-focus-panel {
    border-radius: 18px;
  }

  .group-focus-content {
    padding: 1.1rem;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(16px);
}

.fade-enter-to,
.fade-leave-from {
  opacity: 1;
  transform: translateY(0);
}

.category-card-media {
  position: relative;
  width: 100%;
  padding-bottom: 133.33%;
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  background-color: transparent;
}

.category-card-body {
  padding: 0.75rem 0.5rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0;
  align-items: center;
}

.category-card-mode {
  display: none;
}

.category-card-title {
  font-family: 'Bebas Neue Local', 'Bebas Neue', 'Impact', 'Arial Black', sans-serif;
  font-size: clamp(1.1rem, 3.8vw, 1.35rem);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: #000000;
  line-height: 1.1;
  font-weight: 400;
}

.category-card-meta {
  display: none;
}

.category-card-badge {
  display: none;
}

@media (max-width: 768px) {
  .category-card-new {
    border-radius: 20px;
  }

  .category-card-body {
    padding: 0.65rem 0.45rem 1.1rem;
  }
  
  .category-card-title {
    font-size: clamp(1rem, 3.6vw, 1.2rem);
  }
}

@media (max-width: 480px) {
  .category-card-new {
    border-radius: 18px;
  }

  .category-card-media {
    padding-bottom: 133.33%;
  }

  .category-card-body {
    padding: 0.55rem 0.4rem 0.95rem;
  }
  
  .category-card-title {
    font-size: clamp(0.95rem, 3.8vw, 1.1rem);
    line-height: 1.15;
  }
}

.group-card {
  border-radius: 20px;
  overflow: hidden;
  border: 3px solid var(--navalivay-black);
  background: var(--navalivay-white);
  transition: transform 0.25s ease, border-color 0.25s ease;
  display: flex;
  flex-direction: column;
  text-align: left;
}

.group-card:hover,
.group-card.active {
  transform: translate(-3px, -3px);
  border-color: var(--navalivay-red);
  box-shadow: var(--navalivay-shadow-hover);
}

.group-card-media {
  width: 100%;
  padding-bottom: 75%;
  background-size: cover;
  background-position: center;
}

.group-card-body {
  padding: 0.85rem 1rem 1rem;
}

.group-card-title {
  font-weight: 800;
  font-size: 0.95rem;
  color: var(--navalivay-black);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.group-card-meta {
  font-size: 0.7rem;
  color: var(--navalivay-gray);
  letter-spacing: 0.08em;
  margin-top: 0.35rem;
}

.cross-sell-card {
  border-radius: 20px;
  overflow: hidden;
  border: 3px solid var(--navalivay-black);
  background: var(--navalivay-white);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
  cursor: pointer;
}

.cross-sell-card:hover {
  transform: translate(-3px, -3px);
  box-shadow: var(--navalivay-shadow-hover);
}

.cross-sell-media,
.product-card-media {
  width: 100%;
  padding-bottom: 100%;
  position: relative;
  background: #f3f3f3;
  overflow: hidden;
  border-radius: 20px 20px 0 0;
}

.product-card-badges {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  z-index: 2;
}

.product-card-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
  background: #e60000;
  border: 2px solid #ffffff;
  font-size: 0.65rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #ffffff;
  box-shadow: 0 6px 16px rgba(230, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.2);
}

.cross-sell-media img,
.product-card-media img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.cross-sell-card:hover img,
.product-card:hover .product-card-media img {
  transform: scale(1.05);
}

.media-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f8f8f8 0%, #ebebeb 100%);
}

.cross-sell-body,
.product-card-body {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.cross-sell-title,
.product-card-title {
  font-weight: 800;
  font-size: 0.95rem;
  color: var(--navalivay-black);
  line-height: 1.35;
}

.product-card-title {
  text-transform: uppercase;
  font-size: 0.9rem;
  letter-spacing: 0.04em;
}

.product-card-variant {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--navalivay-gray);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.cross-sell-price,
.product-card-price {
  font-size: 1.1rem;
  font-weight: 900;
  color: var(--navalivay-red);
  letter-spacing: 0.05em;
}

.product-card {
  border-radius: 22px;
  overflow: visible;
  border: 3px solid var(--navalivay-black);
  background: var(--navalivay-white);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
  cursor: pointer;
}

.product-card:hover {
  transform: translate(-4px, -4px);
  box-shadow: var(--navalivay-shadow-hover);
}

.back-chip,
.link-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border: 3px solid var(--navalivay-black);
  transition: all 0.2s ease;
  background: var(--navalivay-white);
}

.back-chip:hover,
.link-chip:hover {
  transform: translate(-2px, -2px);
  box-shadow: var(--navalivay-shadow);
}

.link-chip {
  border-color: var(--navalivay-red);
  color: var(--navalivay-red);
  background: rgba(211, 47, 47, 0.08);
}

/* ===== Cart Button Styles (Brutal Card Style) ===== */
.cart-wrapper {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  padding: 1rem;
  pointer-events: none;
}

.cart-button {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1.25rem 2rem;
  position: relative;
  
  /* Черный дизайн с контрастом */
  background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
  border: none;
  border-radius: 20px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 0 40px rgba(211, 47, 47, 0.3);
  
  cursor: pointer;
  pointer-events: auto;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}

/* Пульсирующий индикатор */
.cart-button::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 1.5rem;
  width: 10px;
  height: 10px;
  background: var(--navalivay-red);
  border-radius: 50%;
  transform: translateY(-50%);
  box-shadow: 0 0 10px rgba(211, 47, 47, 0.8);
  animation: cart-pulse 2s ease-in-out infinite;
}

@keyframes cart-pulse {
  0%, 100% { 
    opacity: 1; 
    transform: translateY(-50%) scale(1);
    box-shadow: 0 0 10px rgba(211, 47, 47, 0.8);
  }
  50% { 
    opacity: 0.6; 
    transform: translateY(-50%) scale(1.4);
    box-shadow: 0 0 20px rgba(211, 47, 47, 1);
  }
}

.cart-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6), 0 0 50px rgba(211, 47, 47, 0.5);
}

.cart-button:active {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5), 0 0 35px rgba(211, 47, 47, 0.4);
}

.cart-icon {
  flex-shrink: 0;
  color: var(--navalivay-white);
  transition: transform 0.25s ease;
  filter: drop-shadow(0 0 8px rgba(211, 47, 47, 0.5));
}

.cart-button:hover .cart-icon {
  transform: scale(1.1);
  filter: drop-shadow(0 0 12px rgba(211, 47, 47, 0.8));
}

.cart-text {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--navalivay-white);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

/* Slide up animation with bounce */
.cart-slide-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.cart-slide-leave-active {
  transition: all 0.3s ease-out;
}

.cart-slide-enter-from {
  transform: translateY(150%);
  opacity: 0;
}

.cart-slide-leave-to {
  transform: translateY(150%);
  opacity: 0;
}

/* Mobile adjustments */
@media (max-width: 768px) {
  .cart-wrapper {
    padding: 0.75rem;
  }
  
  .cart-button {
    padding: 1rem 1.5rem;
    border-radius: 18px;
  }
  
  .cart-button::before {
    left: 1.2rem;
    width: 8px;
    height: 8px;
  }
  
  .cart-text {
    font-size: 0.95rem;
    letter-spacing: 0.06em;
  }
  
  .cart-icon {
    width: 20px;
    height: 20px;
  }
}

@media (max-width: 480px) {
  .cart-wrapper {
    padding: 0.5rem;
  }
  
  .cart-button {
    padding: 0.85rem 1.25rem;
    border-radius: 16px;
    gap: 0.5rem;
  }
  
  .cart-button::before {
    left: 1rem;
    width: 7px;
    height: 7px;
  }
  
  .cart-text {
    font-size: 0.85rem;
  }
  
  .cart-icon {
    width: 18px;
    height: 18px;
  }
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

:deep(.liquid-ungrouped) {
  border-radius: 24px;
  border: 3px dashed var(--navalivay-black);
  background: rgba(255, 255, 255, 0.9);
  padding: 1.5rem 1.4rem 1.8rem;
}

:deep(.liquid-ungrouped-title) {
  font-family: var(--font-display);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 1rem;
  color: var(--navalivay-black);
  margin-bottom: 1rem;
}

:deep(.liquid-product-header) {
  display: grid;
  grid-template-columns: minmax(0, 2.4fr) minmax(0, 1fr) minmax(120px, 0.8fr) minmax(120px, 0.9fr);
  gap: 1rem;
  padding: 0.9rem 1rem 0.4rem;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(0, 0, 0, 0.48);
}

:deep(.liquid-header-cell) {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

:deep(.liquid-header-title) {
  padding-left: 0.2rem;
}

:deep(.liquid-header-strength),
:deep(.liquid-header-price),
:deep(.liquid-header-stock) {
  justify-content: flex-start;
}

@media (max-width: 720px) {
  :deep(.liquid-product-header) {
    display: none;
  }
}

:deep(.liquid-collapse-enter-active),
:deep(.liquid-collapse-leave-active) {
  transition: max-height 0.25s ease, opacity 0.2s ease;
  overflow: hidden;
}

:deep(.liquid-collapse-enter-from),
:deep(.liquid-collapse-leave-to) {
  max-height: 0;
  opacity: 0;
}

:deep(.liquid-collapse-enter-to),
:deep(.liquid-collapse-leave-from) {
  max-height: 800px;
  opacity: 1;
}

/* Liquid Category Header Styles */
.liquid-category-header {
  background: white;
  padding: 1rem 1rem 0 1rem;
  border-bottom: 1px solid #e5e5e5;
  margin-bottom: 0;
}

.liquid-category-header-content {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  max-width: 100%;
}

.liquid-back-button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1rem;
  border-radius: 10px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  color: #666666;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  transition: all 0.2s ease;
  cursor: pointer;
  flex-shrink: 0;
}

.liquid-back-button:hover {
  background: #ebebeb;
  border-color: #d0d0d0;
  transform: translateX(-2px);
}

.liquid-back-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}

.liquid-back-text {
  white-space: nowrap;
}

.liquid-category-title {
  font-family: 'Bebas Neue Local', 'Bebas Neue', 'Impact', 'Arial Black', sans-serif;
  font-size: 1.20rem;
  font-weight: 400;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #000000;
  line-height: 1.1;
  text-align: right;
  flex: 1;
  min-width: 0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

@media (max-width: 768px) {
  .liquid-category-header {
    padding: 0.85rem;
    margin-bottom: 0.85rem;
  }

  .liquid-category-header-content {
    gap: 0.85rem;
  }

  .liquid-back-button {
    font-size: 0.75rem;
    padding: 0.55rem 0.85rem;
    gap: 0.35rem;
  }

  .liquid-back-icon {
    width: 15px;
    height: 15px;
  }

  .liquid-category-title {
    font-size: 1.35rem;
  }
}

@media (max-width: 640px) {
  .liquid-category-header {
    padding: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .liquid-category-header-content {
    gap: 0.75rem;
  }

  .liquid-back-button {
    font-size: 0.7rem;
    padding: 0.5rem 0.75rem;
    gap: 0.3rem;
  }

  .liquid-back-icon {
    width: 14px;
    height: 14px;
  }

  .liquid-category-title {
    font-size: 1.25rem;
  }
}

@media (max-width: 480px) {
  .liquid-category-header {
    padding: 0.7rem 0.65rem;
    margin-bottom: 0.7rem;
  }

  .liquid-category-header-content {
    gap: 0.65rem;
  }

  .liquid-back-button {
    font-size: 0.68rem;
    padding: 0.45rem 0.7rem;
    gap: 0.28rem;
    border-radius: 8px;
  }

  .liquid-back-icon {
    width: 13px;
    height: 13px;
  }

  .liquid-category-title {
    font-size: 1.15rem;
    letter-spacing: 0;
  }
}

@media (max-width: 360px) {
  .liquid-category-header {
    padding: 0.65rem 0.6rem;
    margin-bottom: 0.65rem;
  }

  .liquid-category-header-content {
    gap: 0.6rem;
  }

  .liquid-back-button {
    font-size: 0.65rem;
    padding: 0.4rem 0.65rem;
    gap: 0.25rem;
  }

  .liquid-back-icon {
    width: 12px;
    height: 12px;
  }

  .liquid-category-title {
    font-size: 1.05rem;
  }
}

/* Cross-sell товары в стиле LiquidLineCard */
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
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.liquid-line-single-main {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
  max-width: 100%;
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
  max-width: 100%;
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
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: none;
}

.liquid-line-description {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  text-transform: uppercase;
  color: #a5a5a5;
  line-height: 1.25;
  margin: 0;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.liquid-line-single-side {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 0.75rem;
  flex-shrink: 0;
  min-width: fit-content;
  padding-top: 0.25rem;
}


.liquid-line-price {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  font-weight: 900;
  color: #ed1d24;
  line-height: 1;
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

.price-value {
  font-size: 1.5rem;
  letter-spacing: -0.02em;
}

.price-currency {
  font-size: 1rem;
}

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
    gap: 0.6rem;
  }

  .liquid-line-single-main {
    gap: 0.6rem;
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

  .liquid-line-description {
    font-size: 0.62rem;
  }

  .liquid-line-single-side {
    gap: 0.6rem;
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
    gap: 0.5rem;
  }

  .liquid-line-single-main {
    gap: 0.5rem;
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

  .liquid-line-description {
    font-size: 0.6rem;
  }

  .liquid-line-single-side {
    gap: 0.5rem;
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
}

@media (max-width: 480px) {
  .liquid-line-card-single {
    padding: 0.85rem 0;
  }

  .liquid-line-single-header {
    gap: 0.45rem;
  }

  .liquid-line-single-main {
    gap: 0.45rem;
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

  .liquid-line-description {
    font-size: 0.58rem;
  }

  .liquid-line-single-side {
    gap: 0.45rem;
  }

  .price-value {
    font-size: 1.15rem;
  }

  .price-currency {
    font-size: 0.8rem;
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
  .liquid-line-card-single {
    padding: 0.8rem 0;
  }

  .liquid-line-single-header {
    gap: 0.4rem;
  }

  .liquid-line-single-main {
    gap: 0.4rem;
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

  .liquid-line-description {
    font-size: 0.54rem;
  }

  .liquid-line-single-side {
    gap: 0.4rem;
  }

  .price-value {
    font-size: 1.05rem;
  }

  .price-currency {
    font-size: 0.75rem;
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
