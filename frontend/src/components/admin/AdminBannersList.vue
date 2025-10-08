<template>
  <div class="space-y-6">
    <!-- Header with controls -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div class="flex items-center gap-4">
        <h2 class="text-2xl font-bold text-gray-900">Управление баннерами</h2>
        <span v-if="filteredBanners.length" class="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
          {{ filteredBanners.length }} из {{ props.banners?.length || 0 }}
        </span>
      </div>
      <div class="flex gap-2">
        <button
          @click="$emit('create')"
          class="px-4 py-2 bg-brand-dark text-white rounded-lg hover:bg-brand-dark/90 transition-colors"
        >
          Добавить баннер
        </button>
      </div>
    </div>

    <!-- Search and filters -->
    <div class="bg-white rounded-lg border p-4 space-y-3">
      <div class="flex flex-col sm:flex-row gap-3">
        <div class="flex-1">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Поиск по ID или ссылке..."
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-dark focus:border-transparent"
          >
        </div>
        <select
          v-model="statusFilter"
          class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-dark focus:border-transparent"
        >
          <option value="all">Все статусы</option>
          <option value="active">Активные</option>
          <option value="inactive">Неактивные</option>
        </select>
      </div>
      
      <!-- Batch operations - мобильная адаптация -->
      <div v-if="selectedIds.length" class="space-y-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-blue-800">Выбрано: {{ selectedIds.length }}</span>
          <button
            @click="clearSelection"
            class="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
          >
            ✕ Отменить
          </button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            @click="batchToggleStatus(true)"
            class="w-full px-3 py-2 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors flex items-center justify-center gap-1"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
            Активировать
          </button>
          <button
            @click="batchToggleStatus(false)"
            class="w-full px-3 py-2 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors flex items-center justify-center gap-1"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 008.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clip-rule="evenodd" />
            </svg>
            Деактивировать
          </button>
          <button
            @click="batchDelete"
            class="w-full px-3 py-2 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors flex items-center justify-center gap-1"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            Удалить
          </button>
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="bg-white rounded-xl shadow-sm border p-8 text-center">
      <div class="animate-spin w-8 h-8 border-4 border-brand-dark border-t-transparent rounded-full mx-auto"></div>
      <p class="mt-2 text-gray-600">Загрузка баннеров...</p>
    </div>

    <!-- Main content -->
    <div v-else-if="props.banners && props.banners.length" class="bg-white rounded-xl shadow-sm border">
      <!-- Table view -->
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 border-b">
            <tr>
              <th class="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  :checked="isAllSelected"
                  @change="toggleSelectAll"
                  class="rounded border-gray-300 text-brand-dark focus:ring-brand-dark"
                >
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Превью</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Название</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Порядок</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
            </tr>
          </thead>
          <tbody 
            ref="sortableContainer" 
            class="divide-y divide-gray-200"
          >
            <tr
              v-for="(banner, index) in filteredBanners"
              :key="banner.id"
              :data-id="banner.id"
              class="hover:bg-gray-50 transition-colors sortable-item"
              :class="{ 'bg-blue-50': selectedIds.includes(banner.id) }"
            >
              <td class="px-4 py-4">
                <input
                  type="checkbox"
                  :checked="selectedIds.includes(banner.id)"
                  @change="toggleSelect(banner.id)"
                  class="rounded border-gray-300 text-brand-dark focus:ring-brand-dark"
                >
              </td>
              <td class="px-4 py-4">
                <div class="group relative">
                  <img 
                    :src="imageOf(banner)" 
                    :alt="banner.id" 
                    @error="onImgError" 
                    class="w-16 h-10 object-cover rounded border cursor-pointer" 
                    @click="showPreview(banner.image)"
                  >
                  <div class="absolute inset-0 rounded"></div>
                </div>
              </td>
              <td class="px-4 py-4">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-gray-900 truncate">{{ banner.title || banner.id }}</p>
                  <p v-if="linkOf(banner)" class="text-xs text-gray-500 truncate mt-1">{{ linkOf(banner) }}</p>
                </div>
              </td>
              <td class="px-4 py-4">
                <button
                  @click="handleToggleStatus(banner.id)"
                  :class="isActive(banner) ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'"
                  class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer"
                >
                  <span :class="isActive(banner) ? 'bg-green-400' : 'bg-gray-400'" class="w-2 h-2 rounded-full mr-1.5"></span>
                  {{ isActive(banner) ? 'Активен' : 'Неактивен' }}
                </button>
              </td>
              <td class="px-4 py-4">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-mono text-gray-600 min-w-[2rem] text-center">{{ banner.order || (index + 1) }}</span>
                  <div class="flex flex-col gap-1">
                    <button
                      @click="moveItemUp(banner.id)"
                      :disabled="index === 0"
                      class="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Переместить выше"
                    >
                      <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd" />
                      </svg>
                    </button>
                    <button
                      @click="moveItemDown(banner.id)"
                      :disabled="index === filteredBanners.length - 1"
                      class="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Переместить ниже"
                    >
                      <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </td>
              <td class="px-4 py-4">
                <div class="flex items-center justify-end gap-2">
                  <button 
                    @click="$emit('edit', banner)" 
                    class="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-all"
                    title="Редактировать"
                  >
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                  <button 
                    @click="$emit('delete', banner.id)" 
                    class="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-100 rounded transition-all"
                    title="Удалить"
                  >
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>


      <!-- Help text -->
      <div class="px-6 py-3 bg-gray-50 border-t text-xs text-gray-500 text-center">
        Используйте стрелочки ↑↓ для изменения порядка. Используйте чекбоксы для массовых операций.
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="bg-white rounded-xl shadow-sm border p-8 text-center">
      <svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 48 48">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M8 14v20c0 4.418 7.163 8 16 8 1.381 0 2.721-.087 4-.252M8 14c0 4.418 7.163 8 16 8s16-3.582 16-8M8 14c0-4.418 7.163-8 16-8s16 3.582 16 8m0 0v14m-16-5c0 4.418 7.163 8 16 8 1.381 0 2.721-.087 4-.252" />
      </svg>
      <h3 class="text-lg font-medium text-gray-900 mb-2">Баннеров пока нет</h3>
      <p class="text-gray-600 mb-4">Создайте первый баннер для отображения на главной странице</p>
      <button
        @click="$emit('create')"
        class="px-4 py-2 bg-brand-dark text-white rounded-lg hover:bg-brand-dark/90 transition-colors"
      >
        Создать первый баннер
      </button>
    </div>

    <!-- Preview Modal -->
    <div v-if="previewImage" class="fixed inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-50" @click="closePreview">
      <div class="max-w-4xl max-h-full p-4">
        <img :src="previewImage" alt="Preview" class="max-w-full max-h-full object-contain rounded-lg" />
        <button 
          @click="closePreview"
          class="absolute top-4 right-4 text-white hover:text-gray-300 text-2xl font-bold"
        >
          ×
        </button>
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
        v-if="toastMessage"
        class="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm font-medium"
      >
        {{ toastMessage }}
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue'
import type { Banner } from '@/stores/admin'

