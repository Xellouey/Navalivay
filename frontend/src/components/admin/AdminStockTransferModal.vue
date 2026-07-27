<template>
  <AdminModal
    :isOpen="isOpen"
    :title="modalTitle"
    :description="modalDescription"
    size="2xl"
    :showActions="false"
    :persistent="true"
    @close="closeModal"
    @cancel="closeModal"
  >
    <div v-if="view === 'list'" class="space-y-4">
      <div class="flex">
        <button
          type="button"
          class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-dark px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark/90 disabled:opacity-50 sm:ml-auto sm:w-auto"
          :disabled="loadingTransfers || loadingMore"
          @click="openCreate"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Новая заявка
        </button>
      </div>

      <div v-if="loadingTransfers" class="py-10 text-center text-sm text-gray-500">Загрузка…</div>
      <div v-else-if="listError" class="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
        <span>{{ listError }}</span>
        <button type="button" class="font-semibold underline" @click="loadTransfers()">Повторить</button>
      </div>
      <p v-if="detailError" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {{ detailError }}
      </p>
      <div v-if="!loadingTransfers && !listError && !transfers.length" class="rounded-2xl border border-dashed border-gray-200 px-5 py-10 text-center">
        <p class="font-medium text-gray-900">Заявок пока нет</p>
        <p class="mt-1 text-sm text-gray-500">Создайте первую заявку на перемещение.</p>
      </div>
      <div v-if="!loadingTransfers && transfers.length" class="transfer-scroll space-y-2 sm:max-h-[58vh] sm:overflow-y-auto sm:pr-2">
        <button
          v-for="transfer in transfers"
          :key="transfer.id"
          type="button"
          class="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-left transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60"
          :disabled="Boolean(openingTransferId) || loadingMore"
          @click="openDetails(transfer.id)"
        >
          <span class="min-w-0">
            <span class="flex flex-wrap items-center gap-2">
              <span class="font-semibold text-gray-900">Перемещение №{{ transfer.transfer_number }}</span>
              <span :class="statusClass(transfer.status)" class="rounded-full px-2.5 py-1 text-xs font-semibold">
                {{ statusLabel(transfer.status) }}
              </span>
            </span>
            <span class="mt-1 block text-sm text-gray-600">
              {{ locationLabel(transfer.source_location) }} → {{ locationLabel(transfer.destination_location) }} · {{ positionsLabel(Number(transfer.item_count || 0)) }} · {{ Number(transfer.total_quantity || 0) }} шт
            </span>
            <span class="mt-1 block text-xs text-gray-500">
              {{ formatDate(transfer.created_at) }} · создал {{ transfer.created_by || 'администратор' }}
            </span>
          </span>
          <svg v-if="openingTransferId !== transfer.id" class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 18 6-6-6-6" />
          </svg>
          <span v-else class="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-brand-dark" aria-label="Открываем"></span>
        </button>
      </div>
      <div v-if="loadMoreError" class="flex items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
        <span>{{ loadMoreError }}</span>
        <button type="button" class="font-semibold underline" @click="loadTransfers(true)">Повторить</button>
      </div>
      <button
        v-if="transferPage < transferTotalPages && !loadMoreError"
        type="button"
        class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
        :disabled="loadingMore"
        @click="loadTransfers(true)"
      >
        {{ loadingMore ? 'Загрузка…' : 'Показать ещё' }}
      </button>
    </div>

    <div v-else-if="view === 'details' && activeTransfer" class="space-y-4">
      <button type="button" class="inline-flex w-fit items-center gap-2 rounded-lg px-1 py-1 text-sm font-semibold text-gray-600 transition hover:text-brand-dark focus:outline-none focus:ring-2 focus:ring-rose-200" @click="backToList">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Все перемещения
      </button>

      <div class="rounded-2xl border border-gray-200 bg-gray-50/60 p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="text-xs font-semibold uppercase tracking-wide text-gray-500">Маршрут</div>
            <div class="mt-1 text-lg font-semibold text-gray-900">
              {{ locationLabel(activeTransfer.source_location) }} → {{ locationLabel(activeTransfer.destination_location) }}
            </div>
          </div>
          <span :class="statusClass(activeTransfer.status)" class="rounded-full px-3 py-1.5 text-sm font-semibold">
            {{ statusLabel(activeTransfer.status) }}
          </span>
        </div>
        <p v-if="activeTransfer.comment" class="mt-2 text-sm text-gray-600">{{ activeTransfer.comment }}</p>
        <div class="mt-2 space-y-1 text-xs text-gray-500">
          <div>Создал: {{ activeTransfer.created_by || 'администратор' }} · {{ formatDate(activeTransfer.created_at) }}</div>
          <div v-if="activeTransfer.completed_at">Оприходовал: {{ activeTransfer.completed_by || 'администратор' }} · {{ formatDate(activeTransfer.completed_at) }}</div>
          <div v-if="activeTransfer.cancelled_at">Отменил: {{ activeTransfer.cancelled_by || 'администратор' }} · {{ formatDate(activeTransfer.cancelled_at) }}</div>
        </div>
      </div>

      <div class="overflow-hidden rounded-2xl border border-gray-200">
        <div class="border-b border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900">
          {{ positionsLabel(activeTransfer.items?.length || 0) }} · {{ Number(activeTransfer.total_quantity || 0) }} шт
        </div>
        <div class="transfer-scroll divide-y divide-gray-100 sm:max-h-[42vh] sm:overflow-y-auto">
          <div v-for="item in activeTransfer.items" :key="item.id" class="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <div class="flex min-w-0 items-center gap-3">
              <img
                v-if="item.product_image && !failedImageIds.has(item.id)"
                :src="item.product_image"
                :alt="item.product_title"
                class="h-11 w-11 flex-shrink-0 rounded-lg object-cover ring-1 ring-gray-200"
                loading="lazy"
                @error="markImageFailed(item.id)"
              />
              <div v-else class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100" aria-label="Фото отсутствует">
                <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2z" />
                </svg>
              </div>
              <div class="min-w-0">
                <div class="max-w-prose whitespace-normal break-words font-medium leading-snug text-gray-900">
                  {{ item.product_title }}<span v-if="item.variant_name" class="font-normal text-gray-600">, {{ item.variant_name }}</span>
                </div>
                <div v-if="item.group_name" class="truncate text-xs font-semibold text-brand-dark">{{ item.group_name }}</div>
                <div v-if="item.category_name" class="truncate text-xs text-gray-500">{{ item.category_name }}</div>
              </div>
            </div>
            <div class="flex-shrink-0 font-semibold text-gray-900">{{ item.quantity }} шт</div>
          </div>
        </div>
      </div>

      <p v-if="actionMessage" class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        {{ actionMessage }}
      </p>
      <p v-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {{ errorMessage }}
      </p>

    </div>

    <div v-else class="space-y-6">
      <button type="button" class="inline-flex w-fit items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200" @click="backToList">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Все перемещения
      </button>

      <div class="grid gap-3 sm:grid-cols-[1fr,auto,1fr] sm:items-end">
        <div>
          <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Откуда</div>
          <div class="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base font-semibold text-gray-900">
            {{ locationLabel(sourceLocation) }}
          </div>
        </div>
        <button
          type="button"
          class="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-rose-300 hover:text-brand-dark"
          :disabled="submitting"
          @click="swapDirection"
        >
          Поменять
        </button>
        <div>
          <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Куда</div>
          <div class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-base font-semibold text-brand-dark">
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
          class="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
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
          class="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
          placeholder="Название товара, вкус или линейка"
        />
        <div class="max-h-64 overflow-y-auto rounded-xl border border-gray-200">
          <div v-if="loading" class="py-8 text-center text-sm text-gray-500">Загрузка…</div>
          <div v-else-if="loadErrorMessage" class="py-8 text-center text-sm text-red-600">{{ loadErrorMessage }}</div>
          <div v-else-if="!results.length" class="py-8 text-center text-sm text-gray-500">
            В {{ locationLabel(sourceLocation).toLowerCase() }} подходящих товаров нет
          </div>
          <ul v-else class="divide-y divide-gray-100">
            <li v-for="item in results" :key="item.id" class="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div class="flex min-w-0 items-center gap-3">
                <img v-if="item.image" :src="item.image" :alt="item.title" class="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
                <div v-else data-test="transfer-search-image-placeholder" class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100" aria-hidden="true">
                  <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2z" />
                  </svg>
                </div>
                <div class="min-w-0">
                  <div class="truncate text-sm font-medium text-gray-900">{{ item.title }}</div>
                  <div v-if="item.group_name" class="truncate text-xs font-semibold text-brand-dark">{{ item.group_name }}</div>
                  <div v-if="item.category_name" class="truncate text-xs text-gray-500">{{ item.category_name }}</div>
                  <div class="truncate text-xs text-gray-500">Доступно: {{ item.available_stock }} шт</div>
                </div>
              </div>
              <div class="flex flex-shrink-0 items-center gap-1 justify-self-end rounded-xl bg-gray-100 p-1">
                <button type="button" class="h-10 w-10 rounded-lg bg-white text-lg font-semibold text-gray-700 shadow-sm hover:text-brand-dark disabled:cursor-not-allowed disabled:opacity-40" :disabled="submitting || selectedQuantity(item) === 0" aria-label="Уменьшить количество" @click="decreaseResultItem(item)">−</button>
                <span class="min-w-10 text-center text-xs font-semibold text-gray-900">{{ selectedQuantity(item) }} шт</span>
                <button type="button" class="h-10 w-10 rounded-lg bg-brand-dark text-lg font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40" :disabled="submitting || selectedQuantity(item) >= item.available_stock" aria-label="Увеличить количество" @click="addItem(item)">+</button>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <section class="overflow-hidden rounded-xl border border-gray-200">
        <div class="border-b border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900">
          К перемещению: {{ selectedItems.length }} поз. · {{ totalQuantity }} шт
        </div>
        <div v-if="!selectedItems.length" class="px-4 py-8 text-center text-sm text-gray-500">Добавьте товары из списка выше</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[560px] table-fixed text-sm">
            <thead class="border-b border-gray-100 text-left text-xs uppercase text-gray-500">
              <tr><th class="w-[280px] px-4 py-3">Товар</th><th class="w-[90px] px-4 py-3">Доступно</th><th class="w-[120px] px-4 py-3">Количество</th><th class="w-[70px] px-4 py-3"></th></tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="item in selectedItems" :key="item.key">
                <td class="px-4 py-3">
                  <div class="flex min-w-0 items-center gap-3">
                    <img v-if="item.image" :src="item.image" :alt="item.title" class="h-10 w-10 flex-shrink-0 rounded-lg object-cover ring-1 ring-gray-200" loading="lazy" />
                    <div v-else data-test="transfer-selected-image-placeholder" class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100" aria-hidden="true">
                      <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div class="min-w-0">
                      <div class="truncate font-medium text-gray-900">{{ item.title }}</div>
                      <div v-if="item.groupName" class="truncate text-xs font-semibold text-brand-dark">{{ item.groupName }}</div>
                      <div v-if="item.categoryName" class="truncate text-xs text-gray-500">{{ item.categoryName }}</div>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3 text-gray-600">{{ item.available }} шт</td>
                <td class="px-4 py-3">
                  <input v-model.number="item.quantity" type="number" min="1" :max="item.available" :disabled="submitting" class="w-24 rounded-lg border border-gray-300 px-2 py-1.5 focus:border-rose-400 focus:outline-none" @change="clampQuantity(item)" />
                </td>
                <td class="px-4 py-3 text-right">
                  <button type="button" class="text-xs font-semibold text-red-600 hover:text-red-800 disabled:text-gray-400" :disabled="submitting" @click="removeItem(item.key)">Удалить</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p v-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMessage }}</p>

      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" class="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50" :disabled="submitting" @click="backToList">Отмена</button>
        <button type="button" class="min-h-[44px] rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40" :disabled="!selectedItems.length || submitting" @click="requestCreateTransfer">
          {{ submitting ? 'Сохраняем…' : `Создать заявку на ${totalQuantity} шт` }}
        </button>
      </div>
    </div>

    <template v-if="view === 'details' && activeTransfer?.status === 'draft'" #footer>
      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          class="rounded-xl border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
          :disabled="actionSubmitting"
          @click="requestCancelTransfer"
        >
          Отменить заявку
        </button>
        <button
          type="button"
          class="min-h-[44px] rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-blue-300"
          :disabled="actionSubmitting"
          @click="requestCompleteTransfer"
        >
          {{ actionSubmitting ? 'Оприходуем…' : `Оприходовать ${Number(activeTransfer.total_quantity || 0)} шт` }}
        </button>
      </div>
    </template>
  </AdminModal>
  <StaffActorPrompt
    :open="actorPromptOpen"
    :title="actorPromptTitle"
    :description="actorPromptDescription"
    :context="actorPromptContext"
    :action-label="actorPromptActionLabel"
    :loading="actorActionLoading"
    :error="actorPromptError"
    :error-code="actorPromptErrorCode"
    @close="closeActorPrompt"
    @confirm="confirmActorAction"
  />
  <AdminModal
    :is-open="cancelConfirmOpen"
    title="Отменить перемещение?"
    description="Заявка останется в истории, а остатки не изменятся."
    size="sm"
    :show-actions="false"
    :persistent="actionSubmitting"
    @close="cancelConfirmOpen = false"
    @cancel="cancelConfirmOpen = false"
  >
    <div class="space-y-5">
      <div v-if="activeTransfer" class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
        <div class="font-semibold">Перемещение №{{ activeTransfer.transfer_number }}</div>
        <div class="mt-1 text-slate-600">
          {{ locationLabel(activeTransfer.source_location) }} → {{ locationLabel(activeTransfer.destination_location) }}
        </div>
      </div>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          class="min-h-[44px] rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700"
          :disabled="actionSubmitting"
          @click="cancelConfirmOpen = false"
        >
          Оставить заявку
        </button>
        <button
          type="button"
          class="min-h-[44px] rounded-xl bg-red-600 px-4 text-sm font-semibold text-white disabled:bg-red-300"
          :disabled="actionSubmitting"
          @click="cancelTransfer()"
        >
          {{ actionSubmitting ? 'Отменяем…' : 'Отменить перемещение' }}
        </button>
      </div>
    </div>
  </AdminModal>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import AdminModal from '@/components/AdminModal.vue'
