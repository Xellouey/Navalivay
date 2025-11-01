<template>
  <div class="space-y-6">
    <AdminSectionHero
      title="Категории"
      description="Управление категориями"
      :icon="TagIcon"
      tone="violet"
    >
      <template #meta>
        <span class="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/85">
          Всего: {{ localCategories.length }}
        </span>
        <span
          v-if="searchQuery"
          class="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/80"
        >
          Отфильтровано: {{ displayedCategories.length }}
        </span>
      </template>
      <template #actions>
        <button
          @click="$emit('create')"
          class="flex items-center justify-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-offset-2 focus:ring-offset-transparent"
        >
          <span>Добавить категорию</span>
        </button>
      </template>
    </AdminSectionHero>

    <div class="relative overflow-hidden rounded-3xl border border-white/60 bg-white/85 p-4 md:p-6 shadow-xl backdrop-blur">
      <div class="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-violet-200/35 blur-3xl"></div>
      <div class="pointer-events-none absolute bottom-0 left-6 h-28 w-28 rounded-full bg-brand-dark/10 blur-2xl"></div>
      <div class="relative z-10 space-y-6">
      <div v-if="isLoading" class="py-12 text-center">
        <div class="animate-spin w-8 h-8 border-4 border-brand-dark border-t-transparent rounded-full mx-auto"></div>
        <p class="mt-2 text-gray-600">Загрузка категорий...</p>
      </div>

      <div v-else-if="hasAnyCategories" class="space-y-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div class="relative w-full lg:max-w-md">
            <span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-violet-400">
              <MagnifyingGlassIcon class="h-5 w-5" />
            </span>
            <input
              v-model="searchQuery"
              type="search"
              placeholder="Поиск по названию или slug"
              class="w-full rounded-2xl border border-white/60 bg-white/85 px-4 py-3 pl-12 text-sm font-medium text-gray-900 shadow-inner transition focus:border-violet-200 focus:outline-none focus:ring-2 focus:ring-violet-200/70"
            />
          </div>
          <div class="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-gray-500">
            <span>Всего: {{ localCategories.length }}</span>
            <span v-if="searchQuery" class="text-violet-500">Отфильтровано: {{ displayedCategories.length }}</span>
          </div>
        </div>

        <div v-if="displayedCategories.length" class="grid gap-4 lg:gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="category in displayedCategories"
            :key="category.id"
            class="relative overflow-hidden rounded-2xl border border-white/70 bg-white/90 shadow-lg backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
          >
            <div
              v-if="category.cover_image"
              class="absolute inset-0 bg-cover bg-center opacity-85"
              :style="{ backgroundImage: `url(${category.cover_image})` }"
            ></div>
            <div class="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/80 via-white/70 to-white/85"></div>

            <div class="relative z-10 p-5 space-y-4">
              <!-- ========== ЗАГОЛОВОЧНАЯ ОБЛАСТЬ ========== -->
              <div class="flex items-center justify-between gap-4">
              <div class="flex-1 min-w-0">
                <h3 class="text-lg font-semibold text-gray-900 leading-tight mb-1">{{ category.name }}</h3>
                <p class="text-sm text-gray-500 font-mono">{{ category.slug }}</p>
              </div>
              <button
                @click="copyCategoryLink(category.slug)"
                class="inline-flex items-center gap-1 rounded-lg border border-white/70 bg-white/80 px-3 py-1 text-xs font-semibold text-blue-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-50"
                :title="`Копировать ссылку на категорию`"
              >
                <DocumentDuplicateIcon class="w-3 h-3" />
                Ссылка
              </button>
            </div>

              <!-- ========== БЛОК МЕТРИК ========== -->
              <div class="flex items-center justify-between rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm backdrop-blur">
              <div class="space-y-1">
                <div class="flex items-center gap-1">
                  <span class="text-base font-medium text-gray-900">Товаров:</span>
                  <span class="text-base font-semibold text-emerald-600">{{ category.productCount || 0 }}</span>
                </div>
                <div class="flex items-center gap-1 text-sm text-gray-600">
                  <span>Подгрупп:</span>
                  <span class="font-semibold text-gray-900">{{ props.groupCounts?.[category.id] ?? 0 }}</span>
                </div>
                <div class="flex items-center gap-1 text-sm text-gray-600">
                  <span>Вдруг пригодится:</span>
                  <span class="font-semibold text-gray-900">{{ props.crossSellCounts?.[category.id] ?? 0 }}</span>
                </div>
              </div>
              <div class="text-sm text-gray-600 text-right">
                <span class="block">Порядок</span>
                <span class="font-medium text-gray-900">{{ getDisplayOrder(category.id) }}</span>
              </div>
            </div>

            <!-- ========== ДОПОЛНИТЕЛЬНЫЕ МЕТКИ ========== -->
            <div v-if="category.hide_empty === 1 || category.hide_empty === true" class="mb-5">
              <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                🚫 Скрывается при отсутствии товаров
              </span>
            </div>

            <!-- ========== УПРАВЛЕНИЕ ПОРЯДКОМ ========== -->
              <div class="flex items-center justify-center gap-3 mb-5">
              <span class="text-sm text-gray-600 font-medium">Порядок</span>
              <button
                class="flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-white/85 text-gray-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-violet-500/90 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="!canMoveUp(category.id)"
                title="Переместить вверх"
                @click="moveUp(category.id)"
              >
                <ChevronUpIcon class="w-4 h-4" />
              </button>
              <button
                class="flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-white/85 text-gray-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-violet-500/90 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="!canMoveDown(category.id)"
                title="Переместить вниз"
                @click="moveDown(category.id)"
              >
                <ChevronDownIcon class="w-4 h-4" />
              </button>
            </div>

            <!-- ========== БЛОК ДЕЙСТВИЙ ========== -->
            <div class="grid grid-cols-2 gap-2 text-[0.875rem] leading-tight">
              <button
                class="flex items-center justify-center gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50/80 px-4 py-2 font-semibold text-emerald-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-100 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-300/60 active:translate-y-0 active:scale-[0.99]"
                @click="$emit('manage-groups', category)"
              >
                Линейки
              </button>
              <button
                class="flex items-center justify-center gap-2 rounded-xl border border-purple-200/70 bg-purple-50/80 px-4 py-2 font-semibold text-purple-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-purple-100 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-purple-300/60 active:translate-y-0 active:scale-[0.99]"
                @click="$emit('manage-cross-sell', category)"
              >
                Вдруг пригодится
              </button>
              <button 
                @click="$emit('edit', category)" 
                class="flex items-center justify-center gap-2 rounded-xl border border-blue-200/70 bg-blue-50/80 px-4 py-2 font-semibold text-blue-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-100 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-300/60 active:translate-y-0 active:scale-[0.99]"
              >
                Редактировать
              </button>
              <button
                @click="$emit('delete', category.id)"
                :disabled="(category.productCount || 0) > 0"
                class="admin-link-button admin-link-button--danger w-full disabled:cursor-not-allowed disabled:opacity-40"
                :class="(category.productCount || 0) > 0 ? 'border border-gray-200 bg-gray-50 text-gray-400' : ''"
                :title="(category.productCount || 0) > 0 ? `Нельзя удалить категорию с товарами (${category.productCount})` : 'Удалить категорию'"
              >
                Удалить
              </button>
            </div>
            </div>
          </div>
        </div>

        <div
          v-if="displayedCategories.length"
          class="relative overflow-hidden rounded-2xl border border-dashed border-violet-200/70 bg-violet-50/50 px-4 py-3 text-center text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-violet-500 shadow-sm backdrop-blur"
        >
          <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.18),transparent_55%)]"></div>
          <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(79,70,229,0.12),transparent_60%)]"></div>
          <p class="relative hidden sm:block">Используйте стрелки для изменения порядка</p>
          <p class="relative sm:hidden">Стрелки помогут изменить порядок</p>
        </div>

        <div v-else class="text-center py-6 px-4 rounded-2xl border border-dashed border-violet-200/60 bg-white/85 text-gray-600 shadow-inner backdrop-blur">
          По запросу «{{ searchQuery }}» категории не найдены
        </div>
      </div>

      <div v-else class="relative text-center py-8 px-4">
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.12),transparent_60%)]"></div>
        <div class="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-100">
          <svg class="h-8 w-8 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 113 12V7a4 4 0 014-4z"/>
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-2">Категорий пока нет</h3>
        <p class="text-sm text-gray-600 mb-4">Создайте первую категорию для организации товаров</p>
        <button
          @click="$emit('create')"
          class="w-full sm:w-auto rounded-2xl bg-gradient-to-r from-brand-dark via-rose-500 to-brand-primary px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:shadow-lg"
        >
          + Создать категорию
        </button>
      </div>
      </div>
    </div>
    
    <!-- Toast notification -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="copiedToast"
        class="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm font-medium"
      >
        {{ copiedToast }}
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronUpIcon, ChevronDownIcon, DocumentDuplicateIcon, TagIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import type { Category } from '@/stores/admin'
import AdminSectionHero from '@/components/admin/layout/AdminSectionHero.vue'

