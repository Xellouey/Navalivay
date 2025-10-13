<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 bg-white/80 backdrop-blur-lg flex items-center justify-center"
      @click="handleBackgroundClick"
      @keydown="handleKeydown"
      tabindex="0"
      ref="viewerContainer"
    >
      <!-- Close button -->
      <button
        class="absolute top-4 right-4 z-10 w-12 h-12 bg-white/70 rounded-full flex items-center justify-center text-brand-dark hover:bg-white transition-all"
        @click="close"
      >
        <XMarkIcon class="w-6 h-6" />
      </button>

      <!-- Image counter -->
      <div
        v-if="images.length > 1"
        class="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-white/80 text-brand-dark px-3 py-1 rounded-full text-sm"
      >
        {{ currentIndex + 1 }} / {{ images.length }}
      </div>

      <!-- Previous button -->
      <button
        v-if="images.length > 1 && currentIndex > 0"
        class="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 w-12 h-12 bg-white/70 rounded-full flex items-center justify-center text-brand-dark hover:bg-white transition-all"
        @click="goToPrevious"
      >
        <ChevronLeftIcon class="w-6 h-6" />
      </button>

      <!-- Next button -->
      <button
        v-if="images.length > 1 && currentIndex < images.length - 1"
        class="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 w-12 h-12 bg-white/70 rounded-full flex items-center justify-center text-brand-dark hover:bg-white transition-all"
        @click="goToNext"
      >
        <ChevronRightIcon class="w-6 h-6" />
      </button>

      <!-- Image container with touch support -->
      <div
        class="relative max-w-full max-h-full flex items-center justify-center px-4 py-16"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
        ref="imageContainer"
      >
        <Transition
          mode="out-in"
          enter-active-class="transition-all duration-300 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition-all duration-200 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <img
            :key="currentImage"
            :src="currentImage"
            :alt="`Изображение ${currentIndex + 1}`"
            class="max-w-full max-h-full object-contain select-none"
            @click.stop
            @load="onImageLoad"
            @error="onImageError"
          />
        </Transition>

        <!-- Loading state -->
        <div
          v-if="isImageLoading"
          class="absolute inset-0 flex items-center justify-center"
        >
          <div class="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>

      <!-- Dots indicator for multiple images -->
      <div
        v-if="images.length > 1"
        class="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-2"
      >
        <button
          v-for="(_, index) in images"
          :key="index"
          class="w-2 h-2 rounded-full transition-all"
          :class="index === currentIndex ? 'bg-white' : 'bg-white bg-opacity-50'"
          @click="goToIndex(index)"
        />
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/vue/24/outline'

interface Props {
  images: string[]
  initialIndex?: number
  isOpen: boolean
}

interface Emits {
  (e: 'close'): void
  (e: 'update:isOpen', value: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  initialIndex: 0
})

const emit = defineEmits<Emits>()

const currentIndex = ref(0)
const isImageLoading = ref(false)
const viewerContainer = ref<HTMLElement>()
const imageContainer = ref<HTMLElement>()

// Touch handling
const touchStartX = ref(0)
const touchStartY = ref(0)
const touchEndX = ref(0)
const touchEndY = ref(0)
const minSwipeDistance = 50

const currentImage = computed(() => {
  return props.images[currentIndex.value] || ''
})

// Initialize current index when component opens
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    currentIndex.value = props.initialIndex
    nextTick(() => {
      viewerContainer.value?.focus()
    })
  }
})

// Navigation methods
function goToPrevious() {
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

function goToNext() {
  if (currentIndex.value < props.images.length - 1) {
    currentIndex.value++
  }
}

function goToIndex(index: number) {
  if (index >= 0 && index < props.images.length) {
    currentIndex.value = index
  }
}

function close() {
  emit('update:isOpen', false)
  emit('close')
}

// Event handlers
function handleBackgroundClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    close()
  }
}

function handleKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'Escape':
      close()
      break
    case 'ArrowLeft':
      event.preventDefault()
      goToPrevious()
      break
    case 'ArrowRight':
      event.preventDefault()
      goToNext()
      break
  }
}

// Touch event handlers
function handleTouchStart(event: TouchEvent) {
  const touch = event.touches[0]
  touchStartX.value = touch.clientX
  touchStartY.value = touch.clientY
}

function handleTouchMove(event: TouchEvent) {
  event.preventDefault() // Prevent scrolling
}

function handleTouchEnd(event: TouchEvent) {
  const touch = event.changedTouches[0]
  touchEndX.value = touch.clientX
  touchEndY.value = touch.clientY
  
  handleSwipeGesture()
}

function handleSwipeGesture() {
  const deltaX = touchEndX.value - touchStartX.value
  const deltaY = touchEndY.value - touchStartY.value
  
  // Check if it's a horizontal swipe (not vertical)
  if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
    if (deltaX > 0) {
      // Swipe right - go to previous
      goToPrevious()
    } else {
      // Swipe left - go to next
      goToNext()
    }
  }
}

// Image loading handlers
function onImageLoad() {
  isImageLoading.value = false
}

function onImageError() {
  isImageLoading.value = false
}

// Watch for image changes to show loading state
watch(currentIndex, () => {
  isImageLoading.value = true
})
</script>

<style scoped>
/* Prevent body scroll when viewer is open */
.fixed {
  touch-action: none;
}
</style>