import { useAdminStore } from '@/stores/admin'
import { useCrmStore } from '@/stores/crm'
import { BUSINESS_TIME_ZONE } from '@/utils/businessTime'
import StaffActorPrompt from '@/components/admin/staff/StaffActorPrompt.vue'

type Location = 'retail' | 'warehouse'
type TransferStatus = 'draft' | 'completed' | 'cancelled'
type ModalView = 'list' | 'create' | 'details'

interface InventoryItem {
  id: string
  product_id?: string
  title: string
  category_name?: string | null
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
  categoryName: string | null
  groupName: string | null
  image: string | null
  available: number
  quantity: number
}

interface StockTransfer {
  id: string
  transfer_number: number
  source_location: Location
  destination_location: Location
  status: TransferStatus
  comment?: string | null
  created_at: string
  created_by?: string | null
  completed_at?: string | null
  completed_by?: string | null
  completed_by_employee_id?: string | null
  cancelled_at?: string | null
  cancelled_by?: string | null
  cancelled_by_employee_id?: string | null
  total_quantity: number
  item_count: number
  items?: Array<{
    id: string
    product_title: string
    variant_name?: string | null
    category_name?: string | null
    group_name?: string | null
    product_image?: string | null
    quantity: number
  }>
}

const props = defineProps<{ isOpen: boolean; initialSource?: Location }>()
const emit = defineEmits<{
  (event: 'close'): void
  (event: 'saved', details: { number: number }): void
  (event: 'completed', details: { quantity: number; destination: Location }): void
  (event: 'cancelled', details: { number: number }): void
}>()

