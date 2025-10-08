<template>
  <div class="lazy-image-container" :class="containerClasses" ref="imageContainer">
    <!-- Placeholder / Skeleton -->
    <div v-if="!imageLoaded" class="image-placeholder" :style="placeholderStyle">
      <div class="placeholder-shimmer"></div>
      <svg v-if="showIcon" class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
      </svg>
    </div>

    <!-- Основное изображение -->
    <img 
      v-show="imageLoaded"
      :src="currentSrc"
      :alt="alt"
      :class="imageClasses"
      :style="imageStyle"
      @load="onImageLoad"
      @error="onImageError"
      loading="lazy"
    />

    <!-- Overlay для ошибки -->
    <div v-if="imageError" class="image-error" :style="placeholderStyle">
      <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
      <span class="error-text">{{ errorText }}</span>
    </div>

    <!-- Индикатор загрузки -->
    <div v-if="loading && showLoader" class="image-loader">
      <div class="loader-spinner"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  // Источник изображения
  src: {
    type: String,
    required: true
  },
  
  // Альтернативный текст
  alt: {
    type: String,
    default: ''
  },
  
  // Placeholder изображение (низкого качества)
  placeholder: {
    type: String,
    default: null
  },
  
  // Фоновый цвет placeholder
  placeholderColor: {
    type: String,
    default: '#f3f4f6'
  },
  
  // Соотношение сторон (например, '16/9', '1/1', '4/3')
  aspectRatio: {
    type: String,
    default: null
  },
  
  // Ширина изображения
  width: {
    type: [String, Number],
    default: null
  },
  
  // Высота изображения
  height: {
    type: [String, Number],
    default: null
  },
  
  // Радиус скругления
  rounded: {
    type: [Boolean, String],
    default: false
  },
  
  // Показывать иконку в placeholder
  showIcon: {
    type: Boolean,
    default: true
  },
  
  // Показывать индикатор загрузки
  showLoader: {
    type: Boolean,
    default: false
  },
  
  // Текст ошибки
  errorText: {
    type: String,
    default: 'Не удалось загрузить'
  },
  
  // Эффект при загрузке
  transitionEffect: {
    type: String,
    default: 'fade',
    validator: (value) => ['fade', 'blur', 'scale', 'none'].includes(value)
  },
  
  // Fit режим для изображения
  objectFit: {
    type: String,
    default: 'cover',
    validator: (value) => ['cover', 'contain', 'fill', 'none', 'scale-down'].includes(value)
  }
})

const emit = defineEmits(['load', 'error'])

// Состояния
const imageContainer = ref(null)
const imageLoaded = ref(false)
const imageError = ref(false)
const loading = ref(false)
const currentSrc = ref('')
const isInViewport = ref(false)

// Наблюдатель для lazy loading
let observer = null

// Вычисляемые свойства
const containerClasses = computed(() => [
  `transition-${props.transitionEffect}`,
  {
    'image-loaded': imageLoaded.value,
    'image-loading': loading.value,
    'image-error': imageError.value,
    'rounded': props.rounded === true,
    [`rounded-${props.rounded}`]: typeof props.rounded === 'string'
  }
])

const imageClasses = computed(() => [
  'lazy-image',
  `object-${props.objectFit}`
])

const placeholderStyle = computed(() => {
  const style = {
    backgroundColor: props.placeholderColor
  }
  
  if (props.aspectRatio) {
    style.aspectRatio = props.aspectRatio
  }
  
  if (props.width) {
    style.width = typeof props.width === 'number' ? `${props.width}px` : props.width
  }
  
  if (props.height) {
    style.height = typeof props.height === 'number' ? `${props.height}px` : props.height
  }
  
  return style
})

const imageStyle = computed(() => {
  const style = {}
  
  if (props.width) {
    style.width = typeof props.width === 'number' ? `${props.width}px` : props.width
  }
  
  if (props.height) {
    style.height = typeof props.height === 'number' ? `${props.height}px` : props.height
  }
  
  return style
})

