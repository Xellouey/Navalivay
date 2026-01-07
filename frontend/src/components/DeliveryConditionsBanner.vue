<template>
  <Teleport to="body">
    <Transition name="fullscreen">
      <div v-if="isOpen" class="delivery-conditions-overlay" @click.self="close">
        <div class="delivery-conditions-container">
          <!-- Close button -->
          <button class="close-btn" @click="close">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          <!-- Fullscreen image -->
          <div class="conditions-image" v-if="image">
            <img :src="image" alt="Условия доставки" />
          </div>

          <!-- Fallback content if no image -->
          <div v-else class="conditions-fallback">
            <div class="fallback-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                <path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
              </svg>
            </div>
            <h2 class="fallback-title">Условия доставки</h2>
            <p class="fallback-text">Информация о доставке будет добавлена позже</p>
          </div>

          <!-- Bottom action -->
          <div class="bottom-action">
            <button class="continue-btn" @click="close">
              Продолжить оформление
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
interface Props {
  isOpen: boolean
  image?: string
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

function close() {
  emit('close')
}
</script>

<style scoped>
.delivery-conditions-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  background: #000;
}

.delivery-conditions-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: #fff;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.7);
  transform: scale(1.1);
}

.conditions-image {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.conditions-image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.conditions-fallback {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  color: #fff;
}

.fallback-icon {
  margin-bottom: 1.5rem;
  opacity: 0.7;
}

.fallback-title {
  font-family: var(--font-display, 'Inter', sans-serif);
  font-size: 1.75rem;
  font-weight: 800;
  margin: 0 0 0.75rem;
}

.fallback-text {
  font-size: 1rem;
  opacity: 0.7;
  margin: 0;
}

.bottom-action {
  padding: 1rem 1.5rem 2rem;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.9), transparent);
}

.continue-btn {
  display: block;
  width: 100%;
  padding: 1rem 2rem;
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
  border: none;
  border-radius: 16px;
  font-family: var(--font-display, 'Inter', sans-serif);
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 15px rgba(238, 90, 90, 0.4);
}

.continue-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(238, 90, 90, 0.5);
}

/* Transitions */
.fullscreen-enter-active,
.fullscreen-leave-active {
  transition: opacity 0.4s ease;
}

.fullscreen-enter-active .delivery-conditions-container,
.fullscreen-leave-active .delivery-conditions-container {
  transition: transform 0.4s ease;
}

.fullscreen-enter-from,
.fullscreen-leave-to {
  opacity: 0;
}

.fullscreen-enter-from .delivery-conditions-container {
  transform: translateY(100%);
}

.fullscreen-leave-to .delivery-conditions-container {
  transform: translateY(100%);
}

/* Safe area for mobile */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .bottom-action {
    padding-bottom: calc(2rem + env(safe-area-inset-bottom));
  }
  
  .close-btn {
    top: calc(16px + env(safe-area-inset-top));
  }
}
</style>

