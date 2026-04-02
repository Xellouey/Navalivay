<template>
  <div class="space-y-4">
    <div class="rounded-2xl border border-violet-200/70 bg-violet-50/70 px-4 py-3 text-sm text-violet-900">
      Здесь собраны все оптовые ссылки. В каждой карточке видно, для скольких линеек уже заполнены цены.
    </div>

    <div v-if="isLoading" class="rounded-2xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
      Загружаем оптовые ссылки...
    </div>

    <div v-else-if="!links.length" class="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
      Оптовые ссылки пока недоступны
    </div>

    <div v-else class="grid gap-4">
      <article
        v-for="link in sortedLinks"
        :key="link.id"
        class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0">
            <h3 class="text-base font-semibold text-gray-900">{{ link.label }}</h3>
            <p class="mt-1 text-sm text-gray-500">
              Минимальный заказ: {{ formatAmount(link.minOrderAmount) }} BYN
            </p>
          </div>
          <div
            class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
            :class="link.missingGroupCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'"
          >
            {{ link.filledGroupCount }}/{{ link.totalTargetGroups }} линеек заполнено
          </div>
        </div>

        <div class="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
          <p class="break-all text-sm text-gray-700">{{ buildAbsoluteUrl(link.path) }}</p>
        </div>

        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-lg bg-brand-dark px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark/90"
            @click="copyLink(link)"
          >
            Скопировать
          </button>
          <a
            :href="buildAbsoluteUrl(link.path)"
            target="_blank"
            rel="noopener"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-400 hover:text-gray-900"
          >
            Открыть
          </a>
        </div>

        <p v-if="link.missingGroupCount > 0" class="mt-3 text-xs text-amber-700">
          Для {{ link.missingGroupCount }} линеек цены еще не заполнены. Они не попадут в этот прайс.
        </p>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface WholesaleLink {
  id: string
  code: string
  label: string
  minOrderAmount: number
  sortOrder: number
  path: string | null
  totalTargetGroups: number
  filledGroupCount: number
  missingGroupCount: number
}

const props = withDefaults(defineProps<{
  links?: WholesaleLink[]
  isLoading?: boolean
}>(), {
  links: () => [],
  isLoading: false
})

const sortedLinks = computed(() => {
  return [...(props.links || [])].sort((left, right) => left.sortOrder - right.sortOrder)
})

function buildAbsoluteUrl(path: string | null) {
  if (!path) {
    return ''
  }

  if (typeof window === 'undefined') {
    return path
  }

  return new URL(path, window.location.origin).toString()
}

async function copyLink(link: WholesaleLink) {
  const text = buildAbsoluteUrl(link.path)
  if (!text) {
    return
  }

  try {
    await navigator.clipboard.writeText(text)
  } catch (error) {
    console.error('[AdminWholesaleLinksPanel] Failed to copy link', error)
  }
}

function formatAmount(value: number) {
  return Number(value || 0).toFixed(0)
}
</script>
