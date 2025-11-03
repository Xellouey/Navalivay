import 'virtual:uno.css'
import '@/styles/navalivay-theme.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// Добавляем Eruda для отладки в Telegram
if (window.Telegram?.WebApp) {
  // Лоадим Eruda CDN
  const script = document.createElement('script')
  script.src = '//cdn.jsdelivr.net/npm/eruda'
  script.onload = () => {
    // Инициализируем Eruda
    ;(window as any).eruda?.init()
    console.log('[Eruda] Debug console initialized')
  }
  document.head.appendChild(script)
}

// Telegram WebApp API для полноэкранного режима - инициализация в load событии
if (window.Telegram?.WebApp) {
  const tg = window.Telegram.WebApp
  
  console.log('[TG WebApp] Telegram WebApp detected!')
  console.log('[TG WebApp] Version:', tg.version)
  console.log('[TG WebApp] Platform:', tg.platform)
  console.log('[TG WebApp] Has requestFullscreen:', !!tg.requestFullscreen)
  console.log('[TG WebApp] Has exitFullscreen:', !!tg.exitFullscreen)
  console.log('[TG WebApp] Initial isFullscreen:', tg.isFullscreen)
  
  // Инициализация Telegram WebApp сразу
  tg.ready()
  
  // Настройка обработчиков событий полноэкранного режима
  tg.onEvent('fullscreenChanged', () => {
    console.log('[TG WebApp] Fullscreen changed:', tg.isFullscreen)
    // Обновляем CSS переменные для safe area при изменении режима
    if (tg.isFullscreen) {
      document.documentElement.style.setProperty('--tg-safe-area-inset-top', `${tg.safeAreaInset?.top || 0}px`)
      document.documentElement.style.setProperty('--tg-safe-area-inset-bottom', `${tg.safeAreaInset?.bottom || 0}px`)
    }
  })
  
  tg.onEvent('fullscreenFailed', (event: any) => {
    console.warn('[TG WebApp] Fullscreen failed:', event.error)
    if (event.error === 'UNSUPPORTED') {
      console.warn('[TG WebApp] Fullscreen mode is not supported on this device/platform')
    } else if (event.error === 'ALREADY_FULLSCREEN') {
      console.log('[TG WebApp] App is already in fullscreen mode')
    }
  })
  
  // Обработчик изменения safe area
  tg.onEvent('safeAreaChanged', () => {
    console.log('[TG WebApp] Safe area changed:', tg.safeAreaInset)
    // Обновляем CSS переменные
    if (tg.safeAreaInset) {
      document.documentElement.style.setProperty('--tg-safe-area-inset-top', `${tg.safeAreaInset.top}px`)
      document.documentElement.style.setProperty('--tg-safe-area-inset-bottom', `${tg.safeAreaInset.bottom}px`)
      document.documentElement.style.setProperty('--tg-safe-area-inset-left', `${tg.safeAreaInset.left}px`)
      document.documentElement.style.setProperty('--tg-safe-area-inset-right', `${tg.safeAreaInset.right}px`)
    }
  })
  
  // Низкоуровневая функция для отправки событий согласно официальной документации Telegram
  function postEvent(eventType: string, eventData?: any) {
    try {
      // Определяем платформу и используем соответствующий метод
      if (typeof window !== 'undefined') {
        // Desktop и Mobile - используем TelegramWebviewProxy.postEvent
        if ((window as any).TelegramWebviewProxy?.postEvent) {
          console.log(`[TG PostEvent] Using TelegramWebviewProxy.postEvent: ${eventType}`, eventData)
          const data = eventData ? JSON.stringify(eventData) : undefined
          ;(window as any).TelegramWebviewProxy.postEvent(eventType, data || '')
          return true
        }
        // Windows Phone - используем window.external.notify
        else if ((window as any).external?.notify) {
          console.log(`[TG PostEvent] Using external.notify: ${eventType}`, eventData)
          const data = JSON.stringify({
            eventType,
            eventData: eventData || {}
          })
          ;(window as any).external.notify(data)
          return true
        }
        // Web - используем postMessage к родительскому iframe
        else if (window.parent && window.parent !== window) {
          console.log(`[TG PostEvent] Using postMessage: ${eventType}`, eventData)
          const data = JSON.stringify({
            eventType,
            eventData: eventData || {}
          })
          window.parent.postMessage(data, 'https://web.telegram.org')
          return true
        }
      }
      
      console.warn(`[TG PostEvent] No suitable postEvent method found for: ${eventType}`)
      return false
    } catch (error) {
      console.error(`[TG PostEvent] Error sending event ${eventType}:`, error)
      return false
    }
  }
  
  // Функция для запроса полноэкранного режима с использованием официального API
  async function requestFullscreenMode() {
    console.log('[TG WebApp] Requesting fullscreen mode...')
    
    // Проверяем версию (fullscreen доступен с v8.0)
    const isVersionSupported = tg.isVersionAtLeast && tg.isVersionAtLeast('8.0')
    
    if (!isVersionSupported) {
      console.warn('[TG WebApp] Fullscreen not supported. Version:', tg.version, 'Required: 8.0+')
      return false
    }
    
    // Проверяем, что уже не в полноэкранном режиме
    if (tg.isFullscreen) {
      console.log('[TG WebApp] Already in fullscreen mode')
      return true
    }
    
    try {
      // МЕТОД 1: Используем официальный низкоуровневый API postEvent
      console.log('[TG WebApp] Method 1: Using official postEvent API...')
      const postEventResult = postEvent('web_app_request_fullscreen')
      
      if (postEventResult) {
        console.log('[TG WebApp] ✅ PostEvent sent successfully')
        // Даем время на обработку события
        await new Promise(resolve => setTimeout(resolve, 500))
      } else {
        console.warn('[TG WebApp] ⚠️ PostEvent failed, trying fallback method...')
      }
      
      // МЕТОД 2: Fallback - пробуем высокоуровневый API
      if (tg.requestFullscreen && !postEventResult) {
        console.log('[TG WebApp] Method 2: Using high-level requestFullscreen()...')
        const result = tg.requestFullscreen()
        if (result && typeof result.then === 'function') {
          await result
        }
        console.log('[TG WebApp] ✅ High-level requestFullscreen completed')
      }
      
      console.log('[TG WebApp] ✅ Fullscreen request completed')
      return true
      
    } catch (error) {
      console.warn('[TG WebApp] ❌ Failed to request fullscreen:', error)
      return false
    }
  }
  
  // Функция для выхода из полноэкранного режима
  async function exitFullscreenMode() {
    console.log('[TG WebApp] Exiting fullscreen mode...')
    
    if (!tg.isFullscreen) {
      console.log('[TG WebApp] Already not in fullscreen mode')
      return true
    }
    
    try {
      // МЕТОД 1: Используем официальный низкоуровневый API
      console.log('[TG WebApp] Using postEvent for exit fullscreen...')
      const postEventResult = postEvent('web_app_exit_fullscreen')
      
      if (postEventResult) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
      
      // МЕТОД 2: Fallback - высокоуровневый API
      if (tg.exitFullscreen && !postEventResult) {
        console.log('[TG WebApp] Using high-level exitFullscreen()...')
        const result = tg.exitFullscreen()
        if (result && typeof result.then === 'function') {
          await result
        }
      }
      
      console.log('[TG WebApp] ✅ Exit fullscreen completed')
      return true
      
    } catch (error) {
      console.warn('[TG WebApp] ❌ Failed to exit fullscreen:', error)
      return false
    }
  }
  
  // КРИТИЧНО: Запуск fullscreen в load событии (как рекомендует Telegram)
  window.addEventListener('load', async () => {
    console.log('[TG WebApp] Window loaded, initializing fullscreen...')
    
    try {
      // Сначала расширяем приложение
      console.log('[TG WebApp] Expanding app...')
      tg.expand()
      
      // Небольшая задержка для стабилизации expand
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Теперь запрашиваем полноэкранный режим
      const success = await requestFullscreenMode()
      
      if (success) {
        console.log('[TG WebApp] ✅ Fullscreen initialization completed successfully!')
      } else {
        console.log('[TG WebApp] ⚠️ Fullscreen initialization failed, but app continues to work')
      }
    } catch (error) {
      console.warn('[TG WebApp] ❌ Error during fullscreen initialization:', error)
    }
  })
  
  // Экспортируем функции для использования в приложении
  ;(window as any).telegramWebApp = {
    requestFullscreen: requestFullscreenMode,
    exitFullscreen: () => {
      if (tg.exitFullscreen && tg.isFullscreen) {
        try {
          console.log('[TG WebApp] Exiting fullscreen mode...')
          const result = tg.exitFullscreen()
          if (result && typeof result.then === 'function') {
            return result
          }
          return Promise.resolve()
        } catch (error) {
          console.warn('[TG WebApp] Failed to exit fullscreen:', error)
          return Promise.reject(error)
        }
      }
      console.log('[TG WebApp] Already not in fullscreen mode')
      return Promise.resolve()
    },
    isFullscreen: () => tg.isFullscreen,
    getSafeAreaInset: () => tg.safeAreaInset,
    // Для отладки
    expand: () => tg.expand(),
    getVersion: () => tg.version
  }
  
} else {
  console.log('[TG WebApp] Telegram WebApp not detected - running in browser')
}

// Service Worker отключен - кэширование полностью удалено
if ('serviceWorker' in navigator) {
  // Отключаем все существующие Service Workers
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      registration.unregister()
      console.log('Service Worker unregistered')
    })
  })
}

const app = createApp(App)

app.use(createPinia())
app.use(router)

// ⚠️ КРИТИЧЕСКИ ВАЖНО: Ждем готовности router перед монтированием!
// Причина: Без этого App.vue монтируется ДО того, как router разрешит начальный маршрут.
// Это приводит к тому, что currentRoute.value.name = undefined,
// и RouterView не находит совпадающих маршрутов (matched: []).
// Решение: Всегда использовать router.isReady() перед app.mount()!
// Дата исправления: 2025-09-30
router.isReady().then(() => {
  app.mount('#app')
})
