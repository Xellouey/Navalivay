<template>
  <div class="min-h-screen relative overflow-hidden navalivay-bg paper-texture-navalivay">
    <!-- Background with smoke particles -->
    <div class="fixed inset-0 z-0">
      <SmokeParticles :count="6" area="full" />
      
      <!-- Torn top edge -->
      <div class="torn-edge-top grunge-texture"></div>
      
      <!-- Torn bottom edge -->
      <div class="torn-edge-bottom grunge-texture"></div>
      
      <!-- Skull pattern overlay -->
      <div class="skull-pattern"></div>
    </div>
    
    <!-- Brutal Header -->
    <header class="relative border-b-4 border-[var(--navalivay-black)] bg-[var(--navalivay-white)] shadow-2xl z-10">
      <div class="max-w-screen-xl mx-auto">
        <div class="px-4 sm:px-6 lg:px-8 py-8">
          <!-- Brand Logo & Title -->
          <div class="text-center mb-8">
            <!-- Official Logo -->
            <div class="inline-block mb-4 relative">
              <img 
                src="/logo-navalivay.png" 
                alt="НАВАЛИВАЙ - все для вейпинга" 
                class="w-64 h-auto mx-auto relative z-10 drop-shadow-2xl"
                loading="eager"
              />
            </div>
          </div>
          
          <!-- Brutal Search Bar -->
          <div class="relative max-w-xl mx-auto group">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="ЧТО ИЩЕШЬ, БРАТАН?"
              class="relative w-full px-6 py-4 pr-12 text-base bg-white border-4 border-black focus:border-red-600 focus:outline-none transition-all placeholder-gray-400 text-black font-black uppercase tracking-wide shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(220,38,38,1)]"
              @input="handleSearch"
            />
            <MagnifyingGlassIcon class="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-red-600" />
          </div>
          
        </div>

        <!-- Brutal Categories -->
        <div class="px-4 sm:px-6 lg:px-8 pb-6">
          <div class="flex gap-3 overflow-x-auto scrollbar-hide">
            <button
              @click="selectCategory(null)"
              :class="[
                'relative px-6 py-2.5 text-sm font-black whitespace-nowrap transition-all border-3 uppercase tracking-wider',
                !catalogStore.activeCategory
                  ? 'bg-red-600 text-white border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-white text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(220,38,38,1)] hover:border-red-600'
              ]"
            >
              <span class="relative z-10">ВСЕ ТОВАРЫ</span>
            </button>
            <button
              v-for="category in catalogStore.categoriesWithProductCounts"
              :key="category.id"
              @click="selectCategory(category.slug)"
              :class="[
                'relative px-6 py-2.5 text-sm font-black whitespace-nowrap transition-all border-3 uppercase tracking-wider',
                catalogStore.activeCategory === category.slug
                  ? 'bg-red-600 text-white border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-white text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(220,38,38,1)] hover:border-red-600'
              ]"
            >
              <span class="relative z-10">
                {{ category.name }}
                <span v-if="category.productCount > 0" class="ml-2 text-xs opacity-80">
                  [{{ category.productCount }}]
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Delivery Info Section -->
    <DeliveryInfo />

    <!-- Main Content -->
    <main class="max-w-screen-xl mx-auto relative z-10">
      <!-- Error message -->
      <div
        v-if="catalogStore.error"
        class="mx-4 sm:mx-6 lg:mx-8 mt-6 p-4 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(220,38,38,1)]"
      >
        <div class="flex items-start gap-3">
          <ExclamationTriangleIcon class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div class="flex-1">
            <p class="text-sm text-black font-black uppercase">{{ catalogStore.error }}</p>
            <button
              class="mt-2 text-xs text-red-600 hover:text-red-700 underline uppercase font-black"
              @click="catalogStore.clearError"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>

      <!-- Products Section -->
      <div class="px-4 sm:px-6 lg:px-8 py-8">
        <!-- Results Header -->
        <div class="flex items-center justify-between mb-8" v-if="catalogStore.filteredProducts.length > 0">
          <div class="text-sm text-black uppercase tracking-wider font-bold">
            В наличии: <span class="font-black text-red-600 text-lg">{{ catalogStore.totalProducts }}</span> {{ getProductWord(catalogStore.totalProducts) }}
          </div>
          
          <!-- Sort dropdown -->
          <div class="relative">
            <button
              class="flex items-center gap-2 px-4 py-2 text-sm font-black text-black bg-white border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(220,38,38,1)] transition-all uppercase tracking-wider"
              @click="showSortMenu = !showSortMenu"
            >
              <span>{{ sortLabels[catalogStore.sortBy] }}</span>
              <ChevronDownIcon class="w-4 h-4 text-red-600" />
            </button>

            <Transition
              enter-active-class="transition-all duration-200 ease-out"
              enter-from-class="opacity-0 scale-95"
              enter-to-class="opacity-100 scale-100"
              leave-active-class="transition-all duration-150 ease-in"
              leave-from-class="opacity-100 scale-100"
              leave-to-class="opacity-0 scale-95"
            >
              <div
                v-if="showSortMenu"
                class="absolute right-0 top-full mt-2 w-48 bg-white border-3 border-black z-10 overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                <button
                  v-for="(label, key) in sortLabels"
                  :key="key"
                  class="block w-full px-4 py-3 text-left text-sm font-black uppercase tracking-wide hover:bg-red-600 transition-colors text-black hover:text-white"
                  :class="{ 'bg-red-600 text-white': catalogStore.sortBy === key }"
                  @click="selectSort(key as SortOption)"
                >
                  {{ label }}
                </button>
              </div>
            </Transition>
          </div>
        </div>

        <!-- Products Grid -->
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          <!-- Loading skeletons -->
          <div
            v-if="catalogStore.isLoading && !catalogStore.products.length"
            v-for="n in 8"
            :key="`skeleton-${n}`"
            class="animate-pulse"
          >
            <div class="aspect-square bg-gray-200 border-3 border-gray-300 mb-3" />
            <div class="h-4 bg-gray-200 mb-2" />
            <div class="h-5 bg-gray-200 w-3/4" />
          </div>

          <!-- Product Cards - Brutal Style -->
          <div
            v-for="product in catalogStore.filteredProducts"
            :key="product.id"
            @click="openProduct(product)"
            class="cursor-pointer group relative"
          >
            <!-- Product Image -->
            <div class="aspect-square bg-white border-4 border-black relative overflow-hidden mb-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group-hover:shadow-[6px_6px_0px_0px_rgba(220,38,38,1)] transition-all duration-300">
              
              <img
                v-if="product.images?.[0]"
                :src="product.images[0]"
                :alt="product.title"
                class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                loading="lazy"
              />
              <div v-else class="w-full h-full flex items-center justify-center bg-gray-100">
                <PhotoIcon class="w-12 h-12 text-gray-400" />
              </div>
              
              <!-- Stock Badge -->
              <div class="absolute top-2 left-2 px-3 py-1 bg-red-600 text-white border-2 border-black text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                В наличии
              </div>
              
            </div>
            
            <!-- Product Info - Brutal -->
            <div>
              <h3 class="text-sm font-black text-black line-clamp-1 mb-2 uppercase tracking-wider group-hover:text-red-600 transition-colors">
                {{ product.title || 'БЕЗ НАЗВАНИЯ' }}
              </h3>
              
              <p class="text-2xl font-black text-red-600">
                {{ formatPrice(product.priceRub) }}<span class="text-lg ml-1">₽</span>
              </p>
              
              <p v-if="product.description" class="text-xs text-gray-600 line-clamp-2 mt-2 uppercase">
                {{ product.description }}
              </p>
            </div>
          </div>
        </div>

        <!-- Load More -->
        <div v-if="catalogStore.hasMore && catalogStore.products.length" class="mt-12 text-center">
          <button
            class="relative px-10 py-4 bg-red-600 text-white font-black uppercase tracking-wider hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
            :disabled="catalogStore.isLoading"
            @click="catalogStore.loadMoreProducts()"
          >
            <span v-if="catalogStore.isLoading" class="relative z-10 flex items-center justify-center gap-3">
              <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              ЗАГРУЖАЕМ...
            </span>
            <span v-else class="relative z-10">ПОКАЗАТЬ ЕЩЁ</span>
          </button>
        </div>

        <!-- Empty State -->
        <div v-if="!catalogStore.isLoading && !catalogStore.products.length" class="text-center py-20">
          <div class="inline-flex items-center justify-center w-24 h-24 border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(220,38,38,1)] mb-6 relative">
            <ExclamationTriangleIcon class="w-12 h-12 text-red-600 relative z-10" />
          </div>
          <h3 class="text-2xl font-black text-black mb-3 uppercase tracking-wider">ПУСТО, БРАТАН</h3>
          <p class="text-gray-700 max-w-md mx-auto mb-6 text-sm uppercase tracking-wide font-bold">
            {{ searchQuery 
              ? 'Попробуй другой запрос' 
              : catalogStore.activeCategory
                ? 'В этой категории пока пусто'
                : 'Товары скоро будут' }}
          </p>
          <button
            v-if="searchQuery || catalogStore.activeCategory"
            @click="resetFilters"
            class="px-8 py-3 text-sm font-black text-black bg-white border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(220,38,38,1)] hover:bg-red-600 hover:text-white transition-all uppercase tracking-wider"
          >
            СБРОСИТЬ ФИЛЬТРЫ
          </button>
        </div>
      </div>
    </main>

  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  XMarkIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PhotoIcon
} from '@heroicons/vue/24/outline'

