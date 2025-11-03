import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

import { $fetch } from '@/utils/http'

// Types
export interface User {
  username: string
  role: string
}

export interface Banner {
  id: string
  image: string
  href: string | null
  active: number // 0 or 1 from API
  order: number
  openInNewTab?: number // 0 or 1 from API
  title?: string
  description?: string
}

export interface Category {
  id: string
  slug: string
  name: string
  order: number
  productCount?: number
  hide_empty?: number | boolean
  cover_image?: string | null
  display_mode?: 'default' | 'liquid' | 'visual'
  displayMode?: 'default' | 'liquid' | 'visual'
}

export interface ProductLink {
  label?: string
  url: string
}

export interface ProductVariant {
  id?: string
  product_id?: string
  name: string
  colorCode?: string | null
  priceRub?: number | null
  stock?: number
  position?: number
  images: string[]
}

export interface Product {
  id: string
  categoryId: string
  categoryName?: string
  groupId?: string | null
  groupName?: string | null
  groupSlug?: string | null
  title: string
  priceRub: number
  description: string
  images: string[]
  links?: ProductLink[]
  createdAt: string
  strength?: string | null
  costPrice?: number
  stock?: number
  minStock?: number
  hasVariants?: boolean | number
  variants?: ProductVariant[]
  useCategoryImage?: boolean | number
}

export interface CategoryGroup {
  id: string
  categoryId: string
  slug: string
  name: string
  coverImage?: string | null
  order: number
  hideEmpty?: boolean
  parentId?: string | null
  createdAt?: string
  updatedAt?: string
  productCount?: number
  totalProductCount?: number
}

