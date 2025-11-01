<template>
  <div class="min-h-screen" style="background: #ffffff;">
    <div class="mx-auto max-w-4xl px-4 py-6 space-y-6">
      <!-- Header -->
      <div class="flex items-center gap-4">
        <button @click="$router.back()" class="back-chip">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Назад
        </button>
        <h1 class="checkout-title">Оформление заказа</h1>
      </div>

      <!-- Cart Items -->
      <section class="checkout-card">
        <h2 class="checkout-card-title">Состав заказа</h2>
        
        <div v-if="!cartStore.items.length" class="empty-cart">
          Корзина пуста
        </div>
        
        <div v-else class="space-y-3">
          <div v-for="item in cartStore.items" :key="item.productId" class="cart-item">
            <div v-if="item.image" class="cart-item-image">
              <img :src="item.image" :alt="item.title" class="h-full w-full object-cover" />
            </div>
            
            <div class="flex-1 min-w-0">
              <p class="cart-item-title">{{ item.title }}</p>
              <p class="cart-item-meta">{{ formatPrice(item.priceRub) }} BYN × {{ item.quantity }}</p>
            </div>
            
            <div class="flex items-center gap-2">
              <button @click="decrementQuantity(item.productId)" class="qty-btn">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                </svg>
              </button>
              <span class="qty-value">{{ item.quantity }}</span>
              <button @click="incrementQuantity(item.productId)" class="qty-btn">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button @click="cartStore.removeItem(item.productId)" class="remove-btn">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            
            <p class="cart-item-total">{{ formatPrice(item.priceRub * item.quantity) }} BYN</p>
          </div>
          
          <div class="cart-total">
            <span class="cart-total-label">Итого:</span>
            <span class="cart-total-amount">{{ formatPrice(cartStore.totalAmount) }} BYN</span>
          </div>
        </div>
      </section>

      <!-- Delivery Form -->
      <section v-if="cartStore.items.length" class="checkout-card">
        <h2 class="checkout-card-title">Способ получения</h2>
        
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <label class="delivery-option" :class="{ 'active': form.deliveryType === 'pickup' }">
              <input type="radio" v-model="form.deliveryType" value="pickup" class="sr-only" />
              <div class="flex-1">
                <p class="delivery-option-title">Самовывоз</p>
                <p class="delivery-option-desc">Забрать в точке выдачи</p>
              </div>
              <svg v-if="form.deliveryType === 'pickup'" class="h-6 w-6" style="color: var(--navalivay-red);" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
            </label>
            
            <label class="delivery-option" :class="{ 'active': form.deliveryType === 'delivery' }">
              <input type="radio" v-model="form.deliveryType" value="delivery" class="sr-only" />
              <div class="flex-1">
                <p class="delivery-option-title">Доставка</p>
                <p class="delivery-option-desc">Доставим по адресу</p>
              </div>
              <svg v-if="form.deliveryType === 'delivery'" class="h-6 w-6" style="color: var(--navalivay-red);" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
            </label>
          </div>
          
          <div v-if="form.deliveryType === 'delivery'" class="space-y-4 pt-2">
            <div>
              <label class="form-label">
                Телефон <span style="color: var(--navalivay-red);">*</span>
              </label>
              <input
                v-model="form.phone"
                type="tel"
                required
                class="form-input"
                :class="{ 'error': errors.phone }"
                placeholder="+375 XX XXX XX XX"
              />
              <p v-if="errors.phone" class="form-error">{{ errors.phone }}</p>
            </div>
            
            <div>
              <label class="form-label">
                Адрес доставки <span style="color: var(--navalivay-red);">*</span>
              </label>
              <textarea
                v-model="form.address"
                rows="3"
                required
                class="form-input"
                :class="{ 'error': errors.address }"
                placeholder="Улица, дом, квартира, подъезд"
              />
              <p v-if="errors.address" class="form-error">{{ errors.address }}</p>
            </div>
          </div>
          
          <div>
            <label class="form-label">Комментарий к заказу</label>
            <textarea
              v-model="form.notes"
              rows="2"
              class="form-input"
              placeholder="Дополнительная информация"
            />
          </div>
        </div>
      </section>

      <!-- Submit -->
      <section v-if="cartStore.items.length" class="checkout-card">
        <div v-if="submitError" class="submit-error">
          {{ submitError }}
        </div>
        
        <button
          @click="submitOrder"
          :disabled="isSubmitting"
          class="submit-button"
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

