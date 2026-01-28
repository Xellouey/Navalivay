<template>
  <section v-if="banners.length" class="relative w-full banner-section">
    <!-- Banner content - only when banners exist -->
    <div v-if="banners.length">
      <!-- Single banner: только картинка -->
      <template v-if="banners.length === 1">
        <div
          class="single-banner-wrapper"
          @click="(event) => handleBannerClick(banners[0], event)"
        >
          <img
            :src="imageOf(banners[0])"
            :alt="'Banner'"
            class="single-banner-image"
            loading="lazy"
            @error="handleImageError"
            @load="handleImageLoad"
          />
        </div>
      </template>

      <!-- Multiple banners: carousel -->
      <template v-else>
        <div class="carousel-container-new">
          <div
            class="carousel-track-new"
            :style="getTransformStyleNew()"
            @touchstart="onTouchStart"
            @touchmove="onTouchMove"
            @touchend="onTouchEnd"
            @mousedown="onMouseDown"
            @mousemove="onMouseMove"
            @mouseup="onMouseUp"
            @mouseleave="onMouseLeave"
          >
            <div
              v-for="(banner, index) in banners"
              :key="banner.id"
              class="carousel-slide-new"
              :class="{ active: index === currentSlide }"
              @click="(event) => handleBannerClick(banner, event)"
            >
              <img
                :src="imageOf(banner)"
                :alt="`Banner ${index + 1}`"
                class="carousel-image-new"
                loading="lazy"
                @error="handleImageError"
                @load="handleImageLoad"
              />
            </div>
          </div>

          <!-- Peek of next slide -->
          <div
            v-if="banners.length > 1 && currentSlide < banners.length - 1"
            class="carousel-peek-next"
          ></div>
        </div>

        <!-- Dot indicators -->
        <div class="carousel-dots">
          <button
            v-for="(banner, index) in banners"
            :key="`dot-${banner.id}`"
            class="carousel-dot"
            :class="{ active: index === currentSlide }"
            @click="goToSlide(index)"
            :aria-label="`Go to slide ${index + 1}`"
          ></button>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
// Removed chevron icons - using dot indicators instead
import type { Banner } from "@/stores/catalog";

interface Props {
  banners: Banner[];
  isLoading?: boolean;
  autoPlay?: boolean;
  autoPlayInterval?: number;
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  autoPlay: true,
  autoPlayInterval: 5000,
});

const router = useRouter();
const currentSlide = ref(0);
const autoPlayTimer = ref<ReturnType<typeof setTimeout>>();

// Touch and Mouse handling
const touchStartX = ref(0);
const touchEndX = ref(0);
const isDragging = ref(false);
const mouseStartX = ref(0);
const mouseCurrentX = ref(0);
const isMouseDragging = ref(false);

function imageOf(banner: Banner) {
  return (banner as any).image || (banner as any).imageUrl || "";
}

function getTransformStyleNew() {
  // Each slide is calc(100% - 16px) with 8px padding on sides
  const offset = currentSlide.value * 100;
  return {
    transform: `translateX(-${offset}%)`,
  };
}

function getTransformStyle() {
  // Using viewport units: each slide is 85vw + 12px gap
  // First slide has 7.5vw margin-left to center it
  const slideWidthVw = 85;
  const gapPx = 12;

  // Calculate total offset in vw and px
  const offsetVw = currentSlide.value * slideWidthVw;
  const offsetPx = currentSlide.value * gapPx;

  return {
    transform: `translateX(calc(-${offsetVw}vw - ${offsetPx}px))`,
  };
}

function nextSlide() {
  currentSlide.value = (currentSlide.value + 1) % props.banners.length;
  resetAutoPlay();
}

function previousSlide() {
  currentSlide.value =
    currentSlide.value === 0
      ? props.banners.length - 1
      : currentSlide.value - 1;
  resetAutoPlay();
}

function startAutoPlay() {
  if (props.autoPlay && props.banners.length > 1) {
    autoPlayTimer.value = setInterval(nextSlide, props.autoPlayInterval);
  }
}

function stopAutoPlay() {
  if (autoPlayTimer.value) {
    clearInterval(autoPlayTimer.value);
    autoPlayTimer.value = undefined;
  }
}

function resetAutoPlay() {
  stopAutoPlay();
  startAutoPlay();
}

function goToSlide(index: number) {
  currentSlide.value = index;
  resetAutoPlay();
}

