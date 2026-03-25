import 'virtual:uno.css'
import '@/styles/navalivay-theme.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

// Telegram WebApp initialization
if (window.Telegram?.WebApp) {
  const tg = window.Telegram.WebApp
  tg.ready()

  if (typeof tg.expand === 'function') {
    tg.expand()
  }
}

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
