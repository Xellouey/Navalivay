<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Debug Info -->
    <div class="fixed top-2 right-2 bg-black text-white text-xs p-2 rounded z-50">
      <div>Test Component Loaded</div>
      <div>Auth: {{ adminStore?.isAuthenticated || 'undefined' }}</div>
      <div>Token: {{ adminStore?.token ? 'exists' : 'none' }}</div>
      <button 
        @click="clearAuth" 
        class="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 mt-1"
      >
        Clear Auth
      </button>
    </div>
    
    <!-- Login Form -->
    <div v-if="!adminStore?.isAuthenticated" class="min-h-screen flex items-center justify-center p-4">
      <div class="w-full max-w-md">
        <div class="bg-white p-8 rounded-lg shadow-lg">
          <div class="text-center mb-6">
            <h1 class="text-2xl font-bold text-gray-900">TOLSTOVKA Admin</h1>
            <p class="text-gray-600 mt-1">Войдите чтобы управлять контентом</p>
          </div>

          <form @submit.prevent="handleLogin" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Логин</label>
              <input 
                v-model="loginForm.username" 
                type="text" 
                required 
                class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                placeholder="admin" 
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Пароль</label>
              <input 
                v-model="loginForm.password" 
                type="password" 
                required 
                class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                placeholder="••••••••" 
              />
            </div>
            <button 
              type="submit" 
              :disabled="adminStore?.isLoading" 
              class="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ adminStore?.isLoading ? 'Вход...' : 'Войти' }}
            </button>
            <div v-if="adminStore?.error" class="p-3 bg-red-100 border border-red-300 rounded-xl text-red-700 text-sm">
              {{ adminStore.error }}
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Authenticated State -->
    <div v-else class="min-h-screen flex items-center justify-center p-4">
      <div class="text-center">
        <h1 class="text-3xl font-bold text-gray-900 mb-4">Welcome to Admin Panel</h1>
        <p class="text-gray-600 mb-4">Authentication successful!</p>
        <button 
          @click="handleLogout"
          class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminStore } from '@/stores/admin'

const router = useRouter()
const adminStore = useAdminStore()

const loginForm = ref({ username: '', password: '' })

// Debug function to clear auth
function clearAuth() {
  localStorage.removeItem('admin_token')
  adminStore?.logout()
  location.reload()
}

// Auth methods
async function handleLogin() {
  try {
    await adminStore.login(loginForm.value)
  } catch (error) {
    console.error('Login failed:', error)
  }
}

function handleLogout() {
  adminStore.logout()
  router.push('/')
}
</script>