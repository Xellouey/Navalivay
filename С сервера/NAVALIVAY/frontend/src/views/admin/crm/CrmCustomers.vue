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

      <div
        v-if="!loadingCustomers"
        class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
      >
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th class="px-6 py-3 text-left">Сегмент</th>
              <th class="px-6 py-3 text-right">Клиентов</th>
              <th class="px-6 py-3 text-right">Заказов</th>
              <th class="px-6 py-3 text-right">Оборот</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="row in statusSummaryRows"
              :key="row.key"
              class="hover:bg-gray-50"
            >
              <td class="px-6 py-4 font-medium text-gray-900">{{ row.label }}</td>
              <td class="px-6 py-4 text-right text-gray-700">{{ row.count }}</td>
              <td class="px-6 py-4 text-right text-gray-700">{{ row.orders }}</td>
              <td class="px-6 py-4 text-right text-gray-900">{{ formatCurrency(row.spent) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="loadingCustomers" class="text-center py-12">
        <div class="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        <p class="mt-4 text-gray-600">Загрузка клиентов...</p>
      </div>

      <template v-else>
        <div v-if="customers.length > 0" class="rounded-lg bg-white shadow-sm">
          <div class="flex items-center gap-2 border-b border-gray-100 px-6 py-4">
            <label class="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                v-model="showActiveCustomers"
                type="checkbox"
                class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Показывать активных клиентов?</span>
            </label>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[720px]">
          <thead class="bg-gray-50 border-b">
            <tr>
              <th
                class="px-6 py-3 text-left text-xs font-medium uppercase"
                :class="sortHeaderClass('name')"
                @click="toggleSort('name')"
              >
                <span class="flex items-center gap-1">
                  Клиент
                  <span class="text-[10px]" :class="sortIndicatorClass('name')">{{ sortIndicator('name') }}</span>
                </span>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telegram</th>
              <th
                class="px-6 py-3 text-left text-xs font-medium uppercase"
                :class="sortHeaderClass('total_orders')"
                @click="toggleSort('total_orders')"
              >
                <span class="flex items-center gap-1">
                  Заказы
                  <span class="text-[10px]" :class="sortIndicatorClass('total_orders')">{{ sortIndicator('total_orders') }}</span>
                </span>
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium uppercase"
                :class="sortHeaderClass('total_spent')"
                @click="toggleSort('total_spent')"
              >
                <span class="flex items-center gap-1">
                  Потрачено
                  <span class="text-[10px]" :class="sortIndicatorClass('total_spent')">{{ sortIndicator('total_spent') }}</span>
                </span>
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium uppercase"
                :class="sortHeaderClass('last_order_at')"
                @click="toggleSort('last_order_at')"
              >
                <span class="flex items-center gap-1">
                  Посл. заказ
                  <span class="text-[10px]" :class="sortIndicatorClass('last_order_at')">{{ sortIndicator('last_order_at') }}</span>
                </span>
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium uppercase"
                :class="sortHeaderClass('last_visit_at')"
                @click="toggleSort('last_visit_at')"
              >
                <span class="flex items-center gap-1">
                  Посл. визит
                  <span class="text-[10px]" :class="sortIndicatorClass('last_visit_at')">{{ sortIndicator('last_visit_at') }}</span>
                </span>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статусы</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr
              v-for="customer in displayedCustomers"
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
              <td class="px-6 py-4 text-sm text-center">
                <div class="flex flex-col items-center gap-2">
                  <span
                    v-if="customer.blocked_count && customer.blocked_count > 0"
                    class="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800"
                  >
                    Заблокирован
                  </span>
                  <span
                    class="px-2 py-1 text-xs font-medium rounded-full"
                    :class="temperatureBadge(customer).badgeClass"
                  >
                    {{ temperatureBadge(customer).label }}
                  </span>
                </div>
              </td>
              <td class="px-6 py-4 text-sm">
                <div class="flex flex-col items-end gap-2">
                  <button
                    @click="viewCustomer(customer.id)"
                    class="admin-link-button admin-link-button--compact admin-link-button--primary min-w-[132px]"
                  >
                    Подробнее
                  </button>
                  <button
                    v-if="!customer.blocked_count"
                    @click="blockCustomer(customer)"
                    class="admin-link-button admin-link-button--compact admin-link-button--muted min-w-[132px]"
                  >
                    Блокировать
                  </button>
                  <button
                    v-else
                    @click="unblockCustomer(customer)"
                    class="admin-link-button admin-link-button--compact admin-link-button--unblock min-w-[132px]"
                  >
                    Разблокировать
                  </button>
                </div>
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
type SortKey = 'name' | 'total_orders' | 'total_spent' | 'last_order_at' | 'last_visit_at'
const sortKey = ref<SortKey>('last_visit_at')
const sortDirection = ref<'asc' | 'desc'>('desc')
const showBlockModal = ref(false)
const blockReason = ref('')
const customerToBlock = ref<Customer | null>(null)
const showActiveCustomers = ref(true)

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

type CustomerStatsKey = 'cold' | 'inactive' | 'active' | 'all'
type CustomerStat = { count: number; orders: number; spent: number }

const customerStats = computed<Record<CustomerStatsKey, CustomerStat>>(() => {
  const initial: Record<CustomerStatsKey, CustomerStat> = {
    cold: { count: 0, orders: 0, spent: 0 },
    inactive: { count: 0, orders: 0, spent: 0 },
    active: { count: 0, orders: 0, spent: 0 },
    all: { count: 0, orders: 0, spent: 0 }
  }

  customers.value.forEach((customer) => {
    const temp = getCustomerTemperature(customer)
    const orders = Number(customer.total_orders) || 0
    const spent = Number(customer.total_spent) || 0

    initial[temp].count += 1
    initial[temp].orders += orders
    initial[temp].spent += spent

    initial.all.count += 1
    initial.all.orders += orders
    initial.all.spent += spent
  })

  return initial
})

const statusSummaryRows = computed(() => {
  const headings: Array<{ key: Exclude<CustomerStatsKey, 'active'>; label: string }> = [
    { key: 'all', label: 'Все клиенты' },
    { key: 'inactive', label: 'Пропавшие (>30 дней)' },
    { key: 'cold', label: 'Холодные (без заказов)' }
  ]

  return headings.map(({ key, label }) => {
    const stats = customerStats.value[key]
    return {
      key,
      label,
      count: stats?.count ?? 0,
      orders: stats?.orders ?? 0,
      spent: stats?.spent ?? 0
    }
  })
})

function resolveTimestamp(value?: string | null) {
  if (!value) return 0
  const ts = new Date(value).getTime()
  return Number.isNaN(ts) ? 0 : ts
}

const displayedCustomers = computed(() => {
  const items = customers.value.filter((customer) => showActiveCustomers.value || getCustomerTemperature(customer) !== 'active')

  return items.sort((a, b) => {
    const aValue = getSortValue(a, sortKey.value)
    const bValue = getSortValue(b, sortKey.value)

    let result: number

    if (typeof aValue === 'string' || typeof bValue === 'string') {
      result = String(aValue).localeCompare(String(bValue), 'ru', { sensitivity: 'base' })
    } else {
      result = Number(aValue) - Number(bValue)
    }

    if (result === 0 && sortKey.value !== 'last_visit_at') {
      const fallback = resolveTimestamp(a.last_visit_at) - resolveTimestamp(b.last_visit_at)
      result = fallback
    }

    return sortDirection.value === 'asc' ? result : -result
  })
})

function getSortValue(customer: Customer, key: SortKey): string | number {
  switch (key) {
    case 'name':
      return `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim().toLocaleLowerCase('ru')
    case 'total_orders':
      return Number(customer.total_orders) || 0
    case 'total_spent':
      return Number(customer.total_spent) || 0
    case 'last_order_at':
      return resolveTimestamp(customer.last_order_at)
    case 'last_visit_at':
      return resolveTimestamp(customer.last_visit_at)
    default:
      return 0
  }
}

function sortHeaderClass(key: SortKey) {
  return [
    sortKey.value === key ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700',
    'cursor-pointer select-none'
  ]
}

function sortIndicator(key: SortKey) {
  if (sortKey.value === key) {
    return sortDirection.value === 'asc' ? '▲' : '▼'
  }
  return '⇅'
}

function sortIndicatorClass(key: SortKey) {
  return sortKey.value === key ? 'text-blue-600' : 'text-gray-400'
}

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDirection.value = key === 'name' ? 'asc' : 'desc'
  }
}

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
