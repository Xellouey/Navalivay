<template>
  <aside class="hidden md:flex w-72 flex-col border-r bg-white h-screen">
    <div class="h-16 flex items-center px-6 border-b font-semibold text-brand-dark flex-shrink-0">
      {{ title }}
    </div>
    <nav class="flex-1 p-4 space-y-2 overflow-y-auto">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="$emit('update:modelValue', tab.id)"
        :class="[
          'w-full flex items-center gap-4 px-4 py-3 rounded-lg text-base font-medium transition-all duration-200',
          modelValue === tab.id
            ? 'bg-brand-primary/20 text-brand-dark border border-brand-primary/30'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800 hover:shadow-sm'
        ]"
      >
        <component :is="tab.icon" class="w-6 h-6 flex-shrink-0" />
        <span class="truncate text-left">{{ tab.name }}</span>
      </button>
      <RouterLink to="/admin/crm/orders" custom v-slot="{ navigate, isActive }">
        <button
          class="w-full flex items-center gap-4 px-4 py-3 rounded-lg text-base font-medium transition-all duration-200"
          :class="isActive
            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800 hover:shadow-sm'"
          @click="navigate"
        >
          <ClipboardDocumentCheckIcon class="w-6 h-6 flex-shrink-0" />
          <span class="truncate text-left">Заказы (CRM)</span>
        </button>
      </RouterLink>
    </nav>
    <div class="p-4 border-t bg-gray-50 flex-shrink-0">
      <button 
        @click="$emit('logout')" 
        class="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-all duration-200 shadow-sm"
      >
        <ArrowRightOnRectangleIcon class="w-4 h-4" />
        Выйти
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowRightOnRectangleIcon, ClipboardDocumentCheckIcon } from '@heroicons/vue/24/outline'

interface Tab { id: string; name: string; icon: any }

const props = defineProps<{
  modelValue: string
  tabs: Tab[]
  title?: string
}>()

defineEmits<{ (e: 'update:modelValue', v: string): void; (e: 'logout'): void }>()

const title = computed(() => props.title || 'Admin')
</script>