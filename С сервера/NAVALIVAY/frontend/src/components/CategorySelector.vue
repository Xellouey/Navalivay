<template>
  <div class="category-selector">
    <!-- Main trigger button -->
    <button
      class="category-trigger"
      :class="{ 'active': catalogStore.activeCategory }"
      @click="showModal = true"
    >
      <span class="category-trigger-text">
        {{ catalogStore.activeCategoryName }}
      </span>
      <span v-if="catalogStore.totalProducts > 0" class="category-count">
        ({{ catalogStore.totalProducts }})
      </span>
      <ChevronDownIcon class="category-trigger-icon" />
    </button>

    <!-- Modal overlay -->
    <Transition
      enter-active-class="modal-enter-active"
      enter-from-class="modal-enter-from"
      enter-to-class="modal-enter-to"
      leave-active-class="modal-leave-active"
      leave-from-class="modal-leave-from" 
      leave-to-class="modal-leave-to"
    >
      <div
        v-if="showModal"
        class="modal-overlay"
        @click="closeModal"
      >
<div 
          class="modal-content"
          @click.stop
          role="dialog"
          aria-modal="true"
          aria-label="Выбор категории"
        >
          <!-- Drag handle / header -->
          <div class="modal-grip" aria-hidden="true"></div>

          <div class="modal-header">
            <h3 class="modal-title">Выберите категорию</h3>
            <button 
              class="modal-close"
              @click="closeModal"
              aria-label="Закрыть"
            >
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>

          <!-- Search bar -->
          <div class="search-container">
            <MagnifyingGlassIcon class="search-icon" />
            <input
              ref="searchInput"
              v-model="searchQuery"
              type="text"
              placeholder="Поиск категорий"
              class="search-input"
              @keydown.escape="closeModal"
              inputmode="search"
            />
            <button
              v-if="searchQuery"
              class="search-clear"
              @click="clearSearch"
              aria-label="Очистить поиск"
            >
              <XMarkIcon class="w-5 h-5" />
            </button>
          </div>

          <!-- Categories list -->
          <div class="categories-list">
            <!-- All categories option -->
            <button
              class="category-button"
              :class="{ 'active': !catalogStore.activeCategory }"
              @click="selectCategory(null)"
            >
              <span class="category-name">📦 Все товары</span>
              <div class="category-meta">
                <span class="category-count">({{ allProductsCount }})</span>
                <CheckIcon 
                  v-if="!catalogStore.activeCategory"
                  class="category-checkmark"
                />
              </div>
            </button>

            <!-- Separator -->
            <div v-if="filteredCategories.length > 0" class="category-separator"></div>

            <!-- Filtered categories -->
            <button
              v-for="category in filteredCategories"
              :key="category.id"
              class="category-button"
              :class="{ 'active': catalogStore.activeCategory === category.slug }"
              @click="selectCategory(category.slug)"
            >
              <span class="category-name">{{ category.name }}</span>
              <div class="category-meta">
                <span class="category-count">({{ getCategoryProductCount(category.id) }})</span>
                <CheckIcon 
                  v-if="catalogStore.activeCategory === category.slug"
                  class="category-checkmark"
                />
              </div>
            </button>

            <!-- Empty state -->
            <div v-if="filteredCategories.length === 0 && searchQuery" class="empty-state">
              <div class="empty-state-icon">
                <MagnifyingGlassIcon class="w-8 h-8 text-gray-400" />
              </div>
              <p class="empty-state-text">
                Категории не найдены
              </p>
              <p class="empty-state-subtext">
                Попробуйте изменить поисковый запрос
              </p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { 
  ChevronDownIcon, 
  XMarkIcon, 
  MagnifyingGlassIcon,
  CheckIcon 
} from '@heroicons/vue/24/outline'
import { useCatalogStore } from '@/stores/catalog'

const catalogStore = useCatalogStore()

// State
const showModal = ref(false)
const searchQuery = ref('')
const searchInput = ref<HTMLInputElement>()

// Computed
const filteredCategories = computed(() => {
  if (!searchQuery.value) {
    return catalogStore.categories
  }
  
  const query = searchQuery.value.toLowerCase().trim()
  return catalogStore.categories.filter(category =>
    category.name.toLowerCase().includes(query)
  )
})

// Computed for all products count
const allProductsCount = computed(() => {
  if (catalogStore.allProducts && catalogStore.allProducts.length > 0) {
    return catalogStore.allProducts.length
  }
  return catalogStore.products.length
})

// Computed for category counts
const categoryProductCounts = computed(() => {
  const productsToCount = (catalogStore.allProducts && catalogStore.allProducts.length > 0) 
    ? catalogStore.allProducts 
    : catalogStore.products
  
  const counts: Record<string, number> = {}
  for (const category of catalogStore.categories) {
    counts[category.id] = productsToCount.filter(p => p.categoryId === category.id).length
  }
  
  return counts
})

// Methods  
function getCategoryProductCount(categoryId: string): number {
  return categoryProductCounts.value[categoryId] || 0
}

async function selectCategory(categorySlug: string | null) {
  await catalogStore.setActiveCategory(categorySlug)
  closeModal()
}

function closeModal() {
  showModal.value = false
  searchQuery.value = ''
}

function clearSearch() {
  searchQuery.value = ''
  searchInput.value?.focus()
}

// Modal state watcher (autofocus removed)
watch(showModal, async (isOpen) => {
  // Autofocus removed per user request
})
</script>

