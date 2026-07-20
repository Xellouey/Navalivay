<template>
  <AdminModal
    :isOpen="isOpen"
    title="Перемещение товаров"
    description="Выберите товары и перенесите остаток между розницей и складом."
    size="2xl"
    :showActions="false"
    :persistent="true"
    @close="closeModal"
    @cancel="closeModal"
  >
    <div class="space-y-6">
      <div class="grid gap-3 sm:grid-cols-[1fr,auto,1fr] sm:items-end">
        <div>
          <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Откуда</div>
          <div class="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base font-semibold text-gray-900">
            {{ locationLabel(sourceLocation) }}
          </div>
        </div>
        <button
          type="button"
          class="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:text-blue-700"
          :disabled="submitting"
          @click="swapDirection"
        >
          Поменять
        </button>
        <div>
          <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Куда</div>
          <div class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-base font-semibold text-blue-900">
            {{ locationLabel(destinationLocation) }}
          </div>
        </div>
      </div>

      <label class="block">
        <span class="mb-2 block text-sm font-medium text-gray-700">Комментарий</span>
        <textarea
          v-model="comment"
          :disabled="submitting"
          rows="2"
          class="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          placeholder="Например, пополнение витрины"
        ></textarea>
      </label>

      <section class="space-y-3">
        <div>
          <h4 class="text-base font-semibold text-gray-900">Поиск товаров</h4>
          <p class="text-sm text-gray-500">Показываются только позиции с остатком в точке отправления.</p>
        </div>
        <input
          v-model="search"
          type="search"
          :disabled="submitting"
          class="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          placeholder="Название товара, вкус или линейка"
        />
        <div class="max-h-64 overflow-y-auto rounded-xl border border-gray-200">
          <div v-if="loading" class="py-8 text-center text-sm text-gray-500">Загрузка…</div>
          <div v-else-if="loadErrorMessage" class="py-8 text-center text-sm text-red-600">
            {{ loadErrorMessage }}
          </div>
          <div v-else-if="!results.length" class="py-8 text-center text-sm text-gray-500">
            В {{ locationLabel(sourceLocation).toLowerCase() }} подходящих товаров нет
          </div>
          <ul v-else class="divide-y divide-gray-100">
            <li v-for="item in results" :key="item.id" class="flex items-center justify-between gap-3 px-4 py-3">
              <div class="flex min-w-0 items-center gap-3">
                <img v-if="item.image" :src="item.image" :alt="item.title" class="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
                <div class="min-w-0">
                  <div class="truncate text-sm font-medium text-gray-900">{{ item.title }}</div>
                  <div class="truncate text-xs text-gray-500">
                    <span v-if="item.group_name">{{ item.group_name }} · </span>Доступно: {{ item.available_stock }} шт
                  </div>
                </div>
              </div>
              <button
                type="button"
                class="flex-shrink-0 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
                :disabled="submitting || isSelected(item)"
                @click="addItem(item)"
              >
                {{ isSelected(item) ? 'Добавлен' : 'Добавить' }}
              </button>
            </li>
          </ul>
        </div>
      </section>

      <section class="overflow-hidden rounded-xl border border-gray-200">
        <div class="border-b border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900">
          К перемещению: {{ selectedItems.length }}
        </div>
        <div v-if="!selectedItems.length" class="px-4 py-8 text-center text-sm text-gray-500">
          Добавьте товары из списка выше
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[560px] text-sm">
            <thead class="border-b border-gray-100 text-left text-xs uppercase text-gray-500">
              <tr>
                <th class="px-4 py-3">Товар</th>
                <th class="px-4 py-3">Доступно</th>
                <th class="px-4 py-3">Количество</th>
                <th class="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="item in selectedItems" :key="item.key">
                <td class="px-4 py-3 font-medium text-gray-900">{{ item.title }}</td>
                <td class="px-4 py-3 text-gray-600">{{ item.available }} шт</td>
                <td class="px-4 py-3">
                  <input
                    v-model.number="item.quantity"
                    type="number"
                    min="1"
                    :max="item.available"
                    :disabled="submitting"
                    class="w-24 rounded-lg border border-gray-300 px-2 py-1.5 focus:border-blue-500 focus:outline-none"
                    @change="clampQuantity(item)"
                  />
                </td>
                <td class="px-4 py-3 text-right">
                  <button type="button" class="text-xs font-semibold text-red-600 hover:text-red-800 disabled:text-gray-400" :disabled="submitting" @click="removeItem(item.key)">
                    Удалить
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p v-if="errorMessage" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {{ errorMessage }}
      </p>

      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" class="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50" :disabled="submitting" @click="closeModal">
          Отмена
        </button>
        <button
          type="button"
          class="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          :disabled="!selectedItems.length || submitting"
          @click="submitTransfer"
        >
          {{ submitting ? 'Перемещаем…' : `Переместить ${totalQuantity} шт ${destinationLabel}` }}
        </button>
      </div>
    </div>
  </AdminModal>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import AdminModal from '@/components/AdminModal.vue'
