<script setup lang="ts">
import { RouterView } from "vue-router";
import { computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import VapeSmoke from "@/components/VapeSmoke.vue";
import BottomTabBar from "@/components/BottomTabBar.vue";

const route = useRoute();

// Временное скрытие нижних кнопок в production UI.
// Чтобы вернуть панель, достаточно переключить флаг в false.
const HIDE_BOTTOM_TAB_BAR = true;

const showTabBar = computed(() => {
  if (HIDE_BOTTOM_TAB_BAR) return false;

  const path = route.path;
  if (path.startsWith("/admin")) return false;
  if (path === "/checkout") return false;
  if (path === "/my-order") return false;
  return true;
});

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
    <RouterView v-slot="{ Component, route: viewRoute }">
      <Transition name="page-fade" mode="out-in">
        <component :is="Component" :key="viewRoute.fullPath" />
      </Transition>
    </RouterView>
    <VapeSmoke />
    <BottomTabBar v-if="showTabBar" />
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