const adminStore = useAdminStore()
const crmStore = useCrmStore()
const { staffTrackingEnabled } = storeToRefs(crmStore)
const view = ref<ModalView>('list')
const transfers = ref<StockTransfer[]>([])
const activeTransfer = ref<StockTransfer | null>(null)
const loadingTransfers = ref(false)
const loadingMore = ref(false)
const transferPage = ref(1)
const transferTotalPages = ref(1)
const listError = ref('')
const loadMoreError = ref('')
const detailError = ref('')
const openingTransferId = ref('')
const actionSubmitting = ref(false)
const actionMessage = ref('')
const failedImageIds = ref<Set<string>>(new Set())
const sourceLocation = ref<Location>('retail')
const destinationLocation = computed<Location>(() => sourceLocation.value === 'retail' ? 'warehouse' : 'retail')
const comment = ref('')
const search = ref('')
const results = ref<InventoryItem[]>([])
const selectedItems = ref<SelectedItem[]>([])
const loading = ref(false)
const submitting = ref(false)
const transferCreateKey = ref(newRequestKey())
const errorMessage = ref('')
const loadErrorMessage = ref('')
const actorPromptOpen = ref(false)
const actorPromptError = ref('')
const actorPromptErrorCode = ref('')
const actorPromptAction = ref<'create' | 'complete' | 'cancel' | null>(null)
const cancelConfirmOpen = ref(false)
const actorActionLoading = computed(() => submitting.value || actionSubmitting.value)
const actorPromptTitle = computed(() => {
  if (actorPromptAction.value === 'complete') return 'Оприходовать перемещение'
  if (actorPromptAction.value === 'cancel') return 'Отменить перемещение'
  return 'Создать заявку на перемещение'
})
const actorPromptDescription = computed(() => {
  if (actorPromptAction.value === 'complete') {
    return 'После подтверждения остатки изменятся сразу.'
  }
  if (actorPromptAction.value === 'cancel') {
    return 'Подтвердите сотрудника. Заявка останется в истории без изменения остатков.'
  }
  return 'Подтвердите сотрудника. Состав заявки сохранится при ошибке.'
})
const actorPromptActionLabel = computed(() => {
  if (actorPromptAction.value === 'complete') return 'Оприходовать перемещение'
  if (actorPromptAction.value === 'cancel') return 'Отменить перемещение'
  return 'Создать заявку на перемещение'
})
const actorPromptContext = computed(() => {
  if (
    ['complete', 'cancel'].includes(String(actorPromptAction.value))
    && activeTransfer.value
  ) {
    return [
      `Перемещение №${activeTransfer.value.transfer_number}`,
      `${locationLabel(activeTransfer.value.source_location)} → ${locationLabel(activeTransfer.value.destination_location)}`,
      `${positionsLabel(Number(activeTransfer.value.item_count || 0))} · ${Number(activeTransfer.value.total_quantity || 0)} шт`,
    ].join('\n')
  }
  if (actorPromptAction.value === 'create') {
    return [
      'Новая заявка на перемещение',
      `${locationLabel(sourceLocation.value)} → ${locationLabel(destinationLocation.value)}`,
      `${positionsLabel(selectedItems.value.length)} · ${totalQuantity.value} шт`,
    ].join('\n')
  }
  return ''
})
const transferCompletionKeys = new Map<string, string>()
let searchTimer: ReturnType<typeof setTimeout> | null = null
let requestId = 0
let detailsRequestId = 0
let transfersRequestId = 0

