<template>
  <div class="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
    <div class="mx-auto w-full max-w-7xl space-y-8">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 sm:text-3xl">Клиенты</h1>
        <p class="mt-2 text-sm text-gray-600 sm:text-base">Работа с пропавшими клиентами</p>
      </div>

      <!-- Tabs -->
      <div class="flex flex-wrap gap-2">
        <button @click="activeTab = 'inactive'" :class="tabButtonClass('inactive')">
          Не заказывали более 45 дней
        </button>
        <button @click="activeTab = 'processed'" :class="tabButtonClass('processed')">
          Обработанные
        </button>
        <button @click="activeTab = 'all'" :class="tabButtonClass('all')">
          Все клиенты
        </button>
        <button @click="activeTab = 'blocked'" :class="tabButtonClass('blocked')">
          Заблокированные
          <span
            v-if="blockedTotalCount > 0"
            class="ml-1 inline-flex items-center justify-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600"
          >
            {{ blockedTotalCount }}
          </span>
        </button>
      </div>


      <div v-if="loading" class="text-center py-12">
        <div class="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        <p class="mt-4 text-gray-600">Загрузка...</p>
      </div>

      <template v-else>
        <!-- Inactive Customers (>45 days) -->
        <div v-if="activeTab === 'inactive'" class="space-y-4">
          <div v-if="inactiveCustomers.length > 0" class="rounded-lg bg-white shadow-sm">
            <div class="overflow-x-auto">
              <table class="w-full min-w-[600px]">
                <thead class="bg-gray-50 border-b">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Имя</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дней назад</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr v-for="customer in inactiveCustomers" :key="customer.id" class="hover:bg-gray-50">
                    <td class="px-6 py-4">
                      <a
                        v-if="customer.telegram_username"
                        :href="`https://t.me/${customer.telegram_username}`"
                        target="_blank"
                        class="text-blue-600 hover:text-blue-900 text-sm font-medium"
                      >
                        @{{ customer.telegram_username }}
                      </a>
                      <span v-else class="text-sm text-gray-400">Нет username</span>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-900">
                      {{ customer.first_name || 'Без имени' }} {{ customer.last_name || '' }}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                      {{ getDaysSinceLastOrder(customer) }} дн.
                    </td>
                    <td class="px-6 py-4 text-right">
                      <button
                        @click="openFeedbackModal(customer)"
                        class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                      >
                        Обработан
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div v-else class="text-center py-12 bg-white rounded-lg shadow-sm">
            <p class="text-gray-600">Нет клиентов, не заказывавших более 45 дней</p>
          </div>
        </div>

        <!-- Processed Customers -->
        <div v-if="activeTab === 'processed'" class="space-y-6">
          <div v-if="groupedFeedbacks.length > 0">
            <div v-for="group in groupedFeedbacks" :key="group.date" class="mb-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-3">{{ group.date }}</h3>
              <div class="bg-white rounded-lg shadow-sm divide-y divide-gray-200">
                <div v-for="feedback in group.items" :key="feedback.id" class="p-6">
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="flex items-center gap-3 mb-2">
                        <span class="text-sm font-medium text-gray-900">username клиента</span>
                        <a
                          v-if="feedback.telegram_username"
                          :href="`https://t.me/${feedback.telegram_username}`"
                          target="_blank"
                          class="text-blue-600 hover:text-blue-900 text-sm"
                        >
                          @{{ feedback.telegram_username }}
                        </a>
                      </div>
                      <div class="text-sm text-gray-500 mb-3">
                        {{ feedback.customer_name || 'Без имени' }}
                      </div>
                      <div class="text-sm text-gray-700 bg-gray-50 rounded p-3">
                        <span class="font-medium">итог:</span> {{ feedback.reason }}
                      </div>
                    </div>
                    <button
                      @click="openDeleteFeedbackModal(feedback)"
                      class="ml-4 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Удалить запись"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-12 bg-white rounded-lg shadow-sm">
            <p class="text-gray-600">Нет обработанных клиентов</p>
          </div>
        </div>

        <!-- All Customers with Search -->
        <div v-if="activeTab === 'all'" class="space-y-4">
          <div class="bg-white rounded-lg shadow-sm p-4">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Поиск по username..."
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div v-if="filteredAllCustomers.length > 0" class="rounded-lg bg-white shadow-sm">
            <div class="overflow-x-auto">
              <table class="w-full min-w-[720px]">
                <thead class="bg-gray-50 border-b">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Имя</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Заказов</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Последний заказ</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr v-for="customer in filteredAllCustomers" :key="customer.id" class="hover:bg-gray-50">
                    <td class="px-6 py-4">
                      <a
                        v-if="customer.telegram_username"
                        :href="`https://t.me/${customer.telegram_username}`"
                        target="_blank"
                        class="text-blue-600 hover:text-blue-900 text-sm"
                      >
                        @{{ customer.telegram_username }}
                      </a>
                      <span v-else class="text-sm text-gray-400">Нет username</span>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-900">
                      {{ customer.first_name || 'Без имени' }} {{ customer.last_name || '' }}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-900">{{ customer.total_orders }}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                      {{ customer.last_order_at ? formatDate(customer.last_order_at) : 'Никогда' }}
                    </td>
                    <td class="px-6 py-4 text-right">
                      <div class="flex items-center justify-end gap-2">
                        <button
                          v-if="!customer.blocked_count"
                          @click="openBlockModal(customer)"
                          class="px-3 py-1 bg-red-50 text-red-600 text-sm font-medium rounded hover:bg-red-100"
                        >
                          Блокировать
                        </button>
                        <button
                          v-else
                          @click="unblockCustomer(customer)"
                          class="px-3 py-1 bg-green-50 text-green-600 text-sm font-medium rounded hover:bg-green-100"
                        >
                          Разблокировать
                        </button>
                        <button
                          @click="openDeleteCustomerModal(customer)"
                          class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Удалить клиента"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
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
        </div>

        <!-- Blocked customers (active + pending) -->
        <div v-if="activeTab === 'blocked'" class="space-y-4">
          <div v-if="loadingBlocks" class="text-center py-12 bg-white rounded-lg shadow-sm">
            <p class="text-gray-600">Загрузка списка блокировок…</p>
          </div>
          <template v-else>
            <!-- Активные блокировки -->
            <div class="rounded-lg bg-white shadow-sm overflow-hidden">
              <div class="px-6 py-3 bg-gray-50 border-b text-sm font-semibold text-gray-700">
                Активные блокировки ({{ blocksList.active.length }})
              </div>
              <div v-if="blocksList.active.length === 0" class="px-6 py-8 text-center text-sm text-gray-500">
                Нет активных блокировок
              </div>
              <table v-else class="w-full min-w-[720px]">
                <thead class="bg-gray-50 border-b">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Клиент</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Причина</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Истекает</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Кто заблокировал</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr v-for="block in blocksList.active" :key="block.id" class="hover:bg-gray-50">
                    <td class="px-6 py-4">
                      <a
                        v-if="block.customer?.telegram_username"
                        :href="`https://t.me/${block.customer.telegram_username}`"
                        target="_blank"
                        class="text-blue-600 hover:text-blue-900 text-sm"
                      >
                        @{{ block.customer.telegram_username }}
                      </a>
                      <span v-else class="text-sm text-gray-500">
                        {{ block.customer?.first_name || 'Без username' }}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-700 max-w-xs truncate" :title="block.reason || ''">
                      {{ block.reason || '—' }}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                      {{ block.block_until ? formatBlockUntil(block.block_until) : 'Бессрочно' }}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">{{ block.blocked_by || '—' }}</td>
                    <td class="px-6 py-4 text-right">
                      <button
                        :disabled="removingBlockId === block.id"
                        @click="handleUnblock(block.id)"
                        class="px-3 py-1 bg-green-50 text-green-600 text-sm font-medium rounded hover:bg-green-100 disabled:opacity-50"
                      >
                        {{ removingBlockId === block.id ? 'Снимаем…' : 'Разблокировать' }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pending (превентивные баны) -->
            <div class="rounded-lg bg-white shadow-sm overflow-hidden">
              <div class="px-6 py-3 bg-gray-50 border-b text-sm font-semibold text-gray-700">
                Превентивные баны ({{ blocksList.pending.length }})
                <span class="ml-2 text-xs font-normal text-gray-500">
                  активируются при первом заходе клиента в миниапку
                </span>
              </div>
              <div v-if="blocksList.pending.length === 0" class="px-6 py-8 text-center text-sm text-gray-500">
                Нет превентивных банов
              </div>
              <table v-else class="w-full min-w-[640px]">
                <thead class="bg-gray-50 border-b">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">@username</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Причина</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Истекает</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Создан</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr v-for="pb in blocksList.pending" :key="`p-${pb.id}`" class="hover:bg-gray-50">
                    <td class="px-6 py-4 text-sm text-gray-900">@{{ pb.telegram_username }}</td>
                    <td class="px-6 py-4 text-sm text-gray-700 max-w-xs truncate" :title="pb.reason || ''">
                      {{ pb.reason || '—' }}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                      {{ pb.block_until ? formatBlockUntil(pb.block_until) : 'Бессрочно' }}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">{{ formatDate(pb.blocked_at) }}</td>
                    <td class="px-6 py-4 text-right">
                      <button
                        :disabled="removingBlockId === String(pb.id)"
                        @click="handleUnblock(pb.id)"
                        class="px-3 py-1 bg-green-50 text-green-600 text-sm font-medium rounded hover:bg-green-100 disabled:opacity-50"
                      >
                        {{ removingBlockId === String(pb.id) ? 'Удаляем…' : 'Отменить' }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>
      </template>
    </div>

    <!-- Feedback Modal -->
    <div
      v-if="showFeedbackModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4"
      @click.self="closeFeedbackModal"
    >
      <div class="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
        <h3 class="text-xl font-bold text-gray-900 mb-2">Какой итог?</h3>
        <p class="text-sm text-gray-600 mb-4">
          Оставьте обратную связь по поводу пропавшего клиента. Какова причина?
          Какая была обратная связь? И что было предложено чтобы он вернулся?
        </p>
        <textarea
          v-model="feedbackReason"
          rows="6"
          class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="напишите отчёт по клиенту..."
        ></textarea>
        <div class="mt-6 flex gap-3">
          <button
            @click="submitFeedback"
            :disabled="!feedbackReason.trim() || submittingFeedback"
            class="flex-1 rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{ submittingFeedback ? 'Сохранение...' : 'подтвердить и закрыть' }}
          </button>
          <button
            @click="closeFeedbackModal"
            class="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Feedback Modal -->
    <div
      v-if="showDeleteFeedbackModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4"
      @click.self="showDeleteFeedbackModal = false"
    >
      <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 class="text-xl font-semibold text-gray-900 mb-2">Удалить запись?</h3>
        <p class="text-sm text-gray-600 mb-4">
          Эта запись обратной связи будет удалена, и клиент снова появится 
          в списке "Не заказывали более 45 дней".
        </p>
        <div class="mt-6 flex gap-3">
          <button
            @click="confirmDeleteFeedback"
            :disabled="deletingFeedback"
            class="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {{ deletingFeedback ? 'Удаление...' : 'Удалить' }}
          </button>
          <button
            @click="showDeleteFeedbackModal = false"
            class="flex-1 rounded-lg border border-gray-200 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Customer Modal -->
    <div
      v-if="showDeleteCustomerModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4"
      @click.self="showDeleteCustomerModal = false"
    >
      <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 class="text-xl font-semibold text-gray-900 mb-2">Удалить клиента?</h3>
        <p class="text-sm text-gray-600 mb-2">
          Вы уверены, что хотите удалить клиента?
        </p>
        <div v-if="customerToDelete" class="bg-gray-50 rounded p-3 mb-4 text-sm">
          <p class="font-medium text-gray-900">{{ customerToDelete.first_name || 'Без имени' }} {{ customerToDelete.last_name || '' }}</p>
          <p class="text-gray-600">@{{ customerToDelete.telegram_username || 'без username' }}</p>
        </div>
        <p class="text-sm text-red-600 mb-4">
          Это действие необратимо!
        </p>
        <div class="flex gap-3">
          <button
            @click="confirmDeleteCustomer"
            :disabled="deletingCustomer"
            class="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {{ deletingCustomer ? 'Удаление...' : 'Удалить' }}
          </button>
          <button
            @click="showDeleteCustomerModal = false"
            class="flex-1 rounded-lg border border-gray-200 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>

    <!-- Block Modal -->
    <div
      v-if="showBlockModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4"
      @click.self="showBlockModal = false"
    >
      <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 class="text-xl font-semibold text-gray-900 mb-2">Блокировка доставки</h3>
        <p class="text-sm text-gray-500 mb-4">Укажите причину блокировки для клиента.</p>
        <textarea
          v-model="blockReason"
          rows="3"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          placeholder="Причина блокировки..."
        ></textarea>
        <div class="mt-4 flex gap-3">
          <button
            @click="confirmBlock"
            :disabled="blockingInProgress"
            class="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {{ blockingInProgress ? 'Блокируем...' : 'Заблокировать' }}
          </button>
          <button
            @click="showBlockModal = false"
            class="flex-1 rounded-lg border border-gray-200 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useCrmStore } from '@/stores/crm'
import { storeToRefs } from 'pinia'
import type { Customer, CustomerFeedback } from '@/stores/crm'

const crmStore = useCrmStore()
const {
  customers,
  loadingCustomers,
  customerFeedbacks,
  loadingCustomerFeedbacks,
  customerBlocksList,
  loadingCustomerBlocks,
} = storeToRefs(crmStore)

const activeTab = ref<'inactive' | 'processed' | 'all' | 'blocked'>('inactive')

// Список блокировок (active + pending) — для таба «Заблокированные»
const blocksList = computed(() => customerBlocksList.value)
const loadingBlocks = computed(() => loadingCustomerBlocks.value)
const blockedTotalCount = computed(
  () => blocksList.value.active.length + blocksList.value.pending.length,
)
const removingBlockId = ref<string | null>(null)

// Реактивно подгружаем при переключении на таб
watch(activeTab, (tab) => {
  if (tab === 'blocked') {
    crmStore.fetchCustomerBlocksList().catch((err) => {
      console.error('[crm-customers] failed to load blocks list', err)
    })
  }
})

async function handleUnblock(blockId: string | number) {
  const id = String(blockId)
  if (removingBlockId.value === id) return
  removingBlockId.value = id
  try {
    await crmStore.removeCustomerBlock(blockId)
    await crmStore.fetchCustomerBlocksList()
  } catch (err: any) {
    console.error('[crm-customers] unblock failed', err)
     
    window.alert(err?.message || 'Не удалось снять блок')
  } finally {
    removingBlockId.value = null
  }
}

function formatBlockUntil(iso: string) {
  // Backend хранит TEXT в SQLite UTC формате 'YYYY-MM-DD HH:MM:SS'.
  // В JS new Date('YYYY-MM-DD HH:MM:SS') парсится как локальное время,
  // поэтому добавляем 'Z' чтобы интерпретировать как UTC.
  const normalized = iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z'
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
const showBlockModal = ref(false)
const showFeedbackModal = ref(false)
const showDeleteFeedbackModal = ref(false)
const showDeleteCustomerModal = ref(false)
const blockReason = ref('')
const feedbackReason = ref('')
const customerToBlock = ref<Customer | null>(null)
const customerToProcess = ref<Customer | null>(null)
const customerToDelete = ref<Customer | null>(null)
const feedbackToDelete = ref<CustomerFeedback | null>(null)
const blockingInProgress = ref(false)
const submittingFeedback = ref(false)
const deletingFeedback = ref(false)
const deletingCustomer = ref(false)
const searchQuery = ref('')
const loading = computed(() => loadingCustomers.value || loadingCustomerFeedbacks.value)

type InactiveCustomer = Customer

function getDaysSinceLastOrder(c: Customer) {
  if (!c.last_order_at) return 9999
  const lastOrder = new Date(c.last_order_at).getTime()
  return Math.floor((Date.now() - lastOrder) / (1000 * 60 * 60 * 24))
}

const inactiveCustomers = computed<InactiveCustomer[]>(() => {
  const processedCustomerIds = new Set(
    customerFeedbacks.value.map((f) => f.customer_id)
  )
  return customers.value
    .filter((c) => Boolean(c.last_order_at))
    .filter((c) => getDaysSinceLastOrder(c) >= 45)
    .filter((c) => !processedCustomerIds.has(c.id))
    .sort((a, b) => getDaysSinceLastOrder(b) - getDaysSinceLastOrder(a))
})

const filteredAllCustomers = computed(() => {
  // В UI username отображается с префиксом "@", в БД хранится без него.
  // Принимаем обе формы запроса: "@polizhzw" и "polizhzw".
  const q = searchQuery.value.trim().toLowerCase().replace(/^@+/, '')
  const list = customers.value
  if (!q) return list
  return list.filter((c) => (c.telegram_username || '').toLowerCase().includes(q))
})

const groupedFeedbacks = computed(() => {
  const groups: Record<string, CustomerFeedback[]> = {}
  for (const item of customerFeedbacks.value) {
    const d = new Date(item.processed_at || item.created_at)
    const label = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    if (!groups[label]) groups[label] = []
    groups[label].push(item)
  }
  return Object.entries(groups).map(([date, items]) => ({ date, items }))
})

function tabButtonClass(tab: 'inactive' | 'processed' | 'all' | 'blocked') {
  return [
    'w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:w-auto',
    activeTab.value === tab ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
  ]
}

function openBlockModal(customer: Customer) {
  customerToBlock.value = customer
  blockReason.value = ''
  showBlockModal.value = true
}

async function confirmBlock() {
  if (!customerToBlock.value || blockingInProgress.value) return
  try {
    blockingInProgress.value = true
    await crmStore.blockCustomer(customerToBlock.value.id, blockReason.value)
    showBlockModal.value = false
    await crmStore.fetchCustomers()
  } catch (e) {
    alert('Ошибка блокировки')
  } finally {
    blockingInProgress.value = false
  }
}

async function unblockCustomer(customer: Customer) {
  if (!confirm('Разблокировать доставку для этого клиента?')) return
  await crmStore.unblockCustomer(customer.id)
  await crmStore.fetchCustomers()
}

function openFeedbackModal(customer: Customer) {
  customerToProcess.value = customer
  feedbackReason.value = ''
  showFeedbackModal.value = true
}

function closeFeedbackModal() {
  showFeedbackModal.value = false
  customerToProcess.value = null
}

async function submitFeedback() {
  if (!customerToProcess.value || !feedbackReason.value.trim()) return
  submittingFeedback.value = true
  try {
    await crmStore.createCustomerFeedback({
      customer_id: customerToProcess.value.id,
      reason: feedbackReason.value.trim()
    })
    showFeedbackModal.value = false
    await Promise.all([crmStore.fetchCustomerFeedbacks(), crmStore.fetchCustomers()])
  } catch (e) {
    alert('Не удалось сохранить итог')
  } finally {
    submittingFeedback.value = false
  }
}

function openDeleteFeedbackModal(feedback: CustomerFeedback) {
  feedbackToDelete.value = feedback
  showDeleteFeedbackModal.value = true
}

async function confirmDeleteFeedback() {
  if (!feedbackToDelete.value || deletingFeedback.value) return
  deletingFeedback.value = true
  try {
    await crmStore.deleteCustomerFeedback(feedbackToDelete.value.id)
    await crmStore.fetchCustomerFeedbacks()
    showDeleteFeedbackModal.value = false
    feedbackToDelete.value = null
  } catch (e) {
    alert('Не удалось удалить запись')
  } finally {
    deletingFeedback.value = false
  }
}

function openDeleteCustomerModal(customer: Customer) {
  customerToDelete.value = customer
  showDeleteCustomerModal.value = true
}

async function confirmDeleteCustomer() {
  if (!customerToDelete.value || deletingCustomer.value) return
  deletingCustomer.value = true
  try {
    await crmStore.deleteCustomer(customerToDelete.value.id)
    await crmStore.fetchCustomers()
    showDeleteCustomerModal.value = false
    customerToDelete.value = null
  } catch (e) {
    alert('Не удалось удалить клиента')
  } finally {
    deletingCustomer.value = false
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

onMounted(() => {
  void Promise.all([crmStore.fetchCustomers(), crmStore.fetchCustomerFeedbacks()])
})
</script>
