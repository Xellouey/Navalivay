<template>
  <transition
    enter-active-class="transition-opacity duration-300"
    leave-active-class="transition-opacity duration-500"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div 
      v-if="isVisible" 
      class="fixed inset-0 z-50 flex items-center justify-center bg-black"
    >
      <!-- Animated background -->
      <div class="absolute inset-0 overflow-hidden">
        <!-- Smoke effects -->
        <div class="smoke-1"></div>
        <div class="smoke-2"></div>
        <div class="smoke-3"></div>
        
        <!-- Skull pattern -->
        <div class="skull-bg"></div>
      </div>
      
      <!-- Logo container -->
      <div class="relative z-10">
        <!-- Pulsing glow effect -->
        <div class="absolute inset-0 -m-20 bg-red-600 rounded-full blur-3xl opacity-30 animate-pulse"></div>
        
        <!-- Main logo -->
        <img 
          src="/logo-navalivay.png" 
          alt="НАВАЛИВАЙ" 
          class="w-80 h-auto relative z-20 logo-animation"
          @load="onLogoLoad"
        />
        
        <!-- Loading bar -->
        <div class="mt-8 w-64 mx-auto">
          <div class="h-1 bg-gray-800 rounded-full overflow-hidden">
            <div 
              class="h-full bg-gradient-to-r from-red-600 to-red-500 rounded-full transition-all duration-1000"
              :style="`width: ${progress}%`"
            ></div>
          </div>
          <p class="text-gray-400 text-xs uppercase tracking-wider text-center mt-2">
            {{ loadingText }}
          </p>
        </div>
      </div>
      
      <!-- Bottom text -->
      <div class="absolute bottom-10 text-center">
        <p class="text-gray-600 text-sm uppercase tracking-widest brutal-text">
          Все для вейпинга
        </p>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const isVisible = ref(true)
const progress = ref(0)
const loadingText = ref('Загружаем дым...')

const loadingStages = [
  { progress: 20, text: 'Загружаем дым...' },
  { progress: 40, text: 'Наливаем жижу...' },
  { progress: 60, text: 'Заряжаем моды...' },
  { progress: 80, text: 'Готовим товары...' },
  { progress: 100, text: 'Готово!' }
]

const onLogoLoad = () => {
  // Start progress animation when logo is loaded
  let currentStage = 0
  const interval = setInterval(() => {
    if (currentStage < loadingStages.length) {
      progress.value = loadingStages[currentStage].progress
      loadingText.value = loadingStages[currentStage].text
      currentStage++
    } else {
      clearInterval(interval)
      setTimeout(() => {
        isVisible.value = false
      }, 500)
    }
  }, 400)
}

onMounted(() => {
  // Auto-hide after max 3 seconds
  setTimeout(() => {
    isVisible.value = false
  }, 3000)
})

defineExpose({
  hide: () => {
    isVisible.value = false
  }
})
</script>

<style scoped>
/* Logo animation */
@keyframes logoFloat {
  0%, 100% { 
    transform: translateY(0) scale(1); 
  }
  50% { 
    transform: translateY(-10px) scale(1.05); 
  }
}

.logo-animation {
  animation: logoFloat 3s ease-in-out infinite;
}

/* Smoke animations */
@keyframes smoke1 {
  0% {
    transform: translateX(-100%) rotate(0deg);
    opacity: 0;
  }
  25% {
    opacity: 0.3;
  }
  100% {
    transform: translateX(100%) rotate(180deg);
    opacity: 0;
  }
}

@keyframes smoke2 {
  0% {
    transform: translateY(100%) rotate(0deg);
    opacity: 0;
  }
  25% {
    opacity: 0.2;
  }
  100% {
    transform: translateY(-100%) rotate(-180deg);
    opacity: 0;
  }
}

.smoke-1 {
  position: absolute;
  width: 60%;
  height: 60%;
  top: -30%;
  left: -30%;
  background: radial-gradient(circle, #dc2626 0%, transparent 70%);
  filter: blur(60px);
  animation: smoke1 8s linear infinite;
}

.smoke-2 {
  position: absolute;
  width: 50%;
  height: 50%;
  bottom: -20%;
  right: -20%;
  background: radial-gradient(circle, #7f1d1d 0%, transparent 60%);
  filter: blur(40px);
  animation: smoke2 10s linear infinite;
  animation-delay: 2s;
}

.smoke-3 {
  position: absolute;
  width: 40%;
  height: 40%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, #991b1b 0%, transparent 50%);
  filter: blur(50px);
  animation: smoke1 12s linear infinite;
  animation-delay: 4s;
}

/* Skull background pattern */
.skull-bg {
  position: absolute;
  inset: 0;
  opacity: 0.02;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cg opacity='0.5'%3E%3Cpath d='M100 40 C80 40 65 55 65 75 C65 90 75 100 85 105 L85 115 L115 115 L115 105 C125 100 135 90 135 75 C135 55 120 40 100 40 Z' fill='%23fff'/%3E%3Ccircle cx='85' cy='70' r='8' fill='%23000'/%3E%3Ccircle cx='115' cy='70' r='8' fill='%23000'/%3E%3C/g%3E%3C/svg%3E");
  background-size: 200px 200px;
  animation: floatPattern 20s linear infinite;
}

@keyframes floatPattern {
  0% { transform: translate(0, 0); }
  100% { transform: translate(-200px, -200px); }
}

/* Brutal text effect */
.brutal-text {
  text-shadow: 2px 2px 0 #000;
}
</style>