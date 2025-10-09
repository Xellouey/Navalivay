<template>
  <div class="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
    <div class="mx-auto w-full max-w-7xl space-y-8">
      <!-- Back Button -->
      <div>
        <h1 class="text-2xl font-bold text-gray-900 sm:text-3xl">Клиенты</h1>
        <p class="mt-2 text-sm text-gray-600 sm:text-base">Управление клиентами и их заказами</p>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap gap-2">
        <button @click="selectedFilter = null" :class="filterButtonClass(null)">Все</button>
        <button @click="selectedFilter = 'inactive'" :class="filterButtonClass('inactive')">Пропавшие (>30 дней)</button>
        <button @click="selectedFilter = 'cold'" :class="filterButtonClass('cold')">Холодные (без заказов)</button>
      </div>

      <div v-if="!loadingCustomers" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div class="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
          <p class="text-xs font-semibold uppercase text-blue-600">Холодные</p>
          <p class="mt-2 text-3xl font-bold text-blue-800">{{ temperatureStats.cold }}</p>
          <p class="text-xs text-blue-600">Без заказов</p>
        </div>
        <div class="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
          <p class="text-xs font-semibold uppercase text-amber-600">Пропавшие</p>
          <p class="mt-2 text-3xl font-bold text-amber-800">{{ temperatureStats.inactive }}</p>
          <p class="text-xs text-amber-600">Более 30 дней без покупки</p>
        </div>
        <div class="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
          <p class="text-xs font-semibold uppercase text-emerald-600">Активные</p>
          <p class="mt-2 text-3xl font-bold text-emerald-800">{{ temperatureStats.active }}</p>
          <p class="text-xs text-emerald-600">Недавние покупки</p>
        </div>
      </div>

      <div v-if="loadingCustomers" class="text-center py-12">
        <div class="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        <p class="mt-4 text-gray-600">Загрузка клиентов...</p>
      </div>

      <template v-else>
        <div
          v-if="inactiveReminderVisible"
          class="mb-6 rounded-xl border border-amber-200 bg-amber-50/80 p-4"
        >
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="text-sm font-semibold text-amber-700">Свяжитесь с пропавшими клиентами</p>
              <p class="text-xs text-amber-700/80">
                {{ inactiveCustomersCount }} {{ inactiveCustomersCount === 1 ? 'клиент' : inactiveCustomersCount < 5 ? 'клиента' : 'клиентов' }} не оформляли заказ более 30 дней.
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                class="rounded-lg border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                @click="showInactiveCustomers"
              >
                Показать «пропавших»
              </button>
              <button
                v-if="nextInactiveCustomer"
                class="rounded-lg border border-amber-400 bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-700"
                @click="goToNextInactive"
              >
                Открыть карточку
              </button>
            </div>
          </div>
        </div>

        <div v-if="customers.length > 0" class="rounded-lg bg-white shadow-sm">
          <div class="overflow-x-auto">
            <table class="w-full min-w-[720px]">
          <thead class="bg-gray-50 border-b">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Клиент</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telegram</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Заказы</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Потрачено</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Посл. заказ</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Посл. визит</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статусы</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr
              v-for="customer in customers"
              :key="customer.id"
              :class="customerRowClass(customer)"
            >
              <td class="px-6 py-4">
                <div class="text-sm font-medium text-gray-900">
                  {{ customer.first_name || 'Без имени' }} {{ customer.last_name || '' }}
                </div>
                <div v-if="customer.notes" class="text-xs text-gray-500 mt-1">
                  {{ customer.notes }}
                </div>
                <div
                  v-if="customer.recent_visits && customer.recent_visits.length"
                  class="mt-2 flex flex-wrap gap-1 text-[11px] text-gray-500"
                >
                  <span
                    v-for="visit in customer.recent_visits"
                    :key="visit.id"
                    class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5"
                  >
                    <span class="font-medium text-gray-600">{{ visitLabel(visit) }}</span>
                    <span class="text-[10px] text-gray-400">· {{ formatRelative(visit.visited_at) }}</span>
                  </span>
                </div>
              </td>
              <td class="px-6 py-4">
                <a v-if="customer.telegram_username" :href="`https://t.me/${customer.telegram_username}`" target="_blank" class="text-blue-600 hover:text-blue-900 text-sm">
                  @{{ customer.telegram_username }}
                </a>
                <span v-else class="text-sm text-gray-400">Нет username</span>
              </td>
              <td class="px-6 py-4 text-sm text-gray-900">{{ customer.total_orders }}</td>
              <td class="px-6 py-4 text-sm font-medium text-gray-900">{{ formatCurrency(customer.total_spent) }}</td>
              <td class="px-6 py-4 text-sm text-gray-500">
                {{ customer.last_order_at ? formatDate(customer.last_order_at) : 'Никогда' }}
              </td>
              <td class="px-6 py-4 text-sm text-gray-500">
                {{ customer.last_visit_at ? formatRelative(customer.last_visit_at) : 'Никогда' }}
              </td>
              <td class="px-6 py-4">
                <div class="flex flex-wrap gap-1">
                  <span
                    v-if="customer.blocked_count && customer.blocked_count > 0"
                    class="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800"
                  >
                    Заблокирован
                  </span>
                  <span v-else class="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                    Активен
                  </span>
                  <span
                    class="px-2 py-1 text-xs font-medium rounded-full"
                    :class="temperatureBadge(customer).badgeClass"
                  >
                    {{ temperatureBadge(customer).label }}
                  </span>
                </div>
                <div
                  v-if="isInactiveCustomer(customer)"
                  class="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700"
                >
                  Свяжитесь, клиент пропал
                </div>
              </td>
              <td class="px-6 py-4 text-right text-sm">
                <button @click="viewCustomer(customer.id)" class="text-blue-600 hover:text-blue-900 mr-3">Подробнее</button>
                <button v-if="!customer.blocked_count" @click="blockCustomer(customer)" class="text-red-600 hover:text-red-900">Блокировать</button>
                <button v-else @click="unblockCustomer(customer)" class="text-green-600 hover:text-green-900">Разблокировать</button>
              </td>
            </tr>
          </tbody>
            </table>
          </div>
        </div>

        <div v-else class="text-center py-12 bg-white rounded-lg shadow-sm">
          <p class="text-gray-600">Клиентов не найдено</p>
        </div>
      </template>
    </div>

    <!-- Block Modal -->
    <AdminModal
      :isOpen="showBlockModal"
      title="Блокировка доставки"
      description="Укажите причину блокировки для клиента."
      size="sm"
      :showActions="false"
      @close="showBlockModal = false"
      @cancel="showBlockModal = false"
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Причина блокировки</label>
          <textarea v-model="blockReason" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Укажите причину..."></textarea>
        </div>
        <div class="flex gap-3">
          <button @click="confirmBlock" class="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Заблокировать</button>
          <button @click="showBlockModal = false" class="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">Отмена</button>
        </div>
      </div>
    </AdminModal>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useCrmStore } from '@/stores/crm'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import type { Customer, VisitLog } from '@/stores/crm'
