<template>
  <form @submit.prevent="onSubmit" class="space-y-4">
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Название линейки *</label>
      <input
        v-model="form.name"
        type="text"
        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-dark focus:border-transparent"
        placeholder="Например: PODGON"
        :class="{ 'border-red-300 focus:ring-red-500 focus:border-red-300': nameError }"
      />
      <p v-if="nameError" class="mt-1 text-sm text-red-600">{{ nameError }}</p>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Дополнительный параметр</label>
      <input
        v-model="form.metaValue"
        type="text"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-brand-dark focus:border-transparent text-sm"
        placeholder="Крепость 60 мг или Затяжек 2000"
      />
      <p class="mt-1 text-xs text-gray-500">Показывается на витрине как единая строка</p>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Минимальный остаток</label>
      <input
        v-model="form.minStockThreshold"
        type="number"
        min="0"
        step="1"
        inputmode="numeric"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-brand-dark focus:border-transparent text-sm"
        placeholder="Например 45"
      />
      <p class="mt-1 text-xs text-gray-500">
        Когда суммарный остаток линейки опустится ниже этого числа — она появится
        в плашке «Заканчивающиеся» в разделе Закупки. Если поле пустое —
        оповещение появится только при полном обнулении товара.
      </p>
    </div>

    <div class="space-y-3 rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p class="text-sm font-medium text-gray-700">Оптовые цены</p>
          <p class="mt-0.5 text-xs text-gray-500">Заполнено {{ wholesaleFilledCount }} из {{ resolvedWholesaleTiers.length || 0 }}</p>
        </div>
        <div class="text-right text-xs text-gray-500">
          <p>Себестоимость</p>
          <p class="mt-0.5 text-sm font-semibold text-gray-900">{{ averageCostAutoLabel }}</p>
        </div>
      </div>

      <div v-if="resolvedWholesaleTiers.length" class="overflow-hidden rounded-xl border border-white bg-white shadow-sm">
        <div class="grid grid-cols-[84px_minmax(0,1fr)] border-b border-gray-100 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          <span>Уровень</span>
          <span>Цена, BYN</span>
        </div>
        <div
          v-for="tier in resolvedWholesaleTiers"
          :key="tier.id"
          class="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-2 border-b border-gray-100 px-3 py-2 last:border-b-0"
        >
          <div class="min-w-0">
            <p class="text-sm font-semibold text-gray-900">{{ tier.code }}+</p>
            <p class="text-[11px] text-gray-500">{{ formatTierMinAmount(tier.minOrderAmount) }} минимум</p>
          </div>
          <div class="flex items-center gap-2">
            <input
              :id="`wholesale-price-${tier.code}`"
              v-model="wholesalePriceInputs[tier.code]"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              class="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-900 focus:border-brand-dark/40 focus:ring-1 focus:ring-brand-dark/40"
              placeholder="-"
            />
            <span class="text-xs font-medium text-gray-500">BYN</span>
          </div>
        </div>
      </div>

      <p v-else class="text-xs text-gray-500">
        Уровни опта загружаются. После сохранения можно будет заполнить цены.
      </p>
    </div>

      <div class="space-y-3">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span class="block text-sm font-medium text-gray-700">Обложка линейки</span>
        </div>
        <div class="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 text-xs font-medium text-gray-600">
          <button
            type="button"
            class="px-3 py-1 rounded-md transition-colors"
            :class="coverMode === 'url' ? 'bg-white text-gray-900 shadow-sm' : 'hover:text-gray-800'"
            @click="setCoverMode('url')"
          >
            Ссылка
          </button>
          <button
            type="button"
            class="px-3 py-1 rounded-md transition-colors"
            :class="coverMode === 'file' ? 'bg-white text-gray-900 shadow-sm' : 'hover:text-gray-800'"
            @click="setCoverMode('file')"
          >
            Файл
          </button>
        </div>
      </div>

      <div
        v-if="hasPreview"
        class="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center"
      >
        <img
          :src="currentPreview"
          alt="Превью обложки"
          class="h-20 w-32 flex-shrink-0 rounded-lg object-cover ring-1 ring-white/80 shadow"
        />
        <div class="flex-1 space-y-1 text-xs text-gray-600">
          <p class="break-all leading-snug" v-if="coverMode === 'url'">{{ form.coverImage }}</p>
          <p v-else-if="uploadedFileName" class="font-medium">{{ uploadedFileName }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <a
            v-if="isRemotePreview"
            :href="currentPreview"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center justify-center rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-300 hover:text-gray-900"
          >
            Открыть
          </a>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:border-red-300 hover:text-red-700"
            @click="clearCover"
          >
            Очистить
          </button>
        </div>
      </div>

      <div v-if="coverMode === 'url'" class="space-y-2">
        <input
          v-model="form.coverImage"
          type="text"
          class="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-brand-dark/40 focus:ring-1 focus:ring-brand-dark/40"
          placeholder="https://example.com/subcategory-cover.jpg"
        />
      </div>

      <div v-else class="space-y-2">
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleFileSelected"
        />
        <div
          class="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center text-xs text-gray-500 transition hover:border-brand-dark/50 hover:bg-white"
          @click="triggerFileSelect"
          @dragover.prevent
          @drop.prevent="handleFileDrop"
        >
          <svg class="h-8 w-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 15.75a4.5 4.5 0 013.75-4.43 5.25 5.25 0 0110.5 0 4.5 4.5 0 013.75 4.43A3.75 3.75 0 0117.25 19.5h-10.5A3.75 3.75 0 013 15.75z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 13.5l3-3 3 3m-3-3v7.5" />
          </svg>
          <div class="space-y-1">
            <p class="font-medium text-gray-700">Перетащите изображение сюда или выберите файл</p>
          </div>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-md bg-brand-dark px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark/90"
          >
            Выбрать файл
          </button>
        </div>
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Родительская линейка</label>
      <select
        v-model="form.parentId"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-brand-dark focus:border-transparent text-sm"
      >
        <option value="">(Нет родителя)</option>
        <option
          v-for="option in parentOptions"
          :key="option.id"
          :value="option.id"
        >
          {{ option.label }}
        </option>
      </select>
      <p class="mt-1 text-xs text-gray-500">Выберите линейку, внутри которой будет располагаться текущая.</p>
    </div>

    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="text-sm font-medium text-gray-700">Скрывать пустую линейку</p>
        <p class="text-xs text-gray-500 mt-1">Если нет товаров, линейка не будет показана на витрине</p>
      </div>
      <label class="inline-flex items-center">
        <input
          v-model="form.hideEmpty"
          type="checkbox"
          class="w-5 h-5 text-brand-dark border-gray-300 rounded"
        />
      </label>
    </div>

    <div class="flex justify-end gap-3 pt-2">
      <button
        type="button"
        class="px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors"
        @click="$emit('cancel')"
      >
        Отмена
      </button>
      <button
        type="submit"
        :disabled="isSubmitting"
        class="px-4 py-2 bg-brand-dark text-white rounded-lg hover:bg-brand-dark/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {{ isSubmitting ? 'Сохранение...' : (editingGroup ? 'Сохранить изменения' : 'Создать линейку') }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { reactive, ref, watch, computed } from 'vue'

interface CategoryGroup {
  id?: string
  name: string
  coverImage?: string | null
  hideEmpty?: boolean
  parentId?: string | null
  metaLabel?: string | null
  metaValue?: string | null
  minStockThreshold?: number | null
  depth?: number
  averageCostAuto?: number | null
  directProductCount?: number
  productsWithCostCount?: number
  wholesalePrices?: Record<string, number | null>
  wholesaleTiers?: WholesaleTier[]
}

interface WholesaleTier {
  id: string
  code: string
  label: string
  minOrderAmount: number
  sortOrder?: number
}

const props = withDefaults(defineProps<{ editingGroup?: CategoryGroup | null; isSubmitting?: boolean; availableGroups?: Array<CategoryGroup & { depth?: number }>; wholesaleTiers?: WholesaleTier[] }>(), {
  editingGroup: null,
  isSubmitting: false,
  availableGroups: () => [],
  wholesaleTiers: () => []
})

const emit = defineEmits<{
  (e: 'submit', payload: { name: string; coverImage?: string | null; hideEmpty?: boolean; parentId?: string | null; metaLabel?: string | null; metaValue?: string | null; minStockThreshold?: number | null; wholesalePrices?: Record<string, number | null> }): void
  (e: 'cancel'): void
}>()

const form = reactive({
  name: '',
  coverImage: '',
  hideEmpty: false,
  parentId: '',
  metaValue: '',
  minStockThreshold: ''
})

const nameError = ref('')
const coverMode = ref<'url' | 'file'>('url')
const uploadPreview = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadedFileName = ref('')
const wholesalePriceInputs = reactive<Record<string, string>>({})

const defaultWholesaleTiers: WholesaleTier[] = [
  { id: 'wt_100', code: '100', label: 'Опт от 100 BYN', minOrderAmount: 100, sortOrder: 100 },
  { id: 'wt_250', code: '250', label: 'Опт от 250 BYN', minOrderAmount: 250, sortOrder: 250 },
  { id: 'wt_500', code: '500', label: 'Опт от 500 BYN', minOrderAmount: 500, sortOrder: 500 },
  { id: 'wt_1000', code: '1000', label: 'Опт от 1000 BYN', minOrderAmount: 1000, sortOrder: 1000 }
]

const resolvedWholesaleTiers = computed(() => {
  if (props.wholesaleTiers?.length) {
    return props.wholesaleTiers
  }

  if (props.editingGroup?.wholesaleTiers?.length) {
    return props.editingGroup.wholesaleTiers
  }

  const fromAvailableGroup = (props.availableGroups || []).find((group) => group.wholesaleTiers?.length)
  return fromAvailableGroup?.wholesaleTiers?.length ? fromAvailableGroup.wholesaleTiers : defaultWholesaleTiers
})

const averageCostAutoLabel = computed(() => {
  const value = props.editingGroup?.averageCostAuto
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return 'Появится после добавления товаров'
  }
  return `${Number(value).toFixed(2)} BYN`
})

