<template>
  <div class="min-h-screen bg-gray-50 p-6">
    <div class="mx-auto max-w-6xl space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <button @click="$router.back()" class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Назад к заказам
        </button>
        <div class="flex flex-wrap items-center gap-2">
          <button
            v-if="currentOrder && !loading"
            @click="refreshOrder"
            class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
            :disabled="isSaving"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Обновить
          </button>
          <button
            v-if="currentOrder && currentOrder.telegram_username"
            @click="contactClient"
            class="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
            :disabled="isGeneratingMessage"
          >
            <svg v-if="isGeneratingMessage" class="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>{{ isGeneratingMessage ? 'Генерируем…' : 'Связаться с клиентом' }}</span>
          </button>
          <button
            v-if="canRemovePayment"
            @click="removePayment"
            class="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            :disabled="isSaving || deletingPayment"
          >
            <svg v-if="deletingPayment" class="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span v-else>Отменить оплату</span>
            <span v-if="deletingPayment">Удаляем…</span>
          </button>
          <button
            v-if="canReactivate"
            @click="reactivateOrder"
            class="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
            :disabled="isSaving || reactivating"
          >
            <svg v-if="reactivating" class="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span v-else>Возобновить заказ</span>
          </button>
          <button
            v-if="currentOrder"
            @click="resetForm"
            class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
            :disabled="isSaving"
          >
            Сбросить изменения
          </button>
          <button
            @click="saveChanges"
            class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            :disabled="!canSave"
          >
            <svg v-if="isSaving" class="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{{ isSaving ? 'Сохраняем…' : 'Сохранить изменения' }}</span>
          </button>
        </div>
      </div>

      <div v-if="loading || !currentOrder" class="rounded-2xl bg-white p-12 text-center shadow-sm">
        <div class="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-r-transparent"></div>
        <p class="mt-4 text-sm text-gray-600">Загружаем заказ…</p>
      </div>

      <div v-else class="space-y-6">
        <section class="rounded-2xl bg-white p-6 shadow-sm">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 class="text-2xl font-bold text-gray-900">Заказ #{{ currentOrder.order_number }}</h1>
              <p class="mt-1 text-sm text-gray-500">Создан {{ formatFullDate(currentOrder.created_at) }}</p>
              <p class="mt-2 text-sm text-gray-700">
                Клиент: <span class="font-semibold text-gray-900">{{ currentOrder.customer_name || 'Гость' }}</span>
              </p>
              <p v-if="currentOrder.phone" class="text-sm text-gray-600">Телефон: {{ currentOrder.phone }}</p>
              <p v-if="currentOrder.telegram_username" class="text-sm text-blue-600">
                <a :href="`https://t.me/${currentOrder.telegram_username}`" target="_blank" class="hover:underline">@{{ currentOrder.telegram_username }}</a>
              </p>
            </div>
            <div class="text-right">
              <span :class="statusBadgeClass(editableStatus)" class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide">{{ statusLabel(editableStatus, deliveryType) }}</span>
              <div v-if="hasPayment" class="mt-2 text-sm text-emerald-600">
                Оплачено: {{ formatCurrency(currentOrder.paid_amount || 0) }}
                <div class="text-xs text-gray-500">{{ paymentDescription }}</div>
              </div>
            </div>
          </div>

          <div class="mt-6 grid gap-4 md:grid-cols-2">
            <label class="flex flex-col gap-2 text-sm font-medium text-gray-700">
              Статус заказа
              <select
                v-model="editableStatus"
                class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option v-for="option in statusOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
            </label>
            <div class="flex flex-col gap-2 text-sm text-gray-600">
              <span class="font-medium text-gray-700">Тип отдачи</span>
              <div class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {{ deliveryLabel }}
              </div>
            </div>
            <label v-if="deliveryType === 'delivery'" class="md:col-span-2 flex flex-col gap-2 text-sm font-medium text-gray-700">
              Адрес доставки
              <textarea
                v-model="form.deliveryAddress"
                rows="2"
                class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="Улица, дом, подъезд, комментарии"
              />
            </label>
            <label class="md:col-span-2 flex flex-col gap-2 text-sm font-medium text-gray-700">
              Комментарий менеджера
              <textarea
                v-model="form.notes"
                rows="3"
                class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="Примечания по заказу, способу оплаты и т.д."
              />
            </label>
          </div>
        </section>

        <section class="rounded-2xl bg-white p-6 shadow-sm">
          <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 class="text-xl font-semibold text-gray-900">Позиции заказа</h2>
              <p class="text-sm text-gray-500">Редактируйте количество, цены и добавляйте новые товары.</p>
            </div>
            <div class="w-full max-w-md">
              <label class="block text-sm font-medium text-gray-700">Добавить товар</label>
              <input
                v-model="productSearch"
                type="search"
                placeholder="Название, артикул или группа"
                class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <p v-if="showSearchHint" class="mt-1 text-xs text-gray-500">Для поиска введите минимум 2 символа.</p>
            </div>
          </div>

          <div v-if="isSearchingProducts" class="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
            Ищем товары…
          </div>
          <div v-else-if="searchError" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{{ searchError }}</div>
          <div v-else-if="productResults.length" class="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            <p class="mb-2 text-xs font-semibold uppercase text-gray-500">Найдено товаров</p>
            <ul class="space-y-2">
              <li v-for="product in productResults" :key="product.id" class="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
                <div>
                  <p class="font-medium text-gray-900">{{ product.title }}</p>
                  <p class="text-xs text-gray-500">
                    Остаток: {{ product.stock }}
                    <span v-if="product.groupName">· {{ product.groupName }}</span>
                  </p>
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-sm font-semibold text-gray-900">{{ formatCurrency(product.priceRub) }}</span>
                  <button
                    class="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-blue-700"
                    @click.prevent="addProduct(product)"
                  >
                    Добавить
                  </button>
                </div>
              </li>
            </ul>
          </div>

          <div class="mt-6 space-y-4">
            <div
              v-if="!form.items.length"
              class="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500"
            >
              Позиции заказа пока не добавлены. Найдите товар выше и добавьте его в список.
            </div>

            <article
              v-for="item in form.items"
              :key="item.productId"
              class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              :class="{
                'border-red-300 bg-red-50/40': item.quantity <= 0 || item.discount > item.price * item.quantity
              }"
            >
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p class="text-base font-semibold text-gray-900">{{ item.title }}</p>
                  <p class="text-xs text-gray-500">
                    Себестоимость: {{ formatCurrency(item.cost) }}
                    <span v-if="item.stock !== null && item.stock !== undefined" class="ml-2">Остаток: {{ item.stock }}</span>
                  </p>
                </div>
                <button
                  class="admin-link-button admin-link-button--danger"
                  @click="removeItem(item.productId)"
                >
                  Удалить
                </button>
              </div>

              <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label class="flex flex-col gap-1 text-xs font-medium text-gray-600">
                  Количество
                  <input
                    v-model.number="item.quantity"
                    type="number"
                    min="1"
                    class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    @blur="normalizeItem(item)"
                  />
                </label>
                <label class="flex flex-col gap-1 text-xs font-medium text-gray-600">
                  Цена, ₽
                  <input
                    v-model.number="item.price"
                    type="number"
                    min="0"
                    step="0.01"
                    class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    @blur="normalizeItem(item)"
                  />
                </label>
                <label class="flex flex-col gap-1 text-xs font-medium text-gray-600">
                  Скидка на позицию, ₽
                  <input
                    v-model.number="item.discount"
                    type="number"
                    min="0"
                    step="0.01"
                    class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    @blur="normalizeItem(item)"
                  />
                </label>
              </div>

              <div class="mt-3 flex flex-wrap items-center justify-between text-sm text-gray-600">
                <span>Всего: <span class="font-semibold text-gray-900">{{ formatCurrency(itemSubtotal(item)) }}</span></span>
                <span>Максимальная скидка: {{ formatCurrency(item.price * Math.max(item.quantity, 0)) }}</span>
              </div>
            </article>
          </div>
        </section>

        <section class="rounded-2xl bg-white p-6 shadow-sm">
          <div class="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
            <div class="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-5">
              <header class="flex items-center justify-between">
                <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-600">Финансовые итоги</h3>
                <span class="text-xs font-medium text-gray-400">Автоматический пересчет</span>
              </header>
              <dl class="space-y-3 text-sm text-gray-600">
                <div class="flex items-center justify-between">
                  <dt>Сумма позиций (без скидок)</dt>
                  <dd class="font-semibold text-gray-900">{{ formatCurrency(itemsSubtotal) }}</dd>
                </div>
                <div class="flex items-center justify-between">
                  <dt>Скидка ₽</dt>
                  <dd>
                    <input
                      v-model.number="form.discountAmount"
                      type="number"
                      min="0"
                      step="0.01"
                      class="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      @blur="normalizeDiscounts"
                    />
                  </dd>
                </div>
                <div class="flex items-center justify-between">
                  <dt>Скидка %</dt>
                  <dd>
                    <input
                      v-model.number="form.discountPercent"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      class="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      @blur="normalizeDiscounts"
                    />
                  </dd>
                </div>
                <div class="flex items-center justify-between border-t border-gray-200 pt-3 text-base font-semibold text-gray-900">
                  <dt>Итого к оплате</dt>
                  <dd>{{ formatCurrency(finalAmount) }}</dd>
                </div>
                <div class="flex items-center justify-between text-xs text-gray-500">
                  <dt>Ожидаемая прибыль</dt>
                  <dd>{{ formatCurrency(expectedProfit) }}</dd>
                </div>
              </dl>
            </div>
            <div class="space-y-3 text-sm text-gray-600">
              <div class="rounded-xl border border-gray-200 bg-white p-4">
                <p>
                  Номер заказа: <span class="font-medium text-gray-900">#{{ currentOrder.order_number }}</span>
                </p>
                <p>
                  Статус оплаты: <span class="font-medium" :class="hasPayment ? 'text-emerald-600' : 'text-gray-700'">
                    {{ hasPayment ? 'Оплачен' : 'Не оплачен' }}
                  </span>
                </p>
                <p v-if="currentOrder.completed_at">Выдан: {{ formatFullDate(currentOrder.completed_at) }}</p>
                <p v-if="currentOrder.employee_id" class="text-xs text-gray-500">ID сотрудника: {{ currentOrder.employee_id }}</p>
              </div>
              <div v-if="saveError" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{{ saveError }}</div>
              <div v-else-if="saveSuccess" class="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{{ saveSuccess }}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useCrmStore, type CrmProductSummary, type Order } from '@/stores/crm'

