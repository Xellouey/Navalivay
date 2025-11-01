<template>
  <Transition name="toast-slide">
    <div v-if="visible" class="toast-container" :class="type">
      <div class="toast-content">
        <div class="toast-icon">
          <ExclamationTriangleIcon v-if="type === 'error'" class="icon" />
          <CheckCircleIcon v-else-if="type === 'success'" class="icon" />
          <InformationCircleIcon v-else class="icon" />
        </div>
        <p class="toast-message">{{ message }}</p>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ExclamationTriangleIcon, CheckCircleIcon, InformationCircleIcon } from '@heroicons/vue/24/outline'

const props = withDefaults(defineProps<{
  message: string
  type?: 'error' | 'success' | 'info'
  duration?: number
}>(), {
  type: 'info',
  duration: 3000
})

const visible = ref(false)
let hideTimeout: NodeJS.Timeout | null = null

onMounted(() => {
  if (props.message) {
    setTimeout(() => {
      visible.value = true
    }, 50)
    
    hideTimeout = setTimeout(() => {
      visible.value = false
    }, props.duration)
  }
})

onBeforeUnmount(() => {
  if (hideTimeout) {
    clearTimeout(hideTimeout)
  }
})
</script>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  max-width: 90%;
  width: auto;
  min-width: 280px;
}

.toast-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  background: white;
  border: 3px solid var(--navalivay-black);
  border-radius: 16px;
  box-shadow: 4px 4px 0 rgba(26, 26, 26, 0.3);
}

.toast-container.error .toast-content {
  border-color: #e60000;
  background: #fff5f5;
}

.toast-container.success .toast-content {
  border-color: #00c853;
  background: #f1f8f4;
}

.toast-container.info .toast-content {
  border-color: #2196f3;
  background: #f3f9ff;
}

.toast-icon {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toast-container.error .icon {
  color: #e60000;
}

.toast-container.success .icon {
  color: #00c853;
}

.toast-container.info .icon {
  color: #2196f3;
}

.toast-message {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--navalivay-black);
  line-height: 1.3;
  text-align: left;
}

.toast-slide-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toast-slide-leave-active {
  transition: all 0.2s ease-out;
}

.toast-slide-enter-from {
  transform: translate(-50%, 20px);
  opacity: 0;
}

.toast-slide-leave-to {
  transform: translate(-50%, 20px);
  opacity: 0;
}

@media (max-width: 640px) {
  .toast-container {
    bottom: 90px;
    min-width: 260px;
  }
  
  .toast-content {
    padding: 0.85rem 1.25rem;
    border-width: 2px;
    border-radius: 14px;
  }
  
  .toast-icon {
    width: 24px;
    height: 24px;
  }
  
  .toast-message {
    font-size: 0.88rem;
  }
}

@media (max-width: 480px) {
  .toast-container {
    bottom: 85px;
    min-width: 240px;
  }
  
  .toast-content {
    padding: 0.75rem 1rem;
    gap: 0.6rem;
  }
  
  .toast-message {
    font-size: 0.85rem;
  }
}
</style>
