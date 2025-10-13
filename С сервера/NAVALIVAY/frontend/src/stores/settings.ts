import { defineStore } from 'pinia'
import { ref } from 'vue'
import { $fetch } from '@/utils/http'

export interface PublicSettings {
  manager_telegram: string
}

export const useSettingsStore = defineStore('settings', () => {
  // State
  const settings = ref<PublicSettings>({
    manager_telegram: 'dmitriy_mityuk'
  })
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Actions
  async function fetchSettings() {
    try {
      isLoading.value = true
      error.value = null

      const response = await $fetch<PublicSettings>('/api/settings')
      settings.value = response
      return response
    } catch (err: any) {
      console.error('[settings] Failed to fetch settings:', err)
      error.value = 'Failed to fetch settings'
      // Не кидаем ошибку, используем дефолтные значения
    } finally {
      isLoading.value = false
    }
  }

  return {
    // State
    settings,
    isLoading,
    error,
    
    // Actions
    fetchSettings
  }
})