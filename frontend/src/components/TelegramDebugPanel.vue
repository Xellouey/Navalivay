<template>
  <div class="debug-panel" :class="{ 'minimized': isMinimized }">
    <div class="debug-header" @click="isMinimized = !isMinimized">
      <div class="debug-title">
        <span class="debug-icon">🐛</span>
        <span>Telegram Debug</span>
      </div>
      <button class="minimize-btn">
        {{ isMinimized ? '▲' : '▼' }}
      </button>
    </div>

    <div v-if="!isMinimized" class="debug-content">
      <!-- Connection Status -->
      <div class="debug-section">
        <div class="section-title">Статус подключения</div>
        <div class="status-indicator" :class="{ 'connected': isTelegramAvailable }">
          <span class="indicator-dot"></span>
          <span>{{ isTelegramAvailable ? 'Подключено к Telegram' : 'Не подключено' }}</span>
        </div>
      </div>

      <!-- User Data -->
      <div v-if="isTelegramAvailable" class="debug-section">
        <div class="section-title">Данные пользователя</div>
        <div class="data-grid">
          <div class="data-row">
            <span class="data-label">ID:</span>
            <span class="data-value">{{ userData.id || '—' }}</span>
          </div>
          <div class="data-row">
            <span class="data-label">Username:</span>
            <span class="data-value">{{ userData.username || '—' }}</span>
          </div>
          <div class="data-row">
            <span class="data-label">First Name:</span>
            <span class="data-value">{{ userData.first_name || '—' }}</span>
          </div>
          <div class="data-row">
            <span class="data-label">Last Name:</span>
            <span class="data-value">{{ userData.last_name || '—' }}</span>
          </div>
          <div class="data-row">
            <span class="data-label">Language:</span>
            <span class="data-value">{{ userData.language_code || '—' }}</span>
          </div>
          <div class="data-row">
            <span class="data-label">Premium:</span>
            <span class="data-value">{{ userData.is_premium ? '✅' : '❌' }}</span>
          </div>
        </div>
      </div>

      <!-- Init Data -->
      <div v-if="isTelegramAvailable" class="debug-section">
        <div class="section-title">Init Data</div>
        <div class="data-row">
          <span class="data-label">Available:</span>
          <span class="data-value">{{ initData ? '✅ Да' : '❌ Нет' }}</span>
        </div>
        <div v-if="initData" class="data-code">
          {{ initData.substring(0, 100) }}{{ initData.length > 100 ? '...' : '' }}
        </div>
      </div>

      <!-- Platform Info -->
      <div v-if="isTelegramAvailable" class="debug-section">
        <div class="section-title">Платформа</div>
        <div class="data-grid">
          <div class="data-row">
            <span class="data-label">Platform:</span>
            <span class="data-value">{{ platformInfo.platform || '—' }}</span>
          </div>
          <div class="data-row">
            <span class="data-label">Version:</span>
            <span class="data-value">{{ platformInfo.version || '—' }}</span>
          </div>
          <div class="data-row">
            <span class="data-label">Color Scheme:</span>
            <span class="data-value">{{ platformInfo.colorScheme || '—' }}</span>
          </div>
        </div>
      </div>

      <!-- Test Data for Order -->
      <div v-if="isTelegramAvailable" class="debug-section">
        <div class="section-title">Данные для заказа</div>
        <div class="data-code test-data">
          <pre>{{ orderTestData }}</pre>
        </div>
        <button @click="copyOrderData" class="copy-btn">
          {{ copied ? '✅ Скопировано' : '📋 Копировать' }}
        </button>
      </div>

      <!-- Refresh Button -->
      <button @click="refresh" class="refresh-btn">
        🔄 Обновить данные
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const isMinimized = ref(false)
const copied = ref(false)

const isTelegramAvailable = computed(() => {
  return typeof window !== 'undefined' && !!window.Telegram?.WebApp
})

const userData = computed(() => {
  if (!isTelegramAvailable.value) return {}
  const user = window.Telegram?.WebApp.initDataUnsafe?.user
  return {
    id: user?.id,
    username: user?.username,
    first_name: user?.first_name,
    last_name: user?.last_name,
    language_code: user?.language_code,
    is_premium: user?.is_premium
  }
})

