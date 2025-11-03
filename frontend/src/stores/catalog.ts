import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface CategoryGroup {
  id: string
  slug: string
  name: string
  order: number
  coverImage?: string | null
  productCount: number
  totalProductCount?: number
  parentId?: string | null
  badge?: string | null
  badgeColor?: string | null
}

export interface Category {
  id: string
  slug: string
  name: string
  order: number
  productCount: number
  coverImage?: string | null
  groups: CategoryGroup[]
  displayMode?: 'default' | 'liquid' | 'visual'
}

export interface ProductLink {
  label?: string
  url: string
}

export interface ProductBadge {
  type: string | null
  label: string | null
  color: string | null
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
  groupId?: string | null
  groupSlug?: string | null
  groupName?: string | null
  title: string
  priceRub: number
  description: string
  images: string[]
  links?: ProductLink[]
  createdAt: string
  color?: string
  variant?: string
  strength?: string | null
  costPrice?: number
  stock?: number | null
  minStock?: number | null
  isAvailable?: boolean
  badges?: ProductBadge[]
  hasVariants?: boolean
  variants?: ProductVariant[]
}

export interface Banner {
  id: string
  image: string
  href: string | null
  active: number
  order: number
  openInNewTab?: number // 0 or 1 from API
  title?: string
  description?: string
  ctaText?: string | null
}


export type SortOption = 'price_asc' | 'price_desc' // | 'newest' | 'oldest'