// Методы
const loadImage = () => {
  if (!isInViewport.value || loading.value) return
  
  loading.value = true
  imageError.value = false
  
  // Если есть placeholder, загружаем его первым
  if (props.placeholder && !imageLoaded.value) {
    const placeholderImg = new Image()
    placeholderImg.src = props.placeholder
    placeholderImg.onload = () => {
      currentSrc.value = props.placeholder
    }
  }
  
  // Загружаем основное изображение
  const img = new Image()
  img.src = props.src
  img.onload = () => {
    currentSrc.value = props.src
  }
  img.onerror = () => {
    onImageError()
  }
}

const onImageLoad = () => {
  loading.value = false
  imageLoaded.value = true
  imageError.value = false
  emit('load')
}

const onImageError = () => {
  loading.value = false
  imageLoaded.value = false
  imageError.value = true
  emit('error')
}

const setupIntersectionObserver = () => {
  if (!window.IntersectionObserver) {
    // Fallback для старых браузеров
    isInViewport.value = true
    loadImage()
    return
  }
  
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          isInViewport.value = true
          loadImage()
          observer.unobserve(entry.target)
        }
      })
    },
    {
      rootMargin: '50px'
    }
  )
  
  if (imageContainer.value) {
    observer.observe(imageContainer.value)
  }
}

// Хуки жизненного цикла
onMounted(() => {
  setupIntersectionObserver()
})

onUnmounted(() => {
  if (observer && imageContainer.value) {
    observer.unobserve(imageContainer.value)
  }
})

// Следим за изменением src
watch(() => props.src, () => {
  imageLoaded.value = false
  imageError.value = false
  if (isInViewport.value) {
    loadImage()
  }
})
</script>

<style scoped>
.lazy-image-container {
  position: relative;
  overflow: hidden;
  background-color: transparent;
}

.lazy-image {
  width: 100%;
  height: 100%;
  display: block;
}

/* Object fit классы */
.object-cover {
  object-fit: cover;
}

.object-contain {
  object-fit: contain;
}

.object-fill {
  object-fit: fill;
}

.object-none {
  object-fit: none;
}

.object-scale-down {
  object-fit: scale-down;
}

/* Placeholder */
.image-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: inherit;
  overflow: hidden;
}

.placeholder-shimmer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.2),
    transparent
  );
  animation: shimmer 1.5s infinite;
}

.placeholder-icon {
  width: 40px;
  height: 40px;
  color: #9ca3af;
  opacity: 0.5;
  z-index: 1;
}

/* Ошибка */
.image-error {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #f3f4f6;
  color: #6b7280;
}

.error-icon {
  width: 32px;
  height: 32px;
  margin-bottom: 8px;
  color: #ef4444;
}

.error-text {
  font-size: 0.75rem;
  text-align: center;
  padding: 0 8px;
}

/* Загрузчик */
.image-loader {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
}

.loader-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* Эффекты перехода */
.transition-fade .lazy-image {
  opacity: 0;
  transition: opacity 0.5s ease;
}

.transition-fade.image-loaded .lazy-image {
  opacity: 1;
}

.transition-blur .lazy-image {
  filter: blur(10px);
  transition: filter 0.5s ease;
}

.transition-blur.image-loaded .lazy-image {
  filter: blur(0);
}

.transition-scale .lazy-image {
  transform: scale(1.1);
  transition: transform 0.5s ease;
}

.transition-scale.image-loaded .lazy-image {
  transform: scale(1);
}

/* Скругления */
.rounded {
  border-radius: 0.375rem;
}

.rounded-sm {
  border-radius: 0.125rem;
}

.rounded-md {
  border-radius: 0.375rem;
}

.rounded-lg {
  border-radius: 0.5rem;
}

.rounded-xl {
  border-radius: 0.75rem;
}

.rounded-2xl {
  border-radius: 1rem;
}

.rounded-full {
  border-radius: 9999px;
}

.rounded .lazy-image,
.rounded-sm .lazy-image,
.rounded-md .lazy-image,
.rounded-lg .lazy-image,
.rounded-xl .lazy-image,
.rounded-2xl .lazy-image,
.rounded-full .lazy-image {
  border-radius: inherit;
}

/* Анимации */
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>