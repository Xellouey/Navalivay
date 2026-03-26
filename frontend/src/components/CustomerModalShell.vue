<template>
  <Teleport to="body">
    <Transition name="customer-modal">
      <div
        v-if="open"
        class="customer-modal-overlay"
        :class="{ 'customer-modal-overlay--with-tab-bar': reserveTabBar }"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        @click.self="emit('close')"
      >
        <section
          class="customer-modal-card"
          :style="{ '--customer-modal-max-width': maxWidth }"
        >
          <div class="customer-modal-header">
            <h2 :id="titleId" class="customer-modal-title">{{ title }}</h2>
            <button
              type="button"
              class="customer-modal-close"
              :aria-label="closeLabel"
              @click="emit('close')"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M4 4L12 12M12 4L4 12"
                  stroke="#191919"
                  stroke-width="1.8"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </div>

          <div class="customer-modal-body">
            <slot />
          </div>

          <div v-if="$slots.footer" class="customer-modal-footer">
            <slot name="footer" />
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, watch } from "vue";

interface Props {
  open: boolean;
  title: string;
  closeLabel?: string;
  maxWidth?: string;
  reserveTabBar?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  closeLabel: "Закрыть окно",
  maxWidth: "361px",
  reserveTabBar: false,
});

const emit = defineEmits<{
  close: [];
}>();

const titleId = `customer-modal-title-${Math.random().toString(36).slice(2, 10)}`;

function syncScrollLock(isOpen: boolean) {
  if (typeof document === "undefined") {
    return;
  }

  const overflowValue = isOpen ? "hidden" : "";
  document.documentElement.style.overflow = overflowValue;
  document.body.style.overflow = overflowValue;
}

watch(
  () => props.open,
  (isOpen) => {
    syncScrollLock(isOpen);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  syncScrollLock(false);
});
</script>

<style scoped>
.customer-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding:
    calc(24px + env(safe-area-inset-top, 0px))
    16px
    calc(24px + env(safe-area-inset-bottom, 0px));
  background: rgba(101, 109, 119, 0.72);
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
  box-sizing: border-box;
}

.customer-modal-overlay--with-tab-bar {
  padding-bottom: calc(var(--app-bottom-tab-bar-height, 130px) + 24px);
}

.customer-modal-card {
  width: min(var(--customer-modal-max-width), 100%);
  max-height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  background: #ffffff;
  box-sizing: border-box;
  padding: 16px;
  box-shadow: 0 24px 48px rgba(25, 25, 25, 0.12);
  transform-origin: center center;
  overflow: hidden;
}

.customer-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.customer-modal-title {
  margin: 8px 0 0;
  font-family: "Montserrat", sans-serif;
  font-weight: 700;
  font-size: 20px;
  line-height: 24px;
  color: #191919;
}

.customer-modal-close {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border: none;
  border-radius: 512px;
  background: #f5f7fa;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.customer-modal-body {
  margin-top: 12px;
  overflow-y: auto;
}

.customer-modal-footer {
  margin-top: 28px;
}

.customer-modal-enter-active,
.customer-modal-leave-active {
  transition: opacity 0.24s ease;
}

.customer-modal-enter-active .customer-modal-card,
.customer-modal-leave-active .customer-modal-card {
  transition:
    opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.customer-modal-enter-from,
.customer-modal-leave-to {
  opacity: 0;
}

.customer-modal-enter-from .customer-modal-card,
.customer-modal-leave-to .customer-modal-card {
  opacity: 0;
  transform: translateY(18px) scale(0.985);
}

@media (max-width: 360px) {
  .customer-modal-overlay {
    padding:
      calc(20px + env(safe-area-inset-top, 0px))
      12px
      calc(20px + env(safe-area-inset-bottom, 0px));
  }

  .customer-modal-overlay--with-tab-bar {
    padding-bottom: calc(var(--app-bottom-tab-bar-height, 130px) + 20px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .customer-modal-enter-active,
  .customer-modal-leave-active,
  .customer-modal-enter-active .customer-modal-card,
  .customer-modal-leave-active .customer-modal-card {
    transition-duration: 0.01ms;
  }
}
</style>
