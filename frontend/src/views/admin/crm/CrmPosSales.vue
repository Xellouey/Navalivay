<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Продажи касса</h1>
        <p class="text-sm text-gray-500 mt-1">Продажи через кассовый интерфейс</p>
      </div>
      
      <!-- Stats summary -->
      <div class="flex items-center gap-4">
        <div class="rounded-lg bg-green-50 border border-green-200 px-4 py-2">
          <p class="text-xs text-green-600 font-medium">Выручка</p>
          <p class="text-lg font-bold text-green-700">{{ formatCurrency(stats.totalRevenue) }}</p>
        </div>
        <div class="rounded-lg bg-blue-50 border border-blue-200 px-4 py-2">
          <p class="text-xs text-blue-600 font-medium">Прибыль</p>
          <p class="text-lg font-bold text-blue-700">{{ formatCurrency(stats.totalProfit) }}</p>
        </div>
        <div v-if="stats.pendingCount > 0" class="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2">
          <p class="text-xs text-amber-600 font-medium">Отложено</p>
          <p class="text-lg font-bold text-amber-700">{{ stats.pendingCount }}</p>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-3">
      <select
        v-model="filters.status"
        class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200"
      >
        <option value="">Все статусы</option>
        <option value="completed">Завершенные</option>
        <option value="pending">Отложенные</option>
      </select>
      
      <input
        v-model="filters.from"
        type="date"
        class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200"
        placeholder="От"
      />
      
      <input
        v-model="filters.to"
        type="date"
        class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200"
        placeholder="До"
      />
      
      <button
        @click="applyFilters"
        class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
      >
        Применить
      </button>
      
      <button
        @click="resetFilters"
        class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Сбросить
      </button>
    </div>

    <!-- Table -->
    <div class="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">№</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Дата</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Товар</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Цена</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Себестоимость</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Прибыль</th>
              <th class="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Статус</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Действия</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="loading" class="animate-pulse">
              <td colspan="8" class="px-4 py-8 text-center text-gray-500">
                Загрузка...
              </td>
            </tr>
            <tr v-else-if="sales.length === 0">
              <td colspan="8" class="px-4 py-8 text-center text-gray-500">
                Нет продаж
              </td>
            </tr>
            <tr
              v-for="sale in sales"
              :key="sale.id"
              class="hover:bg-gray-50 transition-colors"
            >
              <td class="px-4 py-3 text-sm text-gray-900 font-medium">
                #{{ sale.sale_number }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">
                {{ formatDateTime(sale.created_at) }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-900">
                {{ sale.product_name }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                {{ formatCurrency(sale.price) }}
              </td>
              <td class="px-4 py-3 text-sm text-right">
                <span v-if="sale.cost_price !== null" class="text-gray-600">
                  {{ formatCurrency(sale.cost_price) }}
                </span>
                <span v-else class="text-gray-400">-</span>
              </td>
              <td class="px-4 py-3 text-sm text-right font-medium">
                <span v-if="sale.profit !== null" :class="sale.profit >= 0 ? 'text-green-600' : 'text-red-600'">
                  {{ formatCurrency(sale.profit) }}
                </span>
                <span v-else class="text-gray-400">-</span>
              </td>
              <td class="px-4 py-3 text-center">
                <span
                  class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                  :class="sale.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'"
                >
                  {{ sale.status === 'completed' ? 'Завершен' : 'Отложен' }}
                </span>
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button
                    v-if="sale.status === 'pending'"
                    @click="openEditModal(sale)"
                    class="rounded p-1.5 text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Дозаполнить"
                  >
                    <PencilIcon class="h-4 w-4" />
                  </button>
                  <button
                    @click="confirmDelete(sale)"
                    class="rounded p-1.5 text-red-600 hover:bg-red-50 transition-colors"
                    title="Удалить"
                  >
                    <TrashIcon class="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
        <p class="text-sm text-gray-600">
          Показано {{ (currentPage - 1) * pageSize + 1 }}-{{ Math.min(currentPage * pageSize, total) }} из {{ total }}
        </p>
        <div class="flex items-center gap-2">
          <button
            @click="goToPage(currentPage - 1)"
            :disabled="currentPage === 1"
            class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Назад
          </button>
          <button
            @click="goToPage(currentPage + 1)"
            :disabled="currentPage === totalPages"
            class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Вперед
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <Transition name="fade">
      <div
        v-if="showEditModal && editingSale"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="closeEditModal"
      >
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Редактировать продажу</h3>
          
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Товар</label>
              <input
                v-model="editForm.product_name"
                type="text"
                class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Цена</label>
                <input
                  v-model="editForm.price"
                  type="number"
                  step="0.01"
                  min="0"
                  class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Себестоимость</label>
                <input
                  v-model="editForm.cost_price"
                  type="number"
                  step="0.01"
                  min="0"
                  class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200"
                  placeholder="Введите себестоимость"
                />
              </div>
            </div>
          </div>
          
          <div class="flex gap-3 mt-6">
            <button
              @click="saveEdit"
              :disabled="isSaving"
              class="flex-1 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {{ isSaving ? 'Сохраняем...' : 'Сохранить' }}
            </button>
            <button
              @click="closeEditModal"
              class="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Delete Confirmation Modal -->
    <Transition name="fade">
      <div
        v-if="showDeleteModal && deletingSale"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="closeDeleteModal"
      >
        <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <h3 class="text-lg font-semibold text-gray-900 mb-2">Удалить продажу?</h3>
          <p class="text-sm text-gray-600 mb-4">
            Вы уверены, что хотите удалить продажу "{{ deletingSale.product_name }}"?
          </p>
          
          <div class="flex gap-3">
            <button
              @click="deleteSale"
              :disabled="isDeleting"
              class="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {{ isDeleting ? 'Удаляем...' : 'Удалить' }}
            </button>
            <button
              @click="closeDeleteModal"
              class="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { PencilIcon, TrashIcon } from '@heroicons/vue/24/outline'
import { useCrmStore, type PosSale } from '@/stores/crm'

const crmStore = useCrmStore()

// State
const loading = ref(false)
const sales = ref<PosSale[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = 50

const filters = reactive({
  status: '' as '' | 'completed' | 'pending',
  from: '',
  to: ''
})

const stats = reactive({
  totalRevenue: 0,
  totalProfit: 0,
  pendingCount: 0
})

// Edit modal
const showEditModal = ref(false)
const editingSale = ref<PosSale | null>(null)
const editForm = reactive({
  product_name: '',
  price: '',
  cost_price: ''
})
const isSaving = ref(false)

// Delete modal
const showDeleteModal = ref(false)
const deletingSale = ref<PosSale | null>(null)
const isDeleting = ref(false)

// Computed
const totalPages = computed(() => Math.ceil(total.value / pageSize))

// Methods
function formatCurrency(value: number | null): string {
  if (value === null) return '-'
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ₽'
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function loadSales() {
  loading.value = true
  try {
    const params: any = {
      limit: pageSize,
      offset: (currentPage.value - 1) * pageSize
    }
    
    if (filters.status) params.status = filters.status
    if (filters.from) params.from = filters.from
    if (filters.to) params.to = filters.to + 'T23:59:59'
    
    const response = await crmStore.fetchPosSales(params)
    sales.value = response.sales
    total.value = response.total
    
    // Calculate stats from loaded data
    calculateStats()
  } finally {
    loading.value = false
  }
}

function calculateStats() {
  stats.totalRevenue = sales.value
    .filter(s => s.status === 'completed')
    .reduce((sum, s) => sum + s.price, 0)
  
  stats.totalProfit = sales.value
    .filter(s => s.status === 'completed' && s.profit !== null)
    .reduce((sum, s) => sum + (s.profit || 0), 0)
  
  stats.pendingCount = sales.value.filter(s => s.status === 'pending').length
}

function applyFilters() {
  currentPage.value = 1
  loadSales()
}

function resetFilters() {
  filters.status = ''
  filters.from = ''
  filters.to = ''
  currentPage.value = 1
  loadSales()
}

function goToPage(page: number) {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
  loadSales()
}

function openEditModal(sale: PosSale) {
  editingSale.value = sale
  editForm.product_name = sale.product_name
  editForm.price = String(sale.price)
  editForm.cost_price = sale.cost_price !== null ? String(sale.cost_price) : ''
  showEditModal.value = true
}

function closeEditModal() {
  showEditModal.value = false
  editingSale.value = null
}

async function saveEdit() {
  if (!editingSale.value || isSaving.value) return
  
  isSaving.value = true
  try {
    await crmStore.updatePosSale(editingSale.value.id, {
      product_name: editForm.product_name,
      price: Number(editForm.price),
      cost_price: editForm.cost_price ? Number(editForm.cost_price) : undefined
    })
    
    closeEditModal()
    loadSales()
  } catch (error) {
    console.error('Failed to update sale:', error)
  } finally {
    isSaving.value = false
  }
}

function confirmDelete(sale: PosSale) {
  deletingSale.value = sale
  showDeleteModal.value = true
}

function closeDeleteModal() {
  showDeleteModal.value = false
  deletingSale.value = null
}

async function deleteSale() {
  if (!deletingSale.value || isDeleting.value) return
  
  isDeleting.value = true
  try {
    await crmStore.deletePosSale(deletingSale.value.id)
    closeDeleteModal()
    loadSales()
  } catch (error) {
    console.error('Failed to delete sale:', error)
  } finally {
    isDeleting.value = false
  }
}

onMounted(() => {
  loadSales()
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