const props = defineProps<{ id: string }>()

type FormItem = {
  productId: string
  title: string
  quantity: number
  price: number
  discount: number
  cost: number
  stock?: number | null
}

const crmStore = useCrmStore()
const { currentOrder } = storeToRefs(crmStore)

const loading = ref(false)
const editableStatus = ref<Order['status']>('new')
const form = reactive({
  deliveryAddress: '',
  notes: '',
  discountAmount: 0,
  discountPercent: 0,
  items: [] as FormItem[]
})

const productSearch = ref('')
const productResults = ref<CrmProductSummary[]>([])
const isSearchingProducts = ref(false)
const searchError = ref('')

const isSaving = ref(false)
const saveError = ref('')
const saveSuccess = ref('')
const deletingPayment = ref(false)
const reactivating = ref(false)
const isGeneratingMessage = ref(false)

const statusOptions: Array<{ value: Order['status']; label: string }> = [
  { value: 'new', label: 'Новый' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'completed', label: 'Завершён' },
  { value: 'delivered', label: 'Выдан' },
  { value: 'cancelled', label: 'Отменён' }
]

const deliveryType = computed(() => currentOrder.value?.delivery_type ?? 'pickup')
const deliveryLabel = computed(() => (deliveryType.value === 'delivery' ? 'Доставка' : 'Самовывоз'))
const hasPayment = computed(() => {
  const paid = Number(currentOrder.value?.paid_amount ?? 0)
  return paid > 0
})
const paymentDescription = computed(() => {
  if (!currentOrder.value) return ''
  const account = currentOrder.value.payment_account_id ? `счёт ${currentOrder.value.payment_account_id}` : 'неизвестный счёт'
  return `${formatCurrency(currentOrder.value.paid_amount || 0)} · ${account}`
})

