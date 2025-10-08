<template>
  <div class="min-h-screen bg-gray-50 p-6">
    <div class="max-w-7xl mx-auto">
      <!-- Back Button -->
      <button @click="$router.push('/admin?tab=crm')" class="mb-4 inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
        </svg>
        Назад в админку
      </button>
      
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900">CRM Dashboard</h1>
        <p class="text-gray-600 mt-2">Статистика и аналитика продаж</p>
      </div>

      <!-- Period Filter -->
      <div class="mb-6 flex gap-2">
        <button
          v-for="period in periods"
          :key="period.value"
          @click="selectedPeriod = period.value"
          :class="[
            'px-4 py-2 rounded-lg font-medium transition-colors',
            selectedPeriod === period.value
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          ]"
        >
          {{ period.label }}
        </button>
      </div>

      <div v-if="loadingDashboard" class="text-center py-12">
        <div class="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        <p class="mt-4 text-gray-600">Загрузка данных...</p>
      </div>

      <div v-else-if="dashboardStats" class="space-y-6">
        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
              class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
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

        <div class="grid gap-6 md:grid-cols-2">
          <div class="bg-white rounded-lg shadow-sm p-6">
            <h2 class="text-xl font-bold text-gray-900 mb-4">Доставка</h2>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div class="text-xs uppercase text-gray-500">Количество доставок</div>
                <div class="mt-1 text-2xl font-semibold text-gray-900">{{ dashboardStats.deliveryStats?.deliveries || 0 }}</div>
              </div>
              <div class="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div class="text-xs uppercase text-gray-500">Выручка доставок</div>
                <div class="mt-1 text-2xl font-semibold text-gray-900">{{ formatCurrency(dashboardStats.deliveryStats?.revenue || 0) }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Orders by Status -->
        <div class="bg-white rounded-lg shadow-sm p-6">
          <h2 class="text-xl font-bold text-gray-900 mb-4">Заказы по статусам</h2>
          <div v-if="dashboardStats.ordersByStatus.length > 0" class="grid grid-cols-2 md:grid-cols-4 gap-4">
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
import { ref, onMounted, watch } from 'vue'
import { useCrmStore } from '@/stores/crm'
import { storeToRefs } from 'pinia'
import AdminModal from '@/components/AdminModal.vue'

const crmStore = useCrmStore()
const { dashboardStats, loadingDashboard } = storeToRefs(crmStore)

const periods = [
  { value: 'today', label: 'Сегодня' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' }
] as const

const selectedPeriod = ref<'today' | 'week' | 'month' | 'year'>('today')
const profitUnlocked = ref(false)
const showPasswordModal = ref(false)
const passwordInput = ref('')
const passwordError = ref('')
const verifyingPassword = ref(false)

watch(selectedPeriod, (newPeriod) => {
  crmStore.fetchDashboard(newPeriod)
})

onMounted(() => {
  crmStore.fetchDashboard(selectedPeriod.value)
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
