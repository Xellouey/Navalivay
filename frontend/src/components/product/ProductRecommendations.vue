<template>
  <div class="product-recommendations bg-gray-50 py-6">
    <!-- Section Header -->
    <div class="px-4 mb-4 flex justify-between items-center">
      <h2 class="text-lg font-semibold text-brand-dark">Вам также может понравиться</h2>
      <router-link
        v-if="categorySlug"
        :to="`/category/${categorySlug}`"
        class="text-sm text-brand-primary hover:text-brand-dark transition-colors flex items-center gap-1"
      >
        <span>Все товары</span>
        <ChevronRightIcon class="w-4 h-4" />
      </router-link>
    </div>

    <!-- Products Carousel -->
    <div class="relative">
      <div 
        ref="scrollContainer"
        class="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-2 snap-x snap-mandatory"
        @scroll="onScroll"
      >
        <!-- Product Cards -->
        <div
          v-for="product in recommendations"
          :key="product.id"
          class="flex-shrink-0 w-40 snap-start"
        >
          <router-link
            :to="`/p/${product.id}`"
            class="block group"
          >
            <!-- Product Image -->
            <div class="relative aspect-[3/4] bg-white rounded-xl overflow-hidden mb-2 shadow-sm group-hover:shadow-lg transition-all duration-300">
              <!-- Skeleton Loading -->
              <div
                v-if="!product.imageLoaded"
                class="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse"
              />
              
              <!-- Product Image -->
              <img
                :src="getProductCover(product)"
                :alt="product.title"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                @load="onImageLoad(product.id)"
                @error="onImageError"
                loading="lazy"
              />
              
              <!-- Quick View Button -->
              <Transition
                enter-active-class="transition-all duration-300"
                enter-from-class="opacity-0 translate-y-2"
                enter-to-class="opacity-100 translate-y-0"
                leave-active-class="transition-all duration-200"
                leave-from-class="opacity-100 translate-y-0"
                leave-to-class="opacity-0 translate-y-2"
              >
                <button
                  v-if="hoveredProduct === product.id"
                  @click.prevent="quickView(product)"
                  class="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-sm text-brand-dark py-2 px-3 rounded-lg text-xs font-semibold shadow-lg hover:bg-white transition-colors"
                >
                  Быстрый просмотр
                </button>
              </Transition>
              
              <!-- Badges -->
              <div 
                v-if="product.isNew || product.isSale"
                class="absolute top-2 left-2 flex flex-col gap-1"
              >
                <span
                  v-if="product.isNew"
                  class="inline-block px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-full"
                >
                  NEW
                </span>
                <span
                  v-if="product.isSale"
                  class="inline-block px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full"
                >
                  -{{ product.discount }}%
                </span>
              </div>
            </div>
            
            <!-- Product Info -->
            <div class="px-1">
              <h3 class="text-sm font-medium text-brand-dark line-clamp-2 mb-1 group-hover:text-brand-primary transition-colors">
                {{ product.title }}
              </h3>
              <div class="flex items-center gap-2">
                <span class="text-base font-bold text-brand-dark tabular-nums">
                  {{ formatPrice(product.priceRub) }}
                </span>
                <span
                  v-if="product.oldPriceRub"
                  class="text-sm text-gray-400 line-through tabular-nums"
                >
                  {{ formatPrice(product.oldPriceRub) }}
                </span>
              </div>
            </div>
          </router-link>
        </div>
        
        <!-- Load More Skeleton -->
        <div 
          v-if="loading"
          class="flex-shrink-0 w-40 snap-start"
        >
          <div class="aspect-[3/4] bg-gray-200 rounded-xl animate-pulse mb-2" />
          <div class="h-4 bg-gray-200 rounded animate-pulse mb-1" />
          <div class="h-6 bg-gray-200 rounded animate-pulse w-2/3" />
        </div>
      </div>

      <!-- Scroll Indicators -->
      <Transition
        enter-active-class="transition-opacity duration-300"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-200"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <button
          v-if="canScrollLeft"
          @click="scrollLeft"
          class="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center hover:bg-white transition-all"
        >
          <ChevronLeftIcon class="w-5 h-5 text-brand-dark" />
        </button>
      </Transition>
      
      <Transition
        enter-active-class="transition-opacity duration-300"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-200"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <button
          v-if="canScrollRight"
          @click="scrollRight"
          class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center hover:bg-white transition-all"
        >
          <ChevronRightIcon class="w-5 h-5 text-brand-dark" />
        </button>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/vue/24/outline'

interface ProductLink { label?: string; url: string }

interface ProductVariant {
  id?: string
  name: string
  colorCode?: string | null
  priceRub?: number | null
  stock?: number
  images: string[]
}

interface Product {
  id: string
  title: string
  priceRub: number
  oldPriceRub?: number
  links?: ProductLink[]
  images: string[]
  categoryId: string
  isNew?: boolean
  isSale?: boolean
  discount?: number
  imageLoaded?: boolean
  hasVariants?: boolean
  variants?: ProductVariant[]
}

