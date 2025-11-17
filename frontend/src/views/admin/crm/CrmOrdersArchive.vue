<template>
  <div class="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
    <div class="mx-auto w-full max-w-7xl space-y-6">
      <!-- Верхняя панель -->
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
          <button
            @click="$router.push('/admin/crm/orders')"
            class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Назад к заказам
          </button>
          <button
            @click="refreshOrders()"
            :disabled="isRefreshing"
            class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span v-if="!isRefreshing">Обновить</span>
            <span v-else>Обновляем...</span>
          </button>
        </div>
      </div>

      <!-- Заголовок -->
      <header class="flex flex-col gap-2">
        <h1 class="text-2xl font-bold text-gray-900 sm:text-3xl">Архив заказов</h1>
        <p class="text-sm text-gray-600 sm:text-base">Завершённые заказы, автоматически перенесённые в архив в полночь</p>
      </header>

      <!-- Поиск -->
      <div class="flex flex-col sm:flex-row gap-3">
        <div class="relative flex-1">
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Поиск по номеру заказа..."
            class="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            @input="handleSearch"
          />
          <svg v-if="!searchQuery" class="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <!-- Загрузка -->
      <div v-if="loadingOrders" class="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white">
        <div class="flex flex-col items-center gap-4">
          <div class="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-r-transparent"></div>
          <p class="text-sm text-gray-500">Загружаем архив...</p>
        </div>
      </div>

      <!-- Компактный список архивных заказов -->
      <div v-else-if="orders.length > 0" class="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div class="border-b border-gray-100 px-5 py-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900">Всего в архиве: {{ orders.length }}</h2>
          </div>
        </div>
        
        <div class="divide-y divide-gray-100">
          <button
            v-for="order in orders"
            :key="order.id"
            @click="viewOrder(order.id)"
            class="w-full border-0 bg-white px-5 py-2.5 text-left outline-none transition-all hover:bg-blue-50 focus:outline-none"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <svg class="h-5 w-5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                <span class="text-sm font-semibold text-gray-900">#{{ order.order_number }}</span>
                <span class="text-xs text-gray-500">{{ formatDate(order.completed_at || order.created_at) }}</span>
              </div>
              <div class="flex items-center gap-3">
                <span v-if="order.customer_name" class="hidden text-sm text-gray-600 sm:block">{{ order.customer_name }}</span>
                <span class="text-sm font-semibold text-gray-900">{{ formatCurrency(order.final_amount) }}</span>
                <svg class="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>
        </div>
      </div>

      <!-- Пустое состояние -->
      <div v-else class="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-16 text-center">
        <svg class="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
        <h3 class="mt-4 text-lg font-medium text-gray-900">Архив пуст</h3>
        <p class="mt-2 text-sm text-gray-500">Завершённые заказы будут автоматически перенесены сюда каждую полночь</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const orders = ref<any[]>([])
const loadingOrders = ref(false)
const isRefreshing = ref(false)
const searchQuery = ref('')
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

async function fetchArchivedOrders() {
  loadingOrders.value = true
  try {
    const searchParam = searchQuery.value.trim() || undefined
    const response = await fetch(`/api/admin/crm/orders/archived?limit=1000${searchParam ? `&search=${encodeURIComponent(searchParam)}` : ''}`, {
      credentials: 'include'
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch archived orders')
    }
    
    const data = await response.json()
    orders.value = data.orders || []
  } catch (error) {
    console.error('[Archive] Failed to fetch orders:', error)
    orders.value = []
  } finally {
    loadingOrders.value = false
  }
}

async function refreshOrders() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  try {
    await fetchArchivedOrders()
  } finally {
    isRefreshing.value = false
  }
}

function handleSearch() {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }
  searchDebounceTimer = setTimeout(() => {
    void fetchArchivedOrders()
  }, 400)
}

function viewOrder(id: string) {
  router.push(`/admin/crm/orders/${id}`)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0
  }).format(value)
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(() => {
  fetchArchivedOrders()
})
</script>
