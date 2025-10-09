<template>
  <aside class="hidden md:flex w-72 xl:w-80 bg-transparent">
    <div class="sticky top-0 flex h-screen w-full flex-col border-r border-gray-200 bg-white">
      <nav class="flex-1 overflow-y-auto px-3 py-2 sm:py-3">
        <div class="flex h-full flex-col gap-[clamp(0.5rem,1.2vh,0.9rem)]">
          <div class="sidebar-stack">
            <p class="px-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-500">Основное</p>
            <div class="sidebar-stack">
              <button
                v-for="tab in tabs"
                :key="tab.id"
                @click="$emit('update:modelValue', tab.id)"
                :class="[
                  'sidebar-button w-full flex items-center gap-3 px-3 rounded-2xl text-sm font-medium transition-all duration-200',
                  modelValue === tab.id && !isOnCrmPage
                    ? 'sidebar-button--active'
                    : 'sidebar-button--default'
                ]"
              >
                <component :is="tab.icon" class="w-5 h-5 flex-shrink-0" />
                <div class="flex flex-col items-start gap-0.5">
                  <span class="text-sm font-semibold leading-tight">{{ tab.name }}</span>
                  <span v-if="tab.description" class="text-xs text-gray-500 leading-tight">{{ tab.description }}</span>
                </div>
              </button>
            </div>
          </div>
          <div v-if="crmLinks.length" class="sidebar-stack">
            <p class="px-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-500">CRM</p>
            <div class="sidebar-stack mt-1">
              <RouterLink
                v-for="link in crmLinks"
                :key="link.id"
                :to="link.to"
                custom
                v-slot="{ navigate, isActive }"
              >
                <button
                  class="sidebar-button w-full flex items-center gap-3 px-3 rounded-2xl text-sm font-medium text-left transition-all duration-200"
                  :class="isActive
                    ? 'sidebar-button--crm-active'
                    : 'sidebar-button--default'"
                  @click="navigate"
                >
                  <component :is="link.icon" class="w-5 h-5 flex-shrink-0" />
                  <div class="flex flex-col items-start gap-0.5">
                    <span class="text-sm font-semibold leading-tight">{{ link.name }}</span>
                    <span class="text-xs text-gray-500 leading-tight">{{ link.description }}</span>
                  </div>
                </button>
              </RouterLink>
            </div>
          </div>
          <div class="mt-auto pt-2">
            <button 
              @click="$emit('logout')" 
              class="sidebar-button sidebar-button--default w-full flex items-center gap-2 px-3 rounded-2xl text-sm font-semibold transition-all duration-200"
            >
              <ArrowRightOnRectangleIcon class="w-5 h-5" />
              <span class="leading-none">Выйти</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ArrowRightOnRectangleIcon } from '@heroicons/vue/24/outline'

interface Tab { id: string; name: string; icon: any; description?: string }
interface SidebarLink { id: string; name: string; description: string; icon: any; to: string }

const props = defineProps<{
  modelValue: string
  tabs: Tab[]
  title?: string
  crmLinks?: SidebarLink[]
}>()

defineEmits<{ (e: 'update:modelValue', v: string): void; (e: 'logout'): void }>()

const crmLinks = computed(() => props.crmLinks ?? [])
const route = useRoute()
const isOnCrmPage = computed(() => route.path.includes('/crm'))
</script>

<style scoped>
.sidebar-stack {
  display: flex;
  flex-direction: column;
  gap: clamp(0.2rem, 0.75vh, 0.45rem);
}

.sidebar-button {
  padding-block: clamp(0.46rem, 1.28vh, 0.68rem);
  padding-inline: clamp(0.95rem, 2.5vw, 1.3rem);
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(15, 23, 42, 0.02);
  color: rgba(51, 65, 85, 0.92);
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(12px);
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease, background-color 0.25s ease, color 0.25s ease;
  isolation: isolate;
}

.sidebar-button--default {
  color: rgba(71, 85, 105, 0.9);
}

.sidebar-button--default:hover,
.sidebar-button--default:focus-visible {
  background: rgba(15, 23, 42, 0.08);
  border-color: rgba(148, 163, 184, 0.45);
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.1);
  transform: translateY(-1px);
  color: rgba(30, 41, 59, 0.98);
}

.sidebar-button:focus-visible {
  outline: none;
  border-color: rgba(99, 102, 241, 0.6);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.08);
}

.sidebar-button--active {
  background: rgba(254, 226, 226, 0.75);
  border-color: rgba(244, 63, 94, 0.45);
  box-shadow: 0 16px 32px rgba(244, 63, 94, 0.18);
  color: rgb(190 18 60);
  transform: translateY(-1px);
}

.sidebar-button--crm-active {
  background: rgba(222, 247, 236, 0.78);
  border-color: rgba(16, 185, 129, 0.45);
  box-shadow: 0 16px 32px rgba(16, 185, 129, 0.18);
  color: rgba(4, 120, 87, 1);
  transform: translateY(-1px);
}

.sidebar-button:active {
  transform: translateY(0);
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.18);
}
</style>
