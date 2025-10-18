<template>
  <div class="min-h-screen bg-gray-50 py-6 px-4">
    <div class="mx-auto max-w-4xl space-y-6">
      <!-- Header -->
      <div class="flex items-center gap-3">
        <button @click="$router.back()" class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Назад
        </button>
        <h1 class="text-2xl font-bold text-gray-900">Оформление заказа</h1>
      </div>

      <!-- Cart Items -->
      <section class="rounded-2xl bg-white p-6 shadow-sm">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Состав заказа</h2>
        
        <div v-if="!cartStore.items.length" class="text-center py-8 text-gray-500">
          Корзина пуста
        </div>
        
        <div v-else class="space-y-3">
          <div v-for="item in cartStore.items" :key="item.productId" class="flex items-center gap-4 rounded-lg border border-gray-200 p-4">
            <div v-if="item.image" class="h-16 w-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
              <img :src="item.image" :alt="item.title" class="h-full w-full object-cover" />
            </div>
            <div v-else class="h-16 w-16 flex-shrink-0 rounded-lg bg-gray-100 flex items-center justify-center">
              <svg class="h-8 w-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-gray-900">{{ item.title }}</p>
              <p class="text-sm text-gray-600">{{ formatPrice(item.priceRub) }} BYN × {{ item.quantity }}</p>
            </div>
            
            <div class="flex items-center gap-2">
              <button @click="decrementQuantity(item.productId)" class="rounded-md border border-gray-300 bg-white px-2 py-1 text-gray-700 hover:bg-gray-100">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                </svg>
              </button>
              <span class="w-8 text-center font-semibold">{{ item.quantity }}</span>
              <button @click="incrementQuantity(item.productId)" class="rounded-md border border-gray-300 bg-white px-2 py-1 text-gray-700 hover:bg-gray-100">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button @click="cartStore.removeItem(item.productId)" class="ml-2 rounded-md border border-red-300 bg-white px-2 py-1 text-red-600 hover:bg-red-50">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            
            <p class="font-bold text-gray-900 w-24 text-right">{{ formatPrice(item.priceRub * item.quantity) }} BYN</p>
          </div>
          
          <div class="flex items-center justify-between border-t pt-4 text-lg">
            <span class="font-semibold text-gray-700">Итого:</span>
            <span class="text-2xl font-bold text-gray-900">{{ formatPrice(cartStore.totalAmount) }} BYN</span>
          </div>
        </div>
      </section>

      <!-- Delivery Form -->
      <section v-if="cartStore.items.length" class="rounded-2xl bg-white p-6 shadow-sm">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Способ получения</h2>
        
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <label class="relative flex cursor-pointer rounded-lg border-2 p-4 transition" :class="form.deliveryType === 'pickup' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'">
              <input type="radio" v-model="form.deliveryType" value="pickup" class="sr-only" />
              <div class="flex-1">
                <p class="font-semibold text-gray-900">Самовывоз</p>
                <p class="text-sm text-gray-600">Забрать в точке выдачи</p>
              </div>
              <svg v-if="form.deliveryType === 'pickup'" class="h-6 w-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
            </label>
            
            <label class="relative flex cursor-pointer rounded-lg border-2 p-4 transition" :class="form.deliveryType === 'delivery' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'">
              <input type="radio" v-model="form.deliveryType" value="delivery" class="sr-only" />
              <div class="flex-1">
                <p class="font-semibold text-gray-900">Доставка</p>
                <p class="text-sm text-gray-600">Доставим по адресу</p>
              </div>
              <svg v-if="form.deliveryType === 'delivery'" class="h-6 w-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
            </label>
          </div>
          
          <div v-if="form.deliveryType === 'delivery'" class="space-y-4 pt-2">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Телефон <span class="text-red-600">*</span>
              </label>
              <input
                v-model="form.phone"
                type="tel"
                required
                class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                :class="{ 'border-red-500': errors.phone }"
                placeholder="+375 XX XXX XX XX"
              />
              <p v-if="errors.phone" class="mt-1 text-sm text-red-600">{{ errors.phone }}</p>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Адрес доставки <span class="text-red-600">*</span>
              </label>
              <textarea
                v-model="form.address"
                rows="3"
                required
                class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                :class="{ 'border-red-500': errors.address }"
                placeholder="Улица, дом, квартира, подъезд"
              />
              <p v-if="errors.address" class="mt-1 text-sm text-red-600">{{ errors.address }}</p>
            </div>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Комментарий к заказу</label>
            <textarea
              v-model="form.notes"
              rows="2"
              class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Дополнительная информация"
            />
          </div>
        </div>
      </section>

      <!-- Submit -->
      <section v-if="cartStore.items.length" class="rounded-2xl bg-white p-6 shadow-sm">
        <div v-if="submitError" class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {{ submitError }}
        </div>
        
        <button
          @click="submitOrder"
          :disabled="isSubmitting"
          class="w-full rounded-lg bg-blue-600 px-6 py-4 text-lg font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {{ isSubmitting ? 'Оформляем заказ...' : `Оформить заказ на ${formatPrice(cartStore.totalAmount)} BYN` }}
        </button>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCartStore } from '@/stores/cart'

