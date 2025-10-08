<template>
  <component :is="asLink ? 'router-link' : 'div'" 
             :to="asLink ? '/' : null"
             :class="logoClasses"
             class="logo-component">
    <!-- Основной логотип -->
    <div class="logo-wrapper" :class="{ 'animate': animated }">
      <div class="logo-text" :style="logoStyle">
        <span v-if="!splitLetters" class="logo-full">{{ text }}</span>
        <span v-else class="logo-letters">
          <span v-for="(letter, index) in logoLetters" 
                :key="index"
                class="logo-letter"
                :style="{ animationDelay: `${index * 0.05}s` }">
            {{ letter }}
          </span>
        </span>
      </div>
      
      <!-- Подзаголовок если нужен -->
      <div v-if="showSubtitle" class="logo-subtitle" :style="subtitleStyle">
        {{ subtitle }}
      </div>
    </div>

    <!-- Декоративные элементы -->
    <div v-if="showDecoration" class="logo-decoration">
      <svg class="decoration-svg" viewBox="0 0 100 20">
        <path d="M0,10 Q25,0 50,10 T100,10" 
              stroke="currentColor" 
              stroke-width="2" 
              fill="none"
              class="wave-path"/>
      </svg>
    </div>

    <!-- Эффект свечения -->
    <div v-if="glowEffect" class="logo-glow"></div>
  </component>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // Текст логотипа
  text: {
    type: String,
    default: 'NAVALIVAY'
  },
  
  // Подзаголовок
  subtitle: {
    type: String,
    default: 'маркетплейс'
  },
  
  // Показывать подзаголовок
  showSubtitle: {
    type: Boolean,
    default: false
  },
  
  // Размер: xs, sm, md, lg, xl, 2xl
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['xs', 'sm', 'md', 'lg', 'xl', '2xl'].includes(value)
  },
  
  // Вариант отображения
  variant: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'minimal', 'bold', 'gradient', 'neon'].includes(value)
  },
  
  // Цвет текста
  color: {
    type: String,
    default: null
  },
  
  // Включить анимацию
  animated: {
    type: Boolean,
    default: false
  },
  
  // Разделить на буквы для анимации
  splitLetters: {
    type: Boolean,
    default: false
  },
  
  // Сделать ссылкой на главную
  asLink: {
    type: Boolean,
    default: false
  },
  
  // Показать декоративные элементы
  showDecoration: {
    type: Boolean,
    default: false
  },
  
  // Эффект свечения
  glowEffect: {
    type: Boolean,
    default: false
  }
})

// Размеры шрифтов
const fontSizes = {
  xs: { main: '1rem', sub: '0.6rem' },
  sm: { main: '1.5rem', sub: '0.75rem' },
  md: { main: '2rem', sub: '0.875rem' },
  lg: { main: '2.5rem', sub: '1rem' },
  xl: { main: '3rem', sub: '1.125rem' },
  '2xl': { main: '3.5rem', sub: '1.25rem' }
}

const logoLetters = computed(() => props.text.split(''))

const logoClasses = computed(() => [
  `logo-variant-${props.variant}`,
  `logo-size-${props.size}`,
  {
    'logo-link': props.asLink,
    'logo-animated': props.animated,
    'logo-glow': props.glowEffect
  }
])

const logoStyle = computed(() => ({
  fontSize: fontSizes[props.size].main,
  color: props.color || undefined
}))

const subtitleStyle = computed(() => ({
  fontSize: fontSizes[props.size].sub,
  color: props.color ? `${props.color}99` : undefined
}))
</script>

<style scoped>
.logo-component {
  display: inline-block;
  position: relative;
  user-select: none;
}

.logo-link {
  text-decoration: none;
  cursor: pointer;
}

.logo-wrapper {
  position: relative;
  z-index: 2;
}

.logo-text {
  font-weight: 900;
  letter-spacing: -0.02em;
  line-height: 1;
  transition: all 0.3s ease;
}

.logo-letters {
  display: flex;
  gap: 0.05em;
}

.logo-letter {
  display: inline-block;
  transition: transform 0.3s ease;
}

.logo-subtitle {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  margin-top: 0.25em;
  opacity: 0.8;
  font-weight: 500;
  text-align: center;
}

/* Варианты отображения */
.logo-variant-default .logo-text {
  color: currentColor;
}

.logo-variant-minimal .logo-text {
  font-weight: 300;
  letter-spacing: 0.1em;
}

.logo-variant-bold .logo-text {
  font-weight: 900;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
}

.logo-variant-gradient .logo-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.logo-variant-neon .logo-text {
  color: #fff;
  text-shadow: 
    0 0 10px currentColor,
    0 0 20px currentColor,
    0 0 30px currentColor,
    0 0 40px currentColor;
}

/* Анимации */
.logo-animated .logo-wrapper {
  animation: float 3s ease-in-out infinite;
}

.logo-animated .logo-letter {
  animation: bounce 2s ease-in-out infinite;
  animation-fill-mode: both;
}

.logo-animated:hover .logo-letter {
  animation: wave 0.5s ease-in-out;
  animation-fill-mode: both;
}

/* Декоративные элементы */
.logo-decoration {
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 120%;
  opacity: 0.3;
}

.decoration-svg {
  width: 100%;
  height: 20px;
  color: currentColor;
}

.wave-path {
  animation: wave-animation 3s ease-in-out infinite;
}

/* Эффект свечения */
.logo-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 150%;
  height: 150%;
  background: radial-gradient(circle, currentColor 0%, transparent 70%);
  opacity: 0.1;
  filter: blur(20px);
  animation: pulse 2s ease-in-out infinite;
  z-index: 1;
}

/* Keyframes */
@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes wave {
  0%, 100% {
    transform: translateY(0) rotateZ(0);
  }
  25% {
    transform: translateY(-5px) rotateZ(-5deg);
  }
  75% {
    transform: translateY(5px) rotateZ(5deg);
  }
}

@keyframes wave-animation {
  0%, 100% {
    d: path("M0,10 Q25,0 50,10 T100,10");
  }
  50% {
    d: path("M0,10 Q25,20 50,10 T100,10");
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.1;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 0.2;
    transform: translate(-50%, -50%) scale(1.1);
  }
}

/* Адаптивность */
@media (max-width: 768px) {
  .logo-size-2xl .logo-text {
    font-size: 2.5rem !important;
  }
  
  .logo-size-xl .logo-text {
    font-size: 2rem !important;
  }
  
  .logo-size-lg .logo-text {
    font-size: 1.75rem !important;
  }
}

@media (max-width: 480px) {
  .logo-size-2xl .logo-text {
    font-size: 2rem !important;
  }
  
  .logo-size-xl .logo-text {
    font-size: 1.5rem !important;
  }
  
  .logo-size-lg .logo-text {
    font-size: 1.25rem !important;
  }
}
</style>