import { useAdminStore } from '@/stores/admin'

type Location = 'retail' | 'warehouse'

interface InventoryItem {
  id: string
  product_id?: string
  title: string
  group_name?: string | null
  is_variant?: boolean
  image?: string | null
  available_stock: number
}

interface SelectedItem {
  key: string
  productId: string
  variantId: string | null
  title: string
  available: number
  quantity: number
}

const props = defineProps<{
  isOpen: boolean
  initialSource?: Location
}>()

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'completed', details: { quantity: number; destination: Location }): void
}>()

const adminStore = useAdminStore()
const sourceLocation = ref<Location>('retail')
const destinationLocation = computed<Location>(() => sourceLocation.value === 'retail' ? 'warehouse' : 'retail')
const comment = ref('')
const search = ref('')
const results = ref<InventoryItem[]>([])
const selectedItems = ref<SelectedItem[]>([])
const loading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const loadErrorMessage = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null
let requestId = 0

const totalQuantity = computed(() => selectedItems.value.reduce((sum, item) => sum + item.quantity, 0))
const destinationLabel = computed(() => destinationLocation.value === 'warehouse' ? 'на склад' : 'в розницу')

function locationLabel(location: Location) {
  return location === 'warehouse' ? 'Склад' : 'Розница'
}

function itemKey(item: InventoryItem) {
  return `${item.product_id || item.id}:${item.is_variant ? item.id : ''}`
}

function isSelected(item: InventoryItem) {
  const key = itemKey(item)
  return selectedItems.value.some((selected) => selected.key === key)
}

async function loadItems() {
  const currentRequest = ++requestId
  loading.value = true
  loadErrorMessage.value = ''
  try {
    const data = await adminStore.fetchInventoryItems({
      location: sourceLocation.value,
      search: search.value.trim() || undefined,
      limit: 100,
    })
    if (currentRequest !== requestId) return
    results.value = Array.isArray(data) ? data : []
  } catch (error) {
    if (currentRequest !== requestId) return
    console.error('[inventory] Failed to load items', error)
    results.value = []
    loadErrorMessage.value = 'Не удалось загрузить товары'
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

function addItem(item: InventoryItem) {
  if (isSelected(item)) return
  const available = Math.max(0, Number(item.available_stock || 0))
  if (available <= 0) return
  selectedItems.value.push({
    key: itemKey(item),
    productId: String(item.product_id || item.id),
    variantId: item.is_variant ? String(item.id) : null,
    title: item.title,
    available,
    quantity: 1,
  })
}

function removeItem(key: string) {
  selectedItems.value = selectedItems.value.filter((item) => item.key !== key)
}

function clampQuantity(item: SelectedItem) {
  const quantity = Math.floor(Number(item.quantity || 1))
  item.quantity = Math.min(Math.max(quantity, 1), item.available)
}

function swapDirection() {
  sourceLocation.value = destinationLocation.value
  selectedItems.value = []
  void loadItems()
}

function reset() {
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
  requestId += 1
  sourceLocation.value = props.initialSource || 'retail'
  comment.value = ''
  search.value = ''
  results.value = []
  selectedItems.value = []
  errorMessage.value = ''
  loadErrorMessage.value = ''
  loading.value = false
}

function closeModal() {
  if (submitting.value) return
  emit('close')
}

async function submitTransfer() {
  if (!selectedItems.value.length || submitting.value) return
  selectedItems.value.forEach(clampQuantity)
  const submittedQuantity = totalQuantity.value
  const submittedDestination = destinationLocation.value
  submitting.value = true
  errorMessage.value = ''
  try {
    await adminStore.createInventoryTransfer({
      source_location: sourceLocation.value,
      destination_location: destinationLocation.value,
      comment: comment.value.trim() || undefined,
      items: selectedItems.value.map((item) => ({
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: item.quantity,
      })),
    })
    emit('completed', { quantity: submittedQuantity, destination: submittedDestination })
    emit('close')
  } catch (error: any) {
    const code = String(error?.data?.error || '')
    errorMessage.value = code.startsWith('insufficient_stock:')
      ? 'Остаток изменился. Обновите список и проверьте количество.'
      : 'Не удалось выполнить перемещение'
  } finally {
    submitting.value = false
  }
}

watch(() => props.isOpen, (open) => {
  if (!open) {
    reset()
    return
  }
  sourceLocation.value = props.initialSource || 'retail'
  void loadItems()
})

watch(search, () => {
  if (!props.isOpen) return
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void loadItems(), 250)
})

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
  requestId += 1
})
</script>
