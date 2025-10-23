<template>
  <div class="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
    <!-- Locked view: show only access form -->
    <div v-if="!profitUnlocked" class="mx-auto w-full max-w-md">
      <div class="rounded-lg bg-white p-6 shadow-sm">
        <h1 class="text-xl font-semibold text-gray-900 mb-4 text-center">Введите код доступа</h1>
        <form class="space-y-4" @submit.prevent="submitPassword">
          <div>
            <input
              v-model="passwordInput"
              type="password"
              class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="Пароль"
              autocomplete="current-password"
            />
            <p v-if="passwordError" class="mt-2 text-sm text-red-600">{{ passwordError }}</p>
          </div>
          <button
            type="submit"
            class="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            :disabled="verifyingPassword"
          >
            {{ verifyingPassword ? 'Проверяем…' : 'Войти' }}
          </button>
        </form>
      </div>
    </div>

    <!-- Unlocked dashboard content -->
    <div v-else class="mx-auto w-full max-w-7xl space-y-8">
      <button
        @click="$router.push('/admin?tab=crm')"
        class="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 sm:w-auto"
      >
        <svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Назад в админку
      </button>

      <div>
        <h1 class="text-2xl font-bold text-gray-900 sm:text-3xl">CRM Dashboard</h1>
        <p class="mt-2 text-sm text-gray-600 sm:text-base">Статистика и аналитика продаж</p>
      </div>

      <div class="flex flex-wrap gap-2">
        <!-- Period selector -->
        <button
          v-for="period in periods"
          :key="period.value"
          @click="selectedPeriod = period.value"
          :class="[
            'w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:w-auto',
            selectedPeriod === period.value
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          ]"
        >
          {{ period.label }}
        </button>
      </div>

      <!-- Period navigation -->
      <div class="flex items-center gap-3 text-sm text-gray-600">
        <button @click="prevPeriod" class="rounded-md border px-2 py-1 hover:bg-gray-50">←</button>
        <span>{{ periodLabel }}</span>
        <button @click="nextPeriod" class="rounded-md border px-2 py-1 hover:bg-gray-50" :disabled="isAtCurrentPeriod">→</button>
      </div>

      <div v-if="loadingDashboard" class="text-center py-12">
        <div class="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        <p class="mt-4 text-gray-600">Загрузка данных...</p>
      </div>

      <div v-else-if="dashboardStats" class="space-y-8">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
            <div class="text-3xl font-bold text-blue-600">
              {{ formatCurrency(dashboardStats.stats.profit) }}
            </div>
          </div>

          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="text-sm text-gray-600 mb-2">Средний чек</div>
            <div class="text-3xl font-bold text-purple-600">
              {{ formatCurrency(dashboardStats.stats.averageCheck) }}
            </div>
          </div>

          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="text-sm text-gray-600 mb-2">Покупатели</div>
            <div class="text-3xl font-bold text-gray-900">{{ dashboardStats.stats.uniqueCustomers }}</div>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-sm p-6">
          <h2 class="text-xl font-bold text-gray-900 mb-4">Топ 5 направлений по выручке</h2>
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
            <h2 class="text-xl font-bold text-gray-900 mb-4">Доставка</h2>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div class="text-xs uppercase text-gray-500">Количество доставок</div>
                <div class="mt-1 text-2xl font-semibold text-gray-900">{{ dashboardStats.deliveryStats?.deliveries || 0 }}</div>
              </div>
              <div class="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div class="text-xs uppercase text-gray-500">Прибыль с доставок</div>
                <div class="mt-1 text-2xl font-semibold text-gray-900">{{ formatCurrency(dashboardStats.deliveryStats?.profit || 0) }}</div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow-sm p-6">
            <h2 class="text-xl font-bold text-gray-900 mb-4">Самовывоз</h2>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div class="text-xs uppercase text-gray-500">Количество самовывозов</div>
                <div class="mt-1 text-2xl font-semibold text-gray-900">{{ dashboardStats.pickupStats?.pickups || 0 }}</div>
              </div>
              <div class="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div class="text-xs uppercase text-gray-500">Прибыль самовывозов</div>
                <div class="mt-1 text-2xl font-semibold text-gray-900">{{ formatCurrency(dashboardStats.pickupStats?.profit || 0) }}</div>
              </div>
            </div>
          </div>
        </div>

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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useCrmStore } from '@/stores/crm'
import { storeToRefs } from 'pinia'

const crmStore = useCrmStore()
const { dashboardStats, loadingDashboard, profitUnlocked, verifyingProfitAccess } = storeToRefs(crmStore)

const periods = [
  { value: 'today', label: 'Сегодня' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' }
] as const

const selectedPeriod = ref<'today' | 'week' | 'month' | 'year'>('today')
const offset = ref(0)
const passwordInput = ref('')
const passwordError = ref('')
const verifyingPassword = computed(() => verifyingProfitAccess.value)

const isAtCurrentPeriod = computed(() => offset.value >= 0)

const periodLabel = computed(() => {
  const now = new Date()
  const off = offset.value
  if (selectedPeriod.value === 'today') {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() + off)
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
  }
  if (selectedPeriod.value === 'week') {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const day = d.getUTCDay() || 7
    const monday = new Date(d.getTime() - (day - 1) * 86400000 + off * 7 * 86400000)
    const sunday = new Date(monday.getTime() + 6 * 86400000)
    return `${monday.toLocaleDateString('ru-RU')} — ${sunday.toLocaleDateString('ru-RU')}`
  }
  if (selectedPeriod.value === 'month') {
    const y = now.getUTCFullYear()
    const m = now.getUTCMonth() + off
    const d = new Date(Date.UTC(y, m, 1))
    return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
  }
  if (selectedPeriod.value === 'year') {
    const y = now.getUTCFullYear() + off
    return `${y}`
  }
  return ''
})

function prevPeriod() {
  offset.value = offset.value - 1
}
function nextPeriod() {
  if (isAtCurrentPeriod.value) return
  offset.value = offset.value + 1
}

watch([selectedPeriod, offset, profitUnlocked], ([newPeriod, newOffset, unlocked]) => {
  if (unlocked) {
    crmStore.fetchDashboard(newPeriod as typeof selectedPeriod.value, newOffset as number)
  }
})

onMounted(() => {
  if (profitUnlocked.value) {
    crmStore.fetchDashboard(selectedPeriod.value, offset.value)
  }
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

async function submitPassword() {
  if (!passwordInput.value) {
    passwordError.value = 'Введите пароль'
    return
  }

  passwordError.value = ''
  try {
    await crmStore.verifyProfitPassword(passwordInput.value)
    // После успешной проверки сразу грузим данные
    await crmStore.fetchDashboard(selectedPeriod.value, offset.value)
  } catch (error) {
    passwordError.value = 'Неверный пароль'
  }
}
</script>