const wholesaleFilledCount = computed(() =>
  resolvedWholesaleTiers.value.reduce((total, tier) => {
    const raw = String(wholesalePriceInputs[tier.code] ?? '').trim()
    return raw ? total + 1 : total
  }, 0),
)

const wholesaleTierKey = computed(() =>
  resolvedWholesaleTiers.value.map((tier) => `${tier.id}:${tier.code}`).join('|'),
)

function syncWholesalePriceInputs(group?: CategoryGroup | null) {
  Object.keys(wholesalePriceInputs).forEach((key) => {
    delete wholesalePriceInputs[key]
  })

  resolvedWholesaleTiers.value.forEach((tier) => {
    const rawValue = group?.wholesalePrices?.[tier.code]
    wholesalePriceInputs[tier.code] =
      rawValue === null || rawValue === undefined || Number.isNaN(Number(rawValue))
        ? ''
        : String(rawValue)
  })
}

watch(
  [() => props.editingGroup, wholesaleTierKey],
  ([group]) => {
    if (group) {
      form.name = group.name || ''
      form.coverImage = group.coverImage || ''
      form.hideEmpty = !!group.hideEmpty
      form.parentId = group.parentId || ''
      const label = (group.metaLabel || '').trim()
      const value = (group.metaValue || '').trim()
      form.metaValue = label && value ? `${label} ${value}` : (label || value)
      const threshold = group.minStockThreshold
      form.minStockThreshold =
        threshold === null || threshold === undefined || !Number.isFinite(Number(threshold)) || Number(threshold) <= 0
          ? ''
          : String(threshold)
      syncWholesalePriceInputs(group)
      if ((group.coverImage || '').startsWith('data:')) {
        coverMode.value = 'file'
        uploadPreview.value = group.coverImage || ''
      } else {
        coverMode.value = 'url'
        uploadPreview.value = ''
      }
      uploadedFileName.value = ''
    } else {
      form.name = ''
      form.coverImage = ''
      form.hideEmpty = false
      form.parentId = ''
      form.metaValue = ''
      form.minStockThreshold = ''
      syncWholesalePriceInputs(null)
      coverMode.value = 'url'
      uploadPreview.value = ''
      uploadedFileName.value = ''
    }
    nameError.value = ''
  },
  { immediate: true }
)

