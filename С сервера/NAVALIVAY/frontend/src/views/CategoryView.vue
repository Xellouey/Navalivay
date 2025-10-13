<template>
  <div class="min-h-screen bg-brand-primary tg-safe-area">
    <main class="container-safe pb-20 pt-4">
      <div class="bg-brand-dark text-white rounded-3xl overflow-hidden">
        <!-- Header -->
        <header class="sticky top-0 z-50 bg-brand-dark border-b-2 border-brand-primary">
          <div class="flex flex-wrap items-center gap-3 px-4 py-3">
            <div class="flex flex-col gap-1">
              <h1 class="text-lg font-semibold">{{ category?.name || 'Категория' }}</h1>
              <p v-if="catalogStore.activeGroupName" class="text-sm text-white/70">
                Линейка: <span class="font-medium text-white">{{ catalogStore.activeGroupName }}</span>
              </p>
            </div>
            <div class="flex items-center gap-3 ml-auto">
              <div
                v-if="allowCustomView"
                class="inline-flex rounded-full border-2 border-brand-dark bg-brand-primary/10 p-1"
              >
                <button
                  v-for="mode in displayModes"
                  :key="mode.value"
                  class="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                  :class="displayMode === mode.value ? 'bg-brand-primary text-brand-dark shadow-md' : 'text-white/70 hover:bg-white/10'"
                  @click="setDisplayMode(mode.value)"
                >
                  {{ mode.label }}
                </button>
              </div>
              <span
                v-else-if="displayModeBadge"
                class="px-3 py-1.5 rounded-full border-2 border-brand-primary/60 bg-brand-primary/15 text-xs font-semibold uppercase tracking-wide text-white/80"
              >
                {{ displayModeBadge }}
              </span>
              <div class="relative">
              <button
                class="flex items-center space-x-2 px-3 py-2 bg-brand-primary text-brand-dark rounded-full border-2 border-brand-dark"
                @click="showSortMenu = !showSortMenu"
              >
                <span class="text-sm">{{ sortLabels[catalogStore.sortBy] }}</span>
                <ChevronDownIcon class="w-4 h-4" />
              </button>
              <Transition
                enter-active-class="transition-all duration-200 ease-out"
                enter-from-class="opacity-0 scale-95"
                enter-to-class="opacity-100 scale-100"
                leave-active-class="transition-all duration-150 ease-in"
                leave-from-class="opacity-100 scale-100"
                leave-to-class="opacity-0 scale-95"
              >
                <div
                  v-if="showSortMenu"
                  class="absolute right-0 top-full mt-2 w-48 bg-white border-2 border-brand-dark rounded-xl z-10 text-brand-dark"
                >
                  <button
                    v-for="(label, key) in sortLabels"
                    :key="key"
                    class="block w-full px-4 py-2 text-left text-sm hover:bg-brand-primary/10 first:rounded-t-lg last:rounded-b-lg transition-colors"
                    :class="{ 'text-brand-dark font-medium': catalogStore.sortBy === key }"
                    @click="selectSort(key as SortOption)"
                  >
                    {{ label }}
                  </button>
                </div>
              </Transition>
              </div>
            </div>
          </div>
        </header>

        <!-- Loading -->
        <div v-if="loading" class="flex justify-center items-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-2 border-brand-primary border-t-transparent"></div>
        </div>

        <!-- Error -->
        <div v-else-if="error || catalogStore.error" class="flex flex-col items-center justify-center py-16 text-center px-6">
          <ExclamationTriangleIcon class="w-12 h-12 text-brand-primary mb-4" />
          <h2 class="text-xl font-semibold mb-2">Категория недоступна</h2>
          <p class="text-white/80 mb-6">{{ error || catalogStore.error }}</p>
          <router-link 
            to="/"
            class="px-4 py-2 bg-brand-primary text-brand-dark rounded-lg border-2 border-brand-dark"
          >
            На главную
          </router-link>
        </div>

        <!-- Content -->
        <div v-else class="space-y-6 pb-6">
          <section v-if="shouldShowCrossSell" class="px-4">
            <div class="rounded-3xl border-2 border-white/10 bg-white/5 p-5">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 class="text-lg font-semibold text-white">А вдруг пригодится?</h2>
                  <p class="text-sm text-white/60">Подборка для дополнения заказа</p>
                </div>
                <button
                  v-if="crossSellItems.length"
                  class="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/10"
                  @click="$router.push('/')"
                >
                  На главную
                </button>
              </div>

              <div
                v-if="crossSellLoading"
                class="flex items-center justify-center gap-3 py-10 text-sm text-white/70"
              >
                <div class="h-5 w-5 animate-spin rounded-full border-2 border-brand-primary border-t-transparent"></div>
                Загружаем рекомендации…
              </div>

              <div v-else-if="crossSellItems.length" class="mt-6 flex gap-4 overflow-x-auto pb-2">
                <article
                  v-for="item in crossSellItems"
                  :key="`cross-sell-${item.id}`"
                  class="min-w-[240px] max-w-[260px] flex-shrink-0 cursor-pointer rounded-2xl border border-white/10 bg-black/40 p-4 transition hover:border-brand-primary/60 hover:bg-black/55"
                  @click="$router.push({ name: 'product', params: { id: item.id } })"
                >
                  <div class="relative mb-4 h-36 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                    <img
                      v-if="item.images?.length"
                      :src="item.images[0]"
                      :alt="item.title"
                      class="h-full w-full object-cover"
                    />
                    <div v-else class="flex h-full w-full items-center justify-center text-xs text-white/50">
                      Фото отсутствует
                    </div>
                    <span
                      v-if="item.priceRub"
                      class="absolute left-2 top-2 rounded-full bg-brand-primary px-3 py-1 text-xs font-semibold text-brand-dark"
                    >
                      {{ formatCurrency(item.priceRub) }}
                    </span>
                  </div>
                  <h3 class="text-base font-semibold text-white line-clamp-2">{{ item.title }}</h3>
                  <p v-if="item.description" class="mt-2 text-xs text-white/60 line-clamp-3">
                    {{ item.description }}
                  </p>
                  <div class="mt-4 flex items-center justify-between text-xs text-white/60">
                    <span v-if="item.groupName">{{ item.groupName }}</span>
                    <span v-else-if="category?.name">{{ category.name }}</span>
                    <span v-if="item.stock !== undefined" class="rounded-full bg-white/10 px-2 py-0.5">
                      Остаток: {{ item.stock }}
                    </span>
                  </div>
                </article>
              </div>

              <div v-else class="mt-6 rounded-2xl border border-dashed border-white/15 bg-white/5 p-6 text-center text-sm text-white/60">
                Подборка формируется — скоро здесь появятся рекомендации.
              </div>
            </div>
          </section>

          <!-- Groups navigation -->
          <section v-if="categoryGroups.length && allowGroupFiltering" class="px-4">
            <div class="flex flex-wrap items-center gap-3 mb-4">
              <h2 class="text-base font-semibold tracking-wide">Линейки</h2>
              <button
                v-if="catalogStore.activeGroup"
                class="text-xs px-3 py-1 rounded-full border border-white/30 hover:bg-white/10 transition"
                @click="handleGroupSelect(null)"
              >
                Все вкусы
              </button>
            </div>
            <div class="flex flex-wrap gap-3">
              <button
                v-for="group in categoryGroups"
                :key="group.id"
                class="group-chip"
                :class="{ active: catalogStore.activeGroup === group.slug }"
                @click="handleGroupSelect(group.slug)"
              >
                <span class="group-chip__name">{{ group.name }}</span>
                <span class="group-chip__meta">{{ group.totalProductCount ?? group.productCount }} вкусов</span>
              </button>
            </div>
          </section>

          <!-- Products grid -->
          <section v-if="uiMode === 'grid'" class="px-4">
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div
                v-if="catalogStore.isLoading && !catalogStore.products.length"
                v-for="n in 8"
                :key="`grid-skeleton-${n}`"
                class="rounded-2xl aspect-[3/4] border-2 border-white/20 bg-white/10 animate-pulse"
              />

              <ProductCard
                v-for="product in productsForCategory"
                :key="product.id"
                :product="product"
                @click="$router.push({ name: 'product', params: { id: product.id } })"
              />
            </div>

            <div
              v-if="!catalogStore.isLoading && !productsForCategory.length"
              class="flex-center flex-col space-y-4 py-12 text-white/80"
            >
              <div class="w-16 h-16 bg-white/10 rounded-full flex-center">
                <ExclamationTriangleIcon class="w-8 h-8 text-white/60" />
              </div>
              <div class="text-center">
                <h3 class="text-lg font-medium mb-2">Товаров не найдено</h3>
                <p>Попробуйте выбрать другую категорию</p>
              </div>
            </div>
          </section>

          <!-- Products list -->
          <section v-else-if="uiMode === 'list'" class="px-3 md:px-4">
            <div class="space-y-4">
              <div
                v-if="catalogStore.isLoading && !catalogStore.products.length"
                v-for="n in 6"
                :key="`list-skeleton-${n}`"
                class="flex flex-col gap-3 rounded-3xl border-2 border-white/10 bg-white/5 p-4 animate-pulse"
              >
                <div class="h-40 rounded-2xl bg-white/10" />
                <div class="h-4 w-2/3 rounded bg-white/20" />
                <div class="h-3 w-1/2 rounded bg-white/10" />
              </div>

              <article
                v-for="product in productsForCategory"
                :key="`list-${product.id}`"
                class="flex flex-col gap-4 rounded-3xl border-2 border-white/10 bg-white/5 p-4 md:flex-row md:items-center md:gap-6"
              >
                <div class="relative flex-shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30 md:w-48 md:h-40">
                  <img
                    v-if="product.images?.length"
                    :src="product.images[0]"
                    :alt="product.title"
                    class="h-full w-full object-cover"
                  />
                  <div
                    v-else
                    class="flex h-full w-full items-center justify-center bg-brand-primary/15 text-xs text-white/50"
                  >
                    Нет изображения
                  </div>
                  <span
                    v-if="product.stock !== undefined && product.stock !== null && product.minStock !== undefined && product.minStock !== null && product.minStock > 0"
                    class="absolute left-2 top-2 rounded-full bg-brand-dark/80 px-3 py-1 text-[11px] uppercase tracking-wide text-white"
                  >
                    Остаток: {{ product.stock }}
                  </span>
                </div>

                <div class="flex-1 space-y-3">
                  <header class="space-y-1">
                    <div class="flex items-center gap-2 text-xs uppercase tracking-wide text-white/50">
                      <span>Арт. #{{ product.id }}</span>
                      <span v-if="product.strength" class="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold">
                        {{ product.strength }}
                      </span>
                      <span v-if="product.variant" class="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold">
                        {{ product.variant }}
                      </span>
                    </div>
                    <h3 class="text-xl font-semibold text-white">
                      {{ product.title }}
                    </h3>
                  </header>

                  <p v-if="product.description" class="text-sm text-white/70">
                    {{ product.description }}
                  </p>

                  <dl class="grid grid-cols-1 gap-3 text-xs text-white/60 sm:grid-cols-2">
                    <div v-if="product.priceRub" class="rounded-2xl bg-white/5 p-3">
                      <dt class="uppercase tracking-wide">Цена</dt>
                      <dd class="mt-1 text-base font-semibold text-white">
                        {{ formatCurrency(product.priceRub) }}
                      </dd>
                    </div>
                    <div v-if="product.costPrice" class="rounded-2xl bg-white/5 p-3">
                      <dt class="uppercase tracking-wide">Себестоимость</dt>
                      <dd class="mt-1 text-sm">
                        {{ formatCurrency(product.costPrice) }}
                      </dd>
                    </div>
                    <div v-if="product.stock !== undefined && product.stock !== null" class="rounded-2xl bg-white/5 p-3">
                      <dt class="uppercase tracking-wide">Остаток</dt>
                      <dd
                        class="mt-1 text-sm font-semibold"
                        :class="product.minStock && product.stock <= product.minStock ? 'text-red-300' : 'text-white'"
                      >
                        {{ product.stock }}
                        <span v-if="product.minStock" class="text-xs text-white/50"> / мин. {{ product.minStock }}</span>
                      </dd>
                    </div>
                    <div v-if="product.links?.length" class="rounded-2xl bg-white/5 p-3">
                      <dt class="uppercase tracking-wide">Ссылки</dt>
                      <dd class="mt-1 space-y-1">
                        <a
                          v-for="link in product.links"
                          :key="link.url"
                          :href="link.url"
                          target="_blank"
                          class="block text-xs text-brand-primary underline-offset-2 hover:underline"
                        >
                          {{ link.label || link.url }}
                        </a>
                      </dd>
                    </div>
                  </dl>

                  <footer class="flex flex-wrap items-center gap-3">
                    <button
                      class="inline-flex items-center gap-2 rounded-full border-2 border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/10"
                      @click="$router.push({ name: 'product', params: { id: product.id } })"
                    >
                      Подробнее
                    </button>
                    <span v-if="product.color" class="rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-wide">
                      Цвет: {{ product.color }}
                    </span>
                  </footer>
                </div>
              </article>

              <div
                v-if="!catalogStore.isLoading && !productsForCategory.length"
                class="flex-center flex-col space-y-4 py-12 text-white/80"
              >
                <div class="w-16 h-16 bg-white/10 rounded-full flex-center">
                  <ExclamationTriangleIcon class="w-8 h-8 text-white/60" />
                </div>
                <div class="text-center">
                  <h3 class="text-lg font-medium mb-2">Товаров не найдено</h3>
                  <p>Попробуйте выбрать другую категорию</p>
                </div>
              </div>
            </div>
          </section>

          <!-- Liquids -->
          <section v-else-if="uiMode === 'liquid'" class="px-3 md:px-4 space-y-4">
            <div
              v-for="group in liquidGroups"
              :key="group.id"
              class="rounded-3xl border-2 border-white/10 bg-white/5 overflow-hidden"
            >
              <button
                type="button"
                class="flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-white/10"
                @click="toggleLiquidGroup(group.id)"
              >
                <div v-if="group.coverImage" class="h-16 w-24 overflow-hidden rounded-2xl border border-white/10">
                  <img :src="group.coverImage" :alt="group.name" class="h-full w-full object-cover" />
                </div>
                <div class="flex-1">
                  <h3 class="text-xl font-semibold text-white">{{ group.name }}</h3>
                  <p class="text-xs uppercase tracking-wide text-white/60">
                    {{ group.totalProductCount }} вкусов
                  </p>
                </div>
                <ChevronDownIcon
                  class="h-5 w-5 text-white/70 transition-transform"
                  :class="{ 'rotate-180': isLiquidGroupExpanded(group.id) }"
                />
              </button>
              <Transition
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="opacity-0 -translate-y-1"
                enter-to-class="opacity-100 translate-y-0"
                leave-active-class="transition duration-150 ease-in"
                leave-from-class="opacity-100 translate-y-0"
                leave-to-class="opacity-0 -translate-y-1"
              >
                <div
                  v-if="isLiquidGroupExpanded(group.id)"
                  class="space-y-4 border-t border-white/5 bg-white/5 px-4 py-4"
                >
                  <div
                    v-for="section in group.sections"
                    :key="section.key"
                    class="space-y-3"
                  >
                    <h4
                      class="text-sm font-semibold uppercase tracking-wide text-white/70"
                      :style="section.depth > 0 ? { paddingLeft: `${Math.min(section.depth * 0.75, 2.5)}rem` } : undefined"
                    >
                      {{ section.title }}
                    </h4>
                    <ul class="space-y-2">
                      <li
                        v-for="product in section.products"
                        :key="`liquid-${group.id}-${product.id}`"
                        class="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                      >
                        <div class="flex flex-col">
                          <span class="text-base font-medium text-white">{{ product.title }}</span>
                          <span v-if="product.description" class="text-xs text-white/60">
                            {{ product.description }}
                          </span>
                        </div>
                        <div class="flex items-center gap-3">
                          <span class="text-sm font-semibold text-brand-primary">{{ formatCurrency(product.priceRub) }}</span>
                          <button
                            class="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-wide text-white/80 transition hover:bg-white/10"
                            @click="$router.push({ name: 'product', params: { id: product.id } })"
                          >
                            Подробнее
                          </button>
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>
              </Transition>
            </div>

            <div
              v-if="liquidUngroupedProducts.length"
              class="rounded-3xl border-2 border-dashed border-white/10 bg-white/5 px-4 py-5"
            >
              <h3 class="text-sm font-semibold uppercase tracking-wide text-white/70 mb-3">Дополнительные вкусы</h3>
              <ul class="space-y-2">
                <li
                  v-for="product in liquidUngroupedProducts"
                  :key="`liquid-ungrouped-${product.id}`"
                  class="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <div>
                    <span class="text-base font-medium text-white">{{ product.title }}</span>
                    <p v-if="product.description" class="text-xs text-white/60 mt-0.5">
                      {{ product.description }}
                    </p>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="text-sm font-semibold text-brand-primary">{{ formatCurrency(product.priceRub) }}</span>
                    <button
                      class="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-wide text-white/80 transition hover:bg-white/10"
                      @click="$router.push({ name: 'product', params: { id: product.id } })"
                    >
                      Подробнее
                    </button>
                  </div>
                </li>
              </ul>
            </div>

            <div
              v-if="!liquidGroups.length && !liquidUngroupedProducts.length"
              class="flex-center flex-col space-y-4 py-12 text-white/80"
            >
              <div class="w-16 h-16 bg-white/10 rounded-full flex-center">
                <ExclamationTriangleIcon class="w-8 h-8 text-white/60" />
              </div>
              <div class="text-center">
                <h3 class="text-lg font-medium mb-2">Вкусы не найдены</h3>
                <p>Похоже, эта линейка пока недоступна.</p>
              </div>
            </div>
          </section>

          <!-- Visual grid -->
          <section v-else class="px-4">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div
                v-if="catalogStore.isLoading && !productsForCategory.length"
                v-for="n in 6"
                :key="`visual-skeleton-${n}`"
                class="h-72 rounded-3xl border-2 border-white/10 bg-white/5 animate-pulse"
              />

              <article
                v-for="product in productsForCategory"
                :key="`visual-${product.id}`"
                class="group relative flex h-72 flex-col overflow-hidden rounded-3xl border-2 border-white/10 bg-black/40"
              >
                <img
                  v-if="product.images?.length"
                  :src="product.images[0]"
                  :alt="product.title"
                  class="absolute inset-0 h-full w-full object-cover opacity-70 transition group-hover:opacity-90"
                />
                <div v-else class="absolute inset-0 flex items-center justify-center bg-brand-primary/15 text-xs text-white/60">
                  Фото отсутствует
                </div>
                <div class="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div class="relative mt-auto space-y-2 p-4">
                  <p class="text-xs uppercase tracking-wide text-white/60">
                    {{ product.groupName || category?.name }}
                  </p>
                  <h3 class="text-lg font-semibold text-white">{{ product.title }}</h3>
                  <p v-if="product.description" class="text-sm text-white/70 line-clamp-2">
                    {{ product.description }}
                  </p>
                  <div class="flex items-center justify-between pt-2">
                    <span class="text-base font-semibold text-brand-primary">{{ formatCurrency(product.priceRub) }}</span>
                    <button
                      class="rounded-full border border-white/20 px-4 py-1 text-xs uppercase tracking-wide text-white/80 transition hover:bg-white/10"
                      @click="$router.push({ name: 'product', params: { id: product.id } })"
                    >
                      Подробнее
                    </button>
                  </div>
                </div>
              </article>
            </div>

            <div
              v-if="!catalogStore.isLoading && !productsForCategory.length"
              class="flex-center flex-col space-y-4 py-12 text-white/80"
            >
              <div class="w-16 h-16 bg-white/10 rounded-full flex-center">
                <ExclamationTriangleIcon class="w-8 h-8 text-white/60" />
              </div>
              <div class="text-center">
                <h3 class="text-lg font-medium mb-2">Товаров не найдено</h3>
                <p>Попробуйте выбрать другую категорию</p>
              </div>
            </div>
          </section>

        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { onBeforeRouteUpdate, useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import { useCatalogStore, type SortOption, type Product, type CategoryGroup } from '@/stores/catalog'
import ProductCard from '@/components/ProductCard.vue'
import { 
  ExclamationTriangleIcon,
  ChevronDownIcon
} from '@heroicons/vue/24/outline'

interface Props { slug: string }
const props = defineProps<Props>()

const catalogStore = useCatalogStore()
const route = useRoute()
const router = useRouter()

const loading = ref(false)
const error = ref('')
const showSortMenu = ref(false)
const syncingGroup = ref(false)
const displayMode = ref<'list' | 'grid'>('list')
const crossSellLoading = ref(false)
const fetchedCrossSell = ref<Set<string>>(new Set())

const sortLabels: Record<SortOption, string> = {
  price_asc: 'Цена ↑',
  price_desc: 'Цена ↓'
  // newest: 'Новые',
  // oldest: 'Старые'
}

const category = computed(() => 
  catalogStore.categories.find(cat => cat.slug === props.slug) || null
)

const productsForCategory = computed(() => catalogStore.filteredProducts)

const totalForCategory = computed(() => catalogStore.totalProducts)

const categoryGroups = computed(() => category.value?.groups ?? [])

const crossSellItems = computed<Product[]>(() => {
  const slug = category.value?.slug
  if (!slug) return []
  const record = catalogStore.crossSellProducts[slug]
  return Array.isArray(record) ? record : []
})

const shouldShowCrossSell = computed(() => crossSellLoading.value || crossSellItems.value.length > 0)

const categoryDisplayMode = computed(() => category.value?.displayMode ?? 'default')
const allowCustomView = computed(() => categoryDisplayMode.value === 'default')
const allowGroupFiltering = computed(() => categoryDisplayMode.value !== 'liquid')

const uiMode = computed(() => {
  if (categoryDisplayMode.value === 'liquid') return 'liquid'
  if (categoryDisplayMode.value === 'visual') return 'visual'
  return displayMode.value
})

const categoryProducts = computed(() => catalogStore.products)

const displayModeBadge = computed(() => {
  if (categoryDisplayMode.value === 'liquid') return 'Жидкости'
  if (categoryDisplayMode.value === 'visual') return 'Витрина'
  return null
})

interface LiquidSection {
  key: string
  title: string
  depth: number
  products: Product[]
}

interface LiquidGroupDisplay {
  id: string
  name: string
  slug: string
  coverImage?: string | null
  totalProductCount: number
  sections: LiquidSection[]
}

const liquidProductMapping = computed(() => {
  const grouping = new Map<string, Product[]>()
  const ungrouped: Product[] = []

  categoryProducts.value.forEach((product) => {
    const key = product.groupId !== null && product.groupId !== undefined ? String(product.groupId) : null
    if (key) {
      const list = grouping.get(key) || []
      list.push(product)
      grouping.set(key, list)
    } else {
      ungrouped.push(product)
    }
  })

  const sortProducts = (items: Product[]) => {
    items.sort((a, b) => a.title.localeCompare(b.title, 'ru', { sensitivity: 'base' }))
  }

  grouping.forEach(sortProducts)
  sortProducts(ungrouped)

  return { grouping, ungrouped }
})

type LiquidNode = CategoryGroup & { children: LiquidNode[] }

const liquidGroups = computed<LiquidGroupDisplay[]>(() => {
  if (categoryDisplayMode.value !== 'liquid') {
    return []
  }

  const nodesMap = new Map<string, LiquidNode>()
  categoryGroups.value.forEach((group) => {
    nodesMap.set(group.id, {
      ...group,
      parentId: group.parentId ?? null,
      totalProductCount: group.totalProductCount ?? group.productCount,
      children: []
    })
  })

  const roots: LiquidNode[] = []

  nodesMap.forEach((node) => {
    if (node.parentId && nodesMap.has(String(node.parentId))) {
      nodesMap.get(String(node.parentId))!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  const sortTree = (items: LiquidNode[]) => {
    items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    items.forEach(child => sortTree(child.children))
  }

  sortTree(roots)

  const buildSections = (node: LiquidNode, depth = 0): LiquidSection[] => {
    const result: LiquidSection[] = []
    const directProducts = liquidProductMapping.value.grouping.get(node.id) || []
    if (directProducts.length) {
      result.push({
        key: `${node.id}-self`,
        title: depth === 0 ? 'Вкусы' : node.name,
        depth,
        products: directProducts
      })
    }
    node.children.forEach(child => {
      result.push(...buildSections(child, depth + 1))
    })
    return result
  }

  return roots
    .filter(node => (node.totalProductCount ?? node.productCount ?? 0) > 0)
    .map(node => ({
      id: node.id,
      name: node.name,
      slug: node.slug,
      coverImage: node.coverImage,
      totalProductCount: node.totalProductCount ?? node.productCount ?? 0,
      sections: buildSections(node)
    }))
})

const liquidUngroupedProducts = computed(() => liquidProductMapping.value.ungrouped)

const expandedLiquidGroupIds = ref<Set<string>>(new Set())
const seenLiquidGroupIds = ref<Set<string>>(new Set())

watch(liquidGroups, (groups) => {
  const previousExpanded = expandedLiquidGroupIds.value
  const nextExpanded = new Set<string>()
  const seen = new Set(seenLiquidGroupIds.value)

  groups.forEach(group => {
    const isNew = !seen.has(group.id)
    if (isNew || previousExpanded.has(group.id)) {
      nextExpanded.add(group.id)
    }
    seen.add(group.id)
  })

  expandedLiquidGroupIds.value = nextExpanded
  seenLiquidGroupIds.value = seen
})

function toggleLiquidGroup(groupId: string) {
  const next = new Set(expandedLiquidGroupIds.value)
  if (next.has(groupId)) {
    next.delete(groupId)
  } else {
    next.add(groupId)
  }
  expandedLiquidGroupIds.value = next
}

function isLiquidGroupExpanded(groupId: string) {
  return expandedLiquidGroupIds.value.has(groupId)
}

const routeGroupSlug = computed(() => {
  const raw = route.query.group
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
})

const routeDisplayMode = computed(() => {
  const raw = route.query.view
  if (typeof raw !== 'string') return null
  return raw === 'grid' ? 'grid' : raw === 'list' ? 'list' : null
})

const displayModes = [
  { value: 'list', label: 'Список' },
  { value: 'grid', label: 'Плитка' }
] as const

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(value)
}

function setDisplayMode(mode: 'list' | 'grid') {
  if (!allowCustomView.value) return
  if (displayMode.value === mode) return
  displayMode.value = mode
  const targetQuery = buildCategoryRouteQuery(catalogStore.activeGroup, mode)
  if (!isSameQuery(route.query, targetQuery)) {
    void router.replace({
      name: 'category',
      params: { slug: props.slug },
      query: targetQuery
    })
  }
}

function selectSort(sortOption: SortOption) {
  catalogStore.setSortBy(sortOption)
  showSortMenu.value = false
}

async function ensureDataForSlug(
  slug: string,
  groupSlug: string | null = routeGroupSlug.value,
  initialDisplayMode: 'list' | 'grid' | null = routeDisplayMode.value
) {
  loading.value = true
  error.value = ''
  try {
    // Инициализируем данные каталога если они не загружены
    if (!catalogStore.categories.length) {
      console.log('[CategoryView] Initializing catalog data')
      await catalogStore.initialize()
    }
    
    const exists = catalogStore.categories.some(c => c.slug === slug)
    if (!exists) {
      error.value = 'Запрошенная категория не существует или была удалена.'
      return
    }
    await catalogStore.setActiveCategory(slug) // дождаться загрузки
    await syncGroupFromRoute(groupSlug)
    if (allowCustomView.value) {
      displayMode.value = initialDisplayMode ?? 'list'
    } else {
      displayMode.value = categoryDisplayMode.value === 'visual' ? 'grid' : 'list'
    }
    void ensureCrossSell(slug)
  } catch (err) {
    console.error('[CategoryView] Error loading category data:', err)
    error.value = err instanceof Error ? err.message : 'Не удалось загрузить товары'
  } finally {
    loading.value = false
  }
}

function buildCategoryRouteQuery(
  groupSlug: string | null,
  viewMode: 'list' | 'grid' | null = allowCustomView.value ? displayMode.value : null
) {
  const nextQuery: LocationQueryRaw = {}

  for (const [key, value] of Object.entries(route.query)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      nextQuery[key] = value.map(entry => (entry != null ? String(entry) : null))
    } else {
      nextQuery[key] = value != null ? String(value) : null
    }
  }

  if (allowGroupFiltering.value && groupSlug) {
    nextQuery.group = groupSlug
  } else {
    delete nextQuery.group
  }

  if (allowCustomView.value && viewMode) {
    nextQuery.view = viewMode
  } else {
    delete nextQuery.view
  }

  return nextQuery
}

async function ensureCrossSell(slug: string) {
  if (!slug) return
  const alreadyFetched = fetchedCrossSell.value.has(slug)
  if (alreadyFetched) return
  crossSellLoading.value = true
  try {
    await catalogStore.fetchCrossSell(slug)
    const next = new Set(fetchedCrossSell.value)
    next.add(slug)
    fetchedCrossSell.value = next
  } catch (err) {
    console.error('[CategoryView] Cross-sell error', err)
  } finally {
    crossSellLoading.value = false
  }
}

function isSameQuery(a: Record<string, unknown>, b: Record<string, unknown>) {
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  return keysA.every((key) => {
    const valueA = a[key]
    const valueB = b[key]
    if (Array.isArray(valueA) || Array.isArray(valueB)) {
      const listA = Array.isArray(valueA) ? valueA : valueA === undefined ? [] : [valueA]
      const listB = Array.isArray(valueB) ? valueB : valueB === undefined ? [] : [valueB]
      if (listA.length !== listB.length) return false
      return listA.every((entry, idx) => String(entry) === String(listB[idx]))
    }
    if (valueA === undefined && valueB === undefined) return true
    return String(valueA ?? '') === String(valueB ?? '')
  })
}

async function handleGroupSelect(groupSlug: string | null) {
  if (!allowGroupFiltering.value) return
  if (syncingGroup.value) return
  syncingGroup.value = true
  try {
    await catalogStore.setActiveGroup(groupSlug)
    const targetQuery = buildCategoryRouteQuery(groupSlug)
    if (!isSameQuery(route.query, targetQuery)) {
      await router.replace({
        name: 'category',
        params: { slug: props.slug },
        query: targetQuery
      })
    }
  } finally {
    syncingGroup.value = false
  }
}

async function syncGroupFromRoute(groupSlug: string | null) {
  if (!category.value) return
  if (!allowGroupFiltering.value) {
    if (catalogStore.activeGroup) {
      await catalogStore.setActiveGroup(null)
    }
    if (route.query.group) {
      const targetQuery = buildCategoryRouteQuery(null)
      if (!isSameQuery(route.query, targetQuery)) {
        await router.replace({
          name: 'category',
          params: { slug: props.slug },
          query: targetQuery
        })
      }
    }
    return
  }
  const available = categoryGroups.value
  const match = groupSlug ? available.find(group => group.slug === groupSlug) : null

  syncingGroup.value = true
  try {
    if (groupSlug && !match) {
      // Некорректная линейка — сбрасываем
      if (catalogStore.activeGroup) {
        await catalogStore.setActiveGroup(null)
      }
      if (route.query.group) {
        const targetQuery = buildCategoryRouteQuery(null)
        if (!isSameQuery(route.query, targetQuery)) {
          await router.replace({
            name: 'category',
            params: { slug: props.slug },
            query: targetQuery
          })
        }
      }
      return
    }

    if (!groupSlug && catalogStore.activeGroup) {
      await catalogStore.setActiveGroup(null)
      return
    }

    if (groupSlug && catalogStore.activeGroup !== groupSlug) {
      await catalogStore.setActiveGroup(groupSlug)
    }
  } finally {
    syncingGroup.value = false
  }
}

onMounted(() => {
  ensureDataForSlug(props.slug)
})

onBeforeRouteUpdate((to) => {
  const slug = to.params.slug as string
  const incomingGroup = typeof to.query.group === 'string' ? to.query.group : null
  const incomingView = typeof to.query.view === 'string' ? to.query.view : null
  ensureDataForSlug(
    slug,
    incomingGroup,
    incomingView === 'grid' ? 'grid' : incomingView === 'list' ? 'list' : null
  )
})

watch(routeGroupSlug, (slug) => {
  if (!category.value) return
  if (!allowGroupFiltering.value) return
  void syncGroupFromRoute(slug)
})

watch(routeDisplayMode, (mode) => {
  if (!allowCustomView.value) {
    displayMode.value = 'list'
    return
  }
  if (!mode) {
    displayMode.value = 'list'
    return
  }
  displayMode.value = mode
})

watch(allowCustomView, (allowed) => {
  if (allowed) return
  if (route.query.view) {
    const targetQuery = buildCategoryRouteQuery(catalogStore.activeGroup, null)
    if (!isSameQuery(route.query, targetQuery)) {
      void router.replace({
        name: 'category',
        params: { slug: props.slug },
        query: targetQuery
      })
    }
  }
})

watch(() => catalogStore.activeGroup, (groupSlug) => {
  if (!allowGroupFiltering.value) return
  if (syncingGroup.value) return
  const targetQuery = buildCategoryRouteQuery(groupSlug)
  if (isSameQuery(route.query, targetQuery)) return
  void router.replace({
    name: 'category',
    params: { slug: props.slug },
    query: targetQuery
  })
})

watch(allowGroupFiltering, (allowed) => {
  if (allowed) return
  if (catalogStore.activeGroup) {
    void catalogStore.setActiveGroup(null)
  }
  if (route.query.group) {
    const targetQuery = buildCategoryRouteQuery(null)
    if (!isSameQuery(route.query, targetQuery)) {
      void router.replace({
        name: 'category',
        params: { slug: props.slug },
        query: targetQuery
      })
    }
  }
})

watch(displayMode, (mode) => {
  if (!allowCustomView.value) return
  const targetQuery = buildCategoryRouteQuery(catalogStore.activeGroup, mode)
  if (isSameQuery(route.query, targetQuery)) return
  void router.replace({
    name: 'category',
    params: { slug: props.slug },
    query: targetQuery
  })
})
</script>

<style scoped>
.group-chip {
  @apply px-4 py-3 bg-white/10 border border-white/20 rounded-2xl flex flex-col items-start gap-1 transition-colors;
}

.group-chip.active {
  @apply bg-brand-primary text-brand-dark border-brand-dark;
}

.group-chip__name {
  @apply text-sm font-semibold;
}

.group-chip__meta {
  @apply text-xs uppercase tracking-wide text-white/70;
}
</style>
