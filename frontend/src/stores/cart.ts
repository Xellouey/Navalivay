import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Product } from './catalog'
import { useCatalogStore } from './catalog'

export interface CartItem {
  productId: string
  title: string
  productTitle?: string | null
  priceRub: number
  quantity: number
  image?: string | null
  variantId?: string | null
  variantName?: string | null
  groupId?: string | null
  categoryId?: string | null
}

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])

  const totalItems = computed(() => {
    return items.value.reduce((sum, item) => sum + item.quantity, 0)
  })

  const totalAmount = computed(() => {
    return items.value.reduce((sum, item) => sum + item.priceRub * item.quantity, 0)
  })

  async function loadFromStorage() {
    try {
      const stored = localStorage.getItem('navalivay_cart')
      if (stored) {
        const loadedItems = JSON.parse(stored)
        const catalogStore = useCatalogStore()
        
        // Ensure catalog is loaded
        if (!catalogStore.allProducts.length) {
          await catalogStore.fetchAllProducts()
        }
        
        // Migrate old items
        items.value = loadedItems.map((item: CartItem) => {
          const migrated = { ...item }
          
          if (!item.productTitle) {
            const titleParts = item.title.split(' - ')
            migrated.productTitle = titleParts.length > 1 ? titleParts[0] : item.title
            migrated.variantName = titleParts.length > 1 ? titleParts.slice(1).join(' - ') : null
          }
          
          // Update image from group/category if needed
          if (item.groupId) {
            const groupImage = catalogStore.getGroupImage(item.groupId)
            if (groupImage) migrated.image = groupImage
          } else if (item.categoryId) {
            const categoryImage = catalogStore.getCategoryImage(item.categoryId)
            if (categoryImage) migrated.image = categoryImage
          } else if (!item.groupId && !item.categoryId) {
            // Old item without IDs - try to find product in catalog
            const product = catalogStore.allProducts.find(p => p.id === item.productId)
            if (product) {
              migrated.groupId = product.groupId || null
              migrated.categoryId = product.categoryId || null
              if (product.groupId) {
                const groupImage = catalogStore.getGroupImage(product.groupId)
                if (groupImage) migrated.image = groupImage
              } else if (product.categoryId) {
                const categoryImage = catalogStore.getCategoryImage(product.categoryId)
                if (categoryImage) migrated.image = categoryImage
              }
            }
          }
          
          return migrated
        })
        saveToStorage()
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
      let productTitle = product.groupName || product.title
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
          // Изображение варианта берем только если НЕТ флага needsCategoryImage
          if (!product.needsCategoryImage && variant.images && variant.images.length > 0) {
            image = variant.images[0]
          }
        }
      }
      
      // Если у товара флаг needsCategoryImage - ВСЕГДА берем из группы или категории
      if (product.needsCategoryImage) {
        const catalogStore = useCatalogStore()
        if (product.groupId) {
          const groupImage = catalogStore.getGroupImage(product.groupId)
          if (groupImage) image = groupImage
        }
        if (!image && product.categoryId) {
          const categoryImage = catalogStore.getCategoryImage(product.categoryId)
          if (categoryImage) image = categoryImage
        }
      }
      
      items.value.push({
        productId: product.id,
        productTitle,
        title,
        priceRub,
        quantity,
        image,
        variantId: variantId || null,
        variantName: variantName || (product.groupName ? product.title : null),
        groupId: product.groupId || null,
        categoryId: product.categoryId || null
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