function handleBannerClick(banner: Banner, event?: Event) {
  // Предотвращаем стандартное поведение браузера
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  if ((banner as any).href) {
    const href = (banner as any).href as string;
    const openInNewTab = (banner as any).openInNewTab === 1;

    if (href.startsWith("http")) {
      // Для внешних ссылок
      if (window.Telegram?.WebApp?.openLink) {
        // В Telegram WebApp открываем через API
        window.Telegram.WebApp.openLink(href);
      } else {
        // В обычном браузере - проверяем флаг
        if (openInNewTab) {
          const result = window.open(href, "_blank", "noopener,noreferrer");
          if (!result) {
            // Fallback: try without features
            const fallback = window.open(href, "_blank");
            // Если и fallback не сработал - ничего не делаем
            // Пользователь должен разрешить popup'ы
          }
        } else {
          window.location.href = href;
        }
      }
    } else {
      // Для внутренних ссылок проверяем флаг openInNewTab
      if (openInNewTab) {
        // Открываем внутреннюю ссылку в новой вкладке
        const fullUrl = window.location.origin + href;
        const result = window.open(fullUrl, "_blank", "noopener,noreferrer");
        if (!result) {
          // Fallback: try without features
          const fallback = window.open(fullUrl, "_blank");
          // Если и fallback не сработал - ничего не делаем
        }
      } else {
        // Используем обычную навигацию Vue Router
        navigateTo(href);
      }
    }
  }
}

function navigateTo(path: string) {
  try {
    router.push(path);
  } catch (error) {
    console.error("Navigation error:", error);
    // Fallback - используем обычную навигацию
    window.location.href = path;
  }
}

// Touch handlers
function onTouchStart(e: TouchEvent) {
  touchStartX.value = e.touches[0].clientX;
  isDragging.value = false;
  stopAutoPlay();
}

function onTouchMove(e: TouchEvent) {
  if (!isDragging.value) {
    isDragging.value = true;
  }
  touchEndX.value = e.touches[0].clientX;
}

function onTouchEnd() {
  if (!isDragging.value) {
    startAutoPlay();
    return;
  }

  const threshold = 50;
  const diff = touchStartX.value - touchEndX.value;

  if (Math.abs(diff) > threshold) {
    if (diff > 0) {
      nextSlide();
    } else {
      previousSlide();
    }
  } else {
    startAutoPlay();
  }

  isDragging.value = false;
}

// Mouse drag handlers
function onMouseDown(e: MouseEvent) {
  isMouseDragging.value = true;
  mouseStartX.value = e.clientX;
  stopAutoPlay();
  e.preventDefault();
}

function onMouseMove(e: MouseEvent) {
  if (!isMouseDragging.value) return;
  mouseCurrentX.value = e.clientX;
}

function onMouseUp() {
  if (!isMouseDragging.value) return;

  const threshold = 50;
  const diff = mouseStartX.value - mouseCurrentX.value;

  if (Math.abs(diff) > threshold) {
    if (diff > 0) {
      nextSlide();
    } else {
      previousSlide();
    }
  } else {
    startAutoPlay();
  }

  isMouseDragging.value = false;
}

function onMouseLeave() {
  if (isMouseDragging.value) {
    onMouseUp();
  }
}

function handleImageError(event: Event) {
  const img = event.target as HTMLImageElement;
  console.error('Banner image failed to load:', img.src);
  // Hide broken image icon on iOS
  img.style.display = 'none';
}

function handleImageLoad(event: Event) {
  const img = event.target as HTMLImageElement;
  img.style.display = 'block';
}

onMounted(() => {
  startAutoPlay();
});

onUnmounted(() => {
  stopAutoPlay();
});
</script>

<style scoped>
/* Banner section */
.banner-section {
  position: relative;
  padding: 0 8px;
  margin-top: 0;
}

/* Single banner */
.single-banner-wrapper {
  width: 100%;
  cursor: pointer;
  border-radius: 24px;
  overflow: hidden;
  position: relative;
  background-color: #f0f0f0; /* Fallback background if image fails to load */
  /* Fallback for iOS Safari < 15 - use padding-bottom trick */
  padding-bottom: 50%; /* 2:1 aspect ratio */
  height: 0;
}

/* Modern browsers with aspect-ratio support */
@supports (aspect-ratio: 2 / 1) {
  .single-banner-wrapper {
    padding-bottom: 0;
    height: auto;
  }
}

.single-banner-image {
  width: 100%;
  display: block;
  object-fit: cover;
  /* Fallback for older iOS */
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
}

/* Modern browsers with aspect-ratio support */
@supports (aspect-ratio: 2 / 1) {
  .single-banner-image {
    position: static;
    height: auto;
    aspect-ratio: 2 / 1;
  }
}

/* New carousel container */
.carousel-container-new {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: 24px;
}

.carousel-track-new {
  display: flex;
  transition: transform 0.4s ease-out;
  touch-action: pan-x;
  cursor: grab;
  user-select: none;
}

.carousel-track-new:active {
  cursor: grabbing;
}

