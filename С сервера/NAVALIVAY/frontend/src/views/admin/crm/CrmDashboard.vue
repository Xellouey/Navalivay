<template>
  <div class="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
    <div class="mx-auto w-full max-w-7xl space-y-8">
      <button
        @click="$router.push('/admin?tab=crm')"
        class="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 sm:w-auto"
      >
        <svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Назад в админку
      </button>

      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-gray-900 sm:text-3xl">CRM Dashboard</h1>
        <p class="mt-2 text-sm text-gray-600 sm:text-base">Статистика и аналитика продаж</p>
      </div>

      <!-- Period Filter with Navigation -->
      <div class="space-y-4">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="period in periods"
            :key="period.value"
            @click="selectPeriodType(period.value)"
            :class="[
              'w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:w-auto',
              selectedPeriodType === period.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            ]"
          >
            {{ period.label }}
          </button>
        </div>

        <!-- Period Navigation -->
        <div class="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm">
          <button
            @click="navigatePeriod(-1)"
            class="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Предыдущий
          </button>

          <div class="text-center">
            <div class="text-lg font-semibold text-gray-900">{{ currentPeriodLabel }}</div>
            <div class="text-xs text-gray-500">{{ periodRangeLabel }}</div>
          </div>

          <button
            @click="navigatePeriod(1)"
            :disabled="!canNavigateForward"
            class="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Следующий
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div v-if="loadingDashboard" class="text-center py-12">
        <div class="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        <p class="mt-4 text-gray-600">Загрузка данных...</p>
      </div>

      <div v-else-if="dashboardStats" class="space-y-8">
        <!-- Stats Cards -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="text-sm text-gray-600 mb-2">Количество продаж</div>
            <div class="text-3xl font-bold text-gray-900">{{ dashboardStats.stats.totalSales }}</div>
          </div>

          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="text-sm text-gray-600 mb-2">Выручка</div>
            <div class="text-3xl font-bold text-green-600">
              {{ formatCurrency(dashboardStats.stats.revenue) }}
            </div>
          </div>

          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="text-sm text-gray-600 mb-2">Прибыль</div>
            <div class="mt-2">
              <div v-if="profitUnlocked" class="text-3xl font-bold text-blue-600">
                {{ formatCurrency(dashboardStats.stats.profit) }}
              </div>
              <div v-else class="relative">
                <div class="text-3xl font-bold text-blue-600 select-none blur-sm">
                  {{ formatCurrency(dashboardStats.stats.profit) }}
                </div>
                <button
                  type="button"
                  class="absolute inset-0 flex items-center justify-center text-sm font-semibold text-blue-600 transition hover:text-blue-800"
                  @click="openPasswordModal"
                >
                  Показать
                </button>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="text-sm text-gray-600 mb-2">Средний чек</div>
            <div class="text-3xl font-bold text-purple-600">
              {{ formatCurrency(dashboardStats.stats.averageCheck) }}
            </div>
          </div>
        </div>

        <!-- Top Products -->
        <div class="bg-white rounded-lg shadow-sm p-6">
          <h2 class="text-xl font-bold text-gray-900 mb-4">Топ линейки</h2>
          <div v-if="dashboardStats.topProducts.length > 0" class="space-y-3">
            <div
              v-for="(product, index) in dashboardStats.topProducts"
              :key="index"
              class="flex flex-col gap-3 rounded-lg bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="flex-1">
                <div class="font-medium text-gray-900">{{ product.group_name }}</div>
                <div class="text-sm text-gray-600">
                  Продано: {{ product.total_quantity }} шт
                </div>
              </div>
              <div class="text-right">
                <div class="font-bold text-gray-900">
                  {{ formatCurrency(product.total_revenue) }}
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-center text-gray-500 py-8">
            Нет данных за выбранный период
          </div>
        </div>

        <div class="grid gap-6 sm:grid-cols-2">
          <div class="bg-white rounded-lg shadow-sm p-6">
            <h2 class="text-xl font-bold text-gray-900 mb-4">Доставка курьером</h2>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div class="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div class="text-xs uppercase text-gray-500">Количество</div>
                <div class="mt-1 text-2xl font-semibold text-rose-700">{{ dashboardStats.deliveryStats?.deliveries || 0 }}</div>
              </div>
              <div class="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div class="text-xs uppercase text-gray-500">Выручка</div>
                <div class="mt-1 text-2xl font-semibold text-gray-900">{{ formatCurrency(dashboardStats.deliveryStats?.revenue || 0) }}</div>
              </div>
              <div class="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div class="text-xs uppercase text-gray-500">Прибыль</div>
                <div class="mt-1 text-2xl font-semibold text-emerald-700">{{ formatCurrency(dashboardStats.deliveryStats?.profit || 0) }}</div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow-sm p-6">
            <h2 class="text-xl font-bold text-gray-900 mb-4">Самовывоз</h2>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div class="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div class="text-xs uppercase text-gray-500">Количество</div>
                <div class="mt-1 text-2xl font-semibold text-blue-700">{{ dashboardStats.pickupStats?.pickups || 0 }}</div>
              </div>
              <div class="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div class="text-xs uppercase text-gray-500">Выручка</div>
                <div class="mt-1 text-2xl font-semibold text-gray-900">{{ formatCurrency(dashboardStats.pickupStats?.revenue || 0) }}</div>
              </div>
              <div class="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div class="text-xs uppercase text-gray-500">Прибыль</div>
                <div class="mt-1 text-2xl font-semibold text-emerald-700">{{ formatCurrency(dashboardStats.pickupStats?.profit || 0) }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Orders by Status -->
        <div class="bg-white rounded-lg shadow-sm p-6">
          <h2 class="text-xl font-bold text-gray-900 mb-4">Заказы по статусам</h2>
          <div v-if="dashboardStats.ordersByStatus.length > 0" class="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div
              v-for="(statusData, index) in dashboardStats.ordersByStatus"
              :key="index"
              class="p-4 bg-gray-50 rounded-lg text-center"
            >
              <div class="text-2xl font-bold text-gray-900">{{ statusData.count }}</div>
              <div class="text-sm text-gray-600 mt-1">{{ getStatusLabel(statusData.status) }}</div>
            </div>
          </div>
          <div v-else class="text-center text-gray-500 py-8">
            Нет данных за выбранный период
          </div>
        </div>
      </div>

      <div v-else class="text-center py-12">
        <p class="text-gray-600">Нет данных</p>
      </div>
    </div>

  <AdminModal
    :isOpen="showPasswordModal"
    title="Подтверждение доступа"
    description="Введите пароль для просмотра прибыли."
    size="sm"
    :showActions="false"
    @close="closePasswordModal"
    @cancel="closePasswordModal"
  >
    <form class="space-y-4" @submit.prevent="submitPassword">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
        <input
          v-model="passwordInput"
          type="password"
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          placeholder="Введите пароль"
        />
        <p v-if="passwordError" class="mt-2 text-sm text-red-600">{{ passwordError }}</p>
      </div>
      <div class="flex gap-3 pt-2">
        <button
          type="submit"
          class="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          :disabled="verifyingPassword"
        >
          {{ verifyingPassword ? 'Проверяем…' : 'Показать' }}
        </button>
        <button
          type="button"
          class="flex-1 rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300"
          @click="closePasswordModal"
        >
          Отмена
        </button>
      </div>
    </form>
  </AdminModal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useCrmStore } from '@/stores/crm'