interface ProductsResponse {
  products: Product[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface ApiError {
  error: string
  message: string
}

// Реальный стор админки. Без моков.

export const useAdminStore = defineStore('admin', () => {
  // Authentication state
  const isAuthenticated = ref(false)
  const user = ref<User | null>(null)
  const token = ref('')

  // Data state
  const banners = ref<Banner[]>([])
  const categories = ref<Category[]>([])
  const products = ref<Product[]>([])
  const currentProduct = ref<Product | null>(null)
  const categoryGroups = ref<CategoryGroup[]>([])
  const categoryCrossSells = ref<Record<string, Product[]>>({})
  const settings = ref<Record<string, string>>({})

  // UI state
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Pagination state
  const productsPagination = ref({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  })

  // Computed
  const isLoggedIn = computed(() => isAuthenticated.value && !!token.value)

  // Utilities
  function setError(message: string) {
    error.value = message
    setTimeout(() => {
      error.value = null
    }, 5000)
  }

  function handleApiError(err: any) {
    console.error('API Error:', err)
    
    // Специальная обработка дублирования категорий
    if (err.data?.error === 'duplicate_category') {
      setError(err.data.message || 'Категория с таким названием уже существует')
      return
    }
    
    // Обычная обработка ошибок
    if (err.data?.message) {
      setError(err.data.message)
    } else if (err.message) {
      setError(err.message)
    } else {
      setError('Произошла ошибка при выполнении запроса')
    }
  }

  function normalizeProductData(product: any): Product {
    const hasVariants = Boolean(product?.hasVariants ?? 0)
    const result: Product = {
      ...product,
      strength: product?.strength ?? null,
      costPrice: Number(product?.costPrice ?? 0),
      stock: Number(product?.stock ?? 0),
      minStock: Number(product?.minStock ?? 0),
      hasVariants,
      useCategoryImage: Boolean(product?.useCategoryImage ?? 1)
    }
    
    if (hasVariants && Array.isArray(product?.variants)) {
      result.variants = product.variants.map((v: any) => ({
        id: v.id,
        product_id: v.product_id,
        name: v.name || '',
        colorCode: v.colorCode || v.color_code || null,
        priceRub: v.priceRub !== undefined ? Number(v.priceRub) : null,
        stock: v.stock !== undefined ? Number(v.stock) : 0,
        position: v.position ?? 0,
        images: Array.isArray(v.images) ? v.images : []
      }))
      // Для товаров с вариантами images может быть пустым
      result.images = result.images || []
    } else {
      result.images = Array.isArray(product?.images) ? product.images : []
    }
    
    return result
  }

  // Authentication methods (реальные запросы)
  async function login(credentials: { username: string; password: string }) {
    try {
      isLoading.value = true
      error.value = null

      // Express API only
      const response = await $fetch<{ success?: boolean; token: string; user?: User }>('/api/admin/login', { 
        method: 'POST', 
        body: credentials 
      })

      // Normalise
      // @ts-ignore
      token.value = response.token
      // @ts-ignore
      user.value = response.user || { username: credentials.username, role: 'admin' }
      isAuthenticated.value = true
      if (typeof window !== 'undefined') localStorage.setItem('admin_token', token.value)
      return { success: true, token: token.value, user: user.value as User }
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    token.value = ''
    user.value = null
    isAuthenticated.value = false
    if (typeof window !== 'undefined') localStorage.removeItem('admin_token')
  }

  async function checkAuth() {
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
    if (!storedToken) {
      isAuthenticated.value = false
      user.value = null
      token.value = ''
      return false
    }
    
    token.value = storedToken
    
    // Probe protected endpoint to verify token
    try {
      await $fetch('/api/admin/banners', { headers: { Authorization: `Bearer ${storedToken}` } })
      user.value = user.value || { username: 'admin', role: 'admin' }
      isAuthenticated.value = true
      return true
    } catch (err) {
      console.warn('Protected endpoint check failed:', err)
      // Clear invalid token
      if (typeof window !== 'undefined') localStorage.removeItem('admin_token')
      isAuthenticated.value = false
      user.value = null
      token.value = ''
      return false
    }
  }

  // Helper for authenticated requests
  function getAuthHeaders() {
    if (!token.value) {
      throw new Error('No authentication token')
    }
    return {
      Authorization: `Bearer ${token.value}`
    }
  }

  // Upload files (real API): /api/admin/upload?target=...
  async function uploadFiles(files: FileList | File[], target?: string) {
    try {
      isLoading.value = true
      const fd = new FormData()
      Array.from(files).forEach(f => fd.append('files', f))
      const qs = target ? `?target=${encodeURIComponent(target)}` : ''
      const res = await $fetch<{ ok: boolean; urls: string[] }>(`/api/admin/upload${qs}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: fd
      })
      return res.urls
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Banner CRUD methods
  async function fetchBanners() {
    try {
      isLoading.value = true
      error.value = null

      const response = await $fetch<Banner[]>('/api/admin/banners', {
        headers: getAuthHeaders()
      })

      banners.value = response
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function createBanner(banner: Omit<Banner, 'id' | 'order'>) {
    try {
      isLoading.value = true
      error.value = null

      const response = await $fetch<Banner>('/api/admin/banners', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: banner
      })

      banners.value.push(response)
      return response
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function updateBanner(id: string, updates: Partial<Banner>) {
    try {
      isLoading.value = true
      error.value = null

      const response = await $fetch<Banner>(`/api/admin/banners/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: updates
      })

      // Update local state с данными от сервера
      const index = banners.value.findIndex(b => b.id === id)
      if (index !== -1) {
        banners.value[index] = response
      }

      return banners.value[index]
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function deleteBanner(id: string) {
    try {
      isLoading.value = true
      error.value = null

      await $fetch(`/api/admin/banners/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })

      banners.value = banners.value.filter(b => b.id !== id)
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function toggleBannerStatus(id: string) {
    try {
      const banner = banners.value.find(b => b.id === id)
      if (!banner) return
      
      const newActive = banner.active === 1 ? 0 : 1
      await updateBanner(id, { active: newActive })
    } catch (err: any) {
      handleApiError(err)
      throw err
    }
  }

  async function reorderBanners(reorderedBanners: { id: string; order: number }[]) {
    try {
      isLoading.value = true
      error.value = null

      await $fetch('/api/admin/banners/reorder', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: { banners: reorderedBanners }
      })

      // Update local state
      reorderedBanners.forEach(({ id, order }) => {
        const banner = banners.value.find(b => b.id === id)
        if (banner) {
          banner.order = order
        }
      })

      // Sort by order
      banners.value.sort((a, b) => a.order - b.order)
      
      // Принудительно обновляем данные с сервера для синхронизации
      await fetchBanners()
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Category CRUD methods
  async function fetchCategories() {
    try {
      isLoading.value = true
      error.value = null

      const response = await $fetch<Category[]>('/api/admin/categories', {
        headers: getAuthHeaders()
      })

      categories.value = response.map((category) => ({
        ...category,
        displayMode: (category.displayMode ?? category.display_mode ?? 'default') as 'default' | 'liquid' | 'visual',
        display_mode: (category.displayMode ?? category.display_mode ?? 'default') as 'default' | 'liquid' | 'visual'
      }))
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

async function createCategory(category: { name: string; hideEmpty?: boolean; coverImage?: string | null }) {
    try {
      isLoading.value = true
      error.value = null

      const response = await $fetch<any>('/api/admin/categories', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: {
          name: category.name,
          hide_empty: category.hideEmpty || false,
          cover_image: category.coverImage ?? null
        }
      })

      // Express server returns { ok: true, id, slug, name, order }
      if (response.ok && response.id) {
        console.log('[admin] Category created on server:', response)
        
        // Return the category data for the caller to use
        // The list will be refreshed by the calling component
        const displayModeValue = (response.display_mode ?? response.displayMode ?? 'default') as 'default' | 'liquid' | 'visual'

        const newCategory: Category = {
          id: response.id,
          slug: response.slug,
          name: response.name,
          order: response.order,
          productCount: 0, // новая категория, товаров пока нет
          hide_empty: response.hide_empty,
          cover_image: response.cover_image ?? null,
          display_mode: displayModeValue,
          displayMode: displayModeValue
        }
        
        return newCategory
      } else {
        throw new Error('Invalid server response format')
      }
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function updateCategory(id: string, updates: Partial<Category>) {
    try {
      isLoading.value = true
      error.value = null

      console.log('[admin] Updating category', id, 'with:', updates)

      const payload: Record<string, unknown> = { ...updates }
      if (updates.hide_empty !== undefined && typeof updates.hide_empty === 'boolean') {
        payload.hide_empty = updates.hide_empty
      }
      if (updates.cover_image !== undefined) {
        payload.cover_image = updates.cover_image
      }

      const response = await $fetch<Record<string, any>>(`/api/admin/categories/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: payload
      })

      console.log('[admin] Update category response:', response)

      // Обновляем локальное состояние полными данными от сервера
      const index = categories.value.findIndex(c => c.id === id)
      if (index !== -1) {
        const displayModeValue = (response.displayMode ?? response.display_mode ?? 'default') as 'default' | 'liquid' | 'visual'
        categories.value[index] = {
          ...categories.value[index],
          ...response,
          display_mode: displayModeValue,
          displayMode: displayModeValue
        }
        console.log('[admin] Updated local category:', categories.value[index])
      }
      return {
        ...response,
        display_mode: (response.displayMode ?? response.display_mode ?? 'default') as 'default' | 'liquid' | 'visual'
      }
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function deleteCategory(id: string) {
    try {
      isLoading.value = true
      error.value = null

      await $fetch(`/api/admin/categories/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })

      categories.value = categories.value.filter(c => c.id !== id)
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function reorderCategories(reorderedCategories: { id: string; order: number }[]) {
    try {
      isLoading.value = true
      error.value = null

      console.log('🔥 [admin] reorderCategories called with:', reorderedCategories)
      const payload = { categories: reorderedCategories }
      console.log('🔥 [admin] Sending payload to server:', JSON.stringify(payload, null, 2))
      console.log('🔥 [admin] Auth headers:', getAuthHeaders())

      const response = await $fetch('/api/admin/categories/reorder', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: payload
      })
      
      console.log('🔥 [admin] Reorder response from server:', response)

      // Update local state
      reorderedCategories.forEach(({ id, order }) => {
        const category = categories.value.find(c => c.id === id)
        if (category) {
          category.order = order
        }
      })

      // Sort by order
      categories.value.sort((a, b) => a.order - b.order)
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function fetchCategoryGroups(categoryId?: string) {
    try {
      isLoading.value = true
      error.value = null

      const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : ''
      const response = await $fetch<Array<Record<string, any>>>(`/api/admin/category-groups${query}`, {
        headers: getAuthHeaders()
      })

      const mapped = response.map(group => ({
        id: group.id,
        categoryId: group.categoryId,
        slug: group.slug,
        name: group.name,
        coverImage: group.cover_image ?? null,
        order: Number(group.order ?? group['order'] ?? 0),
        hideEmpty: Boolean(group.hide_empty),
        parentId: group.parent_group_id ?? null,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
        productCount: group.productCount ?? 0,
        totalProductCount: group.totalProductCount ?? group.productCount ?? 0
      })) as CategoryGroup[]

      if (categoryId) {
        categoryGroups.value = categoryGroups.value.filter(g => g.categoryId !== categoryId).concat(mapped)
      } else {
        categoryGroups.value = mapped
      }

      return mapped
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function createCategoryGroup(payload: { categoryId: string; name: string; slug?: string; coverImage?: string | null; hideEmpty?: boolean; parentId?: string | null }) {
    try {
      isLoading.value = true
      error.value = null

      const response = await $fetch<Record<string, any>>('/api/admin/category-groups', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: {
          categoryId: payload.categoryId,
          name: payload.name,
          slug: payload.slug,
          coverImage: payload.coverImage ?? null,
          hide_empty: payload.hideEmpty ?? false,
          parentId: payload.parentId ?? null
        }
      })

      const mapped: CategoryGroup = {
        id: String(response.id),
        categoryId: String(response.categoryId),
        slug: response.slug,
        name: response.name,
        coverImage: response.cover_image ?? null,
        order: Number(response.order ?? response['order'] ?? 0),
        hideEmpty: Boolean(response.hide_empty),
        parentId: response.parent_group_id ?? null,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
        productCount: response.productCount ?? 0,
        totalProductCount: response.totalProductCount ?? response.productCount ?? 0
      }

      categoryGroups.value = categoryGroups.value.filter(g => g.id !== mapped.id).concat(mapped)
      categoryGroups.value.sort((a, b) => a.order - b.order)

      return mapped
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function updateCategoryGroup(id: string, updates: Partial<CategoryGroup>) {
    try {
      isLoading.value = true
      error.value = null

      const response = await $fetch<Record<string, any>>(`/api/admin/category-groups/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: {
          name: updates.name,
          slug: updates.slug,
          coverImage: updates.coverImage ?? null,
          hide_empty: updates.hideEmpty,
          order: updates.order,
          parentId: updates.parentId ?? null
        }
      })

      const mapped: CategoryGroup = {
        id: String(response.id),
        categoryId: String(response.categoryId),
        slug: response.slug,
        name: response.name,
        coverImage: response.cover_image ?? null,
        order: Number(response.order ?? response['order'] ?? 0),
        hideEmpty: Boolean(response.hide_empty),
        parentId: response.parent_group_id ?? null,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
        productCount: response.productCount ?? 0,
        totalProductCount: response.totalProductCount ?? response.productCount ?? 0
      }

      const idx = categoryGroups.value.findIndex(g => g.id === id)
      if (idx !== -1) {
        categoryGroups.value.splice(idx, 1, mapped)
      } else {
        categoryGroups.value.push(mapped)
      }
      categoryGroups.value.sort((a, b) => a.order - b.order)

      return mapped
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function deleteCategoryGroup(id: string) {
    try {
      isLoading.value = true
      error.value = null

      await $fetch(`/api/admin/category-groups/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })

      categoryGroups.value = categoryGroups.value.filter(g => g.id !== id)
      // Обновляем продукты, у которых мог быть установлен groupId
      products.value = products.value.map(p => p.groupId === id ? { ...p, groupId: null, groupName: undefined, groupSlug: undefined } : p)
      if (currentProduct.value?.groupId === id) {
        currentProduct.value = { ...currentProduct.value, groupId: null, groupName: undefined, groupSlug: undefined }
      }
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function reorderCategoryGroups(items: { id: string; order: number }[]) {
    try {
      isLoading.value = true
      error.value = null

      await $fetch('/api/admin/category-groups/reorder', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: { groups: items }
      })

      items.forEach(({ id, order }) => {
        const group = categoryGroups.value.find(g => g.id === id)
        if (group) {
          group.order = order
        }
      })
      categoryGroups.value.sort((a, b) => a.order - b.order)
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function fetchCategoryCrossSells(categoryId: string) {
    try {
      isLoading.value = true
      error.value = null

      const response = await $fetch<Product[]>(`/api/admin/categories/${categoryId}/cross-sells`, {
        headers: getAuthHeaders()
      })

      categoryCrossSells.value = { ...categoryCrossSells.value, [categoryId]: response }
      return response
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function updateCategoryCrossSells(categoryId: string, productIds: string[]) {
    try {
      isLoading.value = true
      error.value = null

      const response = await $fetch<Product[]>(`/api/admin/categories/${categoryId}/cross-sells`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: { productIds }
      })

      categoryCrossSells.value = { ...categoryCrossSells.value, [categoryId]: response }
      return response
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Product CRUD methods
  async function fetchProducts(options: {
    page?: number
    limit?: number
    category?: string
    search?: string
  } = {}) {
    try {
      isLoading.value = true
      error.value = null

      const params = new URLSearchParams()
      if (options.page) params.set('page', options.page.toString())
      if (options.limit) params.set('limit', options.limit.toString())
      if (options.category) params.set('category', options.category)
      if (options.search) params.set('search', options.search)

      const response = await $fetch<ProductsResponse>(`/api/admin/products?${params}`, {
        headers: getAuthHeaders()
      })

      products.value = response.products.map(normalizeProductData)
      productsPagination.value = response.pagination
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function fetchProduct(id: string) {
    try {
      isLoading.value = true
      error.value = null

      const response = await $fetch<Product>(`/api/admin/products/${id}`, {
        headers: getAuthHeaders()
      })

      const normalized = normalizeProductData(response)
      currentProduct.value = normalized
      return normalized
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function createProduct(product: Omit<Product, 'id' | 'createdAt' | 'categoryName'>) {
    try {
      isLoading.value = true
      error.value = null

      console.log('[admin] Creating product with data:', product)
      
      const payload: Record<string, any> = {
        categoryId: product.categoryId,
        groupId: product.groupId ?? null,
        title: product.title,
        priceRub: product.priceRub,
        description: product.description,
        images: product.images,
        links: product.links,
        strength: product.strength ?? null,
        cost_price: product.costPrice ?? 0,
        stock: product.stock ?? 0,
        min_stock: product.minStock ?? 0,
        useCategoryImage: product.useCategoryImage ?? false,
        hasVariants: product.hasVariants ?? false
      }
      
      // Добавляем варианты если есть
      if (product.hasVariants && product.variants) {
        payload.variants = product.variants
      }

      const response = await $fetch<{ ok: boolean; id: string; product: Product }>('/api/admin/products', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: payload
      })

      console.log('[admin] Product creation response:', response)
      
      // Use the product data returned from server (includes processed images)
      const createdProduct = normalizeProductData(response.product)
      
      products.value.unshift(createdProduct)
      productsPagination.value.total++
      return createdProduct
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function updateProduct(id: string, updates: Partial<Product>) {
    try {
      isLoading.value = true
      error.value = null

      const payload: Record<string, any> = { ...updates }

      if (updates.groupId !== undefined) {
        payload.groupId = updates.groupId ?? null
      }

      if (updates.costPrice !== undefined) {
        payload.cost_price = updates.costPrice
        delete payload.costPrice
      }

      if (updates.minStock !== undefined) {
        payload.min_stock = updates.minStock
        delete payload.minStock
      }
      
      // Поддержка вариантов
      if (updates.hasVariants !== undefined) {
        payload.hasVariants = updates.hasVariants
      }
      
      if (updates.variants !== undefined) {
        payload.variants = updates.variants
      }
      
      if (updates.useCategoryImage !== undefined) {
        payload.useCategoryImage = updates.useCategoryImage
      }

      await $fetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: payload
      })
      
      // Update local state
      const index = products.value.findIndex(p => p.id === id)
      if (index !== -1) {
        products.value[index] = { ...products.value[index], ...updates }
      }

      if (currentProduct.value?.id === id) {
        currentProduct.value = { ...currentProduct.value, ...updates }
      }

    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function deleteProduct(id: string) {
    try {
      isLoading.value = true
      error.value = null

      await $fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })

      products.value = products.value.filter(p => p.id !== id)
      productsPagination.value.total--

      if (currentProduct.value?.id === id) {
        currentProduct.value = null
      }
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Batch operations for products
  async function batchDeleteProducts(ids: string[]) {
    try {
      isLoading.value = true
      error.value = null

      // TODO: Здесь можно реализовать более эффективный batch endpoint
      // Пока же используем параллельные запросы
      await Promise.all(ids.map(id => 
        $fetch(`/api/admin/products/${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        })
      ))

      // Обновляем локальное состояние
      products.value = products.value.filter(p => !ids.includes(p.id))
      productsPagination.value.total -= ids.length

      if (currentProduct.value && ids.includes(currentProduct.value.id)) {
        currentProduct.value = null
      }
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function batchUpdateProducts(updates: Array<{ id: string; data: Partial<Product> }>) {
    try {
      isLoading.value = true
      error.value = null

      // TODO: Здесь можно реализовать более эффективный batch endpoint
      await Promise.all(updates.map(({ id, data }) => 
        $fetch(`/api/admin/products/${id}`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: {
            ...data,
            groupId: data.groupId === undefined ? undefined : (data.groupId ?? null)
          }
        })
      ))

      // Обновляем локальное состояние
      updates.forEach(({ id, data }) => {
        const product = products.value.find(p => p.id === id)
        if (product) {
          Object.assign(product, data)
        }
        
        if (currentProduct.value?.id === id) {
          Object.assign(currentProduct.value, data)
        }
      })
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function reorderProductImages(productId: string, images: string[]) {
    try {
      isLoading.value = true
      error.value = null

      await $fetch(`/api/admin/products/${productId}/images/reorder`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: { urls: images }
      })

      // Update local state
      const product = products.value.find(p => p.id === productId)
      if (product) {
        product.images = images
      }

      if (currentProduct.value?.id === productId) {
        currentProduct.value.images = images
      }

    return images
  } catch (err: any) {
    handleApiError(err)
    throw err
  } finally {
    isLoading.value = false
  }
}

  // Password change method
  async function changePassword(currentPassword: string, newPassword: string) {
    try {
      isLoading.value = true
      error.value = null

      const response = await $fetch<{ ok: boolean }>('/api/admin/password', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: {
          currentPassword,
          newPassword
        }
      })

      if (response.ok) {
        return { success: true }
      } else {
        throw new Error('Password change failed')
      }
    } catch (err: any) {
      // Handle specific error cases
      if (err.data?.error === 'invalid_current_password') {
        setError('Неверный текущий пароль')
      } else if (err.data?.error === 'missing') {
        setError('Не указаны все необходимые поля')
      } else {
        handleApiError(err)
      }
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Settings methods
  async function fetchSettings() {
    try {
      isLoading.value = true
      error.value = null

      const response = await $fetch<Record<string, string>>('/api/admin/settings', {
        headers: getAuthHeaders()
      })

      settings.value = response
      return response
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function updateSettings(newSettings: Record<string, string>) {
    try {
      isLoading.value = true
      error.value = null

      const response = await $fetch<{ ok: boolean; settings: Record<string, string> }>('/api/admin/settings', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: { settings: newSettings }
      })

      if (response.ok) {
        settings.value = { ...settings.value, ...newSettings }
        return response.settings
      } else {
        throw new Error('Failed to update settings')
      }
    } catch (err: any) {
      handleApiError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function updateProfitPassword(params: { currentPassword?: string; newPassword: string }) {
    try {
      error.value = null

      const payload: Record<string, string> = { newPassword: params.newPassword }
      if (params.currentPassword) {
        payload.currentPassword = params.currentPassword
      }

      const response = await $fetch<{ ok: boolean }>('/api/admin/settings/profit-password', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: payload
      })

      if (!response.ok) {
        throw new Error('Failed to update profit password')
      }

      return { success: true }
    } catch (err: any) {
      if (err?.data?.error === 'invalid_current_password') {
        setError('Неверный текущий пароль')
      } else if (err?.data?.error === 'missing_current_password') {
        setError('Укажите текущий пароль')
      } else if (err?.data?.error === 'password_too_short') {
        setError('Новый пароль должен быть не короче 4 символов')
      } else if (err?.data?.error === 'missing_new_password') {
        setError('Укажите новый пароль')
      } else {
        handleApiError(err)
      }
      throw err
    }
  }

  // Clear methods
  function clearError() {
    error.value = null
  }

  function clearProducts() {
    products.value = []
    currentProduct.value = null
    productsPagination.value = {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0
    }
  }

  // Verify token (if present)
  async function verifyToken() {
    try {
      const tokenInStorage = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
      if (!tokenInStorage) {
        isAuthenticated.value = false
        return false
      }
      token.value = tokenInStorage
      const res = await $fetch<{ valid: boolean; user: { username: string; role: string } }>('/api/admin/auth/verify', {
        method: 'POST',
        headers: getAuthHeaders()
      })
      if (res.valid) {
        user.value = res.user
        isAuthenticated.value = true
        return true
      }
      isAuthenticated.value = false
      return false
    } catch (err) {
      // invalid token
      if (typeof window !== 'undefined') localStorage.removeItem('admin_token')
      isAuthenticated.value = false
      return false
    }
  }

  // Initialize method
  async function initialize() {
    // Try to verify existing token
    const isValid = await verifyToken()
    if (isValid) {
      // Load initial data
      try {
        await Promise.all([
          fetchBanners(),
          fetchCategories(),
          fetchProducts()
        ])
      } catch (err) {
        // Non-critical errors during initialization
        console.warn('Failed to load some initial data:', err)
      }
    }
  }

  return {
    // State
    isAuthenticated,
    user,
    token,
    banners,
    categories,
    products,
    currentProduct,
    categoryGroups,
    categoryCrossSells,
    settings,
    isLoading,
    error,
    productsPagination,

    // Computed
    isLoggedIn,

    // Auth methods
    login,
    logout,
    checkAuth,
    verifyToken,

    // Banner methods
    fetchBanners,
    createBanner,
    updateBanner,
    deleteBanner,
    toggleBannerStatus,
    reorderBanners,

    // Category methods
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    fetchCategoryGroups,
    createCategoryGroup,
    updateCategoryGroup,
    deleteCategoryGroup,
    reorderCategoryGroups,
    fetchCategoryCrossSells,
    updateCategoryCrossSells,

    // Product methods
    fetchProducts,
    fetchProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    batchDeleteProducts,
    batchUpdateProducts,
    reorderProductImages,

    // Upload
    uploadFiles,

    // Settings methods
    fetchSettings,
    updateSettings,
    updateProfitPassword,

    // Password management
    changePassword,

    // Utility methods
    clearError,
    clearProducts,
    initialize
  }
})
