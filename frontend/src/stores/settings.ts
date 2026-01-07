import { defineStore } from 'pinia'
import { ref } from 'vue'
import { $fetch } from '@/utils/http'

export interface PublicSettings {
  manager_telegram: string
  // Минимальная сумма для доставки
  min_delivery_amount: string
  min_delivery_banner_image: string
  min_delivery_banner_button_text: string
  min_delivery_banner_button_color: string
  // Баннер условий доставки (fullscreen)
  delivery_conditions_image: string
  // Редирект в Telegram после заказа
  order_redirect_telegram: string
  order_redirect_text_template: string
}

export const useSettingsStore = defineStore('settings', () => {
  // State
  const settings = ref<PublicSettings>({
    manager_telegram: 'dmitriy_mityuk',
    min_delivery_amount: '0',
    min_delivery_banner_image: '',
    min_delivery_banner_button_text: 'Понятно',
    min_delivery_banner_button_color: '#FFD700',
    delivery_conditions_image: '',
    order_redirect_telegram: '',
    order_redirect_text_template: 'Мой номер заказа - #{order_number}'
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