const isValid = computed(() => {
  const trimmed = form.name.trim()
  if (!trimmed) {
    nameError.value = 'Название обязательно'
    return false
  }
  if (trimmed.length > 120) {
    nameError.value = 'Название должно быть короче 120 символов'
    return false
  }
  nameError.value = ''
  return true
})

function onSubmit() {
  if (!isValid.value || props.isSubmitting) {
    return
  }
  const metaValue = form.metaValue.trim()
  const wholesalePrices = Object.fromEntries(
    resolvedWholesaleTiers.value.map((tier) => {
      const rawSource = wholesalePriceInputs[tier.code]
      const rawValue = String(rawSource ?? '').trim()
      if (!rawValue) {
        return [tier.code, null]
      }

      const numeric = Number(rawValue)
      return [tier.code, Number.isFinite(numeric) && numeric > 0 ? numeric : null]
    }),
  )
  const rawThreshold = String(form.minStockThreshold ?? '').trim()
  let minStockThreshold: number | null = null
  if (rawThreshold) {
    const parsed = Number(rawThreshold)
    if (Number.isFinite(parsed) && parsed > 0) {
      minStockThreshold = Math.floor(parsed)
    }
  }
  emit('submit', {
    name: form.name.trim(),
    coverImage: form.coverImage.trim() ? form.coverImage.trim() : null,
    hideEmpty: form.hideEmpty,
    parentId: form.parentId ? form.parentId : null,
    metaLabel: null,
    metaValue: metaValue.length ? metaValue : null,
    minStockThreshold,
    wholesalePrices
  })
}