const props = withDefaults(
  defineProps<{
    categories: Category[]
    isLoading?: boolean
    groupCounts?: Record<string, number>
    crossSellCounts?: Record<string, number>
  }>(),
  { isLoading: false, groupCounts: () => ({}), crossSellCounts: () => ({}) }
)

const emit = defineEmits<{
  (e: 'create'): void
  (e: 'edit', category: Category): void
  (e: 'delete', id: string): void
  (e: 'reorder', list: { id: string; order: number }[]): void
  (e: 'manage-groups', category: Category): void
  (e: 'manage-cross-sell', category: Category): void
}>()

const localCategories = ref<Category[]>([])
const searchQuery = ref('')

const hasAnyCategories = computed(() => localCategories.value.length > 0)
const displayedCategories = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    return localCategories.value
  }
  return localCategories.value.filter((category) => {
    const name = (category.name || '').toLowerCase()
    const slug = (category.slug || '').toLowerCase()
    return name.includes(query) || slug.includes(query)
  })
})

watch(() => props.categories, (val) => {
  localCategories.value = Array.isArray(val) ? [...val] : []
}, { immediate: true })

function commitReorder() {
  const payload = localCategories.value.map((c, i) => ({ id: c.id, order: i + 1 }))
  emit('reorder', payload)
}

