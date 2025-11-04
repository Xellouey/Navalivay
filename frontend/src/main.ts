import 'virtual:uno.css'
import '@/styles/navalivay-theme.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

// Telegram WebApp initialization
if (window.Telegram?.WebApp) {
  const tg = window.Telegram.WebApp
  console.log('[TG WebApp] Platform:', tg.platform)
  console.log('[TG WebApp] Version:', tg.version)
  console.log('[TG WebApp] Has exitFullscreen:', !!tg.exitFullscreen)
  console.log('[TG WebApp] Initial isFullscreen:', tg.isFullscreen)
  
  // Инициализация Telegram WebApp сразу
  tg.ready()
  
  // ВАЖНО: НЕ используем exitFullscreen - он работает только для iframe
  // В режиме mini app это не нужно
  
  // Опционально: можем попробовать expand, если есть
  if (typeof tg.expand === 'function') {
    console.log('[TG WebApp] Trying to expand...')
    tg.expand()
  }
  
  console.log('[TG WebApp] After init isFullscreen:', tg.isFullscreen)
}

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
