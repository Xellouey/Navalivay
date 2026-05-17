<template>
  <div class="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
    <div class="mx-auto w-full max-w-7xl space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center gap-4">
        <h1 class="text-2xl font-bold text-gray-900 sm:text-3xl shrink-0">
          Рулетка призов
        </h1>
        <p class="text-sm text-slate-500">
          Призы — это шаблоны промокодов, которые автоматически выдаются при выпадении.
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5"
          :class="
            activeTab === tab.id
              ? 'border-slate-300 bg-white text-slate-800 shadow-md'
              : 'border-slate-200/40 bg-gradient-to-br from-slate-50/90 to-gray-50/60 text-slate-500 hover:border-slate-300/50 hover:shadow-md'
          "
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <section v-if="activeTab === 'dashboard'" class="space-y-4">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
            <p class="text-xs uppercase tracking-wider text-slate-500">Всего спинов</p>
            <p class="mt-1 text-2xl font-bold text-slate-900">
              {{ dashboard.totals?.total_spins ?? 0 }}
            </p>
          </div>
          <div class="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
            <p class="text-xs uppercase tracking-wider text-slate-500">Из них «ничего»</p>
            <p class="mt-1 text-2xl font-bold text-slate-900">
              {{ dashboard.totals?.nothing_spins ?? 0 }}
            </p>
          </div>
          <div class="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
            <p class="text-xs uppercase tracking-wider text-slate-500">Эпические выдачи</p>
            <p class="mt-1 text-2xl font-bold text-slate-900">
              {{ dashboard.totals?.epic_releases ?? 0 }}
            </p>
          </div>
          <div class="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
            <p class="text-xs uppercase tracking-wider text-slate-500">Pity-выдачи</p>
            <p class="mt-1 text-2xl font-bold text-slate-900">
              {{ dashboard.totals?.pity_releases ?? 0 }}
            </p>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
          <h3 class="text-sm font-semibold text-slate-800">Распределение по редкостям</h3>
          <div class="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div
              v-for="row in dashboard.rarity_breakdown || []"
              :key="row.rarity_code"
              class="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
            >
              <span class="text-slate-600">{{ rarityLabel(row.rarity_code) }}</span>
              <span class="font-semibold text-slate-900">{{ row.count }}</span>
            </div>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
          <h3 class="text-sm font-semibold text-slate-800">Активные эпические пулы</h3>
          <p
            v-if="!(dashboard.active_epic_pools || []).length"
            class="mt-2 text-sm text-slate-400"
          >
            Сейчас нет активных пулов.
          </p>
          <ul v-else class="mt-3 space-y-2">
            <li
              v-for="pool in dashboard.active_epic_pools"
              :key="pool.id"
              class="rounded-lg border border-slate-100 px-3 py-2 text-sm"
            >
              <p class="font-semibold text-slate-800">{{ pool.prize_title }}</p>
              <p class="text-xs text-slate-500">
                {{ pool.qualified_customers.length }} / {{ pool.pool_size }} претендентов,
                порог {{ pool.threshold_byn }} BYN.
              </p>
            </li>
          </ul>
        </div>

        <div class="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
          <h3 class="text-sm font-semibold text-slate-800">Призы и расход</h3>
          <table class="mt-3 w-full text-sm">
            <thead class="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th class="text-left py-2">Приз</th>
                <th class="text-left py-2">Редкость</th>
                <th class="text-right py-2">Выдано</th>
                <th class="text-right py-2">Лимит</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="prize in dashboard.prizes_issued || []" :key="prize.id">
                <td class="py-2 font-medium text-slate-800">{{ prize.title }}</td>
                <td class="py-2 text-slate-600">{{ rarityLabel(prize.rarity_code) }}</td>
                <td class="py-2 text-right text-slate-700">{{ prize.issued_count }}</td>
                <td class="py-2 text-right text-slate-500">
                  {{ prize.max_total === 0 ? '∞' : prize.max_total }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-else-if="activeTab === 'prizes'" class="space-y-4">
        <div class="flex justify-between items-center">
          <p class="text-sm text-slate-500">
            При выпадении приза автоматически генерируется уникальный промокод по выбранному
            шаблону и кладётся клиенту в «Мои активные призы».
          </p>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:from-blue-700 hover:to-indigo-700"
            @click="openCreateModal"
          >
            + Новый приз
          </button>
        </div>

        <div class="rounded-2xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th class="text-left px-3 py-2.5">Название</th>
                <th class="text-left px-3 py-2.5">Редкость</th>
                <th class="text-right px-3 py-2.5">Вес</th>
                <th class="text-right px-3 py-2.5">Лимит</th>
                <th class="text-right px-3 py-2.5">Выдано</th>
                <th class="text-center px-3 py-2.5">Розница</th>
                <th class="text-center px-3 py-2.5">Опт</th>
                <th class="text-center px-3 py-2.5">Активен</th>
                <th class="text-right px-3 py-2.5">Действия</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="!prizes.length">
                <td colspan="9" class="px-3 py-8 text-center text-slate-400">
                  Призов пока нет.
                </td>
              </tr>
              <tr v-for="prize in prizes" :key="prize.id">
                <td class="px-3 py-2.5 font-medium text-slate-800">{{ prize.title }}</td>
                <td class="px-3 py-2.5 text-slate-600">
                  {{ rarityLabel(prize.rarity_code) }}
                </td>
                <td class="px-3 py-2.5 text-right text-slate-700">{{ prize.weight }}</td>
                <td class="px-3 py-2.5 text-right text-slate-500">
                  {{ prize.max_total === 0 ? '∞' : prize.max_total }}
                </td>
                <td class="px-3 py-2.5 text-right text-slate-700">{{ prize.issued_count }}</td>
                <td class="px-3 py-2.5 text-center">
                  {{ prize.is_for_retail ? '✓' : '—' }}
                </td>
                <td class="px-3 py-2.5 text-center">
                  {{ prize.is_for_wholesale ? '✓' : '—' }}
                </td>
                <td class="px-3 py-2.5 text-center">
                  {{ prize.is_active ? '✓' : '—' }}
                </td>
                <td class="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    class="text-blue-600 hover:underline mr-3"
                    @click="openEditModal(prize)"
                  >
                    Редактировать
                  </button>
                  <button
                    type="button"
                    class="text-rose-600 hover:underline"
                    @click="deletePrize(prize)"
                  >
                    Скрыть
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-else-if="activeTab === 'settings'" class="space-y-4">
        <div class="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label class="flex flex-col gap-1">
              <span class="text-xs uppercase tracking-wider text-slate-500">Розница: 1 спин за BYN</span>
              <input
                v-model.number="settingsForm.spin_byn_retail"
                type="number"
                min="1"
                class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs uppercase tracking-wider text-slate-500">Опт: 1 спин за BYN</span>
              <input
                v-model.number="settingsForm.spin_byn_wholesale"
                type="number"
                min="1"
                class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs uppercase tracking-wider text-slate-500">
                Pity-таймер (ничего подряд)
              </span>
              <input
                v-model.number="settingsForm.pity_threshold"
                type="number"
                min="1"
                class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs uppercase tracking-wider text-slate-500">
                Срок промокода по умолчанию (дн)
              </span>
              <input
                v-model.number="settingsForm.default_promo_validity_days"
                type="number"
                min="1"
                class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs uppercase tracking-wider text-slate-500">
                Размер ленты выигрышей
              </span>
              <input
                v-model.number="settingsForm.feed_size"
                type="number"
                min="1"
                class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs uppercase tracking-wider text-slate-500">
                Старт сбора покупок
              </span>
              <input
                v-model="settingsForm.start_collecting_at"
                type="datetime-local"
                class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <fieldset>
            <legend class="text-xs uppercase tracking-wider text-slate-500 mb-2">
              Какие редкости считаются «элитными» (доступны только через эпический пул)
            </legend>
            <div class="flex flex-wrap gap-2">
              <label
                v-for="rarity in rarities"
                :key="rarity.code"
                class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  :value="rarity.code"
                  v-model="settingsForm.elite_rarities"
                />
                {{ rarity.label }}
              </label>
            </div>
          </fieldset>
          <div class="flex justify-end">
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md hover:from-blue-700 hover:to-indigo-700"
              @click="saveSettings"
            >
              Сохранить настройки
            </button>
          </div>
        </div>
      </section>

      <section v-else-if="activeTab === 'spins'" class="space-y-4">
        <div class="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th class="text-left py-2">Когда</th>
                <th class="text-left py-2">Клиент</th>
                <th class="text-left py-2">Приз</th>
                <th class="text-left py-2">Редкость</th>
                <th class="text-center py-2">Опт</th>
                <th class="text-left py-2">Промокод</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="!spins.rows?.length">
                <td colspan="6" class="py-8 text-center text-slate-400">
                  Прокруток пока нет.
                </td>
              </tr>
              <tr v-for="spin in spins.rows || []" :key="spin.id">
                <td class="py-2 text-slate-600 whitespace-nowrap">
                  {{ formatDateTime(spin.spun_at) }}
                </td>
                <td class="py-2 text-slate-700">
                  {{ spin.first_name || '—' }}
                  <span v-if="spin.telegram_username" class="text-slate-400">
                    @{{ spin.telegram_username }}
                  </span>
                </td>
                <td class="py-2 text-slate-800 font-medium">{{ spin.prize_title }}</td>
                <td class="py-2 text-slate-600">{{ rarityLabel(spin.rarity_code) }}</td>
                <td class="py-2 text-center">{{ spin.is_wholesale ? '✓' : '—' }}</td>
                <td class="py-2 font-mono text-slate-700">
                  {{ spin.generated_promo_code || '—' }}
                </td>
              </tr>
            </tbody>
          </table>
          <div class="mt-3 flex items-center justify-between text-sm text-slate-500">
            <span>Всего: {{ spins.total }}</span>
            <div class="space-x-2">
              <button
                type="button"
                class="px-3 py-1 rounded border border-slate-200"
                :disabled="spinsOffset === 0"
                @click="changeSpinsPage(-1)"
              >
                Назад
              </button>
              <button
                type="button"
                class="px-3 py-1 rounded border border-slate-200"
                :disabled="spinsOffset + spinsLimit >= spins.total"
                @click="changeSpinsPage(1)"
              >
                Вперёд
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <Transition name="modal-fade">
      <div
        v-if="prizeModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        @click.self="closeModal"
      >
        <form
          class="w-full max-w-xl rounded-2xl bg-white shadow-2xl p-5 max-h-[90vh] overflow-y-auto"
          @submit.prevent="savePrize"
        >
          <h2 class="text-lg font-semibold text-slate-900 mb-4">
            {{ prizeForm.id ? 'Редактировать приз' : 'Новый приз' }}
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="flex flex-col gap-1 col-span-full">
              <span class="text-xs uppercase tracking-wider text-slate-500">Название</span>
              <input
                v-model="prizeForm.title"
                type="text"
                required
                class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label class="flex flex-col gap-1 col-span-full">
              <span class="text-xs uppercase tracking-wider text-slate-500">Описание для клиента</span>
              <textarea
                v-model="prizeForm.description"
                rows="2"
                class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              ></textarea>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs uppercase tracking-wider text-slate-500">Редкость</span>
              <select
                v-model="prizeForm.rarity_code"
                class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option v-for="rarity in rarities" :key="rarity.code" :value="rarity.code">
                  {{ rarity.label }}
                </option>
              </select>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs uppercase tracking-wider text-slate-500">Шаблон промокода</span>
              <select
                v-model="prizeForm.promo_template_id"
                class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option :value="null">— нет (для редкости «ничего»)</option>
                <option v-for="promo in promoTemplates" :key="promo.id" :value="promo.id">
                  {{ promo.code }} ({{ promo.discount_type === 'fixed' ? `${promo.discount_value} BYN` : `${promo.discount_value}%` }})
                </option>
              </select>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs uppercase tracking-wider text-slate-500">Вес (выпадение)</span>
              <input
                v-model.number="prizeForm.weight"
                type="number"
                min="0"
                step="0.1"
                class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs uppercase tracking-wider text-slate-500">Лимит выдачи (0 = ∞)</span>
              <input
                v-model.number="prizeForm.max_total"
                type="number"
                min="0"
                class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs uppercase tracking-wider text-slate-500">Срок промокода (дн)</span>
              <input
                v-model.number="prizeForm.promo_validity_days"
                type="number"
                min="1"
                class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs uppercase tracking-wider text-slate-500">Эпический пул: размер</span>
              <input
                v-model.number="prizeForm.epic_pool_size"
                type="number"
                min="1"
                class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs uppercase tracking-wider text-slate-500">Эпический пул: порог BYN</span>
              <input
                v-model.number="prizeForm.epic_pool_threshold_byn"
                type="number"
                min="0"
                step="0.01"
                class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs uppercase tracking-wider text-slate-500">Порядок</span>
              <input
                v-model.number="prizeForm.sort_order"
                type="number"
                class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <div class="col-span-full flex flex-wrap gap-3">
              <label class="inline-flex items-center gap-2 text-sm">
                <input v-model="prizeForm.is_for_retail" type="checkbox" />
                Розничный пул
              </label>
              <label class="inline-flex items-center gap-2 text-sm">
                <input v-model="prizeForm.is_for_wholesale" type="checkbox" />
                Оптовый пул
              </label>
              <label class="inline-flex items-center gap-2 text-sm">
                <input v-model="prizeForm.is_active" type="checkbox" />
                Активен
              </label>
            </div>
          </div>
          <div class="mt-5 flex justify-end gap-2">
            <button
              type="button"
              class="px-4 py-2 rounded-xl border border-slate-200 text-slate-600"
              @click="closeModal"
            >
              Отмена
            </button>
            <button
              type="submit"
              class="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, computed, watch } from 'vue'

interface WheelRarity {
  code: string
  label: string
  bgColor?: string
  textColor?: string
  sort_order?: number
  is_elite?: number | boolean
}

interface WheelPrize {
  id: string
  rarity_code: string
  title: string
  description: string | null
  image_url: string | null
  weight: number
  max_total: number
  issued_count: number
  is_for_retail: boolean | number
  is_for_wholesale: boolean | number
  promo_template_id: string | null
  promo_validity_days: number
  epic_pool_size: number
  epic_pool_threshold_byn: number
  is_active: boolean | number
  sort_order: number
  rarity?: WheelRarity | null
}

interface PromoTemplate {
  id: string
  code: string
  discount_type: string
  discount_value: number
}

interface DashboardData {
  totals?: {
    total_spins: number
    nothing_spins: number
    epic_releases: number
    pity_releases: number
  }
  rarity_breakdown?: Array<{ rarity_code: string; count: number }>
  active_epic_pools?: Array<{
    id: string
    prize_id: string
    prize_title: string
    pool_size: number
    threshold_byn: number
    qualified_customers: string[]
  }>
  prizes_issued?: Array<{
    id: string
    title: string
    rarity_code: string
    issued_count: number
    max_total: number
  }>
}

interface SpinsResponse {
  rows: Array<{
    id: string
    spun_at: string
    rarity_code: string
    is_wholesale: number
    prize_title: string
    generated_promo_code: string | null
    first_name: string | null
    telegram_username: string | null
  }>
  total: number
}

const tabs = [
  { id: 'dashboard', label: 'Обзор' },
  { id: 'prizes', label: 'Призы' },
  { id: 'settings', label: 'Настройки' },
  { id: 'spins', label: 'Лог прокруток' },
] as const

type WheelTabId = (typeof tabs)[number]['id']
const activeTab = ref<WheelTabId>('dashboard')

const rarities = ref<WheelRarity[]>([])
const prizes = ref<WheelPrize[]>([])
const promoTemplates = ref<PromoTemplate[]>([])
const dashboard = ref<DashboardData>({})
const spins = ref<SpinsResponse>({ rows: [], total: 0 })
const spinsOffset = ref(0)
const spinsLimit = ref(50)

const settingsForm = reactive({
  spin_byn_retail: 40,
  spin_byn_wholesale: 200,
  pity_threshold: 3,
  default_promo_validity_days: 90,
  feed_size: 30,
  start_collecting_at: '',
  elite_rarities: [] as string[],
})

const prizeModalOpen = ref(false)
const prizeForm = reactive<{
  id: string | null
  title: string
  description: string
  rarity_code: string
  promo_template_id: string | null
  weight: number
  max_total: number
  promo_validity_days: number
  epic_pool_size: number
  epic_pool_threshold_byn: number
  sort_order: number
  is_for_retail: boolean
  is_for_wholesale: boolean
  is_active: boolean
}>({
  id: null,
  title: '',
  description: '',
  rarity_code: 'common',
  promo_template_id: null,
  weight: 1,
  max_total: 0,
  promo_validity_days: 90,
  epic_pool_size: 5,
  epic_pool_threshold_byn: 300,
  sort_order: 0,
  is_for_retail: true,
  is_for_wholesale: false,
  is_active: true,
})

const rarityByCode = computed(() => {
  const map = new Map<string, WheelRarity>()
  for (const rarity of rarities.value) map.set(rarity.code, rarity)
  return map
})

function rarityLabel(code: string): string {
  return rarityByCode.value.get(code)?.label || code
}

function formatDateTime(value: string): string {
  if (!value) return ''
  const iso = value.includes('T') ? value : value.replace(' ', 'T') + 'Z'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || ''
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {}),
    },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Request failed')
  }
  return data as T
}

