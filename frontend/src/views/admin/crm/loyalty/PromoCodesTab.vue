<template>
  <div class="space-y-5">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-3">
      <select
        v-model="filter"
        class="rounded-xl border border-slate-200/40 bg-gradient-to-br from-slate-50/90 to-gray-50/60 px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition-all duration-200 hover:border-slate-300/50 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
        @change="loadPromoCodes"
      >
        <option value="">Все статусы</option>
        <option value="active">Активные</option>
        <option value="inactive">Неактивные</option>
        <option value="expired">Истекшие</option>
        <option value="exhausted">Исчерпанные</option>
      </select>

      <div class="relative flex-1 sm:flex-none">
        <input
          v-model="search"
          type="search"
          placeholder="Поиск по коду..."
          class="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:w-64"
          @input="debouncedSearch"
        />
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      <div class="flex-1"></div>

      <button
        @click="openCreateModal"
        class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        <span class="hidden sm:inline">Создать промокод</span>
        <span class="sm:hidden">Создать</span>
      </button>
    </div>

    <!-- Table -->
    <div class="rounded-2xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-slate-50/80 border-b border-slate-200/60">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Код</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Описание</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Скидка</th>
              <th class="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Использований</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Срок</th>
              <th class="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Статус</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Действия</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="crmStore.promoCodesLoading && !promoCodes.length">
              <td colspan="7" class="px-4 py-12 text-center text-slate-400">
                <svg class="mx-auto mb-2 h-6 w-6 animate-spin text-slate-300" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Загрузка...
              </td>
            </tr>
            <tr v-else-if="!promoCodes.length">
              <td colspan="7" class="px-4 py-12 text-center text-slate-400">
                Нет промокодов
              </td>
            </tr>
            <tr
              v-for="promo in promoCodes"
              :key="promo.id"
              class="hover:bg-slate-50/60 transition-colors duration-150"
            >
              <td class="px-4 py-3.5">
                <span class="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-sm font-semibold text-slate-800">
                  {{ promo.code }}
                </span>
              </td>
              <td class="px-4 py-3.5 text-sm text-slate-600 max-w-[200px] truncate">
                {{ promo.description || '-' }}
              </td>
              <td class="px-4 py-3.5 text-sm text-right font-semibold text-slate-800">
                <template v-if="promo.discount_type === 'fixed'">{{ promo.discount_value }} BYN</template>
                <template v-else>{{ promo.discount_value }}%</template>
              </td>
              <td class="px-4 py-3.5 text-center">
                <button
                  @click="openUsageModal(promo)"
                  class="group inline-flex flex-col items-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-slate-50"
                  :title="promo.max_uses > 0 ? `${promo.current_uses} из ${promo.max_uses} использований` : `${promo.current_uses} использований`"
                >
                  <span class="text-sm font-medium text-slate-700">
                    {{ promo.current_uses }}<span class="text-slate-400 font-normal" v-if="promo.max_uses > 0"> / {{ promo.max_uses }}</span><span class="text-slate-400 font-normal" v-else> / ∞</span>
                  </span>
                  <div v-if="promo.max_uses > 0" class="w-12 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div 
                      class="h-full rounded-full transition-all"
                      :class="getUsageBarClass(promo)"
                      :style="{ width: Math.min(100, (promo.current_uses / promo.max_uses) * 100) + '%' }"
                    />
                  </div>
                </button>
              </td>
              <td class="px-4 py-3.5 text-sm text-slate-500">
                <template v-if="promo.valid_from || promo.valid_until">
                  <span v-if="promo.valid_from">{{ formatDate(promo.valid_from) }}</span>
                  <span v-if="promo.valid_from && promo.valid_until" class="text-slate-300"> - </span>
                  <span v-if="promo.valid_until">{{ formatDate(promo.valid_until) }}</span>
                </template>
                <span v-else class="text-slate-300">Бессрочный</span>
              </td>
              <td class="px-4 py-3.5 text-center">
                <span
                  class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                  :class="getStatusClass(promo)"
                >
                  {{ getStatusText(promo) }}
                </span>
              </td>
              <td class="px-4 py-3.5 text-right">
                <div class="flex items-center justify-end gap-1">
                  <button
                    @click="openEditModal(promo)"
                    class="rounded-lg p-2 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600"
                    title="Редактировать"
                  >
                    <PencilIcon class="h-4 w-4" />
                  </button>
                  <button
                    @click="handleDelete(promo)"
                    class="rounded-lg p-2 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
                    title="Удалить"
                  >
                    <TrashIcon class="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="formModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        @click.self="closeFormModal"
      >
        <Transition
          enter-active-class="transition ease-out duration-200"
          enter-from-class="opacity-0 scale-95 translate-y-2"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition ease-in duration-150"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-95 translate-y-2"
        >
          <div v-if="formModalOpen" class="w-full max-w-lg rounded-2xl border border-slate-200/40 bg-white p-6 shadow-2xl">
            <h3 class="text-lg font-bold text-slate-900 mb-5">
              {{ editingPromo ? 'Редактировать промокод' : 'Создать промокод' }}
            </h3>

            <form @submit.prevent="handleSubmit" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1.5">Код промокода</label>
                <div class="flex gap-2">
                  <input
                    v-model="form.code"
                    type="text"
                    class="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm uppercase focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="SALE2026"
                    required
                  />
                  <button
                    type="button"
                    @click="generateCode"
                    class="rounded-xl border border-slate-200/40 bg-gradient-to-br from-slate-50/90 to-gray-50/60 px-3 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300/50 hover:shadow-md whitespace-nowrap"
                  >
                    Сгенерировать
                  </button>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1.5">Описание</label>
                <textarea
                  v-model="form.description"
                  rows="2"
                  class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Описание акции или промокода"
                ></textarea>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1.5">Тип скидки</label>
                  <select
                    v-model="form.discount_type"
                    class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="fixed">Фиксированная (BYN)</option>
                    <option value="percent">Процент (%)</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1.5">Значение скидки</label>
                  <input
                    v-model.number="form.discount_value"
                    type="number"
                    min="0.01"
                    step="0.01"
                    :max="form.discount_type === 'percent' ? 100 : undefined"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    required
                  />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1.5">Мин. сумма заказа</label>
                  <input
                    v-model.number="form.min_order_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="0 = без ограничения"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1.5">Макс. использований</label>
                  <input
                    v-model.number="form.max_uses"
                    type="number"
                    min="0"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="0 = безлимит"
                  />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1.5">Действует с</label>
                  <input
                    v-model="form.valid_from"
                    type="datetime-local"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1.5">Действует до</label>
                  <input
                    v-model="form.valid_until"
                    type="datetime-local"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>

              <div class="flex items-center gap-2.5">
                <div
                  @click="form.active = !form.active"
                  class="relative h-6 w-11 cursor-pointer rounded-full transition-colors duration-200"
                  :class="form.active ? 'bg-blue-500' : 'bg-slate-300'"
                >
                  <div
                    class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200"
                    :class="form.active ? 'left-[22px]' : 'left-0.5'"
                  />
                </div>
                <label class="text-sm font-medium text-slate-700 cursor-pointer" @click="form.active = !form.active">Активен</label>
              </div>

              <p v-if="formError" class="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{{ formError }}</p>

              <div class="flex gap-3 pt-2">
                <button
                  type="submit"
                  :disabled="formSubmitting"
                  class="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {{ formSubmitting ? 'Сохранение...' : (editingPromo ? 'Сохранить' : 'Создать') }}
                </button>
                <button
                  type="button"
                  @click="closeFormModal"
                  class="flex-1 rounded-xl border border-slate-200/40 bg-gradient-to-br from-slate-50/90 to-gray-50/60 px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition-all duration-200 hover:border-slate-300/50 hover:shadow-md"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </Transition>
      </div>
    </Transition>

    <!-- Usage History Modal -->
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="usageModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        @click.self="usageModalOpen = false"
      >
        <div class="w-full max-w-lg rounded-2xl border border-slate-200/40 bg-white p-6 shadow-2xl">
          <h3 class="text-lg font-bold text-slate-900 mb-4">
            История использований: <span class="font-mono">{{ usagePromo?.code }}</span>
          </h3>

          <div v-if="usageLoading" class="py-10 text-center text-slate-400">
            <svg class="mx-auto mb-2 h-6 w-6 animate-spin text-slate-300" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Загрузка...
          </div>
          <div v-else-if="!usageList.length" class="py-10 text-center text-slate-400">
            Промокод еще не использовался
          </div>
          <div v-else class="rounded-xl border border-slate-200/60 overflow-hidden">
            <table class="w-full">
              <thead class="bg-slate-50/80 border-b border-slate-200/60">
                <tr>
                  <th class="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Заказ</th>
                  <th class="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Клиент</th>
                  <th class="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">Скидка</th>
                  <th class="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">Дата</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="u in usageList" :key="u.id" class="hover:bg-slate-50/60 transition-colors">
                  <td class="px-4 py-2.5 text-sm font-semibold text-slate-800">#{{ u.order_number }}</td>
                  <td class="px-4 py-2.5 text-sm text-slate-600">{{ u.customer_name?.trim() || u.telegram_username || '-' }}</td>
                  <td class="px-4 py-2.5 text-sm text-right font-semibold text-slate-800">{{ u.discount_applied }} BYN</td>
                  <td class="px-4 py-2.5 text-sm text-right text-slate-400">{{ formatDateTime(u.used_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="flex justify-end mt-5">
            <button
              @click="usageModalOpen = false"
              class="rounded-xl border border-slate-200/40 bg-gradient-to-br from-slate-50/90 to-gray-50/60 px-5 py-2 text-sm font-medium text-slate-600 shadow-sm transition-all duration-200 hover:border-slate-300/50 hover:shadow-md"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { PencilIcon, TrashIcon } from '@heroicons/vue/24/outline'
import { useCrmStore, type PromoCode, type PromoUsage } from '@/stores/crm'

const crmStore = useCrmStore()
const promoCodes = computed(() => crmStore.promoCodes)

const filter = ref('')
const search = ref('')
let searchTimeout: ReturnType<typeof setTimeout> | null = null

// Form modal
const formModalOpen = ref(false)
const editingPromo = ref<PromoCode | null>(null)
const formSubmitting = ref(false)
const formError = ref('')
const form = ref(getEmptyForm())

function getEmptyForm() {
  return {
    code: '',
    description: '',
    discount_type: 'fixed' as 'fixed' | 'percent',
    discount_value: 0,
    min_order_amount: 0,
    max_uses: 1,
    valid_from: '',
    valid_until: '',
    active: true,
  }
}

// Usage modal
const usageModalOpen = ref(false)
const usagePromo = ref<PromoCode | null>(null)
const usageList = ref<PromoUsage[]>([])
const usageLoading = ref(false)

onMounted(() => {
  loadPromoCodes()
})

async function loadPromoCodes() {
  await crmStore.fetchPromoCodes({
    search: search.value || undefined,
    filter: filter.value || undefined,
  })
}

function debouncedSearch() {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => loadPromoCodes(), 400)
}

function openCreateModal() {
  editingPromo.value = null
  form.value = getEmptyForm()
  formError.value = ''
  formModalOpen.value = true
}

function openEditModal(promo: PromoCode) {
  editingPromo.value = promo
  form.value = {
    code: promo.code,
    description: promo.description || '',
    discount_type: promo.discount_type,
    discount_value: promo.discount_value,
    min_order_amount: promo.min_order_amount,
    max_uses: promo.max_uses,
    valid_from: promo.valid_from ? promo.valid_from.slice(0, 16) : '',
    valid_until: promo.valid_until ? promo.valid_until.slice(0, 16) : '',
    active: Boolean(promo.active),
  }
  formError.value = ''
  formModalOpen.value = true
}

function closeFormModal() {
  if (formSubmitting.value) return
  formModalOpen.value = false
  editingPromo.value = null
}

async function handleSubmit() {
  formError.value = ''
  formSubmitting.value = true

  try {
    const data = {
      ...form.value,
      valid_from: form.value.valid_from || null,
      valid_until: form.value.valid_until || null,
      active: form.value.active ? 1 : 0,
    }

    if (editingPromo.value) {
      await crmStore.updatePromoCode(editingPromo.value.id, data)
    } else {
      await crmStore.createPromoCode(data)
    }

    formModalOpen.value = false
    editingPromo.value = null
  } catch (error: any) {
    const msg = error?.message || ''
    if (msg.includes('code_exists') || msg.includes('уже существует')) {
      formError.value = 'Промокод с таким кодом уже существует'
    } else {
      formError.value = msg || 'Не удалось сохранить промокод'
    }
  } finally {
    formSubmitting.value = false
  }
}

async function handleDelete(promo: PromoCode) {
  const action = promo.current_uses > 0 ? 'деактивирован' : 'удален'
  if (!confirm(`Промокод ${promo.code} будет ${action}. Продолжить?`)) return

  try {
    await crmStore.deletePromoCode(promo.id)
  } catch (error: any) {
    alert(error?.message || 'Не удалось удалить промокод')
  }
}

async function openUsageModal(promo: PromoCode) {
  usagePromo.value = promo
  usageList.value = []
  usageModalOpen.value = true
  usageLoading.value = true

  try {
    usageList.value = await crmStore.fetchPromoUsage(promo.id)
  } catch {
    usageList.value = []
  } finally {
    usageLoading.value = false
  }
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  form.value.code = code
}

function getStatusText(promo: PromoCode): string {
  if (!promo.active) return 'Неактивен'
  const now = new Date().toISOString()
  if (promo.valid_until && now > promo.valid_until) return 'Истек'
  if (promo.max_uses > 0 && promo.current_uses >= promo.max_uses) return 'Исчерпан'
  if (promo.valid_from && now < promo.valid_from) return 'Ожидает'
  return 'Активен'
}

function getStatusClass(promo: PromoCode): string {
  const status = getStatusText(promo)
  switch (status) {
    case 'Активен': return 'bg-green-100 text-green-700'
    case 'Неактивен': return 'bg-slate-100 text-slate-500'
    case 'Истек': return 'bg-red-100 text-red-700'
    case 'Исчерпан': return 'bg-amber-100 text-amber-700'
    case 'Ожидает': return 'bg-blue-100 text-blue-700'
    default: return 'bg-slate-100 text-slate-500'
  }
}

function getUsageBarClass(promo: PromoCode): string {
  if (promo.max_uses <= 0) return 'bg-slate-300'
  const ratio = promo.current_uses / promo.max_uses
  if (ratio >= 1) return 'bg-red-400'
  if (ratio >= 0.75) return 'bg-amber-400'
  if (ratio >= 0.5) return 'bg-blue-400'
  return 'bg-green-400'
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
  } catch {
    return dateStr
  }
}

function formatDateTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return dateStr
  }
}
</script>
