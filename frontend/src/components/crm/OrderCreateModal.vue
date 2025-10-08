<template>
  <AdminModal
    :isOpen="isOpen"
    title="Свободная продажа"
    description="Создайте заказ вручную, выбрав клиента и позиции."
    size="2xl"
    :showActions="false"
    @close="handleClose"
    @cancel="handleClose"
  >
    <div class="grid max-h-[calc(90vh-5.5rem)] grid-cols-1 gap-6 overflow-y-auto px-6 py-6 lg:grid-cols-[1.3fr_1fr]">
      <section class="space-y-6">
            <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <label class="flex flex-col gap-2">
                <span class="text-sm font-medium text-gray-700">Клиент (опционально)</span>
                <select
                  v-model="form.customerId"
                  class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">Гость</option>
                  <option
                    v-for="customer in customers"
                    :key="customer.id"
                    :value="customer.id"
                  >
                    {{ customerLabel(customer) }}
                  </option>
                </select>
              </label>

              <div class="flex flex-col gap-2">
                <span class="text-sm font-medium text-gray-700">Тип отдачи</span>
                <div class="flex items-center gap-3">
                  <label class="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      v-model="form.deliveryType"
                      type="radio"
                      value="pickup"
                      class="h-4 w-4 text-blue-600"
                    />
                    Самовывоз
                  </label>
                  <label class="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      v-model="form.deliveryType"
                      type="radio"
                      value="delivery"
                      class="h-4 w-4 text-blue-600"
                    />
                    Доставка
                  </label>
                </div>
              </div>
            </div>

            <label v-if="form.deliveryType === 'delivery'" class="flex flex-col gap-2">
              <span class="text-sm font-medium text-gray-700">Адрес доставки</span>
              <textarea
                v-model.trim="form.deliveryAddress"
                rows="2"
                class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="Улица, дом, подъезд, комментарии"
              />
            </label>

            <div class="space-y-3">
              <div>
                <label class="text-sm font-medium text-gray-700" for="product-search">Добавить товар</label>
                <div class="relative mt-2">
                  <input
                    id="product-search"
                    v-model="productSearch"
                    type="text"
                    placeholder="Название, артикул или группа"
                    class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <span
                    v-if="isSearching"
                    class="absolute inset-y-0 right-3 flex items-center text-gray-400"
                  >
                    <svg class="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </span>
                </div>
              </div>

              <div
                v-if="productSuggestions.length"
                class="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700"
              >
                <p class="mb-2 text-xs font-semibold uppercase text-gray-500">Найдено товаров</p>
                <ul class="space-y-2">
                  <li
                    v-for="suggestion in productSuggestions"
                    :key="suggestion.id"
                    class="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2"
                  >
                    <div class="flex flex-col">
                      <span class="font-medium text-gray-900">{{ suggestion.title }}</span>
                      <span class="text-xs text-gray-500">
                        Остаток: {{ suggestion.stock }}
                        <span v-if="suggestion.groupName">· {{ suggestion.groupName }}</span>
                      </span>
                    </div>
                    <div class="flex items-center gap-3">
                      <span class="text-sm font-semibold text-gray-900">{{ formatCurrency(suggestion.priceRub) }}</span>
                      <button
                        class="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-blue-700"
                        @click.prevent="addProduct(suggestion)"
                      >
                        Добавить
                      </button>
                    </div>
                  </li>
                </ul>
              </div>
            </div>

            <div class="space-y-3">
              <header class="flex items-center justify-between">
                <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-600">Позиции заказа</h3>
                <span class="text-xs font-medium text-gray-400">Всего: {{ form.items.length }}</span>
              </header>

              <div
                v-if="!form.items.length"
                class="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500"
              >
                Добавьте товары через поиск выше — они появятся здесь для редактирования количества и цены.
              </div>

              <div v-else class="space-y-3">
                <article
                  v-for="item in form.items"
                  :key="item.productId"
                  class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div class="space-y-1">
                      <p class="text-base font-semibold text-gray-900">{{ item.title }}</p>
                      <p class="text-xs text-gray-500">
                        Остаток: <span :class="item.stock <= item.minStock ? 'text-red-500' : ''">{{ item.stock }}</span>
                        <span v-if="item.groupName">· {{ item.groupName }}</span>
                      </p>
                    </div>
                    <button
                      class="text-xs font-medium text-red-500 transition hover:text-red-600"
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
                      />
                    </label>
                  </div>

                  <div class="mt-3 flex items-center justify-between text-sm text-gray-600">
                    <span>Себестоимость: {{ formatCurrency(item.cost) }}</span>
                    <span class="font-semibold text-gray-900">Итого: {{ formatCurrency(itemTotal(item)) }}</span>
                  </div>
                </article>
              </div>
            </div>
          </section>

      <aside class="flex h-full flex-col gap-4">
            <div class="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <header class="flex items-center justify-between">
                <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-600">Итоги</h3>
                <span class="text-xs font-medium text-gray-400">Автопересчет</span>
              </header>

              <dl class="space-y-3 text-sm text-gray-600">
                <div class="flex items-center justify-between">
                  <dt>Сумма позиций</dt>
                  <dd class="font-semibold text-gray-900">{{ formatCurrency(subtotal) }}</dd>
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

            <label class="flex flex-1 flex-col gap-2">
              <span class="text-sm font-medium text-gray-700">Комментарий</span>
              <textarea
                v-model.trim="form.notes"
                rows="4"
                class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="Например, кто оформил заказ или детали оплаты"
              />
            </label>

            <div class="space-y-3">
              <p v-if="submitError" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{{ submitError }}</p>
              <button
                class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                :disabled="isSubmitting || !canSubmit"
                @click="handleSubmit"
              >
                <svg
                  v-if="isSubmitting"
                  class="h-4 w-4 animate-spin"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{{ isSubmitting ? 'Создаем...' : 'Создать заказ' }}</span>
              </button>
              <button
                class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
                @click="handleClose"
              >
                Отмена
              </button>
            </div>
      </aside>
    </div>
  </AdminModal>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useCrmStore, type CrmProductSummary, type Customer, type Order } from '@/stores/crm'