const totalQuantity = computed(() => selectedItems.value.reduce((sum, item) => sum + item.quantity, 0))
const hasUnsavedDraft = computed(() => selectedItems.value.length > 0 || Boolean(comment.value.trim()))
const modalTitle = computed(() => activeTransfer.value ? `Перемещение №${activeTransfer.value.transfer_number}` : view.value === 'create' ? 'Новая заявка' : 'Перемещения товаров')
const modalDescription = computed(() => view.value === 'list'
  ? 'Создайте заявку, а после фактического перемещения оприходуйте её.'
  : view.value === 'create'
    ? 'Остатки не изменятся, пока заявка не будет оприходована.'
    : 'Проверьте состав и статус заявки.')

function locationLabel(location: Location) {
  return location === 'warehouse' ? 'Склад' : 'Розница'
}

function statusLabel(status: TransferStatus) {
  return status === 'completed' ? 'Оприходовано' : status === 'cancelled' ? 'Отменено' : 'Черновик'
}

function statusClass(status: TransferStatus) {
  if (status === 'completed') return 'bg-emerald-100 text-emerald-700'
  if (status === 'cancelled') return 'bg-gray-100 text-gray-500'
  return 'bg-amber-100 text-amber-700'
}

function positionsLabel(count: number) {
  const normalized = Math.max(0, Math.floor(Number(count || 0)))
  const mod100 = normalized % 100
  const mod10 = normalized % 10
  const word = mod100 >= 11 && mod100 <= 14
    ? 'позиций'
    : mod10 === 1
      ? 'позиция'
      : mod10 >= 2 && mod10 <= 4
        ? 'позиции'
        : 'позиций'
  return `${normalized} ${word}`
}

