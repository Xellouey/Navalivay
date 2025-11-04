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
      UnoCSS(),
      injectVersionPlugin()
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
    build: {
      // Добавляем случайный параметр для предотвращения кеширования
      cssCodeSplit: true,
      // Отключить кэширование
      manifest: false,
      rollupOptions: {
        output: {
          // Добавляем timestamp к именам файлов для предотвращения кэширования
          entryFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
          chunkFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
          assetFileNames: `assets/[name]-[hash]-${Date.now()}.[ext]`,
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

// Плагин для добавления случайного параметра к скриптам
function injectVersionPlugin() {
  return {
    name: 'inject-version',
    transformIndexHtml(html: string) {
      const version = Date.now()
      return html.replace(
        /<script type="module" crossorigin src="(\/assets\/[^"]+)"><\/script>/g,
        `<script type="module" crossorigin src="$1?v=${version}"></script>`
      ).replace(
        /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+)">/g,
        `<link rel="stylesheet" crossorigin href="$1?v=${version}">`
      )
    }
  }
}