import AdminModal from '@/components/AdminModal.vue'

const crmStore = useCrmStore()
const { customers, loadingCustomers } = storeToRefs(crmStore)
const router = useRouter()

const selectedFilter = ref<'inactive' | 'cold' | null>(null)
const showBlockModal = ref(false)
const blockReason = ref('')
const customerToBlock = ref<Customer | null>(null)

type CustomerTemperature = 'cold' | 'inactive' | 'active'

const temperatureMeta: Record<CustomerTemperature, { label: string; badgeClass: string; rowClass: string }> = {
  cold: {
    label: 'Холодный',
    badgeClass: 'bg-blue-100 text-blue-700',
    rowClass: 'bg-blue-50/60'
  },
  inactive: {
    label: 'Пропал',
    badgeClass: 'bg-amber-100 text-amber-700',
    rowClass: 'bg-amber-50/60'
  },
  active: {
    label: 'Активен',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    rowClass: ''
  }
}

const temperatureStats = computed(() => {
  const stats = { cold: 0, inactive: 0, active: 0 }
  customers.value.forEach((customer) => {
    const temp = getCustomerTemperature(customer)
    stats[temp] += 1
  })
  return stats
})

const inactiveCustomers = computed(() => customers.value.filter(customer => getCustomerTemperature(customer) === 'inactive'))
const inactiveCustomersCount = computed(() => inactiveCustomers.value.length)
const inactiveReminderVisible = computed(() => inactiveCustomersCount.value > 0)

