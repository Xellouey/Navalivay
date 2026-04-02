<template>
  <div class="min-h-screen bg-[#f5f7fa] px-4 py-10">
    <div class="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm">
      <div v-if="isLoading" class="space-y-4 text-center">
        <div class="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-brand-dark/20 border-t-brand-dark"></div>
        <div>
          <h1 class="text-xl font-semibold text-gray-900">Открываем оптовый прайс</h1>
          <p class="mt-2 text-sm text-gray-500">Проверяем ссылку и подготавливаем витрину...</p>
        </div>
      </div>

      <div v-else class="space-y-4 text-center">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          !
        </div>
        <div>
          <h1 class="text-xl font-semibold text-gray-900">Не удалось открыть прайс</h1>
          <p class="mt-2 text-sm text-gray-500">{{ errorMessage }}</p>
        </div>
        <button
          type="button"
          class="w-full rounded-2xl bg-brand-dark px-4 py-3 text-sm font-semibold text-white hover:bg-brand-dark/90"
          @click="router.replace('/')"
        >
          Вернуться в каталог
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useCartStore } from '@/stores/cart'
import { useWholesaleStore } from '@/stores/wholesale'

const route = useRoute()
const router = useRouter()
const cartStore = useCartStore()
const wholesaleStore = useWholesaleStore()

const isLoading = ref(true)
const errorMessage = ref('')

onMounted(async () => {
  const code = String(route.params.code || '').trim()
  const secret = String(route.params.secret || '').trim()

  if (!code || !secret) {
    isLoading.value = false
    errorMessage.value = 'Оптовая ссылка неполная'
    return
  }

  try {
    const switchingToAnotherLink = !wholesaleStore.isSameLink(code, secret)
    if (switchingToAnotherLink && (cartStore.items.length > 0 || cartStore.editingOrderId)) {
      const confirmed = window.confirm(
        'Текущая корзина будет очищена и открыт другой оптовый прайс. Продолжить?',
      )
      if (!confirmed) {
        await router.replace('/')
        return
      }

      cartStore.clearCart()
      cartStore.clearOrderEdit()
    }

    await wholesaleStore.activateFromLink(code, secret)
    await router.replace('/')
  } catch (error: any) {
    console.error('[WholesaleEntry] Failed to activate wholesale link', error)
    errorMessage.value =
      error?.message || wholesaleStore.error || 'Оптовая ссылка недействительна'
    isLoading.value = false
  }
})
</script>