const itemsSubtotal = computed(() => {
  return form.items.reduce((sum, item) => sum + Math.max(item.price, 0) * Math.max(item.quantity, 0), 0)
})

const itemsCost = computed(() => {
  return form.items.reduce((sum, item) => sum + Math.max(item.cost, 0) * Math.max(item.quantity, 0), 0)
})

const finalAmount = computed(() => applyDiscounts(itemsSubtotal.value, form.discountAmount, form.discountPercent))
const expectedProfit = computed(() => Math.max(finalAmount.value - itemsCost.value, 0))

const hasChanges = computed(() => {
  if (!currentOrder.value) return false
  
  // Проверяем изменение статуса
  if (editableStatus.value !== currentOrder.value.status) return true
  
  // Проверяем изменение адреса доставки
  if (form.deliveryAddress !== (currentOrder.value.delivery_address || '')) return true
  
  // Проверяем изменение комментария
  if (form.notes !== (currentOrder.value.notes || '')) return true
  
  // Проверяем изменение скидок
  if (form.discountAmount !== Number(currentOrder.value.discount_amount || 0)) return true
  if (form.discountPercent !== Number(currentOrder.value.discount_percent || 0)) return true
  
  // Проверяем изменения в позициях
  const originalItems = currentOrder.value.items || []
  if (form.items.length !== originalItems.length) return true
  
  // Проверяем каждую позицию
  for (let i = 0; i < form.items.length; i++) {
    const formItem = form.items[i]
    const originalItem = originalItems.find(item => item.product_id === formItem.productId)
    if (!originalItem) return true
    
    if (formItem.quantity !== Number(originalItem.quantity || 0)) return true
    if (formItem.price !== Number(originalItem.price_per_unit || 0)) return true
    if (formItem.discount !== Number(originalItem.discount_amount || 0)) return true
  }
  
  return false
})