function markImageFailed(itemId: string) {
  failedImageIds.value = new Set([...failedImageIds.value, itemId])
}

function formatDate(value?: string | null) {
  if (!value) return ''
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: BUSINESS_TIME_ZONE,
  })
}

function itemKey(item: InventoryItem) {
  return `${item.product_id || item.id}:${item.is_variant ? item.id : ''}`
}

function selectedItem(item: InventoryItem) {
  const key = itemKey(item)
  return selectedItems.value.find((selected) => selected.key === key)
}

function selectedQuantity(item: InventoryItem) {
  return selectedItem(item)?.quantity || 0
}

async function loadTransfers(append = false) {
  if (append && (loadingMore.value || loadingTransfers.value)) return
  const currentRequest = ++transfersRequestId
  if (append) loadingMore.value = true
  else {
    loadingTransfers.value = true
    loadingMore.value = false
  }
  if (append) loadMoreError.value = ''
  else {
    listError.value = ''
    loadMoreError.value = ''
  }
  try {
    const nextPage = append ? transferPage.value + 1 : 1
    const response = await adminStore.fetchInventoryTransfers({ page: nextPage, limit: 30 })
    if (currentRequest !== transfersRequestId) return
    const nextTransfers = Array.isArray(response?.transfers) ? response.transfers : []
    transfers.value = append ? [...transfers.value, ...nextTransfers] : nextTransfers
    transferPage.value = Number(response?.pagination?.page || nextPage)
    transferTotalPages.value = Number(response?.pagination?.totalPages || 1)
  } catch (error) {
    if (currentRequest !== transfersRequestId) return
    console.error('[inventory] Failed to load transfers', error)
    if (append) loadMoreError.value = 'Не удалось загрузить следующую страницу'
    else listError.value = 'Не удалось загрузить перемещения'
  } finally {
    if (currentRequest === transfersRequestId) {
      loadingTransfers.value = false
      loadingMore.value = false
    }
  }
}