async function loadAll() {
  await Promise.all([
    loadPrizes(),
    loadSettings(),
    loadDashboard(),
    loadPromoTemplates(),
  ])
}

async function loadPrizes() {
  const data = await fetchJson<{ prizes: WheelPrize[] }>(
    '/api/admin/crm/wheel/prizes',
  )
  prizes.value = data.prizes || []
  if (data.prizes?.[0]?.rarity) {
    rarities.value = []
  }
  if (!rarities.value.length) {
    const rarityMap = new Map<string, WheelRarity>()
    for (const prize of data.prizes || []) {
      if (prize.rarity) rarityMap.set(prize.rarity_code, prize.rarity)
    }
    if (rarityMap.size) {
      rarities.value = [...rarityMap.values()]
    }
  }
}

async function loadSettings() {
  const data = await fetchJson<{
    spin_byn_retail: number
    spin_byn_wholesale: number
    pity_threshold: number
    default_promo_validity_days: number
    feed_size: number
    start_collecting_at: string | null
    elite_rarities: string[]
  }>('/api/admin/crm/wheel/settings')
  settingsForm.spin_byn_retail = data.spin_byn_retail
  settingsForm.spin_byn_wholesale = data.spin_byn_wholesale
  settingsForm.pity_threshold = data.pity_threshold
  settingsForm.default_promo_validity_days = data.default_promo_validity_days
  settingsForm.feed_size = data.feed_size
  settingsForm.start_collecting_at = data.start_collecting_at
    ? new Date(data.start_collecting_at).toISOString().slice(0, 16)
    : ''
  settingsForm.elite_rarities = [...(data.elite_rarities || [])]
}