const canSave = computed(() => {
  if (isSaving.value) return false
  if (!hasChanges.value) return false
  
  // Если есть товары, проверяем их валидность
  if (form.items.length > 0 && !form.items.every(isItemValid)) return false
  
  return true
})

const canReactivate = computed(() => currentOrder.value?.status === 'cancelled')
const canRemovePayment = computed(() => hasPayment.value && !isSaving.value)

let searchTimer: ReturnType<typeof setTimeout> | null = null
let successTimer: ReturnType<typeof setTimeout> | null = null

watch(productSearch, (value) => {
  const query = value.trim()
  if (searchTimer) clearTimeout(searchTimer)
  
  if (!query) {
    productResults.value = []
    searchError.value = ''
    isSearchingProducts.value = false
    return
  }
  
  if (query.length < 2) {
    productResults.value = []
    searchError.value = ''
    isSearchingProducts.value = false
    return
  }
  
  searchTimer = setTimeout(() => loadProducts(query), 250)
})

watch(currentOrder, (order) => {
  if (order) {
    initializeForm(order)
  }
})

onMounted(() => {
  void refreshOrder()
})

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
  if (successTimer) clearTimeout(successTimer)
})

async function refreshOrder() {
  loading.value = true
  try {
    const order = await crmStore.fetchOrder(props.id)
    if (order) {
      initializeForm(order)
    }
  } finally {
    loading.value = false
  }
}

function initializeForm(order: Order) {
  editableStatus.value = order.status
  form.deliveryAddress = order.delivery_address || ''
  form.notes = order.notes || ''
  form.discountAmount = Number(order.discount_amount || 0)
  form.discountPercent = Number(order.discount_percent || 0)
  form.items = (order.items || [])
    .filter((item) => !!item.product_id)
    .map((item) => ({
      productId: item.product_id as string,
      title: item.product_title,
      quantity: Number(item.quantity || 0),
      price: Number(item.price_per_unit || 0),
      discount: Number(item.discount_amount || 0),
      cost: Number(item.cost_per_unit || 0),
      stock: null
    }))
  productResults.value = []
  productSearch.value = ''
  saveError.value = ''
  saveSuccess.value = ''
}