import { storeToRefs } from 'pinia'
import AdminModal from '@/components/AdminModal.vue'

const crmStore = useCrmStore()
const { dashboardStats, loadingDashboard } = storeToRefs(crmStore)

const periods = [
  { value: 'today', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' }
] as const

type PeriodType = 'today' | 'week' | 'month' | 'year'

const selectedPeriodType = ref<PeriodType>('today')
const currentDate = ref(new Date())
const profitUnlocked = ref(false)
const showPasswordModal = ref(false)
const passwordInput = ref('')
const passwordError = ref('')
const verifyingPassword = ref(false)

const canNavigateForward = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const current = new Date(currentDate.value)
  current.setHours(0, 0, 0, 0)
  
  return current < today
})

const currentPeriodLabel = computed(() => {
  const date = currentDate.value
  
  switch (selectedPeriodType.value) {
    case 'today':
      return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    
    case 'week': {
      const weekStart = getWeekStart(date)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      return `${weekStart.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — ${weekEnd.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}`
    }
    
    case 'month':
      return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
    
    case 'year':
      return date.toLocaleDateString('ru-RU', { year: 'numeric' })
    
    default:
      return ''
  }
})

const periodRangeLabel = computed(() => {
  const { startDate, endDate } = getPeriodDates()
  if (!startDate || !endDate) return ''
  
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  return `${start.toLocaleDateString('ru-RU')} — ${end.toLocaleDateString('ru-RU')}`
})

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday as first day
  return new Date(d.setDate(diff))
}