function invalidateTransferLoads() {
  transfersRequestId += 1
  loadingTransfers.value = false
  loadingMore.value = false
}

async function openDetails(id: string) {
  if (openingTransferId.value) return
  invalidateTransferLoads()
  const currentRequest = ++detailsRequestId
  failedImageIds.value = new Set()
  actionMessage.value = ''
  errorMessage.value = ''
  detailError.value = ''
  openingTransferId.value = id
  try {
    const transfer = await adminStore.fetchInventoryTransfer(id)
    if (currentRequest !== detailsRequestId) return
    activeTransfer.value = transfer
    view.value = 'details'
  } catch (error) {
    if (currentRequest !== detailsRequestId) return
    console.error('[inventory] Failed to load transfer', error)
    detailError.value = 'Не удалось открыть перемещение. Попробуйте ещё раз.'
  } finally {
    if (currentRequest === detailsRequestId) openingTransferId.value = ''
  }
}

async function loadItems() {
  const currentRequest = ++requestId
  loading.value = true
  loadErrorMessage.value = ''
  try {
    const data = await adminStore.fetchInventoryItems({ location: sourceLocation.value, search: search.value.trim() || undefined, limit: 100 })
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
  const existing = selectedItem(item)
  const available = Math.max(0, Number(item.available_stock || 0))
  if (available <= 0) return
  if (existing) {
    existing.quantity = Math.min(existing.quantity + 1, existing.available)
    return
  }
  selectedItems.value.push({
    key: itemKey(item),
    productId: String(item.product_id || item.id),
    variantId: item.is_variant ? String(item.id) : null,
    title: item.title,
    categoryName: item.category_name || null,
    groupName: item.group_name || null,
    image: item.image || null,
    available,
    quantity: 1,
  })
}

function decreaseResultItem(item: InventoryItem) {
  const existing = selectedItem(item)
  if (!existing) return
  if (existing.quantity <= 1) removeItem(existing.key)
  else existing.quantity -= 1
}

function removeItem(key: string) {
  selectedItems.value = selectedItems.value.filter((item) => item.key !== key)
}

function clampQuantity(item: SelectedItem) {
  const quantity = Math.floor(Number(item.quantity || 1))
  item.quantity = Math.min(Math.max(quantity, 1), item.available)
}

function resetForm() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = null
  requestId += 1
  sourceLocation.value = props.initialSource || 'retail'
  comment.value = ''
  search.value = ''
  results.value = []
  selectedItems.value = []
  errorMessage.value = ''
  loadErrorMessage.value = ''
  loading.value = false
  transferCreateKey.value = newRequestKey()
}

function newRequestKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function openCreate() {
  invalidateTransferLoads()
  detailsRequestId += 1
  openingTransferId.value = ''
  activeTransfer.value = null
  detailError.value = ''
  failedImageIds.value = new Set()
  resetForm()
  view.value = 'create'
  void loadItems()
}

function backToList() {
  if (submitting.value || actionSubmitting.value) return
  if (view.value === 'create' && hasUnsavedDraft.value && !confirm('Закрыть заявку? Данные заявки не сохранятся.')) return
  detailsRequestId += 1
  openingTransferId.value = ''
  activeTransfer.value = null
  actionMessage.value = ''
  errorMessage.value = ''
  detailError.value = ''
  failedImageIds.value = new Set()
  resetForm()
  view.value = 'list'
  void loadTransfers()
}