.carousel-slide-new {
  flex: 0 0 100%;
  min-width: 100%;
  position: relative;
  background-color: #f0f0f0; /* Fallback background if image fails to load */
  /* Fallback for iOS Safari < 15 - use padding-bottom trick */
  padding-bottom: 50%; /* 2:1 aspect ratio */
  height: 0;
}

/* Modern browsers with aspect-ratio support */
@supports (aspect-ratio: 2 / 1) {
  .carousel-slide-new {
    padding-bottom: 0;
    height: auto;
  }
}

.carousel-image-new {
  width: 100%;
  display: block;
  object-fit: cover;
  /* Fallback for older iOS */
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
}

/* Modern browsers with aspect-ratio support */
@supports (aspect-ratio: 2 / 1) {
  .carousel-image-new {
    position: static;
    height: auto;
    aspect-ratio: 2 / 1;
  }
}

/* Dot indicators */
.carousel-dots {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 16px 0 8px;
}

.carousel-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: none;
  background: #aab2bd;
  cursor: pointer;
  padding: 0;
  transition: all 0.3s ease;
}

.carousel-dot.active {
  width: 10px;
  height: 10px;
  background: #fa0001;
  box-shadow: 0px 6px 24px rgba(250, 0, 1, 0.12);
}

.carousel-dot:hover:not(.active) {
  background: #8a919a;
}

/* Legacy peek effect styles (kept for compatibility) */
.carousel-container-peek {
  position: relative;
  width: 100%;
  overflow: visible;
  padding: 20px 0;
}

.carousel-track-peek {
  display: flex;
  gap: 12px;
  transition: transform 0.5s ease-out;
  touch-action: pan-x;
  cursor: grab;
  user-select: none;
  align-items: center;
}

.carousel-track-peek:active {
  cursor: grabbing;
}

.carousel-slide-peek {
  flex: 0 0 85vw;
  min-width: 85vw;
  max-width: 85vw;
  cursor: pointer;
  position: relative;
  transition: all 0.3s ease;
  border-radius: 16px;
  overflow: hidden;
}

.carousel-slide-peek:first-child {
  margin-left: 7.5vw;
}

.carousel-slide-peek::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.3);
  opacity: 1;
  transition: opacity 0.5s ease;
  pointer-events: none;
}

.carousel-slide-peek.active::after {
  opacity: 0;
}

/* 12:5 Aspect ratio wrapper */
.banner-aspect-wrapper {
  position: relative;
  width: 100%;
  padding-bottom: 41.67%; /* 5/12 = 0.4167 */
  overflow: hidden;
  background: #f0f0f0;
}

.carousel-image-peek {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Navigation Arrows - Brutal Style */
.carousel-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  color: var(--navalivay-red);
  outline: none;
  filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.3))
    drop-shadow(0 0 10px rgba(211, 47, 47, 0.3));
  padding: 8px;
}

.carousel-arrow svg {
  width: 56px;
  height: 56px;
  transition: transform 0.3s ease;
}

/* Animate first (faded) arrow on hover */
.carousel-arrow svg polyline:first-of-type {
  transition: opacity 0.3s ease;
}

.carousel-arrow:hover svg polyline:first-of-type {
  opacity: 0.7 !important;
  animation: arrowPulse 1.5s ease-in-out infinite;
}

@keyframes arrowPulse {
  0%,
  100% {
    opacity: 0.3;
  }
  50% {
    opacity: 0.7;
  }
}

.carousel-arrow:hover {
  color: var(--navalivay-red-light);
  transform: translateY(-50%) scale(1.1);
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4))
    drop-shadow(0 0 20px rgba(211, 47, 47, 0.6));
}

.carousel-arrow:hover svg {
  transform: scale(1.05);
}

.carousel-arrow-prev:hover svg {
  transform: scale(1.05) translateX(-3px);
}

.carousel-arrow-next:hover svg {
  transform: scale(1.05) translateX(3px);
}

.carousel-arrow:active {
  transform: translateY(-50%) scale(0.95);
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.3))
    drop-shadow(0 0 15px rgba(211, 47, 47, 0.5));
}

.carousel-arrow-prev {
  left: 8px;
}

.carousel-arrow-next {
  right: 8px;
}

/* Mobile adaptations for arrows */
@media (max-width: 768px) {
  .carousel-arrow svg {
    width: 40px;
    height: 40px;
  }

  .carousel-arrow-prev {
    left: 6px;
  }

  .carousel-arrow-next {
    right: 6px;
  }
}

@media (max-width: 480px) {
  .carousel-arrow svg {
    width: 36px;
    height: 36px;
  }

  .carousel-arrow-prev {
    left: 4px;
  }

  .carousel-arrow-next {
    right: 4px;
  }
}
</style>