export const useCatalogStore = defineStore('catalog', () => {
  // State
  const categories = ref<Category[]>([])
  const products = ref<Product[]>([])
  const allProducts = ref<Product[]>([]) // Store all products for category counts
  const banners = ref<Banner[]>([])
  const currentProduct = ref<Product | null>(null)
  
  const activeCategory = ref<string | null>(null)
  const activeGroup = ref<string | null>(null)
  const sortBy = ref<SortOption>('price_asc')
  const searchQuery = ref('')
  const crossSellProducts = ref<Record<string, Product[]>>({})
  
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  
  // Pagination
  const currentPage = ref(0)
  const itemsPerPage = ref(20)
  const hasMore = ref(true)
  const totalProducts = ref(0)

  // Computed
  const filteredProducts = computed(() => {
    let filtered = products.value
    
    if (activeCategory.value) {
      const category = categories.value.find(c => c.slug === activeCategory.value)
      if (category) {
        filtered = filtered.filter(p => p.categoryId === category.id)
      }
    }

    if (activeGroup.value) {
      filtered = filtered.filter(p => p.groupSlug === activeGroup.value)
    }
    
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(query) || 
        p.description.toLowerCase().includes(query)
      )
    }
    
    return filtered
  })

  const categoriesWithProductCounts = computed(() => {
    return categories.value.map(category => ({
      ...category,
      productCount: allProducts.value.filter(p => p.categoryId === category.id).length
    }))
  })

  const activeCategoryName = computed(() => {
    if (!activeCategory.value) return 'Все товары'
    const category = categories.value.find(c => c.slug === activeCategory.value)
    return category?.name || 'Все товары'
  })

  const activeGroupName = computed(() => {
    if (!activeGroup.value) return null
    const category = categories.value.find(c => c.slug === activeCategory.value)
    const group = category?.groups.find(g => g.slug === activeGroup.value)
    return group?.name || null
  })

  // Helpers
  function delay(ms: number) { return new Promise(res => setTimeout(res, ms)) }
  async function waitForIdle(timeoutMs = 3000) {
    const start = Date.now()
    while (isLoading.value) {
      if (Date.now() - start > timeoutMs) break
      await delay(50)
    }
  }

  // Actions
  async function fetchCategories() {
    try {
      const response = await fetch('/api/categories')
      if (!response.ok) throw new Error('Failed to fetch categories')
      const data = await response.json()
      const mapped: Category[] = (data as any[]).map((cat) => ({
        id: String(cat.id),
        slug: cat.slug,
        name: cat.name,
        order: cat.order ?? 0,
        productCount: cat.productCount ?? 0,
        coverImage: cat.coverImage ?? cat.cover_image ?? null,
        displayMode: (cat.displayMode ?? cat.display_mode ?? 'default') as 'default' | 'liquid' | 'visual',
        groups: Array.isArray(cat.groups)
          ? (cat.groups as any[]).map((group) => ({
              id: String(group.id),
              slug: group.slug,
              name: group.name,
              order: group.order ?? 0,
              coverImage: group.coverImage ?? null,
              productCount: group.productCount ?? 0,
              totalProductCount: group.totalProductCount ?? group.productCount ?? 0,
              parentId: group.parentId ?? null,
              badge: group.badge ?? null,
              badgeColor: group.badgeColor ?? null
            }))
          : []
      }))
      categories.value = mapped.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      console.error('Error fetching categories:', err)
    }
  }

  async function fetchProducts(loadMore = false) {
    if (isLoading.value) return
    
    try {
      isLoading.value = true
      error.value = null
      
      const offset = loadMore ? currentPage.value * itemsPerPage.value : 0
      const params = new URLSearchParams({
        limit: itemsPerPage.value.toString(),
        offset: offset.toString(),
        sort: sortBy.value
      })
      
      if (activeCategory.value) {
        params.set('category', activeCategory.value)
      }

      if (activeGroup.value) {
        params.set('group', activeGroup.value)
      }
      
      const response = await fetch(`/api/products?${params}`)
      if (!response.ok) throw new Error('Failed to fetch products')
      
      const data = await response.json()
      
      if (loadMore) {
        products.value.push(...data.products)
        currentPage.value++
      } else {
      products.value = data.products
        currentPage.value = 0
      }
      
      totalProducts.value = data.total
      hasMore.value = data.hasMore
      
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      console.error('Error fetching products:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchAllProducts() {
    try {
      // Fetch all products without pagination or category filter for counts
      const response = await fetch('/api/products?limit=1000&offset=0')
      if (!response.ok) throw new Error('Failed to fetch all products')
      const data = await response.json()
      allProducts.value = data.products
    } catch (err) {
      console.error('Error fetching all products for counts:', err)
    }
  }

  async function fetchProduct(id: string) {
    try {
      isLoading.value = true
      error.value = null
      
      const response = await fetch(`/api/product/${id}`)
      if (!response.ok) throw new Error('Product not found')
      
      currentProduct.value = await response.json()
      
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      console.error('Error fetching product:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchBanners() {
    try {
      const response = await fetch('/api/banners')
      if (!response.ok) throw new Error('Failed to fetch banners')
      const raw = await response.json()
      // Normalize shape to { id, image, href, active:number, order, openInNewTab }
      const data: Banner[] = (raw as any[]).map((b: any) => ({
        id: String(b.id),
        image: b.image || b.imageUrl || '',
        href: b.href ?? b.linkUrl ?? null,
        active: typeof b.active === 'boolean' ? (b.active ? 1 : 0) : (b.active ?? (b.isActive ? 1 : 0)),
        order: b.order ?? 0,
        openInNewTab: b.openInNewTab ?? 0, // API returns 0/1, default to 0
        title: b.title ?? b.name ?? undefined,
        description: b.description ?? undefined,
        ctaText: b.ctaText ?? b.buttonText ?? null,
      }))
      // show only active banners sorted by order asc
      banners.value = data
        .filter(b => b.active === 1)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      console.error('Error fetching banners:', err)
    }
  }

  async function searchProducts(query: string) {
    if (!query.trim()) {
      searchQuery.value = ''
      await fetchProducts()
      return
    }
    
    try {
      isLoading.value = true
      error.value = null
      searchQuery.value = query
      
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=50`)
      if (!response.ok) throw new Error('Search failed')
      
      const data = await response.json()
      products.value = data.results
      hasMore.value = false
      
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      console.error('Error searching products:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function setActiveCategory(categorySlug: string | null) {
    activeCategory.value = categorySlug
    activeGroup.value = null
    currentPage.value = 0
    await waitForIdle()
    return fetchProducts()
  }

  async function setActiveGroup(groupSlug: string | null) {
    activeGroup.value = groupSlug
    currentPage.value = 0
    await waitForIdle()
    return fetchProducts()
  }

  async function setSortBy(sort: SortOption) {
    sortBy.value = sort
    currentPage.value = 0
    await waitForIdle()
    return fetchProducts()
  }

  function loadMoreProducts() {
    if (hasMore.value && !isLoading.value) {
      fetchProducts(true)
    }
  }

  function clearSearch() {
    searchQuery.value = ''
    fetchProducts()
  }

  async function fetchCrossSell(categorySlug: string) {
    try {
      const response = await fetch(`/api/cross-sells?category=${encodeURIComponent(categorySlug)}`)
      if (!response.ok) throw new Error('Failed to fetch cross sell items')
      const data = await response.json()
      crossSellProducts.value = { ...crossSellProducts.value, [categorySlug]: data }
      return data as Product[]
    } catch (err) {
      console.error('Error fetching cross-sell:', err)
      return []
    }
  }

  function clearError() {
    error.value = null
  }
  
  function clearCurrentProduct() {
    currentProduct.value = null
  }


  // Initialize
  async function initialize() {
    await Promise.all([
      fetchCategories(),
      fetchBanners(),
      fetchProducts(),
      fetchAllProducts() // Load all products for category counts
    ])
  }

  return {
    // State
    categories,
    products,
    allProducts,
    banners,
    currentProduct,
    activeCategory,
    activeGroup,
    sortBy,
    searchQuery,
    crossSellProducts,
    isLoading,
    error,
    currentPage,
    hasMore,
    totalProducts,
    
    // Computed
    filteredProducts,
    activeCategoryName,
    activeGroupName,
    categoriesWithProductCounts,
    
    // Actions
    fetchCategories,
    fetchProducts,
    fetchAllProducts,
    fetchProduct,
    fetchBanners,
    searchProducts,
    setActiveCategory,
    setActiveGroup,
    setSortBy,
    loadMoreProducts,
    clearSearch,
    clearError,
    clearCurrentProduct,
    fetchCrossSell,
    initialize
  }
})