<style scoped>
/* ===== Checkout Page Styles - List Receipt Style ===== */

.back-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border: 3px solid var(--navalivay-black);
  background: var(--navalivay-white);
  color: var(--navalivay-black);
  transition: all 0.2s ease;
  cursor: pointer;
}

.back-chip:hover {
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0 rgba(26, 26, 26, 0.3);
}

.checkout-title {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--navalivay-black);
}

/* Card container - clean */
.checkout-card {
  background: transparent;
  border: 1px solid rgba(26, 26, 26, 0.1);
  border-radius: 16px;
  padding: 1.5rem;
}

.checkout-card-title {
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--navalivay-black);
  margin-bottom: 1rem;
}

.empty-cart {
  text-align: center;
  padding: 3rem 2rem;
  color: var(--navalivay-gray);
  font-weight: 600;
  font-size: 1rem;
}

/* List item - simple row */
.cart-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 0;
  border-bottom: 1px solid rgba(26, 26, 26, 0.1);
  transition: background-color 0.2s ease;
}

.cart-item:hover {
  background-color: rgba(26, 26, 26, 0.02);
}

.cart-item:last-child {
  border-bottom: none;
}

.cart-item-image {
  width: 3.5rem;
  height: 3.5rem;
  flex-shrink: 0;
  border-radius: 8px;
  overflow: hidden;
  background: #f8f8f8;
}

.cart-item-image-placeholder {
  width: 3.5rem;
  height: 3.5rem;
  flex-shrink: 0;
  border-radius: 8px;
  background: #f8f8f8;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--navalivay-gray);
}

.cart-item-title {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--navalivay-black);
  line-height: 1.3;
}

.cart-item-meta {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--navalivay-gray);
  margin-top: 0.25rem;
}

/* Quantity controls - minimal */
.qty-btn {
  padding: 0.25rem 0.5rem;
  border: 1px solid rgba(26, 26, 26, 0.2);
  border-radius: 6px;
  background: transparent;
  color: var(--navalivay-black);
  cursor: pointer;
  transition: all 0.15s ease;
}

.qty-btn:hover {
  border-color: var(--navalivay-black);
  background: rgba(26, 26, 26, 0.05);
}

.qty-value {
  width: 2rem;
  text-align: center;
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--navalivay-black);
}

.remove-btn {
  margin-left: 0.5rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid rgba(211, 47, 47, 0.3);
  border-radius: 6px;
  background: transparent;
  color: var(--navalivay-red);
  cursor: pointer;
  transition: all 0.15s ease;
}

.remove-btn:hover {
  border-color: var(--navalivay-red);
  background: rgba(211, 47, 47, 0.05);
}

.cart-item-total {
  font-weight: 700;
  font-size: 1rem;
  color: var(--navalivay-black);
  min-width: 5rem;
  text-align: right;
}

/* Total section */
.cart-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 1rem;
  margin-top: 1rem;
  border-top: 2px solid var(--navalivay-black);
}

.cart-total-label {
  font-weight: 800;
  font-size: 1.125rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--navalivay-black);
}

.cart-total-amount {
  font-weight: 900;
  font-size: 2rem;
  letter-spacing: 0.02em;
  color: var(--navalivay-red);
}

/* Delivery options - clean cards */
.delivery-option {
  position: relative;
  display: flex;
  cursor: pointer;
  border-radius: 12px;
  border: 2px solid rgba(26, 26, 26, 0.15);
  padding: 1rem;
  background: transparent;
  transition: all 0.2s ease;
}

