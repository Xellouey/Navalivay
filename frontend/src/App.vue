<script setup lang="ts">
import { RouterView } from "vue-router";
import { computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import VapeSmoke from "@/components/VapeSmoke.vue";
import BottomTabBar from "@/components/BottomTabBar.vue";
import WholesaleStatusBar from "@/components/WholesaleStatusBar.vue";
import { useWholesaleStore } from "@/stores/wholesale";

const route = useRoute();
const wholesaleStore = useWholesaleStore();

const showTabBar = computed(() => {
  const path = route.path;
  if (path.startsWith("/admin")) return false;
  if (path === "/checkout") return false;
  if (path === "/my-order") return false;
  if (wholesaleStore.isWholesale) return false;
  return true;
});

const showWholesaleStatusBar = computed(() => {
  const path = route.path;
  if (!wholesaleStore.isWholesale) return false;
  if (path.startsWith("/admin")) return false;
  if (path === "/checkout") return false;
  if (path === "/my-order") return false;
  if (route.name === "product") return false;
  if (route.name === "wholesale-entry") return false;
  return true;
});

onMounted(() => {
  if (typeof window !== "undefined" && window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready();
  }
});
</script>

<template>
  <div
    class="app-shell"
    :class="{ 'app-shell--with-tab-bar': showTabBar || showWholesaleStatusBar }"
    style="background: var(--app-page-background, #ffffff)"
  >
    <div class="app-shell__content">
      <RouterView v-slot="{ Component, route: viewRoute }">
        <Transition name="page-fade" mode="out-in">
          <component :is="Component" :key="viewRoute.fullPath" />
        </Transition>
      </RouterView>
    </div>
    <VapeSmoke />
    <BottomTabBar v-if="showTabBar" />
    <WholesaleStatusBar v-if="showWholesaleStatusBar" />
  </div>
</template>

<style>
:root {
  --app-screen-max-width: 393px;
  --app-bottom-tab-bar-height: 130px;
  --app-page-background: #f5f7fa;
}

html,
body,
#app {
  margin: 0;
  padding: 0;
  min-height: 100%;
}

.app-shell {
  min-height: 100vh;
  overflow-x: hidden;
}

.app-shell--with-tab-bar {
  padding-bottom: var(--app-bottom-tab-bar-height, 130px);
  box-sizing: border-box;
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