// Sortable library for drag&drop (будем подключать позже если нужно)
// import Sortable from 'sortablejs'

const props = withDefaults(defineProps<{ banners: Banner[]; isLoading?: boolean }>(), { isLoading: false })
const emit = defineEmits<{
  (e: 'create'): void
  (e: 'edit', banner: Banner): void
  (e: 'delete', id: string): void
  (e: 'batchDelete', ids: string[]): void
  (e: 'batchToggle', ids: string[], active: boolean): void
  (e: 'reorder', list: { id: string; order: number }[]): void
  (e: 'toggleStatus', id: string): void
}>()

// State
const searchQuery = ref('')
const statusFilter = ref<'all' | 'active' | 'inactive'>('all')
const selectedIds = ref<string[]>([])
const previewImage = ref<string | null>(null)
const sortableContainer = ref<HTMLElement | null>(null)
// let sortableInstance: Sortable | null = null

// Computed - используем props.banners напрямую!
const filteredBanners = computed(() => {
  let filtered = props.banners ? [...props.banners] : []
  
  // Search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    filtered = filtered.filter(banner => 
      banner.id.toLowerCase().includes(query) ||
      banner.title?.toLowerCase().includes(query) ||
      (banner.href && banner.href.toLowerCase().includes(query))
    )
  }
  
  // Status filter
  if (statusFilter.value !== 'all') {
    const isActiveFilter = statusFilter.value === 'active'
    filtered = filtered.filter(banner => isActive(banner) === isActiveFilter)
  }
  
  return filtered
})

const isAllSelected = computed(() => {
  return filteredBanners.value.length > 0 && 
         filteredBanners.value.every(banner => selectedIds.value.includes(banner.id))
})

// Watch props - очищаем выбор при изменении баннеров
watch(() => props.banners, () => {
  selectedIds.value = []
}, { deep: true })

// Selection methods
function toggleSelect(id: string) {
  const index = selectedIds.value.indexOf(id)
  if (index === -1) {
    selectedIds.value.push(id)
  } else {
    selectedIds.value.splice(index, 1)
  }
}

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = [...filteredBanners.value.map(b => b.id)]
  }
}

