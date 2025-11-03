import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Product } from './catalog'

export interface CartItem {
  productId: string
  title: string
  priceRub: number
  quantity: number
  image?: string | null
  variantId?: string | null
  variantName?: string | null
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

  function addItem(product: Product, quantity = 1, variantId?: string | null) {
    // Для товаров с вариантами учитываем variantId при поиске
    const existing = items.value.find(item => 
      item.productId === product.id && 
      (!variantId || item.variantId === variantId)
    )
    
    if (existing) {
      existing.quantity += quantity
    } else {
      let title = product.title
      let priceRub = product.priceRub
      let image = product.images?.[0] || null
      let variantName: string | null = null
      
      // Если указан variantId, найдем его данные
      if (variantId && product.variants) {
        const variant = product.variants.find(v => v.id === variantId)
        if (variant) {
          variantName = variant.name
          title = `${product.title} - ${variant.name}`
          if (variant.priceRub) {
            priceRub = variant.priceRub
          }
          if (variant.images && variant.images.length > 0) {
            image = variant.images[0]
          }
        }
      }
      
      items.value.push({
        productId: product.id,
        title,
        priceRub,
        quantity,
        image,
        variantId: variantId || null,
        variantName
      })
    }
    
    saveToStorage()
  }

  function updateQuantity(productId: string, quantity: number, variantId?: string | null) {
    const item = items.value.find(item => 
      item.productId === productId && 
      (!variantId || item.variantId === variantId)
    )
    if (item) {
      item.quantity = Math.max(1, quantity)
      saveToStorage()
    }
  }

  function removeItem(productId: string, variantId?: string | null) {
    items.value = items.value.filter(item => 
      !(item.productId === productId && (!variantId || item.variantId === variantId))
    )
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
