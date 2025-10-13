<template>
  <div class="min-h-screen bg-gray-50 p-8">
    <div class="max-w-4xl mx-auto">
      <h1 class="text-3xl font-bold text-gray-900 mb-8">Тестирование админ-панели</h1>
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Admin Store Test -->
        <div class="bg-white rounded-xl shadow-sm border p-6">
          <h2 class="text-xl font-semibold mb-4">Тест Admin Store</h2>
          
          <div class="space-y-4">
            <div>
              <p class="text-sm text-gray-600">Аутентификация:</p>
              <p class="font-medium">{{ adminStore.isAuthenticated ? 'Вошел' : 'Не вошел' }}</p>
            </div>
            
            <div>
              <p class="text-sm text-gray-600">Загрузка:</p>
              <p class="font-medium">{{ adminStore.isLoading ? 'Да' : 'Нет' }}</p>
            </div>
            
            <div>
              <p class="text-sm text-gray-600">Ошибка:</p>
              <p class="font-medium text-red-600">{{ adminStore.error || 'Нет' }}</p>
            </div>
            
            <div>
              <p class="text-sm text-gray-600">Баннеров:</p>
              <p class="font-medium">{{ adminStore.banners?.length || 0 }}</p>
            </div>
            
            <div>
              <p class="text-sm text-gray-600">Категорий:</p>
              <p class="font-medium">{{ adminStore.categories?.length || 0 }}</p>
            </div>
            
            <div>
              <p class="text-sm text-gray-600">Товаров:</p>
              <p class="font-medium">{{ adminStore.productsPagination?.total || 0 }}</p>
            </div>
            
            <div class="pt-4 space-y-2">
              <button
                @click="testLogin"
                class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                :disabled="adminStore.isLoading"
              >
                Тест логина
              </button>
              
              <button
                @click="testFetchData"
                class="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                :disabled="adminStore.isLoading"
              >
                Загрузить данные
              </button>
              
              <button
                @click="testCreateBanner"
                class="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                :disabled="adminStore.isLoading"
              >
                Создать тест баннер
              </button>
              
              <button
                @click="testCreateCategory"
                class="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                :disabled="adminStore.isLoading"
              >
                Создать тест категорию
              </button>
              
              <button
                @click="adminStore.logout"
                class="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Выход
              </button>
            </div>
          </div>
        </div>
        
        <!-- Component Tests -->
        <div class="bg-white rounded-xl shadow-sm border p-6">
          <h2 class="text-xl font-semibold mb-4">Тест компонентов</h2>
          
          <div class="space-y-4">
            <button
              @click="showBannerForm = !showBannerForm"
              class="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              {{ showBannerForm ? 'Скрыть' : 'Показать' }} форму баннера
            </button>
            
            <button
              @click="showCategoryForm = !showCategoryForm"
              class="w-full px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700"
            >
              {{ showCategoryForm ? 'Скрыть' : 'Показать' }} форму категории
            </button>
            
            <button
              @click="showModal = true"
              class="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
            >
              Показать модальное окно
            </button>
          </div>
        </div>
        
        <!-- Banner Form Test -->
        <div v-if="showBannerForm" class="lg:col-span-2 bg-white rounded-xl shadow-sm border p-6">
          <h3 class="text-lg font-semibold mb-4">Форма баннера</h3>
          <AdminBannerForm
            :banner="null"
            @submit="onBannerSubmit"
            @cancel="showBannerForm = false"
          />
        </div>
        
        <!-- Category Form Test -->
        <div v-if="showCategoryForm" class="lg:col-span-2 bg-white rounded-xl shadow-sm border p-6">
          <h3 class="text-lg font-semibold mb-4">Форма категории</h3>
          <AdminCategoryForm
            :category="null"
            @submit="onCategorySubmit"
            @cancel="showCategoryForm = false"
          />
        </div>
        
        <!-- Data Display -->
        <div class="lg:col-span-2 bg-white rounded-xl shadow-sm border p-6">
          <h3 class="text-lg font-semibold mb-4">Текущие данные</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 class="font-medium mb-2">Баннеры:</h4>
              <div class="space-y-2">
                <div
                  v-for="banner in adminStore.banners"
                  :key="banner.id"
                  class="p-2 bg-gray-50 rounded text-sm"
                >
                  <p class="font-medium">{{ banner.title }}</p>
                  <p class="text-gray-600">{{ banner.description }}</p>
                  <p class="text-xs text-gray-500">
                    Активен: {{ banner.isActive ? 'Да' : 'Нет' }} | 
                    Порядок: {{ banner.order }}
                  </p>
                </div>
                <div v-if="!adminStore.banners?.length" class="text-gray-500 text-sm">
                  Нет баннеров
                </div>
              </div>
            </div>
            
            <div>
              <h4 class="font-medium mb-2">Категории:</h4>
              <div class="space-y-2">
                <div
                  v-for="category in adminStore.categories"
                  :key="category.id"
                  class="p-2 bg-gray-50 rounded text-sm"
                >
                  <p class="font-medium">{{ category.name }}</p>
                  <p class="text-gray-600">{{ category.description }}</p>
                  <p class="text-xs text-gray-500">
                    Порядок: {{ category.order }}
                  </p>
                </div>
                <div v-if="!adminStore.categories?.length" class="text-gray-500 text-sm">
                  Нет категорий
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Modal Test -->
      <AdminModal
        :isOpen="showModal"
        title="Тестовое модальное окно"
        @cancel="showModal = false"
        @close="showModal = false"
      >
        <p class="text-gray-600">Это тестовое модальное окно для проверки компонента AdminModal.</p>
        <div class="mt-4 p-4 bg-blue-50 rounded-lg">
          <p class="text-blue-800 text-sm">Модальное окно работает правильно!</p>
        </div>
      </AdminModal>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAdminStore } from '@/stores/admin-mock'
