<!-- 
ЭТОТ ФАЙЛ УДАЛЕН В СООТВЕТСТВИИ С ПРАВИЛОМ: НЕ СОЗДАВАТЬ ДЕМО ВЕРСИИ
См. WARP.md раздел "КРИТИЧЕСКОЕ ПРАВИЛО: НЕ СОЗДАВАТЬ ДЕМО ВЕРСИИ"
-->

      <!-- Demo Controls -->
      <div class="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <h3 class="text-lg font-semibold mb-3">Демо контролы</h3>
        <div class="flex flex-col sm:flex-row gap-3">
          <button
            @click="addDemoCategory"
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Добавить тестовую категорию
          </button>
          <button
            @click="clearCategories"
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Очистить все категории
          </button>
          <button
            @click="loadSampleCategories"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Загрузить примеры категорий
          </button>
        </div>
      </div>

      <!-- Mobile viewport simulator -->
      <div class="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <h3 class="text-lg font-semibold mb-3">Симулятор мобильного экрана</h3>
        <div class="flex gap-2 mb-4">
          <button
            @click="viewportWidth = 'full'"
            :class="viewportWidth === 'full' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'"
            class="px-3 py-1 rounded text-sm transition-colors"
          >
            Полная ширина
          </button>
          <button
            @click="viewportWidth = 'tablet'"
            :class="viewportWidth === 'tablet' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'"
            class="px-3 py-1 rounded text-sm transition-colors"
          >
            Планшет (768px)
          </button>
          <button
            @click="viewportWidth = 'mobile'"
            :class="viewportWidth === 'mobile' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'"
            class="px-3 py-1 rounded text-sm transition-colors"
          >
            Мобильный (375px)
          </button>
        </div>
      </div>

      <!-- Viewport Container -->
      <div class="mx-auto transition-all duration-300" :class="viewportClass">
        <div class="bg-white rounded-lg shadow-lg border overflow-hidden">
          <div class="bg-gray-800 text-white p-3 flex items-center justify-between">
            <span class="text-sm font-medium">Админка - Категории</span>
            <span class="text-xs bg-gray-700 px-2 py-1 rounded">{{ currentViewportLabel }}</span>
          </div>
          
          <!-- Categories List Component -->
          <div class="p-4">
            <AdminCategoriesList
              :categories="demoCategories"
              :is-loading="isLoading"
              @create="handleCreate"
              @edit="handleEdit"
              @delete="handleDelete"
              @reorder="handleReorder"
            />
          </div>
        </div>
      </div>

      <!-- Debug Info -->
      <div class="mt-6 bg-white rounded-lg shadow-sm border p-4">
        <h3 class="text-lg font-semibold mb-3">Debug Info</h3>
        <div class="text-sm text-gray-600 space-y-1">
          <p><strong>Текущий viewport:</strong> {{ currentViewportLabel }}</p>
          <p><strong>Количество категорий:</strong> {{ demoCategories.length }}</p>
          <p><strong>Последнее действие:</strong> {{ lastAction || 'Нет' }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import AdminCategoriesList from '@/components/admin/AdminCategoriesList.vue'

interface Category {
  id: string
  slug: string
  name: string
  description?: string
  order?: number
  productCount?: number
}

const viewportWidth = ref<'full' | 'tablet' | 'mobile'>('full')
const isLoading = ref(false)
const lastAction = ref<string>('')

const viewportClass = computed(() => {
  switch (viewportWidth.value) {
    case 'mobile':
      return 'max-w-sm'
    case 'tablet':
      return 'max-w-2xl'
    default:
      return 'max-w-4xl'
  }
})

const currentViewportLabel = computed(() => {
  switch (viewportWidth.value) {
    case 'mobile':
      return 'Мобильный (375px)'
    case 'tablet':
      return 'Планшет (768px)'
    default:
      return 'Десктоп (полная ширина)'
  }
})

const demoCategories = ref<Category[]>([
  {
    id: '1',
    slug: 'tolstovki',
    name: 'Толстовки',
    description: 'Уютные толстовки для всех сезонов',
    order: 1,
    productCount: 15
  },
  {
    id: '2',
    slug: 'futbolki',
    name: 'Футболки',
    description: 'Стильные футболки',
    order: 2,
    productCount: 8
  }
])

const sampleCategories: Category[] = [
  { id: '1', slug: 'tolstovki', name: 'Толстовки', order: 1, productCount: 15 },
  { id: '2', slug: 'futbolki', name: 'Футболки', order: 2, productCount: 8 },
  { id: '3', slug: 'bryuki', name: 'Брюки', order: 3, productCount: 12 },
  { id: '4', slug: 'kurtki', name: 'Куртки', order: 4, productCount: 6 },
  { id: '5', slug: 'aksessuary', name: 'Аксессуары', order: 5, productCount: 0 },
  { id: '6', slug: 'obuv', name: 'Обувь', order: 6, productCount: 4 }
]

function addDemoCategory() {
  const newId = String(Date.now())
  const newCategory: Category = {
    id: newId,
    slug: `category-${newId}`,
    name: `Новая категория ${demoCategories.value.length + 1}`,
    order: demoCategories.value.length + 1,
    productCount: Math.floor(Math.random() * 20)
  }
  
  demoCategories.value.push(newCategory)
  lastAction.value = `Добавлена категория "${newCategory.name}"`
}

function clearCategories() {
  demoCategories.value = []
  lastAction.value = 'Все категории удалены'
}

function loadSampleCategories() {
  demoCategories.value = [...sampleCategories]
  lastAction.value = 'Загружены примеры категорий'
}

function handleCreate() {
  lastAction.value = 'Нажата кнопка "Создать категорию"'
  alert('Действие: Создать новую категорию')
}

function handleEdit(category: Category) {
  lastAction.value = `Редактирование категории "${category.name}"`
  alert(`Действие: Редактировать категорию "${category.name}"`)
}

function handleDelete(categoryId: string) {
  const category = demoCategories.value.find(c => c.id === categoryId)
  if (category) {
    if (category.productCount && category.productCount > 0) {
      alert(`Нельзя удалить категорию "${category.name}" - в ней есть товары (${category.productCount})`)
      lastAction.value = `Попытка удаления категории с товарами "${category.name}"`
    } else {
      demoCategories.value = demoCategories.value.filter(c => c.id !== categoryId)
      lastAction.value = `Удалена категория "${category.name}"`
    }
  }
}

function handleReorder(reorderList: { id: string; order: number }[]) {
  // Update order in demo categories
  reorderList.forEach(item => {
    const category = demoCategories.value.find(c => c.id === item.id)
    if (category) {
      category.order = item.order
    }
  })
  
  // Sort by new order
  demoCategories.value.sort((a, b) => (a.order || 0) - (b.order || 0))
  lastAction.value = 'Порядок категорий изменен'
}
</script>

<style scoped>
/* Custom scrollbar for mobile viewport */
.max-w-sm {
  scrollbar-width: thin;
}

.max-w-sm::-webkit-scrollbar {
  width: 4px;
}

.max-w-sm::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.max-w-sm::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 2px;
}
</style>