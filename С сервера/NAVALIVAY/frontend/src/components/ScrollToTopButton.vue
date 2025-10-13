<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 scale-75"
    enter-to-class="opacity-100 scale-100"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 scale-75"
  >
    <button
      v-if="showButton"
      @click="scrollToTop"
      class="scroll-to-top-button"
      aria-label="Прокрутить наверх"
    >
      <ChevronUpIcon class="w-6 h-6" />
    </button>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { ChevronUpIcon } from '@heroicons/vue/24/outline'

const showButton = ref(false)
const scrollThreshold = 400 // Показывать кнопку после прокрутки на 400px

// Проверка нужно ли показывать кнопку
function checkScrollPosition() {
  showButton.value = window.pageYOffset > scrollThreshold
}

// Плавная прокрутка наверх
function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  })
}

// Обработчик прокрутки с throttling для производительности
let ticking = false
function handleScroll() {
  if (!ticking) {
    requestAnimationFrame(() => {
      checkScrollPosition()
      ticking = false
    })
    ticking = true
  }
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  checkScrollPosition() // Проверить при загрузке
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<style scoped>
.scroll-to-top-button {
  /* Позиционирование */
  position: fixed;
  bottom: 100px;
  right: 20px;
  z-index: 1000;
  
  /* Размеры */
  width: 56px;
  height: 56px;
  
  /* Brutal style */
  background: linear-gradient(135deg, #dc2626, #991b1b);
  border: 2px solid #dc2626;
  border-radius: 0; /* Квадратная форма */
  
  /* Эффект свечения */
  box-shadow: 0 0 20px rgba(220, 38, 38, 0.5), 
              0 0 40px rgba(220, 38, 38, 0.3),
              inset 0 0 20px rgba(0, 0, 0, 0.3);
  
  /* Центрирование иконки */
  display: flex;
  align-items: center;
  justify-content: center;
  
  /* Анимации */
  transition: all 0.3s ease;
  cursor: pointer;
  
  /* Убираем стандартные стили кнопки */
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.scroll-to-top-button:hover {
  /* При наведении усиливаем свечение */
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 0 30px rgba(220, 38, 38, 0.8), 
              0 0 60px rgba(220, 38, 38, 0.5),
              inset 0 0 20px rgba(0, 0, 0, 0.3);
  background: linear-gradient(135deg, #ef4444, #dc2626);
}

.scroll-to-top-button:active {
  /* При нажатии уменьшаем */
  transform: translateY(0) scale(0.95);
  box-shadow: 0 0 15px rgba(220, 38, 38, 0.5), 
              inset 0 0 30px rgba(0, 0, 0, 0.5);
}

/* Иконка стрелки */
.scroll-to-top-button svg {
  color: #ffffff;
  stroke-width: 3; /* Жирная стрелка */
}

/* Адаптив для мобильных */
@media (max-width: 768px) {
  .scroll-to-top-button {
    bottom: 90px;
    right: 16px;
    width: 48px;
    height: 48px;
  }
  
  .scroll-to-top-button svg {
    width: 20px;
    height: 20px;
  }
}

/* Дополнительные стили для безопасной зоны (если используется в Telegram) */
@supports (padding: env(safe-area-inset-bottom)) {
  .scroll-to-top-button {
    bottom: calc(100px + env(safe-area-inset-bottom));
    right: calc(20px + env(safe-area-inset-right));
  }
  
  @media (max-width: 768px) {
    .scroll-to-top-button {
      bottom: calc(90px + env(safe-area-inset-bottom));
      right: calc(16px + env(safe-area-inset-right));
    }
  }
}
</style>