.delivery-option:hover {
  border-color: rgba(26, 26, 26, 0.3);
  background: rgba(26, 26, 26, 0.02);
}

.delivery-option.active {
  border-color: var(--navalivay-red);
  border-width: 2px;
  background: rgba(211, 47, 47, 0.03);
}

.delivery-option-title {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--navalivay-black);
}

.delivery-option-desc {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--navalivay-gray);
  margin-top: 0.25rem;
}

/* Form inputs - clean */
.form-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--navalivay-black);
  margin-bottom: 0.5rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid rgba(26, 26, 26, 0.15);
  border-radius: 10px;
  background: transparent;
  font-family: var(--font-body);
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--navalivay-black);
  transition: all 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--navalivay-red);
  background: rgba(211, 47, 47, 0.02);
}

.form-input.error {
  border-color: var(--navalivay-red);
  background: rgba(211, 47, 47, 0.05);
}

.form-input::placeholder {
  color: var(--navalivay-gray);
  opacity: 0.5;
}

.form-error {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--navalivay-red);
}

.submit-error {
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  border: 2px solid var(--navalivay-red);
  border-radius: 10px;
  background: rgba(211, 47, 47, 0.05);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--navalivay-red);
}

/* Submit button - clean accent */
.submit-button {
  width: 100%;
  padding: 1.25rem 2rem;
  background: var(--navalivay-red);
  border: none;
  border-radius: 12px;
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.submit-button:hover:not(:disabled) {
  background: #b71c1c;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(211, 47, 47, 0.3);
}

.submit-button:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(211, 47, 47, 0.3);
}

.submit-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* Mobile adjustments */
@media (max-width: 768px) {
  .checkout-title {
    font-size: 1.5rem;
  }
  
  .checkout-card {
    padding: 1.25rem;
    border-radius: 14px;
  }
  
  .cart-item {
    padding: 0.85rem 0;
    gap: 0.75rem;
  }
  
  .cart-item-image,
  .cart-item-image-placeholder {
    width: 3rem;
    height: 3rem;
  }
  
  .cart-item-title {
    font-size: 0.85rem;
  }
  
  .cart-item-total {
    min-width: 4.5rem;
    font-size: 0.9rem;
  }
  
  .cart-total-amount {
    font-size: 1.75rem;
  }
  
  .submit-button {
    font-size: 1rem;
    padding: 1rem 1.5rem;
  }
}

@media (max-width: 480px) {
  .checkout-card {
    padding: 1rem;
    border-radius: 12px;
  }
  
  .cart-item {
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-rows: auto auto;
    gap: 0.5rem;
    padding: 0.75rem 0;
  }
  
  .cart-item-image,
  .cart-item-image-placeholder {
    grid-row: 1 / 3;
    width: 2.5rem;
    height: 2.5rem;
  }
  
  .cart-item .flex-1 {
    grid-column: 2;
    grid-row: 1;
  }
  
  .cart-item .flex.items-center.gap-2 {
    grid-column: 2;
    grid-row: 2;
    gap: 0.5rem;
  }
  
  .cart-item-total {
    grid-column: 3;
    grid-row: 1 / 3;
    display: flex;
    align-items: center;
    min-width: auto;
    font-size: 0.9rem;
  }
  
  .qty-btn {
    padding: 0.2rem 0.4rem;
  }
  
  .qty-value {
    width: 1.5rem;
    font-size: 0.85rem;
  }
  
  .remove-btn {
    margin-left: 0.25rem;
    padding: 0.2rem 0.4rem;
  }
  
  .cart-item-title {
    font-size: 0.8rem;
  }
  
  .cart-item-meta {
    font-size: 0.7rem;
  }
  
  .cart-total-amount {
    font-size: 1.5rem;
  }
  
  .grid-cols-2 {
    grid-template-columns: 1fr;
  }
}
</style>