interface Props {
  currentProductId: string
  categoryId: string
  categorySlug?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  quickView: [product: Product]
}>()

function getProductCover(product: Product) {
  // Для товаров с вариантами берём изображение первого варианта
  if (product.hasVariants && product.variants?.length && product.variants[0].images?.length) {
    return product.variants[0].images[0]
  }
  
  const fromImages = product.images?.find(src => typeof src === 'string' && src.trim().length > 0)
  if (fromImages) {
    return fromImages
  }

  const fromLinks = product.links?.find(link => typeof link?.url === 'string' && link.url.trim().length > 0)?.url
  return fromLinks || 'https://placehold.co/180x240/f3f4f6/9ca3af?text=IMG'
}

// State
const recommendations = ref<Product[]>([])
const loading = ref(false)
const hoveredProduct = ref<string | null>(null)
const scrollContainer = ref<HTMLElement>()
const canScrollLeft = ref(false)
const canScrollRight = ref(true)

// Mock data - in real app this would come from API
const mockRecommendations: Product[] = [
  {
    id: 'p_rec1',
    title: 'Толстовка оверсайз с принтом',
    priceRub: 4990,
    oldPriceRub: 5990,
    images: ['/api/placeholder/400/500'],
    categoryId: props.categoryId,
    isNew: true,
    isSale: true,
    discount: 17
  },
  {
    id: 'p_rec2',
    title: 'Худи с капюшоном',
    priceRub: 3990,
    images: ['/api/placeholder/400/500'],
    categoryId: props.categoryId,
    isNew: true
  },
  {
    id: 'p_rec3',
    title: 'Свитшот базовый',
    priceRub: 2990,
    images: ['/api/placeholder/400/500'],
    categoryId: props.categoryId
  },
  {
    id: 'p_rec4',
    title: 'Толстовка с вышивкой',
    priceRub: 5490,
    images: ['/api/placeholder/400/500'],
    categoryId: props.categoryId,
    isNew: true
  },
  {
    id: 'p_rec5',
    title: 'Худи оверсайз',
    priceRub: 4490,
    oldPriceRub: 4990,
    images: ['/api/placeholder/400/500'],
    categoryId: props.categoryId,
    isSale: true,
    discount: 10
  },
  {
    id: 'p_rec6',
    title: 'Свитшот с принтом',
    priceRub: 3490,
    images: ['/api/placeholder/400/500'],
    categoryId: props.categoryId
  }
]

// Load recommendations
async function loadRecommendations() {
  loading.value = true
  
  // Simulate API call
  setTimeout(() => {
    recommendations.value = mockRecommendations
      .filter(p => p.id !== props.currentProductId)
      .map(p => ({ ...p, imageLoaded: false }))
    loading.value = false
  }, 500)
}

// Image handling
function onImageLoad(productId: string) {
  const product = recommendations.value.find(p => p.id === productId)
  if (product) {
    product.imageLoaded = true
  }
}

function onImageError(event: Event) {
  const target = event.target as HTMLImageElement
  target.src = '/placeholder-product.jpg'
}

// Scroll handling
function onScroll() {
  if (!scrollContainer.value) return
  
  const { scrollLeft, scrollWidth, clientWidth } = scrollContainer.value
  canScrollLeft.value = scrollLeft > 10
  canScrollRight.value = scrollLeft < scrollWidth - clientWidth - 10
}

function scrollLeft() {
  if (!scrollContainer.value) return
  scrollContainer.value.scrollBy({ left: -200, behavior: 'smooth' })
}

function scrollRight() {
  if (!scrollContainer.value) return
  scrollContainer.value.scrollBy({ left: 200, behavior: 'smooth' })
}

// Quick view
function quickView(product: Product) {
  emit('quickView', product)
  
  // Haptic feedback
  if (window.Telegram?.WebApp?.HapticFeedback) {
    window.Telegram.WebApp.HapticFeedback.impactOccurred('light')
  }
}

// Product hover handling for desktop
let hoverTimeout: number | null = null

function handleProductHover(productId: string) {
  if (hoverTimeout) clearTimeout(hoverTimeout)
  hoverTimeout = window.setTimeout(() => {
    hoveredProduct.value = productId
  }, 300)
}

function handleProductLeave() {
  if (hoverTimeout) clearTimeout(hoverTimeout)
  hoveredProduct.value = null
}

// Format price
function formatPrice(price: number): string {
  return `${price.toLocaleString('ru-RU')} ₽`
}

// Lifecycle
onMounted(() => {
  loadRecommendations()
  
  // Add hover listeners
  if (scrollContainer.value) {
    scrollContainer.value.addEventListener('mouseenter', (e) => {
      const target = e.target as HTMLElement
      const productCard = target.closest('[data-product-id]')
      if (productCard) {
        handleProductHover(productCard.getAttribute('data-product-id')!)
      }
    }, true)
    
    scrollContainer.value.addEventListener('mouseleave', handleProductLeave, true)
  }
})

onBeforeUnmount(() => {
  if (hoverTimeout) clearTimeout(hoverTimeout)
})
</script>

<style scoped>
.scrollbar-hide {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>