import AdminBannerForm from '@/components/admin/AdminBannerForm.vue'
import AdminCategoryForm from '@/components/admin/AdminCategoryForm.vue'
import AdminModal from '@/components/AdminModal.vue'

const adminStore = useAdminStore()

const showBannerForm = ref(false)
const showCategoryForm = ref(false)
const showModal = ref(false)

const testLogin = async () => {
  try {
    await adminStore.login({ username: 'admin', password: 'admin' })
    console.log('Login successful')
  } catch (error) {
    console.error('Login failed:', error)
  }
}

const testFetchData = async () => {
  try {
    await Promise.all([
      adminStore.fetchBanners(),
      adminStore.fetchCategories(),
      adminStore.fetchProducts({ page: 1, limit: 10 })
    ])
    console.log('Data loaded successfully')
  } catch (error) {
    console.error('Failed to load data:', error)
  }
}

const testCreateBanner = async () => {
  try {
    const testBanner = {
      title: `Тест баннер ${Date.now()}`,
      description: 'Тестовое описание баннера',
      imageUrl: 'https://via.placeholder.com/800x400',
      linkUrl: '/test',
      isActive: true
    }
    await adminStore.createBanner(testBanner)
    console.log('Test banner created')
  } catch (error) {
    console.error('Failed to create banner:', error)
  }
}

const testCreateCategory = async () => {
  try {
    const testCategory = {
      name: `Тест категория ${Date.now()}`,
      description: 'Тестовое описание категории',
      slug: `test-category-${Date.now()}`
    }
    await adminStore.createCategory(testCategory)
    console.log('Test category created')
  } catch (error) {
    console.error('Failed to create category:', error)
  }
}

const onBannerSubmit = (formData) => {
  console.log('Banner form submitted:', formData)
  showBannerForm.value = false
}

const onCategorySubmit = (formData) => {
  console.log('Category form submitted:', formData)
  showCategoryForm.value = false
}

onMounted(async () => {
  await adminStore.checkAuth()
})
</script>