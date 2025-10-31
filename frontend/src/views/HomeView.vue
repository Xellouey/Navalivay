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
      <h1 class="navalivay-title text-center mb-12 main-title-adaptive" style="margin-top: 2rem; color: var(--navalivay-black); font-weight: bold;">
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
            class="category-focus-panel"
          >
            <div class="category-focus-media" :style="categoryFocusStyle"></div>
            <div class="category-focus-overlay"></div>
            <div class="category-focus-content">
              <div class="category-focus-top">
                <button class="back-chip" @click="backToCategories">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                  Все категории
                </button>
                <span class="category-focus-label">{{ displayModeLabels[resolvedDisplayMode] }}</span>
              </div>
              <h2 class="category-focus-title">{{ selectedCategory?.name }}</h2>
              <p class="category-focus-meta">
                {{ selectedCategory?.productCount }} товаров
                <template v-if="selectedCategory?.groups.length"> · {{ selectedCategory?.groups.length }} {{ selectedCategory?.groups.length === 1 ? 'подгруппа' : selectedCategory?.groups.length < 5 ? 'подгруппы' : 'подгрупп' }}</template>
              </p>
            </div>
          </div>
        </Transition>
      </section>

      <section v-if="selectedCategory" class="mt-12 space-y-8">
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
            key="group-grid"
            class="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
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
        </Transition>
        <p v-if="!groupCards.length && !showLiquidShowcase" class="text-gray-600 bg-gray-100 border border-dashed border-gray-300 rounded-xl px-5 py-4 text-sm font-medium">
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
            <div class="liquid-product-header">
              <span class="liquid-header-cell liquid-header-title">Вкус</span>
              <span class="liquid-header-cell liquid-header-strength">Крепость</span>
              <span class="liquid-header-cell liquid-header-price">Цена</span>
              <span class="liquid-header-cell liquid-header-stock">Наличие</span>
            </div>
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
            Выберите другую категорию или подгруппу
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
import { ref, computed, onMounted, watch } from 'vue'
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
  await catalogStore.setActiveCategory(slug)
}

async function selectGroup(slug: string | null) {
  await catalogStore.setActiveGroup(slug)
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

.category-grid {
  display: grid;
  gap: clamp(0.75rem, 3vw, 1rem);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 360px) {
  .category-grid {
    grid-template-columns: repeat(1, minmax(0, 1fr));
    gap: 0.85rem;
  }
}

@media (min-width: 640px) {
  .category-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.2rem;
  }
}

@media (min-width: 1024px) {
  .category-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1.5rem;
  }
}

@media (min-width: 1280px) {
  .category-grid {
    gap: 1.75rem;
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
  padding-bottom: 100%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.category-card-body {
  padding: clamp(0.75rem, 2.8vw, 1rem);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.category-card-mode {
  align-self: flex-start;
  font-size: clamp(0.55rem, 2vw, 0.65rem);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 0.25rem 0.55rem;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.08);
  color: var(--navalivay-black);
}

.category-card-title {
  font-family: var(--font-display);
  font-size: clamp(0.95rem, 3.2vw, 1.05rem);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--navalivay-black);
  line-height: 1.25;
}

.category-card-meta {
  font-size: clamp(0.66rem, 2.4vw, 0.78rem);
  font-weight: 600;
  color: var(--navalivay-gray);
  letter-spacing: 0.05em;
}

.category-card-badge {
  font-size: clamp(0.58rem, 2.2vw, 0.7rem);
  font-weight: 700;
  color: var(--navalivay-white);
  background: var(--navalivay-red);
  padding: 0.25rem 0.5rem;
  border-radius: 8px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

@media (max-width: 768px) {
  .category-card-new {
    border-width: 3px;
    border-radius: 18px;
  }

  .category-card-body {
    padding: clamp(0.7rem, 3vw, 0.85rem);
    gap: 0.2rem;
  }
}

@media (max-width: 480px) {
  .category-card-new {
    border-width: 2px;
    border-radius: 16px;
  }

  .category-card-media {
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  }

  .category-card-body {
    padding: clamp(0.6rem, 4vw, 0.75rem);
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
</style>