const currentPreview = computed(() => {
  if (coverMode.value === 'file') {
    return uploadPreview.value
  }
  return form.coverImage.trim()
})

const hasPreview = computed(() => Boolean(currentPreview.value))
const isRemotePreview = computed(() => /^https?:\/\//i.test(currentPreview.value || ''))

function setCoverMode(mode: 'url' | 'file') {
  coverMode.value = mode
  if (mode === 'url' && form.coverImage.startsWith('data:')) {
    form.coverImage = ''
  }
  if (mode === 'url') {
    uploadPreview.value = ''
    uploadedFileName.value = ''
  }
}

function triggerFileSelect() {
  fileInputRef.value?.click()
}

function handleFileSelected(event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files || !target.files.length) return
  processFile(target.files[0])
}

function handleFileDrop(event: DragEvent) {
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  processFile(file)
}

function processFile(file: File) {
  if (!file.type.startsWith('image/')) {
    return
  }
  coverMode.value = 'file'
  uploadedFileName.value = file.name
  const reader = new FileReader()
  reader.onload = () => {
    const result = typeof reader.result === 'string' ? reader.result : ''
    uploadPreview.value = result
    form.coverImage = result
  }
  reader.readAsDataURL(file)
}

function clearCover() {
  uploadPreview.value = ''
  uploadedFileName.value = ''
  form.coverImage = ''
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
  if (coverMode.value === 'file') {
    coverMode.value = 'url'
  }
}

function formatTierMinAmount(value: number) {
  return Number(value || 0).toFixed(0)
}

const blockedParentIds = computed(() => {
  const blocked = new Set<string>()
  const sourceId = props.editingGroup?.id
  if (!sourceId) {
    return blocked
  }
  blocked.add(sourceId)
  const queue: string[] = [sourceId]
  while (queue.length) {
    const current = queue.shift()!
    for (const group of props.availableGroups || []) {
      if (!group.id || blocked.has(group.id)) continue
      if ((group.parentId || null) === current) {
        blocked.add(group.id)
        queue.push(group.id)
      }
    }
  }
  return blocked
})

const parentOptions = computed(() => {
  return (props.availableGroups || [])
    .filter(group => {
      const id = group.id || ''
      if (!id) return false
      if (blockedParentIds.value.has(id)) return false
      if (props.editingGroup && id === props.editingGroup.id) return false
      return true
    })
    .map(group => ({
      id: group.id || '',
      label: `${'— '.repeat(group.depth ?? 0)}${group.name}`.trim()
    }))
})

watch(
  () => props.availableGroups,
  (list) => {
    if (!form.parentId) return
    const exists = (list || []).some(group => group.id === form.parentId)
    if (!exists || blockedParentIds.value.has(form.parentId)) {
      form.parentId = ''
    }
  }
)
</script>
