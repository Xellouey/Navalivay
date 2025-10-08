<template>
  <div class="min-h-screen flex bg-gray-50">
    <AdminSidebar
      v-model="innerValue"
      :tabs="tabs"
      :title="title"
      @logout="$emit('logout')"
    />

    <div class="flex-1 flex flex-col min-w-0">

      <!-- Main content -->
      <main class="flex-1 p-4 sm:p-6 lg:p-8 pb-16 md:pb-0 min-h-0 flex flex-col">
        <slot />
      </main>

      <!-- Mobile floating menu button -->
      <button
        class="md:hidden fixed bottom-4 right-4 z-50 p-3 rounded-full bg-brand-dark text-white shadow-lg"
        @click="menuOpen = true"
        aria-label="Открыть меню"
      >
        <Bars3Icon class="w-6 h-6" />
      </button>

      <!-- Mobile menu overlay -->
      <div v-if="menuOpen" class="md:hidden fixed inset-0 z-50">
        <div class="absolute inset-0 bg-white/40 backdrop-blur-sm" @click="menuOpen = false"></div>
        <div class="absolute bottom-4 inset-x-4 bg-white rounded-xl shadow-lg p-3">
          <div class="flex items-center justify-between px-3 py-3 border-b mb-3">
            <span class="text-base font-semibold text-gray-800">Разделы</span>
            <button class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" @click="menuOpen = false" aria-label="Закрыть меню">
              <XMarkIcon class="w-5 h-5" />
            </button>
          </div>
          <div class="max-h-[60vh] overflow-auto space-y-2">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="innerValue = tab.id; menuOpen = false"
              :class="[
                'w-full flex items-center gap-4 px-4 py-3 rounded-lg text-base font-medium transition-all duration-200 touch-manipulation',
                innerValue === tab.id 
                  ? 'bg-brand-primary/20 text-brand-dark border border-brand-primary/30' 
                  : 'text-gray-700 hover:bg-gray-50 hover:shadow-sm active:bg-gray-100'
              ]"
            >
              <component :is="tab.icon" class="w-6 h-6 flex-shrink-0" />
              <span class="truncate text-left">{{ tab.name }}</span>
            </button>
            <RouterLink to="/admin/crm/orders" custom v-slot="{ navigate, isActive }">
              <button
                class="w-full flex items-center gap-4 px-4 py-3 rounded-lg text-base font-medium transition-all duration-200 touch-manipulation"
                :class="isActive
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'text-gray-700 hover:bg-gray-50 hover:shadow-sm active:bg-gray-100'"
                @click="() => { navigate(); menuOpen = false }"
              >
                <ClipboardDocumentCheckIcon class="w-6 h-6 flex-shrink-0" />
                <span class="truncate text-left">Заказы (CRM)</span>
              </button>
            </RouterLink>
          </div>
          <div class="border-t pt-3 mt-3">
            <button 
              @click="$emit('logout'); menuOpen = false" 
              class="w-full flex items-center justify-center gap-2 px-4 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors touch-manipulation"
            >
              <ArrowRightOnRectangleIcon class="w-5 h-5" />
              Выйти
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Bars3Icon, XMarkIcon, ArrowRightOnRectangleIcon, ClipboardDocumentCheckIcon } from '@heroicons/vue/24/outline'
import AdminSidebar from './AdminSidebar.vue'

interface Tab { id: string; name: string; icon: any }

const props = withDefaults(defineProps<{
  modelValue: string
  tabs: Tab[]
  title?: string
  subtitle?: string
}>(), { title: 'НАВАЛИВАЙ Admin', subtitle: 'Админ-панель' })

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void; (e: 'logout'): void }>()

const innerValue = ref(props.modelValue)
watch(() => props.modelValue, v => innerValue.value = v)
watch(innerValue, v => emit('update:modelValue', v))

const currentTabName = computed(() => props.tabs.find(t => t.id === innerValue.value)?.name || 'Admin')

const menuOpen = ref(false)

</script>