async function loadProducts(query: string) {
  isSearchingProducts.value = true
  searchError.value = ''
  try {
    const results = await crmStore.searchCrmProducts({ search: query, limit: 12 })
    productResults.value = results
  } catch (error) {
    console.error('[CRM] product search error', error)
    searchError.value = 'Не удалось загрузить товары'
    productResults.value = []
  } finally {
    isSearchingProducts.value = false
  }
}

function addProduct(product: CrmProductSummary) {
  const existing = form.items.find((item) => item.productId === product.id)
  if (existing) {
    existing.quantity = Math.max(existing.quantity + 1, 1)
    existing.price = Number.isFinite(existing.price) ? existing.price : product.priceRub
    existing.cost = Number.isFinite(existing.cost) ? existing.cost : product.costPrice
    existing.stock = product.stock
    normalizeItem(existing)
    return
  }
  form.items.push({
    productId: product.id,
    title: product.title,
    quantity: 1,
    price: product.priceRub,
    discount: 0,
    cost: product.costPrice,
    stock: product.stock
  })
  productResults.value = []
  productSearch.value = ''
}

function removeItem(productId: string) {
  form.items = form.items.filter((item) => item.productId !== productId)
}

function normalizeItem(item: FormItem) {
  if (!Number.isFinite(item.quantity) || item.quantity <= 0) item.quantity = 1
  if (!Number.isFinite(item.price) || item.price < 0) item.price = 0
  if (!Number.isFinite(item.discount) || item.discount < 0) item.discount = 0
  const maxDiscount = Math.max(item.price * item.quantity, 0)
  if (item.discount > maxDiscount) item.discount = maxDiscount
}

function isItemValid(item: FormItem) {
  return item.quantity > 0 && item.price >= 0 && item.discount >= 0 && item.discount <= item.price * item.quantity
}

function itemSubtotal(item: FormItem) {
  const total = Math.max(item.price, 0) * Math.max(item.quantity, 0) - Math.max(item.discount, 0)
  return total < 0 ? 0 : total
}

function normalizeDiscounts() {
  if (!Number.isFinite(form.discountAmount) || form.discountAmount < 0) form.discountAmount = 0
  if (!Number.isFinite(form.discountPercent) || form.discountPercent < 0) form.discountPercent = 0
  if (form.discountPercent > 100) form.discountPercent = 100
  const maxDiscount = itemsSubtotal.value
  if (form.discountAmount > maxDiscount) form.discountAmount = maxDiscount
}

async function saveChanges() {
  if (!currentOrder.value || !canSave.value) return
  saveError.value = ''
  saveSuccess.value = ''
  isSaving.value = true

  const sanitizedItems = form.items.map((item) => {
    const quantity = Math.max(1, Math.round(Number(item.quantity) || 0))
    const price = Math.max(0, Number(item.price) || 0)
    let discount = Math.max(0, Number(item.discount) || 0)
    const maxDiscount = price * quantity
    if (discount > maxDiscount) discount = maxDiscount
    return {
      product_id: item.productId,
      quantity,
      price_per_unit: price,
      discount_amount: discount
    }
  })

  const discountAmount = Math.max(0, Number(form.discountAmount) || 0)
  const discountPercent = Math.min(100, Math.max(0, Number(form.discountPercent) || 0))

  const payload = {
    status: editableStatus.value,
    delivery_address: form.deliveryAddress.trim() || undefined,
    notes: form.notes.trim() || undefined,
    discount_amount: Math.min(discountAmount, itemsSubtotal.value),
    discount_percent: discountPercent,
    items: sanitizedItems
  }

  try {
    const updated = await crmStore.updateOrder(currentOrder.value.id, payload)
    currentOrder.value = updated
    initializeForm(updated)
    saveSuccess.value = 'Изменения сохранены'
    if (successTimer) clearTimeout(successTimer)
    successTimer = setTimeout(() => {
      saveSuccess.value = ''
    }, 4000)
  } catch (error: any) {
    console.error('[CRM] update order error', error)
    saveError.value = error?.message || 'Не удалось сохранить изменения'
  } finally {
    isSaving.value = false
  }
}