function clearSelection() {
  selectedIds.value = []
}

// Batch operations
function batchToggleStatus(active: boolean) {
  if (selectedIds.value.length === 0) return
  emit('batchToggle', [...selectedIds.value], active)
  clearSelection()
}

function batchDelete() {
  if (selectedIds.value.length === 0) return
  if (confirm(`Удалить ${selectedIds.value.length} баннеров?`)) {
    emit('batchDelete', [...selectedIds.value])
    clearSelection()
  }
}

// Reorder methods
function commitReorder() {
  const payload = filteredBanners.value.map((b, i) => ({ id: b.id, order: i + 1 }))
  emit('reorder', payload)
}

function moveUp(index: number) {
  if (index <= 0) return
  const arr = [...filteredBanners.value]
  const [item] = arr.splice(index, 1)
  arr.splice(index - 1, 0, item)
  
  // Просто отправляем reorder - store сам обновит порядок
  const reorderedPayload = arr.map((b, i) => ({ id: b.id, order: i + 1 }))
  emit('reorder', reorderedPayload)
}

function moveDown(index: number) {
  if (index >= filteredBanners.value.length - 1) return
  const arr = [...filteredBanners.value]
  const [item] = arr.splice(index, 1)
  arr.splice(index + 1, 0, item)
  
  // Просто отправляем reorder - store сам обновит порядок
  const reorderedPayload = arr.map((b, i) => ({ id: b.id, order: i + 1 }))
  emit('reorder', reorderedPayload)
}

// Новые методы для работы по ID баннера
function moveItemUp(bannerId: string) {
  const index = filteredBanners.value.findIndex(b => b.id === bannerId)
  if (index !== -1) {
    moveUp(index)
  }
}

function moveItemDown(bannerId: string) {
  const index = filteredBanners.value.findIndex(b => b.id === bannerId)
  if (index !== -1) {
    moveDown(index)
  }
}

// Preview methods
function showPreview(imageSrc: string | null) {
  if (imageSrc) {
    previewImage.value = imageSrc
  }
}

function closePreview() {
  previewImage.value = null
}

// Toast notification variables
const toastMessage = ref('')
const toastTimer = ref<number | null>(null)

// Helper functions
function isActive(b: Banner) { return b.active === 1 }
function imageOf(b: Banner) { return b.image || 'https://placehold.co/80x32/f3f4f6/9ca3af?text=No+Image' }
function linkOf(b: Banner) { return b.href || '' }
function onImgError(e: Event) { (e.target as HTMLImageElement).src = 'https://placehold.co/80x32/f3f4f6/9ca3af?text=Error' }

// Toast functions
function showToast(message: string) {
  toastMessage.value = message
  if (toastTimer.value) {
    clearTimeout(toastTimer.value)
  }
  toastTimer.value = window.setTimeout(() => {
    toastMessage.value = ''
    toastTimer.value = null
  }, 2000)
}

// Status toggle with toast
function handleToggleStatus(bannerId: string) {
  const banner = props.banners.find(b => b.id === bannerId)
  if (banner) {
    const newStatus = banner.active === 1 ? 'деактивирован' : 'активирован'
    showToast(`Баннер ${newStatus}`)
  }
  emit('toggleStatus', bannerId)
}


// Lifecycle hooks для drag&drop (можно будет доделать позже)
onMounted(async () => {
  // Инициализация drag&drop для таблицы
  // await initSortable()
})

onUnmounted(() => {
  // if (sortableInstance) {
  //   sortableInstance.destroy()
  // }
})

// async function initSortable() {
//   if (!sortableContainer.value) return
//   
//   const { default: Sortable } = await import('sortablejs')
//   sortableInstance = new Sortable(sortableContainer.value, {
//     handle: '.cursor-move',
//     animation: 150,
//     onEnd: (evt) => {
//       const { oldIndex, newIndex } = evt
//       if (oldIndex !== undefined && newIndex !== undefined && oldIndex !== newIndex) {
//         const arr = [...filteredBanners.value]
//         const [item] = arr.splice(oldIndex, 1)
//         arr.splice(newIndex, 0, item)
//         
//         // Пересортировать основной массив
//         const reorderedIds = arr.map(b => b.id)
//         localBanners.value.sort((a, b) => {
//           const aIndex = reorderedIds.indexOf(a.id)
//           const bIndex = reorderedIds.indexOf(b.id)
//           if (aIndex === -1) return 1
//           if (bIndex === -1) return -1
//           return aIndex - bIndex
//         })
//         
//         commitReorder()
//       }
//     }
//   })
// }
</script>
