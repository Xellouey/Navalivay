<template>
  <div class="min-h-screen bg-white paper-texture-navalivay">
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
      <h1 class="navalivay-title text-center mb-8 main-title-adaptive" style="margin-top: 2rem; color: var(--navalivay-black); font-weight: bold;">
        ЧТО ХОТИТЕ КУПИТЬ<span class="question-mark">?</span>
      </h1>

      <div class="relative mb-10 max-w-3xl mx-auto">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Быстрый поиск товаров..."
          class="input-navalivay w-full text-center search-field"
          @input="handleSearch"
        />
      </div>

      <section class="space-y-6">
        <div class="section-header-navalivay items-center justify-between">
          <h2 class="navalivay-title text-white text-xl sm:text-2xl">Категории</h2>
          <span class="text-xs sm:text-sm text-white/70 font-semibold tracking-wide">{{ categories.length }} доступно</span>
        </div>

        <div class="grid gap-4 sm:gap-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
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
      </section>

      <section v-if="selectedCategory" class="mt-12 space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="flex items-center gap-3">
            <button class="back-chip" @click="backToCategories">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Все категории
            </button>
            <h2 class="navalivay-title text-2xl sm:text-3xl" style="color: var(--navalivay-black)">
              {{ selectedCategory.name }}
            </h2>
          </div>
          <div v-if="catalogStore.activeGroup" class="flex justify-end">
            <button class="link-chip" @click="backToGroups">Вернуться к подгруппам</button>
          </div>
        </div>

        <div v-if="groupCards.length && !showLiquidShowcase" class="grid gap-4 sm:gap-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          <button
            v-for="group in groupCards"
            :key="group.id"
            class="group-card"
            :class="{ active: group.isActive }"
            :style="group.depth ? { marginLeft: `${Math.min(group.depth * 1.25, 3)}rem` } : undefined"
            @click="selectGroup(group.slug)"
          >
            <div class="group-card-media" :style="{ backgroundImage: `url(${group.previewImage})` }"></div>
            <div class="group-card-body">
              <p class="group-card-title">{{ group.name }}</p>
              <p class="group-card-meta">{{ group.totalProductCount ?? group.productCount }} вкусов</p>
            </div>
          </button>
        </div>
        <p v-else-if="!showLiquidShowcase" class="text-gray-600 bg-gray-100 border border-dashed border-gray-300 rounded-xl px-5 py-4 text-sm font-medium">
          Для категории пока не добавлены подгруппы — товары будут показаны в общем списке ниже.
        </p>

        <section v-if="showLiquidShowcase" class="space-y-4">
          <LiquidLineCard
            v-for="group in liquidGroups"
            :key="group.id"
            :group-id="group.id"
            :title="group.name"
            :products="group.products"
            :cover-image="group.coverImage"
            :fallback-image="liquidFallbackImage"
            :expanded="isGroupExpanded(group.id)"
            @toggle="toggleGroupExpansion"
            @select="openProduct"
          />

          <div v-if="liquidUngrouped.length" class="liquid-ungrouped">
            <h3 class="liquid-ungrouped-title">Без линейки</h3>
            <ul class="liquid-product-list">
              <LiquidFlavorRow
                v-for="product in liquidUngrouped"
                :key="product.id"
                :product="product"
                @select="openProduct"
              />
            </ul>
          </div>
        </section>
      </section>

      <section v-if="crossSellItems.length" class="mt-12 space-y-4">
        <div class="section-header-navalivay grunge-texture">
          <h2 class="navalivay-title text-white text-xl tracking-widest">А вдруг пригодится?</h2>
        </div>
        <div class="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div
            v-for="item in crossSellItems"
            :key="item.id"
            class="cross-sell-card"
            @click="openProduct(item)"
          >
            <div class="cross-sell-media">
              <img
                v-if="getProductImage(item)"
                :src="getProductImage(item)!"
                :alt="item.title"
                loading="lazy"
              />
              <div v-else class="media-placeholder">
                <PhotoIcon class="w-10 h-10 text-gray-300" />
              </div>
            </div>
            <div class="cross-sell-body">
              <p class="cross-sell-title">{{ item.title }}</p>
              <p class="cross-sell-price">{{ formatPrice(item.priceRub) }}<span class="text-base ml-1">₽</span></p>
            </div>
          </div>
        </div>
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
            {{ searchQuery ? 'Попробуйте другой запрос' : 'Выберите другую категорию или подгруппу' }}
          </p>
          <button @click="catalogStore.activeGroup ? backToGroups() : backToCategories()" class="btn-navalivay">
            <span>Вернуться</span>
          </button>
        </div>
      </section>
    </div>

    <DeliveryInfo />

    <div
      v-if="totalCartItems > 0"
      @click="goToCheckout"
      class="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 clickable"
      style="max-width: 90%; width: 600px;"
    >
      <button class="cart-button w-full bg-[#e60000] text-white rounded-full py-4 px-8 flex items-center justify-center gap-3 font-bold text-lg shadow-2xl">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" fill="currentColor" />
        </svg>
        <span>ЗАКАЗ НА {{ totalCartAmount }} BYN</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ExclamationTriangleIcon, PhotoIcon } from '@heroicons/vue/24/outline'