function swapDirection() {
  if (selectedItems.value.length && !confirm('Поменять направление? Выбранные товары будут удалены.')) return
  sourceLocation.value = destinationLocation.value
  selectedItems.value = []
  void loadItems()
}

function closeModal() {
  if (submitting.value || actionSubmitting.value) return
  if (view.value === 'create' && hasUnsavedDraft.value && !confirm('Закрыть заявку? Данные заявки не сохранятся.')) return
  detailsRequestId += 1
  openingTransferId.value = ''
  invalidateTransferLoads()
  emit('close')
}

async function ensureStaffTrackingKnown() {
  if (staffTrackingEnabled.value !== null) return true
  try {
    await crmStore.fetchStaffSettings()
    return true
  } catch {
    errorMessage.value = 'Не удалось проверить режим учёта сотрудников'
    return false
  }
}

async function requestCreateTransfer() {
  if (!selectedItems.value.length || submitting.value) return
  selectedItems.value.forEach(clampQuantity)
  if (!await ensureStaffTrackingKnown()) return
  if (!staffTrackingEnabled.value) {
    await submitTransfer()
    return
  }
  actorPromptAction.value = 'create'
  actorPromptError.value = ''
  actorPromptErrorCode.value = ''
  actorPromptOpen.value = true
}

async function requestCompleteTransfer() {
  if (!activeTransfer.value || actionSubmitting.value) return
  if (!await ensureStaffTrackingKnown()) return
  if (!staffTrackingEnabled.value) {
    await completeTransfer()
    return
  }
  actorPromptAction.value = 'complete'
  actorPromptError.value = ''
  actorPromptErrorCode.value = ''
  actorPromptOpen.value = true
}

async function requestCancelTransfer() {
  if (!activeTransfer.value || actionSubmitting.value) return
  if (!await ensureStaffTrackingKnown()) return
  actorPromptError.value = ''
  actorPromptErrorCode.value = ''
  if (!staffTrackingEnabled.value) {
    cancelConfirmOpen.value = true
    return
  }
  actorPromptAction.value = 'cancel'
  actorPromptOpen.value = true
}

function closeActorPrompt() {
  if (actorActionLoading.value) return
  actorPromptOpen.value = false
  actorPromptError.value = ''
  actorPromptErrorCode.value = ''
  actorPromptAction.value = null
}

async function confirmActorAction(actor: { employeeId: string; pin: string }) {
  if (actorActionLoading.value) return
  if (actorPromptAction.value === 'create') {
    await submitTransfer(actor)
    return
  }
  if (actorPromptAction.value === 'complete') {
    await completeTransfer(actor)
    return
  }
  if (actorPromptAction.value === 'cancel') {
    await cancelTransfer(actor)
  }
}

async function submitTransfer(actor?: { employeeId: string; pin: string }) {
  if (!selectedItems.value.length || submitting.value) return
  selectedItems.value.forEach(clampQuantity)
  submitting.value = true
  errorMessage.value = ''
  actorPromptError.value = ''
  actorPromptErrorCode.value = ''
  try {
    const transfer = await adminStore.createInventoryTransfer({
      idempotency_key: transferCreateKey.value,
      source_location: sourceLocation.value,
      destination_location: destinationLocation.value,
      comment: comment.value.trim() || undefined,
      ...(actor
        ? {
            actor_employee_id: actor.employeeId,
            actor_pin: actor.pin,
          }
        : {}),
      items: selectedItems.value.map((item) => ({ product_id: item.productId, variant_id: item.variantId, quantity: item.quantity })),
    })
    emit('saved', { number: transfer.transfer_number })
    resetForm()
    activeTransfer.value = transfer
    view.value = 'details'
    actorPromptOpen.value = false
    actorPromptAction.value = null
    void loadTransfers()
  } catch (error: any) {
    actorPromptErrorCode.value = String(error?.code || error?.data?.error || '')
    const code = String(error?.data?.error || '')
    actorPromptError.value = error?.outcomeUnknown
      ? 'Ответ сервера не получен. Обновите список перемещений перед повтором, чтобы не создать дубль.'
      : code.startsWith('insufficient_stock:')
      ? 'Остаток изменился. Обновите список и проверьте количество.'
      : error?.status === 409
        ? 'Данные уже изменились. Обновите остатки и проверьте заявку.'
        : error?.data?.message || error?.message || 'Не удалось сохранить заявку. Состав не потерян.'
  } finally {
    submitting.value = false
  }
}