import { useCatalogStore, type SortOption, type Product } from '@/stores/catalog'
import SmokeParticles from '@/components/SmokeParticles.vue'
import DeliveryInfo from '@/components/DeliveryInfo.vue'
import { useSparkles } from '@/composables/useSparkles'

const catalogStore = useCatalogStore()
const router = useRouter()

// Initialize sparkles effect
useSparkles()

const searchQuery = ref('')
const showSortMenu = ref(false)
const searchDebounceTimer = ref<NodeJS.Timeout | null>(null)

const sortLabels: Record<SortOption, string> = {
  price_asc: 'ДЕШЕВЛЕ',
  price_desc: 'ДОРОЖЕ'
}

// Helpers
function formatPrice(price: number): string {
  return price.toLocaleString('ru-RU')
}

function getProductWord(count: number): string {
  const lastDigit = count % 10
  const lastTwoDigits = count % 100
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'товаров'
  }
  
  if (lastDigit === 1) return 'товар'
  if (lastDigit >= 2 && lastDigit <= 4) return 'товара'
  return 'товаров'
}

// Search handling
function handleSearch() {
  if (searchDebounceTimer.value) {
    clearTimeout(searchDebounceTimer.value)
  }
  
  searchDebounceTimer.value = setTimeout(() => {
    catalogStore.setSearchQuery(searchQuery.value)
    catalogStore.fetchProducts(false)
  }, 300)
}