const router = useRouter()
const cartStore = useCartStore()

const form = reactive({
  deliveryType: 'pickup' as 'pickup' | 'delivery',
  phone: '',
  address: '',
  notes: ''
})

const errors = reactive({
  phone: '',
  address: ''
})

const isSubmitting = ref(false)
const submitError = ref('')

const telegramUser = computed(() => {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp.initDataUnsafe?.user
  }
  return null
})

onMounted(() => {
  // Auto-fill phone if available from Telegram
  const user = telegramUser.value
  if (user) {
    // Note: Telegram WebApp doesn't expose phone number by default
    // This would need to be requested via bot
  }
})

function formatPrice(price: number): string {
  return price.toFixed(2)
}

function incrementQuantity(productId: string) {
  const item = cartStore.items.find(i => i.productId === productId)
  if (item) {
    cartStore.updateQuantity(productId, item.quantity + 1)
  }
}

function decrementQuantity(productId: string) {
  const item = cartStore.items.find(i => i.productId === productId)
  if (item && item.quantity > 1) {
    cartStore.updateQuantity(productId, item.quantity - 1)
  }
}

function validateForm(): boolean {
  errors.phone = ''
  errors.address = ''
  
  if (form.deliveryType === 'delivery') {
    if (!form.phone.trim()) {
      errors.phone = 'Укажите номер телефона'
      return false
    }
    
    if (!form.address.trim()) {
      errors.address = 'Укажите адрес доставки'
      return false
    }
  }
  
  return true
}

async function submitOrder() {
  if (!validateForm()) {
    return
  }
  
  submitError.value = ''
  isSubmitting.value = true
  
  try {
    const user = telegramUser.value
    
    const orderData = {
      telegram_id: user?.id ? String(user.id) : undefined,
      telegram_username: user?.username || undefined,
      first_name: user?.first_name || undefined,
      last_name: user?.last_name || undefined,
      delivery_type: form.deliveryType,
      delivery_address: form.deliveryType === 'delivery' ? form.address : undefined,
      phone: form.deliveryType === 'delivery' ? form.phone : undefined,
      notes: form.notes || undefined,
      items: cartStore.items.map(item => ({
        product_id: item.productId,
        quantity: item.quantity,
        price_per_unit: item.priceRub
      }))
    }
    
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    })
    
    if (!response.ok) {
      throw new Error('Не удалось создать заказ')
    }
    
    const result = await response.json()
    
    // Clear cart and redirect
    cartStore.clearCart()
    
    // Show success and redirect
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.showAlert('Заказ успешно оформлен! Номер заказа: ' + result.order_number, () => {
        router.push('/')
      })
    } else {
      alert('Заказ успешно оформлен! Номер заказа: ' + result.order_number)
      router.push('/')
    }
  } catch (error: any) {
    console.error('[Checkout] Submit error', error)
    submitError.value = error?.message || 'Не удалось оформить заказ. Попробуйте снова.'
  } finally {
    isSubmitting.value = false
  }
}
</script>