function getCategoryIndex(categoryId: string) {
  return localCategories.value.findIndex((c) => c.id === categoryId)
}

function moveUp(categoryId: string) {
  const index = getCategoryIndex(categoryId)
  if (index <= 0) return
  const arr = [...localCategories.value]
  const [item] = arr.splice(index, 1)
  arr.splice(index - 1, 0, item)
  localCategories.value = arr
  commitReorder()
}

function moveDown(categoryId: string) {
  const index = getCategoryIndex(categoryId)
  if (index === -1 || index >= localCategories.value.length - 1) return
  const arr = [...localCategories.value]
  const [item] = arr.splice(index, 1)
  arr.splice(index + 1, 0, item)
  localCategories.value = arr
  commitReorder()
}

function canMoveUp(categoryId: string) {
  return getCategoryIndex(categoryId) > 0
}

function canMoveDown(categoryId: string) {
  const index = getCategoryIndex(categoryId)
  return index !== -1 && index < localCategories.value.length - 1
}

function getDisplayOrder(categoryId: string) {
  const index = getCategoryIndex(categoryId)
  return index === -1 ? '-' : index + 1
}

const copiedToast = ref('')
const toastTimer = ref<number | null>(null)
const copyInProgress = ref(false)

function copyCategoryLink(slug: string) {
  // Предотвращаем множественные клики
  if (copyInProgress.value) {
    return
  }
  
  copyInProgress.value = true
  
  // Создаём внутреннюю ссылку на категорию (для использования в баннерах)
  const categoryUrl = `/category/${slug}`
  
  // Копируем в буфер обмена
  if (navigator.clipboard) {
    navigator.clipboard.writeText(categoryUrl).then(() => {
      showCopiedToast('Внутренняя ссылка для вставки в баннер скопирована')
      console.log('Ссылка на категорию скопирована:', categoryUrl)
      // Сбрасываем флаг после успешного копирования
      setTimeout(() => {
        copyInProgress.value = false
      }, 500)
    }).catch(err => {
      console.error('Ошибка копирования:', err)
      fallbackCopy(categoryUrl)
    })
  } else {
    fallbackCopy(categoryUrl)
  }
}

function showCopiedToast(message: string) {
  copiedToast.value = message
  if (toastTimer.value) {
    clearTimeout(toastTimer.value)
  }
  toastTimer.value = window.setTimeout(() => {
    copiedToast.value = ''
    toastTimer.value = null
  }, 2000)
}

function fallbackCopy(text: string) {
  // Fallback для старых браузеров
  const textArea = document.createElement('textarea')
  textArea.value = text
  document.body.appendChild(textArea)
  textArea.select()
  try {
    document.execCommand('copy')
    showCopiedToast('Внутренняя ссылка для вставки в баннер скопирована')
    console.log('Ссылка на категорию скопирована (fallback):', text)
  } catch (err) {
    console.error('Ошибка fallback копирования:', err)
    showCopiedToast('Ошибка копирования')
  }
  document.body.removeChild(textArea)
  
  // Сбрасываем флаг после fallback копирования
  setTimeout(() => {
    copyInProgress.value = false
  }, 500)
}
</script>
