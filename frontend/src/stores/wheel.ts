import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { withTelegramAuthHeaders } from '@/utils/telegramAuth'
import { useWholesaleStore } from '@/stores/wholesale'

export interface WheelRarity {
  code: string
  label: string
  bgColor: string
  textColor: string
  isElite: boolean
}

export interface WheelPrize {
  id: string
  title: string
  description: string | null
  image_url: string | null
  rarity: WheelRarity | null
  weight: number
  effective_weight: number
  max_total: number
  issued_count: number
  is_exhausted: boolean
  sort_order: number
}

export interface WheelFeedItem {
  id: string
  spun_at: string
  prize_title: string
  first_name: string
  last_initial: string
  photo: string | null
  rarity: WheelRarity | null
}

export interface WheelMyPrize {
  spin_id: string
  prize_title: string
  prize_description: string | null
  prize_image_url: string | null
  rarity_code: string
  rarity_label: string | null
  rarity_bg: string | null
  rarity_text: string | null
  promo_code: string | null
  promo_valid_until: string | null
  spun_at: string
  prize_used_at: string | null
  is_epic_release: boolean
}

export interface WheelBalance {
  spins_available: number
  accumulated_byn: number
  threshold_byn: number
  progress_percent: number
  consecutive_nothing: number
}

export interface WheelState {
  customer_id: string | null
  is_wholesale: boolean
  balance: WheelBalance
  prizes: WheelPrize[]
  rarities: WheelRarity[]
  feed: WheelFeedItem[]
  my_active_prizes: WheelMyPrize[]
  feed_consent: boolean
  feed_consent_required: boolean
  settings: {
    pity_threshold: number
    spin_byn_retail: number
    spin_byn_wholesale: number
    elite_rarities: string[]
  }
}

