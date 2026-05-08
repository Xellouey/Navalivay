<template>
  <div class="flex gap-3 w-full">
    <div class="flex-shrink-0">
      <div
        v-if="group.hasCoverImage && coverImage"
        class="h-16 w-16 overflow-hidden rounded-md bg-gray-100"
      >
        <img
          :src="coverImage"
          :alt="group.name"
          class="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div
        v-else
        class="flex h-16 w-16 items-center justify-center rounded-md text-xs font-medium uppercase"
        :class="severity === 'ended' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'"
        aria-hidden="true"
      >
        {{ initials }}
      </div>
    </div>
    <div class="min-w-0 flex-1">
      <h3 class="truncate text-sm font-semibold text-gray-900" :title="group.name">
        {{ group.name }}
      </h3>
      <p
        v-if="group.categoryName"
        class="truncate text-[11px] text-gray-500"
        :title="group.categoryName"
      >
        {{ group.categoryName }}
      </p>
      <p
        class="mt-1 text-xs"
        :class="severity === 'ended' ? 'text-red-700' : 'text-orange-700'"
      >
        <template v-if="group.threshold && group.threshold > 0">
          Порог: {{ group.threshold }} шт
        </template>
        <template v-else>
          Остаток 0
        </template>
      </p>
      <p
        class="mt-0.5 text-sm font-bold"
        :class="severity === 'ended' ? 'text-red-600' : 'text-orange-600'"
      >
        Фактически: {{ group.totalStock }} шт
      </p>
      <div class="mt-2">
        <div class="relative inline-block">
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
            :disabled="busy"
            @click.stop="$emit('toggleMenu')"
          >
            <span v-if="busy">…</span>
            <template v-else>
              Скрыть
              <svg class="h-3 w-3" viewBox="0 0 12 12" fill="none">
                <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </template>
          </button>
          <div
            v-if="menuOpen"
            class="absolute right-0 z-20 mt-1.5 flex w-56 flex-col gap-1.5 rounded-xl bg-white p-2 shadow-xl ring-1 ring-black/5 sm:left-0 sm:right-auto"
          >
            <button
              v-for="(reason, key) in reasons"
              :key="key"
              type="button"
              class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 active:bg-gray-100"
              @click.stop="$emit('pause', key)"
            >
              {{ reason.label }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LowStockGroup, LowStockPauseReason, LowStockPauseConfig } from '@/stores/crm'

const props = defineProps<{
  group: LowStockGroup
  coverImage?: string
  busy: boolean
  menuOpen: boolean
  reasons: Record<LowStockPauseReason, LowStockPauseConfig>
  severity: 'ending' | 'ended'
}>()

defineEmits<{
  toggleMenu: []
  pause: [reason: LowStockPauseReason]
}>()

const initials = computed(() => {
  const name = (props.group.name || '').trim()
  if (!name) return '?'
  const parts = name.split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || '?'
})
</script>
