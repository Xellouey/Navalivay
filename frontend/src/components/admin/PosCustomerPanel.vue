<template>
  <div class="pos-customer-panel">
    <!-- Selected customer summary -->
    <div v-if="modelValue" class="pos-customer-selected">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="text-xs uppercase tracking-wide text-gray-500">Клиент чека</p>
          <p class="text-sm font-semibold text-gray-900 truncate">
            {{ formatCustomerName(modelValue) }}
          </p>
          <p v-if="modelValue.phone" class="text-xs text-gray-600">
            {{ modelValue.phone }}
          </p>
          <p v-if="modelValue.telegram_username" class="text-xs text-blue-600">
            @{{ modelValue.telegram_username }}
          </p>
          <p
            v-if="modelValue.blocked_count && modelValue.blocked_count > 0"
            class="mt-1 inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-700"
          >
            ⚠ Клиент заблокирован
          </p>
        </div>
        <button
          type="button"
          class="text-xs text-red-500 hover:text-red-700 font-medium"
          @click="$emit('update:modelValue', null)"
          aria-label="Открепить клиента"
        >
          ✕
        </button>
      </div>

      <!-- История покупок (компактная) -->
      <div class="mt-3 border-t border-gray-100 pt-2">
        <div class="flex items-center justify-between mb-1">
          <p class="text-xs uppercase tracking-wide text-gray-500">История</p>
          <span class="text-xs text-gray-500">
            {{ historyLoading ? '…' : `${history.length} покупок` }}
          </span>
        </div>
        <ul v-if="history.length" class="space-y-1 max-h-40 overflow-y-auto">
          <li
            v-for="item in history.slice(0, 8)"
            :key="`${item.source}-${item.id}`"
            class="text-xs flex items-center justify-between gap-2"
          >
            <span class="truncate">
              <span
                class="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
                :class="item.source === 'pos' ? 'bg-amber-400' : 'bg-blue-500'"
              />
              {{ formatHistoryDate(item.created_at) }}
            </span>
            <span class="font-medium text-gray-900 whitespace-nowrap">
              {{ formatAmount(item.amount) }} BYN
            </span>
          </li>
        </ul>
        <p v-else-if="!historyLoading" class="text-xs text-gray-400">
          Покупок ещё нет — это первый чек.
        </p>
      </div>
    </div>

    <!-- Search + add (когда клиент не выбран) -->
    <div v-else>
      <label class="block text-sm font-medium text-gray-700 mb-2">Клиент чека</label>
      <div class="relative">
        <MagnifyingGlassIcon class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Имя или телефон…"
          class="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200"
        />
      </div>

      <!-- Search results -->
      <div v-if="searchQuery" class="mt-2 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white">
        <div v-if="searching" class="px-3 py-2 text-xs text-gray-500">Ищем…</div>
        <ul v-else-if="searchResults.length">
          <li
            v-for="customer in searchResults"
            :key="customer.id"
            class="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer border-b last:border-b-0 border-gray-100"
            @click="selectCustomer(customer)"
          >
            <div class="font-medium text-gray-900">{{ formatCustomerName(customer) }}</div>
            <div class="flex items-center gap-2 text-xs text-gray-500">
              <span v-if="customer.phone">{{ customer.phone }}</span>
              <span v-if="customer.telegram_username" class="text-blue-600">@{{ customer.telegram_username }}</span>
            </div>
          </li>
        </ul>
        <div v-else class="px-3 py-2 text-xs text-gray-500">
          Никого не нашли — добавьте нового
        </div>
      </div>

      <button
        type="button"
        class="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        @click="openCreateModal"
      >
        <PlusIcon class="h-4 w-4" />
        + Добавить клиента
      </button>
    </div>

    <!-- Inline-баннер «слили с существующим клиентом» (вместо window.alert) -->
    <Transition name="fade">
      <div
        v-if="mergeBanner"
        class="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800"
      >
        {{ mergeBanner }}
      </div>
    </Transition>

    <!-- Modal: создать клиента -->
    <Transition name="fade">
      <div
        v-if="showCreateModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-customer-modal-title"
        tabindex="-1"
        class="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 px-4"
        @click.self="closeCreateModal"
        @keydown.esc="closeCreateModal"
      >
        <div class="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
          <h3 id="pos-customer-modal-title" class="text-lg font-semibold text-gray-900 mb-3">Новый клиент кассы</h3>
          <form class="space-y-3" @submit.prevent="submitCreate">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Имя (или Имя Фамилия)</label>
              <input
                ref="newNameInputRef"
                v-model.trim="newName"
                type="text"
                placeholder="Иван Петров"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200"
                required
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Телефон</label>
              <input
                v-model.trim="newPhone"
                type="tel"
                placeholder="+375 33 123-45-67"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200"
                required
              />
              <p class="text-xs text-gray-500 mt-1">
                Если такой телефон уже есть в базе — мы привяжем чек к существующему клиенту.
              </p>
            </div>
            <div v-if="createError" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {{ createError }}
            </div>
            <div class="flex gap-2 pt-1">
              <button
                type="submit"
                :disabled="creating || !newName || !newPhone"
                class="flex-1 rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ creating ? 'Сохраняем…' : 'Сохранить' }}
              </button>
              <button
                type="button"
                class="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                @click="closeCreateModal"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/vue/24/outline'
import { useCrmStore, type Customer } from '@/stores/crm'