async function removePayment() {
  if (!currentOrder.value || deletingPayment.value) return
  if (!confirm('Удалить оплату и вернуть заказ в работу?')) return
  deletingPayment.value = true
  saveError.value = ''
  try {
    const updated = await crmStore.deleteOrderPayment(currentOrder.value.id)
    currentOrder.value = updated
    initializeForm(updated)
    saveSuccess.value = 'Оплата удалена'
    if (successTimer) clearTimeout(successTimer)
    successTimer = setTimeout(() => {
      saveSuccess.value = ''
    }, 4000)
  } catch (error: any) {
    console.error('[CRM] delete payment error', error)
    saveError.value = error?.message || 'Не удалось удалить оплату'
  } finally {
    deletingPayment.value = false
  }
}

async function reactivateOrder() {
  if (!currentOrder.value || reactivating.value) return
  if (!confirm('Возобновить отменённый заказ?')) return
  reactivating.value = true
  saveError.value = ''
  try {
    const updated = await crmStore.updateOrder(currentOrder.value.id, { reactivate: true })
    currentOrder.value = updated
    initializeForm(updated)
    saveSuccess.value = 'Заказ возобновлён'
    if (successTimer) clearTimeout(successTimer)
    successTimer = setTimeout(() => {
      saveSuccess.value = ''
    }, 4000)
  } catch (error: any) {
    console.error('[CRM] reactivate order error', error)
    saveError.value = error?.message || 'Не удалось возобновить заказ'
  } finally {
    reactivating.value = false
  }
}

function resetForm() {
  if (currentOrder.value) {
    initializeForm(currentOrder.value)
  }
}

function applyDiscounts(total: number, discountAmount: number, discountPercent: number) {
  let result = Math.max(total - Math.max(discountAmount, 0), 0)
  const percent = Math.min(100, Math.max(discountPercent, 0))
  if (percent > 0) {
    result = result * (1 - percent / 100)
  }
  return result < 0 ? 0 : result
}

function statusBadgeClass(status: Order['status']) {
  switch (status) {
    case 'new':
      return 'bg-amber-100 text-amber-700'
    case 'in_progress':
      return 'bg-blue-100 text-blue-700'
    case 'completed':
    case 'delivered':
      return 'bg-emerald-100 text-emerald-700'
    case 'cancelled':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-gray-100 text-gray-600'
  }
}

function statusLabel(status: Order['status'], deliveryType?: 'pickup' | 'delivery') {
  if ((status === 'delivered' || status === 'completed') && deliveryType) {
    // Условные статусы: доставка → доставлена, самовывоз → выдан
    return deliveryType === 'delivery' ? 'Доставлена' : 'Выдан'
  }
  return statusOptions.find((option) => option.value === status)?.label ?? status
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0
  }).format(value)
}

function formatFullDate(dateString?: string | null) {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function contactClient() {
  if (!currentOrder.value || isGeneratingMessage.value) return
  
  isGeneratingMessage.value = true
  saveError.value = ''
  
  try {
    const data = await crmStore.generateOrderMessage(currentOrder.value.id)
    const { message, telegramUsername } = data
    
    if (telegramUsername) {
      const encodedMessage = encodeURIComponent(message)
      const telegramUrl = `https://t.me/${telegramUsername}?text=${encodedMessage}`
      window.open(telegramUrl, '_blank')
    } else {
      saveError.value = 'У клиента нет Telegram'
    }
  } catch (error: any) {
    console.error('[CRM] Generate message error', error)
    saveError.value = error?.message || 'Не удалось сгенерировать сообщение'
  } finally {
    isGeneratingMessage.value = false
  }
}

const showSearchHint = computed(() => {
  const length = productSearch.value.trim().length
  return length > 0 && length < 2
})
</script>
