<template>
  <nav class="bottom-tab-bar" aria-label="Навигация">
    <router-link
      v-for="tab in tabs"
      :key="tab.path"
      :to="tab.path"
      class="tab-item"
      :class="{ 'tab-item--active': isActive(tab.path) }"
      :aria-label="tab.label"
    >
      <div class="tab-icon-wrap">
        <!-- Главная (домик) -->
        <svg v-if="tab.id === 'home'" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 10.5L12 3L21 10.5V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V10.5Z"
            :stroke="isActive(tab.path) ? '#fff' : 'rgba(255,255,255,0.5)'"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>

        <!-- Placeholder квадратик (раздел 2 и 3) -->
        <svg v-else-if="tab.id === 'section-2' || tab.id === 'section-3'" width="22" height="22" viewBox="0 0 22 22" fill="none">
          <rect
            x="1" y="1" width="20" height="20" rx="4"
            :stroke="isActive(tab.path) ? '#fff' : 'rgba(255,255,255,0.5)'"
            stroke-width="1.8"
          />
        </svg>

        <!-- Профиль (человечек) -->
        <svg v-else-if="tab.id === 'profile'" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12" cy="8" r="4"
            :stroke="isActive(tab.path) ? '#fff' : 'rgba(255,255,255,0.5)'"
            stroke-width="1.8"
          />
          <path
            d="M4 21C4 17.134 7.58172 14 12 14C16.4183 14 20 17.134 20 21"
            :stroke="isActive(tab.path) ? '#fff' : 'rgba(255,255,255,0.5)'"
            stroke-width="1.8"
            stroke-linecap="round"
          />
        </svg>

        <!-- Активный индикатор (точка) -->
        <span v-if="isActive(tab.path)" class="tab-active-dot"></span>
      </div>
    </router-link>
  </nav>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

interface TabItem {
  id: string
  path: string
  label: string
}

const route = useRoute()

const tabs: TabItem[] = [
  { id: 'home', path: '/', label: 'Главная' },
  { id: 'section-2', path: '/section-2', label: 'Раздел 2' },
  { id: 'section-3', path: '/section-3', label: 'Раздел 3' },
  { id: 'profile', path: '/profile', label: 'Профиль' },
]

function isActive(path: string): boolean {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}
</script>

<style scoped>
.bottom-tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-around;
  height: 64px;
  background: linear-gradient(90deg, #f50302 0%, #a90f0e 100%);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
}

.tab-item {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 100%;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  transition: opacity 0.2s ease;
}

.tab-item:active {
  opacity: 0.7;
}

.tab-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
}

.tab-active-dot {
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #fff;
}

@media (max-width: 360px) {
  .bottom-tab-bar {
    height: 56px;
  }
}
</style>
