import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Product } from './catalog'

export interface CartItem {
  productId: string
  title: string
  priceRub: number
  quantity: number
  image?: string | null
}

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])

  const totalItems = computed(() => {
    return items.value.reduce((sum, item) => sum + item.quantity, 0)
  })

  const totalAmount = computed(() => {
    return items.value.reduce((sum, item) => sum + item.priceRub * item.quantity, 0)
  })

  function loadFromStorage() {
    try {
      const stored = localStorage.getItem('navalivay_cart')
      if (stored) {
        items.value = JSON.parse(stored)
      }
    } catch (error) {
      console.error('[Cart] Failed to load from storage', error)
    }
  }

  function saveToStorage() {
    try {
      localStorage.setItem('navalivay_cart', JSON.stringify(items.value))
    } catch (error) {
      console.error('[Cart] Failed to save to storage', error)
    }
  }

  function addItem(product: Product, quantity = 1) {
    const existing = items.value.find(item => item.productId === product.id)
    
    if (existing) {
      existing.quantity += quantity
    } else {
      items.value.push({
        productId: product.id,
        title: product.title,
        priceRub: product.priceRub,
        quantity,
        image: product.images?.[0] || null
      })
    }
    
    saveToStorage()
  }

  function updateQuantity(productId: string, quantity: number) {
    const item = items.value.find(item => item.productId === productId)
    if (item) {
      item.quantity = Math.max(1, quantity)
      saveToStorage()
    }
  }

  function removeItem(productId: string) {
    items.value = items.value.filter(item => item.productId !== productId)
    saveToStorage()
  }

  function clearCart() {
    items.value = []
    saveToStorage()
  }

  // Initialize on store creation
  loadFromStorage()

  return {
    items,
    totalItems,
    totalAmount,
    addItem,
    updateQuantity,
    removeItem,
    clearCart
  }
})
