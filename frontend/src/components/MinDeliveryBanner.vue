<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="min-delivery-overlay" @click.self="close">
        <div class="min-delivery-modal">
          <!-- Close button -->
          <button class="close-btn" @click="close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          <!-- Banner image -->
          <div v-if="bannerImage" class="banner-image">
            <img :src="bannerImage" alt="Минимальная сумма заказа" />
          </div>

          <!-- Content -->
          <div class="banner-content">
            <h2 class="banner-title">Минимальная сумма заказа</h2>
            <p class="banner-text">
              Для оформления доставки сумма заказа должна быть не менее 
              <strong>{{ minAmount }} BYN</strong>
            </p>
            <p class="banner-subtext">
              Сейчас в вашей корзине: <strong>{{ currentAmount }} BYN</strong>
            </p>
            <p class="banner-diff">
              Добавьте товаров ещё на <strong>{{ diffAmount }} BYN</strong>
            </p>
          </div>

          <!-- Action button -->
          <button 
            class="action-btn"
            :style="{ backgroundColor: buttonColor }"
            @click="close"
          >
            {{ buttonText }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  isOpen: boolean
  minAmount: number
  currentAmount: number
  bannerImage?: string
  buttonText?: string
  buttonColor?: string
}

const props = withDefaults(defineProps<Props>(), {
  bannerImage: '',
  buttonText: 'Понятно',
  buttonColor: '#FFD700'
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

const diffAmount = computed(() => {
  const diff = props.minAmount - props.currentAmount
  return diff > 0 ? diff.toFixed(2) : '0.00'
})

function close() {
  emit('close')
}
</script>

<style scoped>
.min-delivery-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  padding: 1rem;
}

.min-delivery-modal {
  position: relative;
  width: 100%;
  max-width: 400px;
  background: #fff;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: #333;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: #fff;
  transform: scale(1.1);
}

.banner-image {
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
}

.banner-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.banner-content {
  padding: 1.5rem;
  text-align: center;
}

.banner-title {
  font-family: var(--font-display, 'Inter', sans-serif);
  font-size: 1.5rem;
  font-weight: 800;
  color: #1a1a1a;
  margin: 0 0 0.75rem;
}

.banner-text {
  font-size: 1rem;
  color: #4a4a4a;
  margin: 0 0 0.5rem;
  line-height: 1.5;
}

.banner-text strong {
  color: #1a1a1a;
}

.banner-subtext {
  font-size: 0.9rem;
  color: #666;
  margin: 0 0 0.5rem;
}

.banner-diff {
  font-size: 0.95rem;
  color: var(--navalivay-red, #d32f2f);
  margin: 0;
  font-weight: 600;
}

.action-btn {
  display: block;
  width: calc(100% - 3rem);
  margin: 0 1.5rem 1.5rem;
  padding: 1rem 2rem;
  border: none;
  border-radius: 16px;
  font-family: var(--font-display, 'Inter', sans-serif);
  font-size: 1rem;
  font-weight: 700;
  color: #1a1a1a;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active .min-delivery-modal,
.modal-leave-active .min-delivery-modal {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .min-delivery-modal,
.modal-leave-to .min-delivery-modal {
  transform: scale(0.9) translateY(20px);
  opacity: 0;
}
</style>

