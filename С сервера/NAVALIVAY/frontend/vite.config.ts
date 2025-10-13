import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import UnoCSS from '@unocss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const API_TARGET = process.env.VITE_API_TARGET || env.VITE_API_TARGET || 'http://127.0.0.1:8081'

  return {
    plugins: [
      vue(),
      // ⚠️ ВАЖНО: vueDevTools() ОТКЛЮЧЕН!
      // Причина: Вызывает критическую ошибку в RouterView:
      // "TypeError: Cannot set properties of null (setting '__vrv_devtools')"
      // Эта ошибка приводит к тому, что компоненты не рендерятся через RouterView.
      // Решение: Отключить vueDevTools() или обновить до совместимой версии.
      // Дата отключения: 2025-09-30
      // vueDevTools(),
      UnoCSS()
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['vue', 'pinia'],
            ui: ['@headlessui/vue', '@vueuse/core']
          }
        }
      }
    },
    server: {
      host: '0.0.0.0', // Разрешить доступ из локальной сети
      port: 5173,
      proxy: {
        '/api': {
          target: API_TARGET,
          changeOrigin: true,
          secure: false
        },
        '/uploads': {
          target: API_TARGET,
          changeOrigin: true,
          secure: false
        }
      }
    }
  }
})