async function loadDashboard() {
  dashboard.value = await fetchJson<DashboardData>(
    '/api/admin/crm/wheel/dashboard',
  )
  if (!rarities.value.length) {
    // Fallback: derive from rarity_breakdown so labels render before prizes load.
    const rarityMap = new Map<string, WheelRarity>()
    for (const row of dashboard.value.rarity_breakdown || []) {
      rarityMap.set(row.rarity_code, { code: row.rarity_code, label: row.rarity_code })
    }
    if (rarityMap.size) rarities.value = [...rarityMap.values()]
  }
}

async function loadPromoTemplates() {
  try {
    const data = await fetchJson<{ promo_codes: PromoTemplate[] } | PromoTemplate[]>(
      '/api/admin/crm/promo-codes',
    )
    promoTemplates.value = Array.isArray(data)
      ? data
      : Array.isArray(data?.promo_codes)
        ? data.promo_codes
        : []
  } catch (_error) {
    promoTemplates.value = []
  }
}

async function loadSpins() {
  const url = `/api/admin/crm/wheel/spins?limit=${spinsLimit.value}&offset=${spinsOffset.value}`
  spins.value = await fetchJson<SpinsResponse>(url)
}

function openCreateModal() {
  Object.assign(prizeForm, {
    id: null,
    title: '',
    description: '',
    rarity_code: rarities.value[0]?.code || 'common',
    promo_template_id: null,
    weight: 1,
    max_total: 0,
    promo_validity_days: settingsForm.default_promo_validity_days || 90,
    epic_pool_size: 5,
    epic_pool_threshold_byn: 300,
    sort_order: prizes.value.length * 10,
    is_for_retail: true,
    is_for_wholesale: false,
    is_active: true,
  })
  prizeModalOpen.value = true
}