import AdminModal from '@/components/AdminModal.vue'

interface Props {
  isOpen: boolean
}

interface Emits {
  (e: 'close'): void
  (e: 'created', order: Order): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const crmStore = useCrmStore()
const { customers } = storeToRefs(crmStore)

const productSearch = ref('')
const productSuggestions = ref<CrmProductSummary[]>([])
const isSearching = ref(false)
const searchToken = ref(0)

const isSubmitting = ref(false)
const submitError = ref('')

const form = reactive({
  customerId: '',
  deliveryType: 'pickup' as 'pickup' | 'delivery',
  deliveryAddress: '',
  discountAmount: 0,
  discountPercent: 0,
  notes: '',
  items: [] as Array<{
    productId: string
    title: string
    quantity: number
    price: number
    cost: number
    discount: number
    stock: number
    minStock: number
    groupName?: string | null
  }>
})

const subtotal = computed(() => {
  return form.items.reduce((sum, item) => sum + Math.max(item.price, 0) * Math.max(item.quantity, 0), 0)
})

const expectedProfit = computed(() => {
  const totalCost = form.items.reduce((sum, item) => sum + item.cost * Math.max(item.quantity, 0), 0)
  return Math.max(finalAmount.value - totalCost, 0)
})

const finalAmount = computed(() => {
  let amount = subtotal.value
  const amountDiscount = Math.min(Math.max(form.discountAmount, 0), amount)
  amount -= amountDiscount
  if (form.discountPercent > 0) {
    const percent = Math.min(Math.max(form.discountPercent, 0), 100)
    amount = amount * (1 - percent / 100)
  }
  return Math.max(amount, 0)
})

const canSubmit = computed(() => {
  if (!form.items.length) return false
  if (form.deliveryType === 'delivery' && !form.deliveryAddress.trim()) return false
  return true
})

watch(
  () => form.deliveryType,
  (type) => {
    if (type === 'pickup') {
      form.deliveryAddress = ''
    }
  }
)

watch(productSearch, (value) => {
  const query = value.trim()
  if (!query || query.length < 2) {
    productSuggestions.value = []
    return
  }

  const currentToken = ++searchToken.value
  isSearching.value = true

  crmStore
    .searchCrmProducts({ search: query, limit: 12 })
    .then((results) => {
      if (currentToken !== searchToken.value) return
      productSuggestions.value = results
    })
    .catch(() => {
      if (currentToken !== searchToken.value) return
      productSuggestions.value = []
    })
    .finally(() => {
      if (currentToken === searchToken.value) {
        isSearching.value = false
      }
    })
})

function resetForm() {
  form.customerId = ''
  form.deliveryType = 'pickup'
  form.deliveryAddress = ''
  form.discountAmount = 0
  form.discountPercent = 0
  form.notes = ''
  form.items = []
  productSearch.value = ''
  productSuggestions.value = []
  submitError.value = ''
}

function customerLabel(customer: Customer) {
  if (customer.telegram_username) return `@${customer.telegram_username}`
  if (customer.first_name || customer.last_name) {
    return `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim()
  }
  if (customer.phone) return customer.phone
  return `Клиент #${customer.id}`
}

function addProduct(product: CrmProductSummary) {
  const existing = form.items.find((item) => item.productId === product.id)
  if (existing) {
    existing.quantity += 1
  } else {
    form.items.push({
      productId: product.id,
      title: product.title,
      quantity: 1,
      price: product.priceRub,
      cost: product.costPrice,
      discount: 0,
      stock: product.stock,
      minStock: product.minStock,
      groupName: product.groupName ?? null
    })
  }
  productSearch.value = ''
  productSuggestions.value = []
}

function removeItem(productId: string) {
  form.items = form.items.filter((item) => item.productId !== productId)
}

function itemTotal(item: typeof form.items[number]) {
  const base = Math.max(item.price, 0) * Math.max(item.quantity, 0)
  const discount = Math.min(Math.max(item.discount, 0), base)
  return base - discount
}

async function handleSubmit() {
  if (!canSubmit.value || isSubmitting.value) return

  submitError.value = ''
  isSubmitting.value = true

  try {
    const payload = {
      customer_id: form.customerId || undefined,
      delivery_type: form.deliveryType,
      delivery_address: form.deliveryType === 'delivery' ? form.deliveryAddress.trim() || undefined : undefined,
      discount_amount: Math.max(form.discountAmount, 0) || undefined,
      discount_percent: Math.max(form.discountPercent, 0) || undefined,
      notes: form.notes || undefined,
      items: form.items.map((item) => ({
        product_id: item.productId,
        quantity: Math.max(item.quantity, 1),
        price_per_unit: Math.max(item.price, 0),
        discount_amount: Math.max(item.discount, 0) || undefined
      }))
    }

    const order = await crmStore.createOrder(payload)

    emit('created', order)
    resetForm()
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : 'Не удалось создать заказ'
  } finally {
    isSubmitting.value = false
  }
}

function handleClose() {
  if (isSubmitting.value) return
  resetForm()
  emit('close')
}

onMounted(async () => {
  if (!customers.value.length) {
    try {
      await crmStore.fetchCustomers()
    } catch (error) {
      console.warn('[CRM] Failed to load customers for order modal:', error)
    }
  }
})

watch(
  () => props.isOpen,
  (open) => {
    if (!open) {
      resetForm()
    }
  }
)

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(amount) ? amount : 0)
}
</script>