export interface WheelSpinResult {
  spin_id: string
  prize: {
    id: string
    title: string
    description: string | null
    image_url: string | null
    rarity_code: string
  }
  is_epic_release: boolean
  is_pity_release: boolean
  promo_code: string | null
  promo_valid_until: string | null
  animation_seed: number
  spins_left: number
  accumulated_byn: number
  idempotent_replay?: boolean
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const wholesaleStore = useWholesaleStore()
  const wholesaleHeaders = wholesaleStore.buildHeaders()
  const response = await fetch(url, {
    ...options,
    headers: withTelegramAuthHeaders({
      'Content-Type': 'application/json',
      ...wholesaleHeaders,
      ...(options?.headers || {}),
    }),
    credentials: options?.credentials ?? 'include',
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const message = data?.message || data?.error || 'Request failed'
    const error = new Error(message) as Error & { code?: string }
    error.code = data?.error
    throw error
  }
  return data as T
}

/**
 * Generate an Idempotency-Key for /api/wheel/spin (P1).
 *
 * `crypto.randomUUID()` is the cleanest source: cryptographically
 * strong, length 36, available in every browser that runs the Mini
 * App and in Node 19+ (covers SSR). Falls back to Math.random when
 * the polyfill is missing — safe enough for retry-dedup since the
 * key is only used once per spin attempt and never persisted to the
 * client.
 */
function generateIdempotencyKey(): string {
  const cryptoObj = typeof globalThis !== 'undefined' ? (globalThis as { crypto?: Crypto }).crypto : undefined
  if (cryptoObj?.randomUUID) {
    return `wheel_${cryptoObj.randomUUID()}`
  }
  return `wheel_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`
}

const EMPTY_BALANCE: WheelBalance = {
  spins_available: 0,
  accumulated_byn: 0,
  threshold_byn: 40,
  progress_percent: 0,
  consecutive_nothing: 0,
}

export const useWheelStore = defineStore('wheel', () => {
  const balance = ref<WheelBalance>({ ...EMPTY_BALANCE })
  const prizes = ref<WheelPrize[]>([])
  const rarities = ref<WheelRarity[]>([])
  const feed = ref<WheelFeedItem[]>([])
  const myActivePrizes = ref<WheelMyPrize[]>([])
  const myAllPrizes = ref<WheelMyPrize[]>([])
  const eliteRarityCodes = ref<string[]>([])
  const settings = ref<WheelState['settings']>({
    pity_threshold: 3,
    spin_byn_retail: 40,
    spin_byn_wholesale: 200,
    elite_rarities: [],
  })
  const customerId = ref<string | null>(null)
  const isWholesale = ref(false)
  const isLoading = ref(false)
  const isSpinning = ref(false)
  const lastResult = ref<WheelSpinResult | null>(null)
  const stateError = ref('')
  const spinError = ref('')
  const feedConsent = ref(false)
  const feedConsentRequired = ref(false)
  const isUpdatingConsent = ref(false)

  const hasSpins = computed(() => balance.value.spins_available > 0)
  const sortedPrizes = computed(() =>
    [...prizes.value].sort((a, b) => a.sort_order - b.sort_order),
  )

  async function fetchState() {
    isLoading.value = true
    stateError.value = ''
    try {
      const data = await fetchJson<WheelState>('/api/wheel/state')
      balance.value = data.balance
      prizes.value = data.prizes
      rarities.value = data.rarities
      feed.value = data.feed
      myActivePrizes.value = data.my_active_prizes
      settings.value = data.settings
      eliteRarityCodes.value = data.settings.elite_rarities
      customerId.value = data.customer_id
      isWholesale.value = data.is_wholesale
      feedConsent.value = Boolean(data.feed_consent)
      feedConsentRequired.value = Boolean(data.feed_consent_required)
      return data
    } catch (error: any) {
      stateError.value = error?.message || 'Не удалось загрузить рулетку'
      throw error
    } finally {
      isLoading.value = false
    }
  }

  async function spin(): Promise<WheelSpinResult> {
    if (isSpinning.value) {
      throw new Error('spin_in_progress')
    }
    isSpinning.value = true
    spinError.value = ''
    try {
      // P1: each /api/wheel/spin POST carries a fresh idempotency key.
      // If the POST is retried (network blip, user double-tap that
      // bypasses the local guard, etc.) the server returns the
      // original spin payload instead of consuming a second spin.
      const idempotencyKey = generateIdempotencyKey()
      const result = await fetchJson<WheelSpinResult>('/api/wheel/spin', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({}),
      })
      lastResult.value = result
      balance.value = {
        ...balance.value,
        spins_available: result.spins_left,
        accumulated_byn: result.accumulated_byn,
      }
      return result
    } catch (error: any) {
      spinError.value = error?.message || 'Не удалось крутить'
      throw error
    } finally {
      isSpinning.value = false
    }
  }

  /**
   * Q6: persist the customer's live-feed PII consent. Called from the
   * first-visit modal (with `true` or `false`) and from the toggle on
   * the retail Profile page (any value the user picks).
   */
  async function setFeedConsent(consent: boolean) {
    isUpdatingConsent.value = true
    try {
      const data = await fetchJson<{ success: boolean; consent: boolean; consent_at: string | null }>(
        '/api/wheel/feed-consent',
        {
          method: 'POST',
          body: JSON.stringify({ consent: Boolean(consent) }),
        },
      )
      feedConsent.value = Boolean(data.consent)
      feedConsentRequired.value = false
      return data
    } finally {
      isUpdatingConsent.value = false
    }
  }

  async function fetchMyPrizes(status: 'all' | 'active' | 'used' | 'expired' = 'all') {
    const data = await fetchJson<{ prizes: WheelMyPrize[] }>(
      `/api/wheel/my-prizes?status=${encodeURIComponent(status)}`,
    )
    myAllPrizes.value = data.prizes || []
    return myAllPrizes.value
  }

  return {
    balance,
    prizes,
    rarities,
    feed,
    myActivePrizes,
    myAllPrizes,
    eliteRarityCodes,
    settings,
    customerId,
    isWholesale,
    isLoading,
    isSpinning,
    lastResult,
    stateError,
    spinError,
    feedConsent,
    feedConsentRequired,
    isUpdatingConsent,
    hasSpins,
    sortedPrizes,
    fetchState,
    spin,
    fetchMyPrizes,
    setFeedConsent,
  }
})