async function completeTransfer(actor?: { employeeId: string; pin: string }) {
  if (!activeTransfer.value || actionSubmitting.value) return
  const transferId = activeTransfer.value.id
  const idempotencyKey =
    transferCompletionKeys.get(transferId) || newRequestKey()
  transferCompletionKeys.set(transferId, idempotencyKey)
  actionSubmitting.value = true
  errorMessage.value = ''
  actionMessage.value = ''
  actorPromptError.value = ''
  actorPromptErrorCode.value = ''
  try {
    const completed = await adminStore.completeInventoryTransfer(transferId, {
      ...(actor
        ? {
            actor_employee_id: actor.employeeId,
            actor_pin: actor.pin,
          }
        : {}),
      idempotency_key: idempotencyKey,
    })
    transferCompletionKeys.delete(transferId)
    activeTransfer.value = completed
    actionMessage.value = 'Перемещение оприходовано'
    actorPromptOpen.value = false
    actorPromptAction.value = null
    emit('completed', { quantity: Number(completed.total_quantity || 0), destination: completed.destination_location })
    void loadTransfers()
  } catch (error: any) {
    actorPromptErrorCode.value = String(error?.code || error?.data?.error || '')
    const code = String(error?.data?.error || '')
    actorPromptError.value = error?.outcomeUnknown
      ? 'Ответ сервера не получен. Обновите перемещение перед повтором: оно могло быть оприходовано.'
      : code.startsWith('insufficient_stock:')
      ? 'В точке отправления уже не хватает товара. Проверьте остатки.'
      : error?.status === 409
        ? 'Перемещение уже изменено другим пользователем. Обновите данные.'
        : error?.data?.message || error?.message || 'Не удалось оприходовать перемещение'
  } finally {
    actionSubmitting.value = false
  }
}

async function cancelTransfer(actor?: { employeeId: string; pin: string }) {
  if (!activeTransfer.value || actionSubmitting.value) return
  actionSubmitting.value = true
  errorMessage.value = ''
  actionMessage.value = ''
  actorPromptError.value = ''
  actorPromptErrorCode.value = ''
  try {
    const cancelled = await adminStore.cancelInventoryTransfer(
      activeTransfer.value.id,
      actor
        ? {
            actor_employee_id: actor.employeeId,
            actor_pin: actor.pin,
          }
        : {},
    )
    activeTransfer.value = cancelled
    actionMessage.value = 'Заявка отменена'
    cancelConfirmOpen.value = false
    actorPromptOpen.value = false
    actorPromptAction.value = null
    emit('cancelled', { number: cancelled.transfer_number })
    void loadTransfers()
  } catch (error: any) {
    console.error('[inventory] Failed to cancel transfer', error)
    actorPromptErrorCode.value = String(error?.code || error?.data?.error || '')
    const message =
      error?.status === 409
        ? 'Перемещение уже изменено другим пользователем. Обновите данные.'
        : error?.data?.message || error?.message || 'Не удалось отменить заявку'
    if (actorPromptOpen.value) actorPromptError.value = message
    else errorMessage.value = message
  } finally {
    actionSubmitting.value = false
  }
}

watch(() => props.isOpen, (open) => {
  if (!open) {
    actorPromptOpen.value = false
    actorPromptAction.value = null
    cancelConfirmOpen.value = false
    actorPromptError.value = ''
    actorPromptErrorCode.value = ''
    detailsRequestId += 1
    openingTransferId.value = ''
    invalidateTransferLoads()
    resetForm()
    view.value = 'list'
    activeTransfer.value = null
    failedImageIds.value = new Set()
    return
  }
  detailError.value = ''
  failedImageIds.value = new Set()
  loadMoreError.value = ''
  resetForm()
  void loadTransfers()
})

watch(search, () => {
  if (!props.isOpen || view.value !== 'create') return
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void loadItems(), 250)
})

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
  requestId += 1
})
</script>

<style scoped>
@media (min-width: 640px) {
  .transfer-scroll {
    scrollbar-color: #cbd5e1 transparent;
    scrollbar-width: thin;
  }

  .transfer-scroll::-webkit-scrollbar {
    width: 7px;
  }

  .transfer-scroll::-webkit-scrollbar-track {
    background: transparent;
  }

  .transfer-scroll::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 999px;
  }

  .transfer-scroll::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
}
</style>
