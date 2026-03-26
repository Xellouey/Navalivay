import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { withTelegramAuthHeaders } from '@/utils/telegramAuth'

export interface UserProfile {
  id: string | null
  telegramId: string
  telegramUsername: string | null
  firstName: string | null
  lastName: string | null
  photoUrl: string | null
  totalOrders: number
  totalSpent: number
  memberSince: string | null
}

export const useUserStore = defineStore('user', () => {
  const profile = ref<UserProfile | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const displayName = computed(() => {
    if (!profile.value) return 'Пользователь'
    const { firstName, lastName } = profile.value
    if (firstName && lastName) return `${firstName} ${lastName}`
    if (firstName) return firstName
    return 'Пользователь'
  })

  const hasUsername = computed(() => {
    return Boolean(profile.value?.telegramUsername)
  })

  const photoUrl = computed(() => {
    return profile.value?.photoUrl || null
  })

  function getTelegramUser() {
    if (typeof window === 'undefined') return null
    return window.Telegram?.WebApp?.initDataUnsafe?.user ?? null
  }

  async function fetchProfile(telegramId?: string): Promise<void> {
    const tgUser = getTelegramUser()
    const id = telegramId || (tgUser?.id ? String(tgUser.id) : null)

    if (!id) {
      // No Telegram context - use local data from initDataUnsafe
      if (tgUser) {
        profile.value = {
          id: null,
          telegramId: String(tgUser.id),
          telegramUsername: tgUser.username || null,
          firstName: tgUser.first_name || null,
          lastName: tgUser.last_name || null,
          photoUrl: null,
          totalOrders: 0,
          totalSpent: 0,
          memberSince: null,
        }
      }
      return
    }

    isLoading.value = true
    error.value = null

    try {
      const response = await fetch(`/api/customer/me?telegram_id=${encodeURIComponent(id)}`, {
        headers: withTelegramAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('Не удалось загрузить профиль')
      }

      const data = await response.json()

      profile.value = {
        id: data.id || null,
        telegramId: data.telegram_id || id,
        telegramUsername: data.telegram_username || tgUser?.username || null,
        firstName: data.first_name || tgUser?.first_name || null,
        lastName: data.last_name || tgUser?.last_name || null,
        photoUrl: data.photo_url || null,
        totalOrders: data.total_orders || 0,
        totalSpent: data.total_spent || 0,
        memberSince: data.member_since || null,
      }
    } catch (e: any) {
      console.error('[UserStore] Failed to fetch profile:', e)
      error.value = e?.message || 'Ошибка загрузки профиля'

      // Fallback to Telegram data
      if (tgUser) {
        profile.value = {
          id: null,
          telegramId: String(tgUser.id),
          telegramUsername: tgUser.username || null,
          firstName: tgUser.first_name || null,
          lastName: tgUser.last_name || null,
          photoUrl: null,
          totalOrders: 0,
          totalSpent: 0,
          memberSince: null,
        }
      }
    } finally {
      isLoading.value = false
    }
  }

  return {
    profile,
    isLoading,
    error,
    displayName,
    hasUsername,
    photoUrl,
    fetchProfile,
  }
})