function resolveTimestamp(value?: string | null) {
  if (!value) return 0
  const ts = new Date(value).getTime()
  return Number.isNaN(ts) ? 0 : ts
}

const nextInactiveCustomer = computed(() => {
  if (!inactiveCustomers.value.length) return null
  return [...inactiveCustomers.value].sort((a, b) => {
    const orderDiff = resolveTimestamp(a.last_order_at) - resolveTimestamp(b.last_order_at)
    if (orderDiff !== 0) return orderDiff
    return resolveTimestamp(a.last_visit_at) - resolveTimestamp(b.last_visit_at)
  })[0]
})

watch(selectedFilter, () => {
  crmStore.fetchCustomers(selectedFilter.value || undefined)
})

onMounted(() => {
  crmStore.fetchCustomers()
})

function filterButtonClass(filter: 'inactive' | 'cold' | null) {
  return [
    'w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:w-auto',
    selectedFilter.value === filter ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
  ]
}

function getCustomerTemperature(customer: Customer): CustomerTemperature {
  if (!customer.total_orders || customer.total_orders === 0) {
    return 'cold'
  }

  if (!customer.last_order_at) {
    return 'cold'
  }

  const lastOrder = new Date(customer.last_order_at).getTime()
  const now = Date.now()
  const diffDays = Math.floor((now - lastOrder) / (1000 * 60 * 60 * 24))

  if (diffDays >= 30) return 'inactive'
  return 'active'
}

function temperatureBadge(customer: Customer) {
  const temperature = getCustomerTemperature(customer)
  return temperatureMeta[temperature]
}

function customerRowClass(customer: Customer) {
  const temperature = getCustomerTemperature(customer)
  return [
    'hover:bg-gray-50 transition-colors',
    temperatureMeta[temperature].rowClass,
    customer.blocked_count && customer.blocked_count > 0 ? 'opacity-80' : ''
  ]
}

function isInactiveCustomer(customer: Customer) {
  return getCustomerTemperature(customer) === 'inactive'
}

function formatRelative(dateString: string | null) {
  if (!dateString) return 'Никогда'
  const target = new Date(dateString).getTime()
  if (Number.isNaN(target)) return '—'
  const diffMs = Date.now() - target
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const month = 30 * day
  const year = 365 * day

  if (diffMs < minute) return 'Только что'
  if (diffMs < hour) return `${Math.round(diffMs / minute)} мин назад`
  if (diffMs < day) return `${Math.round(diffMs / hour)} ч назад`
  if (diffMs < month) return `${Math.round(diffMs / day)} дн назад`
  if (diffMs < year) return `${Math.round(diffMs / month)} мес назад`
  return `${Math.round(diffMs / year)} г назад`
}

function visitLabel(visit: VisitLog) {
  if (visit.action) return visit.action
  if (visit.page_path) {
    if (visit.page_path === '/') return 'Главная'
    if (visit.page_path.startsWith('/category/')) {
      const slug = visit.page_path.split('/').pop()
      return `Категория • ${slug}`
    }
    if (visit.page_path.startsWith('/p/')) {
      return 'Карточка товара'
    }
    return visit.page_path
  }
  return 'Визит'
}

function viewCustomer(id: string) {
  router.push({ name: 'CrmCustomerDetail', params: { id } })
}

function showInactiveCustomers() {
  selectedFilter.value = 'inactive'
}

function goToNextInactive() {
  const target = nextInactiveCustomer.value
  if (!target) return
  viewCustomer(target.id)
}

function blockCustomer(customer: Customer) {
  customerToBlock.value = customer
  blockReason.value = ''
  showBlockModal.value = true
}

async function confirmBlock() {
  if (!customerToBlock.value) return
  try {
    await crmStore.blockCustomer(customerToBlock.value.id, blockReason.value)
    showBlockModal.value = false
    await crmStore.fetchCustomers(selectedFilter.value || undefined)
  } catch (error) {
    alert('Ошибка блокировки')
  }
}

async function unblockCustomer(customer: Customer) {
  if (!confirm('Разблокировать доставку для этого клиента?')) return
  try {
    await crmStore.unblockCustomer(customer.id)
    await crmStore.fetchCustomers(selectedFilter.value || undefined)
  } catch (error) {
    alert('Ошибка разблокировки')
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(value)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
</script>