import { useCatalogStore, type Product, type Category, type CategoryGroup, type ProductBadge } from '@/stores/catalog'
import { useCartStore } from '@/stores/cart'
import SmokeParticles from '@/components/SmokeParticles.vue'
import DeliveryInfo from '@/components/DeliveryInfo.vue'
import BannerCarousel from '@/components/BannerCarousel.vue'
import LiquidLineCard from '@/components/product/liquid/LiquidLineCard.vue'
import LiquidFlavorRow from '@/components/product/liquid/LiquidFlavorRow.vue'

const catalogStore = useCatalogStore()
const cartStore = useCartStore()
const router = useRouter()

const searchQuery = ref('')
const searchDebounceTimer = ref<ReturnType<typeof setTimeout> | null>(null)

const PLACEHOLDER_IMAGE = '/placeholder-category.png'

const categories = computed<Category[]>(() => catalogStore.categories)

const displayModeLabels: Record<'default' | 'liquid' | 'visual', string> = {
  default: 'Стандарт',
  liquid: 'Жидкости',
  visual: 'Витрина'
}

const categoryCards = computed(() => {
  return categories.value.map(category => {
    const previewImage = category.coverImage || category.groups.find(group => group.coverImage)?.coverImage || PLACEHOLDER_IMAGE
    const displayMode = category.displayMode ?? 'default'
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

const isLiquidCategory = computed(() => selectedCategory.value?.displayMode === 'liquid')
const showLiquidShowcase = computed(() => isLiquidCategory.value && !searchQuery.value.trim())

type GroupCard = CategoryGroup & { depth: number; previewImage: string; isActive: boolean }
type GroupCardNode = GroupCard & { children: GroupCardNode[] }
type LiquidGroup = {
  id: string
  name: string
  order: number
  coverImage: string | null
  products: Product[]
}

const groupCards = computed<GroupCard[]>(() => {
  if (!selectedCategory.value) return []

  const groups = selectedCategory.value.groups
  const nodes = new Map<string, GroupCardNode>()

  groups.forEach((group) => {
    nodes.set(group.id, {
      ...group,
      depth: 0,
      previewImage: group.coverImage || PLACEHOLDER_IMAGE,
      isActive: catalogStore.activeGroup === group.slug,
      children: []
    })
  })

  const roots: GroupCardNode[] = []

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

  const flatten: GroupCard[] = []
  const visit = (list: GroupCardNode[]) => {
    list
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .forEach(item => {
        if ((item.totalProductCount ?? item.productCount ?? 0) > 0) {
          const { children, ...rest } = item
          flatten.push(rest)
        }
        if (item.children.length) {
          visit(item.children)
        }
      })
  }

  visit(roots)
  return flatten
})

const liquidStructure = computed(() => {
  if (!showLiquidShowcase.value || !selectedCategory.value) {
    return { groups: [] as LiquidGroup[], ungrouped: [] as Product[] }
  }

  const category = selectedCategory.value
  const fallbackCover = category.coverImage || PLACEHOLDER_IMAGE
  const groupMap = new Map<string, LiquidGroup>()

  category.groups.forEach(group => {
    groupMap.set(group.slug, {
      id: group.id,
      name: group.name,
      order: group.order ?? 0,
      coverImage: group.coverImage || fallbackCover,
      products: []
    })
  })

  const ungrouped: Product[] = []
  const categoryProducts = catalogStore.products.filter(product => product.categoryId === category.id)

  categoryProducts.forEach(product => {
    if (product.groupSlug && groupMap.has(product.groupSlug)) {
      groupMap.get(product.groupSlug)!.products.push(product)
    } else {
      ungrouped.push(product)
    }
  })

  const groups = Array.from(groupMap.values())
    .filter(group => group.products.length > 0)
    .sort((a, b) => a.order - b.order)

  return { groups, ungrouped }
})

const liquidGroups = computed(() => liquidStructure.value.groups)
const liquidUngrouped = computed(() => liquidStructure.value.ungrouped)
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
    ids.forEach((id, index) => {
      nextState[id] = liquidExpansionState.value[id] ?? index === 0
    })
    liquidExpansionState.value = nextState
  },
  { immediate: true }
)

const crossSellItems = computed<Product[]>(() => {
  const slug = catalogStore.activeCategory
  if (!slug) return []
  return catalogStore.crossSellProducts[slug] ?? []
})

const showProducts = computed(() => {
  if (searchQuery.value.trim()) {
    return true
  }
  if (showLiquidShowcase.value) {
    return false
  }
  if (!selectedCategory.value) {
    return false
  }
  if (selectedCategory.value.displayMode === 'visual') {
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

function handleSearch() {
  if (searchDebounceTimer.value) {
    clearTimeout(searchDebounceTimer.value)
  }

  searchDebounceTimer.value = setTimeout(async () => {
    const value = searchQuery.value.trim()
    if (value) {
      if (catalogStore.activeGroup) {
        catalogStore.activeGroup = null
      }
      await catalogStore.searchProducts(value)
    } else {
      await catalogStore.clearSearch()
    }
  }, 300)
}

async function selectCategory(slug: string | null) {
  searchQuery.value = ''
  await catalogStore.setActiveCategory(slug)
}

async function selectGroup(slug: string | null) {
  searchQuery.value = ''
  await catalogStore.setActiveGroup(slug)
}

async function backToCategories() {
  searchQuery.value = ''
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

function toggleGroupExpansion(groupId: string) {
  const current = liquidExpansionState.value[groupId] ?? false
  liquidExpansionState.value = { ...liquidExpansionState.value, [groupId]: !current }
}

function isGroupExpanded(groupId: string) {
  return liquidExpansionState.value[groupId] ?? false
}

watch(
  () => catalogStore.activeCategory,
  (slug) => {
    if (slug && !catalogStore.crossSellProducts[slug]) {
      catalogStore.fetchCrossSell(slug)
    }
  }
)

onMounted(async () => {
  await catalogStore.initialize()

  if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready()
    window.Telegram.WebApp.expand()
  }
})

onUnmounted(() => {
  if (searchDebounceTimer.value) {
    clearTimeout(searchDebounceTimer.value)
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

.search-field {
  background: #f5f5f5;
  border: none;
  border-radius: 16px;
  padding: 1rem 1.5rem;
  font-size: 1rem;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
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
  border-radius: 20px;
  overflow: hidden;
  border: 4px solid var(--navalivay-black);
  background: var(--navalivay-white);
  box-shadow: var(--navalivay-shadow);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
  text-align: left;
}

.category-card-new:hover,
.category-card-new.active {
  transform: translate(-4px, -4px);
  box-shadow: var(--navalivay-shadow-hover);
}

.category-card-media {
  position: relative;
  width: 100%;
  padding-bottom: 70%;
  background-size: cover;
  background-position: center;
}

.category-card-body {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.category-card-mode {
  align-self: flex-start;
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 0.25rem 0.6rem;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.08);
  color: var(--navalivay-black);
}

.category-card-title {
  font-family: var(--font-display);
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--navalivay-black);
}

.category-card-meta {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--navalivay-gray);
  letter-spacing: 0.05em;
}

.category-card-badge {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--navalivay-white);
  background: var(--navalivay-red);
  padding: 0.25rem 0.5rem;
  border-radius: 8px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
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
  padding: 0.25rem 0.6rem;
  border-radius: 9999px;
  background: rgba(230, 0, 0, 0.85);
  border: 1px solid rgba(230, 0, 0, 0.9);
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--navalivay-white);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
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

.cart-button {
  transition: all 0.3s ease;
  letter-spacing: 0.05em;
}

.cart-button:hover {
  background: #cc0000;
  transform: translateY(-2px);
  box-shadow: 0 20px 40px rgba(230, 0, 0, 0.4);
}

.cart-button:active {
  transform: translateY(0);
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

:deep(.liquid-group) {
  border-radius: 24px;
  border: 3px solid var(--navalivay-black);
  background: var(--navalivay-white);
  overflow: hidden;
  box-shadow: var(--navalivay-shadow);
}

:deep(.liquid-group-header) {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.1rem 1.4rem;
  background: rgba(0, 0, 0, 0.02);
  transition: background 0.2s ease;
}

:deep(.liquid-group-header:hover) {
  background: rgba(0, 0, 0, 0.05);
}

:deep(.liquid-group-meta) {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
}

:deep(.liquid-group-title) {
  font-family: var(--font-display);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 1.05rem;
  color: var(--navalivay-black);
}

:deep(.liquid-group-count) {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--navalivay-gray);
  letter-spacing: 0.08em;
}

:deep(.liquid-group-icon) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--navalivay-black);
  background: var(--navalivay-white);
  color: var(--navalivay-black);
}

:deep(.liquid-group-body) {
  padding: 0.75rem 0 1.2rem;
}

:deep(.liquid-product-list) {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0 1.2rem;
}

:deep(.liquid-product) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1rem;
  border-radius: 18px;
  border: 2px solid rgba(0, 0, 0, 0.06);
  background: linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(247,247,247,0.98) 100%);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

:deep(.liquid-product:hover) {
  transform: translate(-3px, -3px);
  box-shadow: var(--navalivay-shadow-hover);
}

:deep(.liquid-product-info) {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-width: 65%;
}

:deep(.liquid-product-title) {
  font-weight: 800;
  font-size: 0.95rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--navalivay-black);
  line-height: 1.35;
}

:deep(.liquid-product-variant),
:deep(.liquid-product-strength) {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--navalivay-gray);
  letter-spacing: 0.08em;
}

:deep(.liquid-product-meta) {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
  min-width: 120px;
}

:deep(.liquid-product-price) {
  font-weight: 900;
  color: var(--navalivay-red);
  font-size: 1rem;
  letter-spacing: 0.05em;
}

:deep(.liquid-product-stock) {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--navalivay-gray);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

:deep(.liquid-product-stock.low) {
  color: var(--navalivay-red);
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
</style>