<style scoped>
/* Глобальное ограничение для всех элементов */
.category-selector * {
  box-sizing: border-box;
  max-width: 100%;
}
/* Main trigger button */
.category-trigger {
  @apply flex items-center justify-between w-full px-4 py-3 bg-brand-white rounded-none border-4 border-brand-dark transition-all duration-200 text-left;
  font-family: var(--font-primary);
  font-weight: 700;
  box-shadow: 8px 8px 0 rgba(26, 26, 26, 0.3);
}

.category-trigger:hover {
  transform: translate(-2px, -2px);
  box-shadow: 12px 12px 0 rgba(211, 47, 47, 0.4);
}

.category-trigger.active {
  @apply bg-brand-red text-white;
  border: 4px solid var(--navalivay-black);
}

.category-trigger-text {
  @apply text-brand-dark flex-1;
  font-family: var(--font-display);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.category-count {
  @apply text-sm text-gray-500 mx-2;
}

.category-trigger-icon {
  @apply w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200;
}

.category-trigger:hover .category-trigger-icon {
  @apply text-brand-red;
}

/* Modal */
.modal-overlay {
  @apply fixed inset-0 z-50 flex items-end justify-center bg-white/40 backdrop-blur-sm p-0 sm:p-4;
  /* Mobile-first: modal slides up from bottom */
}

@media (min-width: 640px) {
  .modal-overlay {
    @apply items-center;
  }
}

.modal-content {
  @apply w-full max-w-md bg-white rounded-t-[20px] sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden;
}

/* Grip */
.modal-grip {
  @apply w-10 h-1 bg-gray-400 rounded-full mx-auto mt-3 mb-2 sm:hidden;
}

/* Modal animations */
.modal-enter-active,
.modal-leave-active {
  @apply transition-all duration-150 ease-out;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  @apply transition-transform duration-150 ease-out;
}

.modal-enter-from {
  @apply opacity-0;
}

.modal-enter-from .modal-content {
  @apply transform translate-y-full sm:translate-y-4 sm:scale-95;
}

.modal-enter-to {
  @apply opacity-100;
}

.modal-enter-to .modal-content {
  @apply transform translate-y-0 scale-100;
}

.modal-leave-from {
  @apply opacity-100;
}

.modal-leave-from .modal-content {
  @apply transform translate-y-0 scale-100;
}

.modal-leave-to {
  @apply opacity-0;
}

.modal-leave-to .modal-content {
  @apply transform translate-y-full sm:translate-y-4 sm:scale-95;
}

/* Modal header */
.modal-header {
  @apply flex items-center justify-between px-4 py-3 border-b border-gray-100;
}

.modal-title {
  @apply text-base sm:text-lg text-brand-burgundy;
  font-family: var(--font-display);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.modal-close {
  @apply p-2 hover:bg-gray-100 rounded-full transition-colors duration-200;
}

/* Search */
.search-container {
  @apply relative px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10;
}

.search-input {
  @apply w-full pl-10 pr-10 py-3 border-4 border-brand-dark rounded-none focus:outline-none focus:border-brand-red transition-all duration-200 text-base;
  box-sizing: border-box;
  max-width: 100%;
  font-family: var(--font-primary);
  font-weight: 700;
  background: var(--navalivay-white);
  box-shadow: 8px 8px 0 rgba(26, 26, 26, 0.3);
}

.search-input:focus {
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transform: translateY(-1px);
}

.search-icon {
  @apply absolute w-5 h-5 text-gray-400 pointer-events-none;
  left: 1.75rem; /* 28px */
  top: 50%;
  transform: translateY(-50%);
}

.search-clear {
  @apply absolute p-1 hover:bg-gray-100 rounded-full transition-colors duration-200;
  right: 1.75rem; /* 28px */
  top: 50%;
  transform: translateY(-50%);
}

/* Categories iOS ActionSheet */
.categories-list {
  @apply flex-1 overflow-y-auto px-2;
}

.category-button {
  @apply w-full px-4 py-5 flex items-center justify-between bg-white hover:bg-gray-50 active:bg-gray-100 transition-all duration-200 text-left;
  border: none;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  border-radius: 8px;
  margin: 2px 0;
}

.category-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.category-button.active {
  @apply bg-brand-red text-white;
  box-shadow: 4px 4px 0 rgba(26, 26, 26, 0.3);
}

.category-name {
  @apply text-base truncate flex-1 mr-3;
  font-family: var(--font-primary);
  font-weight: 700;
  color: var(--navalivay-black);
}

.category-button.active .category-name {
  color: white;
  font-weight: 900;
}

.category-meta {
  @apply flex items-center space-x-2 flex-shrink-0;
}

.category-count {
  @apply text-sm font-medium;
  font-family: var(--font-primary);
  color: #666;
  font-variant-numeric: tabular-nums;
}

.category-button.active .category-count {
  color: white;
  font-weight: 900;
}

.category-checkmark {
  @apply w-6 h-6 text-white flex-shrink-0;
}

.category-separator {
  @apply h-px bg-gray-200 mx-4 my-1;
}

/* Empty state */
.empty-state { @apply flex flex-col items-center justify-center py-12 px-4 text-center; }
.empty-state-icon { @apply mb-4; }
.empty-state-text { 
  @apply text-brand-burgundy mb-2; 
  font-family: var(--font-display);
  font-weight: 900;
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.empty-state-subtext { 
  @apply text-gray-500 text-sm;
  font-family: var(--font-primary);
}

/* Touch improvements for iOS ActionSheet */
@media (max-width: 640px) {
  .category-button {
    @apply py-6; /* Extra large touch targets */
  }
  
  .category-name {
    @apply text-base; /* More reasonable size on mobile */
  }
  
  .category-count {
    @apply text-sm;
  }
  
  .modal-content {
    @apply max-h-[92vh];
  }

  .search-container {
    @apply py-4; /* More space for search */
  }
}
</style>