const props = defineProps<{
  /** Текущий выбранный клиент (v-model) — null когда не выбран. */
  modelValue: Customer | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', customer: Customer | null): void
}>()

const crmStore = useCrmStore()

const searchQuery = ref('')
const searchResults = ref<Customer[]>([])
const searching = ref(false)
let searchDebounce: ReturnType<typeof setTimeout> | null = null
// Sequence number защищает от race условия: быстрая печать может вызвать 2-3
// fetch'а одновременно, медленный (старый) запрос может приземлиться позже
// быстрого (нового) и затереть актуальный результат. Игнорируем устаревшие.
let searchSeq = 0

// Debounce поиска: иначе на каждый символ дёргаем backend.
watch(searchQuery, (q) => {
  if (searchDebounce !== null) clearTimeout(searchDebounce)
  if (!q.trim()) {
    searchResults.value = []
    searching.value = false
    return
  }
  searching.value = true
  const my = ++searchSeq
  searchDebounce = setTimeout(async () => {
    try {
      const items = await crmStore.searchCustomersForPos(q, 10)
      if (my !== searchSeq) return // устаревший ответ — игнорим
      searchResults.value = items
    } catch (err) {
      if (my !== searchSeq) return
      console.error('[pos-customer] search failed', err)
      searchResults.value = []
    } finally {
      if (my === searchSeq) searching.value = false
    }
  }, 250)
})

onBeforeUnmount(() => {
  if (searchDebounce !== null) {
    clearTimeout(searchDebounce)
    searchDebounce = null
  }
  if (mergeBannerTimer !== null) {
    clearTimeout(mergeBannerTimer)
    mergeBannerTimer = null
  }
})

function selectCustomer(customer: Customer) {
  emit('update:modelValue', customer)
  searchQuery.value = ''
  searchResults.value = []
}

// Создание нового клиента
const showCreateModal = ref(false)
const newName = ref('')
const newPhone = ref('')
const createError = ref('')
const creating = ref(false)
const newNameInputRef = ref<HTMLInputElement | null>(null)
const mergeBanner = ref('')
let mergeBannerTimer: ReturnType<typeof setTimeout> | null = null

function openCreateModal() {
  newName.value = ''
  // Если в поле поиска была цифра — предзаполняем телефон
  newPhone.value = /\d/.test(searchQuery.value) ? searchQuery.value : ''
  createError.value = ''
  showCreateModal.value = true
  nextTick(() => newNameInputRef.value?.focus())
}

function closeCreateModal() {
  if (creating.value) return
  showCreateModal.value = false
}

async function submitCreate() {
  if (creating.value) return
  creating.value = true
  createError.value = ''
  try {
    const result = await crmStore.createPosCustomer({
      name: newName.value,
      phone: newPhone.value,
    })
    emit('update:modelValue', result.customer)
    showCreateModal.value = false
    if (result.merged) {
      // Inline-баннер вместо window.alert — не блокирует интерфейс кассы.
      mergeBanner.value =
        `Этот телефон уже был в базе — привязали к: ${formatCustomerName(result.customer)}`
      if (mergeBannerTimer !== null) clearTimeout(mergeBannerTimer)
      mergeBannerTimer = setTimeout(() => { mergeBanner.value = '' }, 6000)
    }
  } catch (err: any) {
    if (err?.message === 'phone_invalid') {
      createError.value = 'Введите корректный телефон (10–15 цифр)'
    } else if (err?.message === 'name_required') {
      createError.value = 'Имя обязательно'
    } else {
      createError.value = err?.message || 'Не удалось сохранить клиента'
    }
  } finally {
    creating.value = false
  }
}

// История покупок выбранного клиента
const history = ref<
  Array<{ id: string; source: 'order' | 'pos'; amount: number; created_at: string }>
>([])
const historyLoading = ref(false)
let historySeq = 0

watch(
  () => props.modelValue?.id ?? null,
  async (customerId) => {
    const my = ++historySeq
    if (!customerId) {
      history.value = []
      return
    }
    historyLoading.value = true
    try {
      const items = await crmStore.fetchCustomerPurchaseHistory(customerId, 30)
      if (my !== historySeq) return // быстро переключили клиента — игнорим устаревший ответ
      history.value = items as typeof history.value
    } catch (err) {
      if (my !== historySeq) return
      console.error('[pos-customer] history failed', err)
      history.value = []
    } finally {
      if (my === historySeq) historyLoading.value = false
    }
  },
  { immediate: true },
)

function formatCustomerName(c: Customer): string {
  const parts = [c.first_name, c.last_name].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : c.telegram_username ? `@${c.telegram_username}` : 'Без имени'
}

function formatHistoryDate(iso: string): string {
  // Синхронно с server/utils/pos-customers.js:parseDbTimestamp — оба формата
  // datetime в БД нормализуем под UTC: 'YYYY-MM-DD HH:MM:SS' (без Z) и
  // 'YYYY-MM-DDTHH:MM:SS.sssZ' (уже UTC). Используем endsWith('Z') как
  // признак уже-UTC формата.
  const normalized = iso.endsWith('Z') ? iso : iso.replace(' ', 'T') + 'Z'
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}

function formatAmount(value: number | null | undefined): string {
  if (value == null) return '—'
  return Number(value).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
</script>

<style scoped>
.pos-customer-panel {
  font-size: 14px;
}

.pos-customer-selected {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