function clearSearch() {
  searchQuery.value = ''
  catalogStore.setSearchQuery('')
  catalogStore.fetchProducts(false)
}

// Category handling
function selectCategory(slug: string | null) {
  catalogStore.setActiveCategory(slug)
  catalogStore.fetchProducts(false)
}

function selectSort(sortOption: SortOption) {
  catalogStore.setSortBy(sortOption)
  showSortMenu.value = false
}

function openProduct(product: Product) {
  catalogStore.currentProduct = product
  router.push({ name: 'product', params: { id: product.id } })
  catalogStore.fetchProduct(product.id)
}

function resetFilters() {
  searchQuery.value = ''
  catalogStore.setSearchQuery('')
  catalogStore.setActiveCategory(null)
  catalogStore.fetchProducts(false)
}


// Close dropdowns when clicking outside
function handleClickOutside(event: Event) {
  const target = event.target as Element
  if (!target.closest('.relative')) {
    showSortMenu.value = false
  }
}

onMounted(async () => {
  // Initialize catalog data
  await catalogStore.initialize()
  
  // Add click outside listener
  document.addEventListener('click', handleClickOutside)
  
  // Initialize Telegram WebApp
  if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready()
    window.Telegram.WebApp.expand()
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
/* Основной фон в стиле НАВАЛИВАЙ */
.navalivay-bg {
  background: #f5f5f5;
}

/* Текстура бумаги */
.paper-texture {
  background-image: 
    /* Мелкая сетка */
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent 2px,
      rgba(0, 0, 0, 0.02) 2px,
      rgba(0, 0, 0, 0.02) 4px
    ),
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0, 0, 0, 0.02) 2px,
      rgba(0, 0, 0, 0.02) 4px
    ),
    /* Шум для текстуры бумаги */
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.9' numOctaves='4' seed='5'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.02'/%3E%3C/svg%3E");
  background-color: #f9fafb;
}