function openEditModal(prize: WheelPrize) {
  Object.assign(prizeForm, {
    id: prize.id,
    title: prize.title,
    description: prize.description || '',
    rarity_code: prize.rarity_code,
    promo_template_id: prize.promo_template_id || null,
    weight: Number(prize.weight) || 0,
    max_total: Number(prize.max_total) || 0,
    promo_validity_days: Number(prize.promo_validity_days) || 90,
    epic_pool_size: Number(prize.epic_pool_size) || 5,
    epic_pool_threshold_byn: Number(prize.epic_pool_threshold_byn) || 300,
    sort_order: Number(prize.sort_order) || 0,
    is_for_retail: Boolean(prize.is_for_retail),
    is_for_wholesale: Boolean(prize.is_for_wholesale),
    is_active: Boolean(prize.is_active),
  })
  prizeModalOpen.value = true
}

function closeModal() {
  prizeModalOpen.value = false
}

async function savePrize() {
  const payload = {
    rarity_code: prizeForm.rarity_code,
    title: prizeForm.title,
    description: prizeForm.description,
    weight: prizeForm.weight,
    max_total: prizeForm.max_total,
    promo_template_id: prizeForm.promo_template_id,
    promo_validity_days: prizeForm.promo_validity_days,
    epic_pool_size: prizeForm.epic_pool_size,
    epic_pool_threshold_byn: prizeForm.epic_pool_threshold_byn,
    is_for_retail: prizeForm.is_for_retail,
    is_for_wholesale: prizeForm.is_for_wholesale,
    is_active: prizeForm.is_active,
    sort_order: prizeForm.sort_order,
  }

  try {
    if (prizeForm.id) {
      await fetchJson(`/api/admin/crm/wheel/prizes/${prizeForm.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
    } else {
      await fetchJson('/api/admin/crm/wheel/prizes', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    }
    prizeModalOpen.value = false
    await loadPrizes()
  } catch (error) {
    console.error('[crm-wheel] save prize failed', error)
    alert('Не удалось сохранить приз. Подробности в консоли.')
  }
}

async function deletePrize(prize: WheelPrize) {
  if (!confirm(`Скрыть приз «${prize.title}»? Восстановить можно через редактирование.`)) {
    return
  }
  try {
    await fetchJson(`/api/admin/crm/wheel/prizes/${prize.id}`, {
      method: 'DELETE',
    })
    await loadPrizes()
  } catch (error) {
    console.error('[crm-wheel] delete prize failed', error)
  }
}

async function saveSettings() {
  const payload = {
    spin_byn_retail: settingsForm.spin_byn_retail,
    spin_byn_wholesale: settingsForm.spin_byn_wholesale,
    pity_threshold: settingsForm.pity_threshold,
    default_promo_validity_days: settingsForm.default_promo_validity_days,
    feed_size: settingsForm.feed_size,
    start_collecting_at: settingsForm.start_collecting_at
      ? new Date(settingsForm.start_collecting_at).toISOString()
      : null,
    elite_rarities: settingsForm.elite_rarities,
  }
  try {
    await fetchJson('/api/admin/crm/wheel/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    await loadSettings()
  } catch (error) {
    console.error('[crm-wheel] save settings failed', error)
    alert('Не удалось сохранить настройки.')
  }
}

function changeSpinsPage(direction: 1 | -1) {
  const next = spinsOffset.value + direction * spinsLimit.value
  if (next < 0) return
  spinsOffset.value = next
  loadSpins()
}

onMounted(async () => {
  await loadAll()
  if (activeTab.value === 'spins') {
    await loadSpins()
  }
})

watch(activeTab, (next) => {
  if (next === 'spins') loadSpins()
  if (next === 'dashboard') loadDashboard()
})
</script>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
