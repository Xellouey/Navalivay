<script setup lang="ts">
import { RouterView } from 'vue-router'
import { onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import ScrollToTopButton from '@/components/ScrollToTopButton.vue'
import VapeSmoke from '@/components/VapeSmoke.vue'

const route = useRoute()

const isAdminRoute = computed(() => {
  return route.path.startsWith('/admin')
})

const isProductRoute = computed(() => {
  return route.name === 'product'
})

onMounted(() => {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp
    tg.ready()
    tg.expand()
  }
})
</script>

<template>
  <div class="min-h-screen">
    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
    
    <ScrollToTopButton v-if="!isAdminRoute && !isProductRoute" />
    <VapeSmoke />
  </div>
</template>

<style>
html, body, #app {
  margin: 0;
  padding: 0;
  min-height: 100%;
}

.page-enter-active,
.page-leave-active {
  transition: all 0.3s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.page-leave-to {
  opacity: 0;
  transform: translateX(10px);
}
</style>
