<script setup lang="ts">
import { RouterView } from "vue-router";
import { onMounted } from "vue";
import VapeSmoke from "@/components/VapeSmoke.vue";
import TelegramDebugPanel from "@/components/TelegramDebugPanel.vue";

onMounted(() => {
  if (typeof window !== "undefined" && window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
  }
});
</script>

<template>
  <div class="min-h-screen" style="background: #ffffff">
    <RouterView v-slot="{ Component, route }">
      <Transition name="page-fade" mode="out-in">
        <component :is="Component" :key="route.fullPath" />
      </Transition>
    </RouterView>
    <VapeSmoke />
    <TelegramDebugPanel />
  </div>
</template>

<style>
html,
body,
#app {
  margin: 0;
  padding: 0;
  min-height: 100%;
}

/* Плавные переходы между страницами - fade */
.page-fade-enter-active {
  transition: opacity 0.25s ease-out;
}

.page-fade-leave-active {
  transition: opacity 0.2s ease-in;
}

.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}
</style>