function getPeriodDates(): { startDate: string; endDate: string } {
  const date = new Date(currentDate.value)
  let startDate: Date
  let endDate: Date
  
  switch (selectedPeriodType.value) {
    case 'today':
      startDate = new Date(date)
      endDate = new Date(date)
      break
    
    case 'week': {
      startDate = getWeekStart(date)
      endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 6)
      break
    }
    
    case 'month':
      startDate = new Date(date.getFullYear(), date.getMonth(), 1)
      endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0)
      break
    
    case 'year':
      startDate = new Date(date.getFullYear(), 0, 1)
      endDate = new Date(date.getFullYear(), 11, 31)
      break
    
    default:
      startDate = new Date(date)
      endDate = new Date(date)
  }
  
  startDate.setHours(0, 0, 0, 0)
  endDate.setHours(23, 59, 59, 999)
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  }
}

function selectPeriodType(type: PeriodType) {
  selectedPeriodType.value = type
  currentDate.value = new Date() // Reset to today when changing period type
  loadDashboard()
}

function navigatePeriod(direction: number) {
  const date = new Date(currentDate.value)
  
  switch (selectedPeriodType.value) {
    case 'today':
      date.setDate(date.getDate() + direction)
      break
    
    case 'week':
      date.setDate(date.getDate() + (direction * 7))
      break
    
    case 'month':
      date.setMonth(date.getMonth() + direction)
      break
    
    case 'year':
      date.setFullYear(date.getFullYear() + direction)
      break
  }
  
  currentDate.value = date
  loadDashboard()
}

function loadDashboard() {
  const { startDate, endDate } = getPeriodDates()
  crmStore.fetchDashboard({ startDate, endDate })
}

watch([selectedPeriodType, currentDate], () => {
  loadDashboard()
})

onMounted(() => {
  loadDashboard()
})

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0
  }).format(value)
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    new: 'Новые',
    in_progress: 'В работе',
    completed: 'Завершены',
    delivered: 'Доставлены',
    cancelled: 'Отменены'
  }
  return labels[status] || status
}

function openPasswordModal() {
  passwordInput.value = ''
  passwordError.value = ''
  showPasswordModal.value = true
}

function closePasswordModal() {
  showPasswordModal.value = false
  passwordInput.value = ''
  passwordError.value = ''
}

async function submitPassword() {
  if (!passwordInput.value) {
    passwordError.value = 'Введите пароль'
    return
  }

  verifyingPassword.value = true
  passwordError.value = ''
  try {
    await crmStore.verifyProfitPassword(passwordInput.value)
    profitUnlocked.value = true
    closePasswordModal()
  } catch (error) {
    passwordError.value = 'Неверный пароль'
  } finally {
    verifyingPassword.value = false
  }
}
</script>