/* Верхний рваный край */
.torn-edge-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 150px;
  background: #000;
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 150' preserveAspectRatio='none'%3E%3Cpath d='M0,0 L0,100 Q48,120 96,100 T192,110 Q240,125 288,105 T384,115 Q432,130 480,110 T576,120 Q624,135 672,115 T768,125 Q816,140 864,120 T960,130 Q1008,145 1056,125 T1152,135 Q1200,150 1248,130 T1344,140 Q1392,150 1440,135 T1536,145 Q1584,150 1632,140 T1728,145 Q1776,150 1824,140 T1920,145 L1920,0 Z' fill='white'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 150' preserveAspectRatio='none'%3E%3Cpath d='M0,0 L0,100 Q48,120 96,100 T192,110 Q240,125 288,105 T384,115 Q432,130 480,110 T576,120 Q624,135 672,115 T768,125 Q816,140 864,120 T960,130 Q1008,145 1056,125 T1152,135 Q1200,150 1248,130 T1344,140 Q1392,150 1440,135 T1536,145 Q1584,150 1632,140 T1728,145 Q1776,150 1824,140 T1920,145 L1920,0 Z' fill='white'/%3E%3C/svg%3E");
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.1));
}

/* Нижний рваный край */
.torn-edge-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 150px;
  background: #000;
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 150' preserveAspectRatio='none'%3E%3Cpath d='M0,150 L0,50 Q48,30 96,50 T192,40 Q240,25 288,45 T384,35 Q432,20 480,40 T576,30 Q624,15 672,35 T768,25 Q816,10 864,30 T960,20 Q1008,5 1056,25 T1152,15 Q1200,0 1248,20 T1344,10 Q1392,0 1440,15 T1536,5 Q1584,0 1632,10 T1728,5 Q1776,0 1824,10 T1920,5 L1920,150 Z' fill='white'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 150' preserveAspectRatio='none'%3E%3Cpath d='M0,150 L0,50 Q48,30 96,50 T192,40 Q240,25 288,45 T384,35 Q432,20 480,40 T576,30 Q624,15 672,35 T768,25 Q816,10 864,30 T960,20 Q1008,5 1056,25 T1152,15 Q1200,0 1248,20 T1344,10 Q1392,0 1440,15 T1536,5 Q1584,0 1632,10 T1728,5 Q1776,0 1824,10 T1920,5 L1920,150 Z' fill='white'/%3E%3C/svg%3E");
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  filter: drop-shadow(0 -8px 16px rgba(0, 0, 0, 0.1));
}

/* Паттерн черепов */
.skull-pattern {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  opacity: 0.03;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cg opacity='0.5'%3E%3Cpath d='M100 40 C80 40 65 55 65 75 C65 90 75 100 85 105 L85 115 L115 115 L115 105 C125 100 135 90 135 75 C135 55 120 40 100 40 Z' fill='%23000'/%3E%3Ccircle cx='85' cy='70' r='8' fill='%23fff'/%3E%3Ccircle cx='115' cy='70' r='8' fill='%23fff'/%3E%3Cpath d='M85 95 L100 90 L115 95' stroke='%23fff' stroke-width='3' fill='none'/%3E%3C/g%3E%3C/svg%3E");
  background-size: 200px 200px;
  pointer-events: none;
  mix-blend-mode: multiply;
}

/* Дополнительные эффекты для черных областей */
.torn-edge-top::before,
.torn-edge-bottom::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 100%;
  background-image: 
    /* Легкая текстура черепов в черных областях */
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cg opacity='0.1'%3E%3Cpath d='M50 20 C40 20 32 28 32 38 C32 45 36 50 41 52 L42 57 L58 57 L59 52 C64 50 68 45 68 38 C68 28 60 20 50 20 Z' fill='%23fff'/%3E%3C/g%3E%3C/svg%3E");
  background-size: 100px 100px;
  opacity: 0.5;
}

/* Анимация для легкого движения */
@keyframes subtle-float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

/* Адаптивность */
@media (max-width: 768px) {
  .torn-edge-top,
  .torn-edge-bottom {
    height: 80px;
  }
  
  .skull-pattern {
    background-size: 150px 150px;
  }
}
</style>