const initData = computed(() => {
  if (!isTelegramAvailable.value) return null
  return window.Telegram?.WebApp.initData || null
})

const platformInfo = computed(() => {
  if (!isTelegramAvailable.value) return {}
  return {
    platform: window.Telegram?.WebApp.platform,
    version: window.Telegram?.WebApp.version,
    colorScheme: window.Telegram?.WebApp.colorScheme
  }
})

const orderTestData = computed(() => {
  if (!isTelegramAvailable.value) return 'Telegram не доступен'
  
  const user = userData.value
  return JSON.stringify({
    telegram_id: user.id ? String(user.id) : undefined,
    telegram_username: user.username || undefined,
    first_name: user.first_name || undefined,
    last_name: user.last_name || undefined,
    // Эти данные будут отправлены в заказе
  }, null, 2)
})

function refresh() {
  // Force re-computation of computed properties
  console.log('[TelegramDebug] Refreshing data...')
  console.log('[TelegramDebug] User:', userData.value)
  console.log('[TelegramDebug] InitData:', initData.value)
  console.log('[TelegramDebug] Platform:', platformInfo.value)
}

function copyOrderData() {
  navigator.clipboard.writeText(orderTestData.value)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

onMounted(() => {
  console.log('[TelegramDebug] Component mounted')
  console.log('[TelegramDebug] Telegram available:', isTelegramAvailable.value)
  if (isTelegramAvailable.value) {
    console.log('[TelegramDebug] Full initDataUnsafe:', window.Telegram?.WebApp.initDataUnsafe)
  }
})
</script>

<style scoped>
.debug-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 380px;
  max-width: calc(100vw - 40px);
  background: #1a1a1a;
  border: 2px solid #333;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  z-index: 9999;
  overflow: hidden;
  transition: all 0.3s ease;
}

.debug-panel.minimized {
  width: 200px;
  height: auto;
}

.debug-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #2a2a2a;
  border-bottom: 1px solid #333;
  cursor: pointer;
  user-select: none;
}

.debug-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 0.9rem;
  color: #fff;
}

.debug-icon {
  font-size: 1.2rem;
}

.minimize-btn {
  background: none;
  border: none;
  color: #999;
  font-size: 1rem;
  cursor: pointer;
  padding: 4px 8px;
  transition: color 0.2s;
}

.minimize-btn:hover {
  color: #fff;
}

.debug-content {
  max-height: 70vh;
  overflow-y: auto;
  padding: 16px;
}

.debug-section {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #333;
}

.debug-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.section-title {
  font-weight: 700;
  font-size: 0.85rem;
  color: #fff;
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(211, 47, 47, 0.1);
  border: 1px solid rgba(211, 47, 47, 0.3);
  border-radius: 8px;
  font-size: 0.85rem;
  color: #ff6b6b;
}

.status-indicator.connected {
  background: rgba(76, 175, 80, 0.1);
  border-color: rgba(76, 175, 80, 0.3);
  color: #4caf50;
}

.indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.data-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.data-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  font-size: 0.8rem;
}

.data-label {
  color: #999;
  font-weight: 600;
}

.data-value {
  color: #fff;
  font-family: 'Courier New', monospace;
  font-weight: 500;
}

.data-code {
  padding: 10px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid #444;
  border-radius: 6px;
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  color: #aaa;
  word-break: break-all;
  margin-top: 8px;
}

.data-code.test-data {
  max-height: 200px;
  overflow-y: auto;
}

.data-code pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.copy-btn {
  width: 100%;
  padding: 8px 12px;
  margin-top: 8px;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.copy-btn:hover {
  background: #333;
  border-color: #555;
}

.refresh-btn {
  width: 100%;
  padding: 10px 12px;
  margin-top: 12px;
  background: linear-gradient(135deg, var(--navalivay-red), #ff4444);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s;
}

.refresh-btn:hover {
  transform: translateY(-2px);
}

.refresh-btn:active {
  transform: translateY(0);
}

/* Mobile adjustments */
@media (max-width: 480px) {
  .debug-panel {
    bottom: 10px;
    right: 10px;
    left: 10px;
    width: auto;
    max-width: none;
  }
  
  .debug-panel.minimized {
    width: auto;
    left: auto;
    right: 10px;
  }
  
  .debug-content {
    max-height: 60vh;
  }
}
</style>
