<template>
  <div class="min-h-screen" style="background: #f5f7fa">
    <SmokeParticles :count="4" area="full" />

    <!-- Баннер -->
    <div class="mb-0 relative banner-wrapper">
      <div class="banner-container relative">
        <BannerCarousel
          v-if="catalogStore.banners.length"
          :banners="catalogStore.banners"
          :is-loading="catalogStore.isLoading"
          :auto-play="true"
          :auto-play-interval="5000"
        />
        <div
          v-else
          class="w-full aspect-[16/7] bg-gradient-to-r from-red-600 to-blue-600 flex items-center justify-center rounded-2xl"
        >
          <p class="text-white text-2xl font-bold">НАВАЛИВАЙ</p>
        </div>
      </div>
    </div>

    <div class="main-content-wrapper">
      <section class="category-section">
        <!-- Сетка категорий -->
        <div class="category-grid">
          <button
            v-for="category in categoryCards"
            :key="category.id"
            class="category-card-wrapper"
            @click="openCategory(category.slug)"
          >
            <div class="category-card-box">
              <div
                class="category-card-media"
                :style="{ backgroundImage: `url(${category.previewImage})` }"
              ></div>
            </div>
            <p class="category-card-title">{{ category.name }}</p>
          </button>
        </div>
      </section>
    </div>

    <!-- Cart Button - Figma Redesign -->
    <Transition name="cart-slide">
      <div v-if="totalCartItems > 0" class="cart-wrapper">
        <button class="cart-button" @click="goToCheckout">
          <svg
            width="17"
            height="16"
            viewBox="0 0 17 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            class="cart-icon"
          >
            <path
              d="M1 1H3.5L4.5 3M4.5 3L6.5 9H13.5L15.5 3H4.5Z"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <circle
              cx="6"
              cy="13"
              r="1.5"
              stroke="currentColor"
              stroke-width="1.6"
            />
            <circle
              cx="13"
              cy="13"
              r="1.5"
              stroke="currentColor"
              stroke-width="1.6"
            />
          </svg>
          <span class="cart-text">Заказ на {{ totalCartAmount }} BYN</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";

import { useCatalogStore, type Category } from "@/stores/catalog";
import { useCartStore } from "@/stores/cart";
import SmokeParticles from "@/components/SmokeParticles.vue";
import BannerCarousel from "@/components/BannerCarousel.vue";

const catalogStore = useCatalogStore();
const cartStore = useCartStore();
const router = useRouter();

const PLACEHOLDER_IMAGE = "/placeholder-category.png";

const categories = computed<Category[]>(() => catalogStore.categories);

const categoryCards = computed(() => {
  return categories.value.map((category) => {
    const previewImage =
      category.coverImage ||
      category.groups.find((group) => group.coverImage)?.coverImage ||
      PLACEHOLDER_IMAGE;
    return {
      id: category.id,
      slug: category.slug,
      name: category.name,
      order: category.order,
      productCount: category.productCount,
      previewImage,
    };
  });
});

const totalCartItems = computed(() => cartStore.totalItems);
const totalCartAmount = computed(() => cartStore.totalAmount.toFixed(2));

function openCategory(slug: string) {
  router.push({ name: "category", params: { slug } });
}

function goToCheckout() {
  router.push("/checkout");
}

onMounted(async () => {
  await catalogStore.initialize();

  if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
  }
});
</script>

<style scoped>
.banner-wrapper {
  overflow-x: hidden;
  overflow-y: visible;
}

.banner-container {
  position: relative;
}

/* Category card wrapper - transparent, holds box + title */
.category-card-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: transform 0.25s ease;
  padding: 0;
}

.category-card-wrapper:hover {
  transform: translateY(-4px);
}

/* White box containing the image */
.category-card-box {
  width: 107px;
  height: 107px;
  background: #ffffff;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.category-card-media {
  width: 84%;
  height: 84%;
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
}

.category-card-title {
  font-family: "Montserrat", sans-serif;
  font-size: 16px;
  font-weight: 700;
  line-height: 20px;
  text-align: center;
  letter-spacing: 0.008em;
  color: #000000;
  margin: 0;
}

/* Сетка категорий - автоматические равномерные отступы включая края экрана */
.category-grid {
  display: grid;
  grid-template-columns: repeat(3, 107px);
  justify-content: space-around;
  row-gap: 12px;
  padding: 0;
}

@media (max-width: 393px) {
  /* iPhone 14/15 и аналогичные - 393px ширина */
  .category-grid {
    grid-template-columns: repeat(3, 107px);
    row-gap: 12px;
    padding: 0;
  }
}

@media (max-width: 375px) {
  /* iPhone SE/Mini - чуть меньше отступы */
  .category-grid {
    grid-template-columns: repeat(3, 103px);
    row-gap: 10px;
    padding: 0;
  }

  .category-card-box {
    width: 103px;
    height: 103px;
  }
}

@media (max-width: 360px) {
  /* 360px экраны */
  .category-grid {
    grid-template-columns: repeat(3, 97px);
    row-gap: 8px;
    padding: 0;
  }

  .category-card-box {
    width: 97px;
    height: 97px;
    border-radius: 14px;
  }

  .category-card-title {
    font-size: 14px;
    line-height: 18px;
  }
}

@media (max-width: 320px) {
  /* 320px экраны */
  .category-grid {
    grid-template-columns: repeat(3, 85px);
    row-gap: 6px;
    padding: 0;
  }

  .category-card-box {
    width: 85px;
    height: 85px;
    border-radius: 12px;
  }

  .category-card-title {
    font-size: 12px;
    line-height: 16px;
  }
}

/* Main Content Wrapper */
.main-content-wrapper {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 16px 100px 16px;
  position: relative;
  z-index: 10;
}

.category-section {
  position: relative;
  min-height: 0;
  margin-top: 1rem;
}

/* ===== Cart Button Styles (Brutal Card Style) ===== */
.cart-wrapper {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  padding: 1rem;
  pointer-events: none;
}

.cart-button {
  width: 100%;
  max-width: 345px;
  height: 64px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0 2rem;
  position: relative;

  /* Figma: Red gradient */
  background: linear-gradient(90deg, #f50302 0%, #a90f0e 100%);
  border: none;
  border-radius: 528px;
  box-shadow: 0 8px 24px rgba(245, 3, 2, 0.3);

  cursor: pointer;
  pointer-events: auto;
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease;
}

.cart-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(245, 3, 2, 0.4);
}

.cart-button:active {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(245, 3, 2, 0.35);
}

.cart-icon {
  flex-shrink: 0;
  color: #ffffff;
  transition: transform 0.25s ease;
}

.cart-button:hover .cart-icon {
  transform: scale(1.1);
}

.cart-text {
  font-family: "Montserrat", sans-serif;
  font-size: 16px;
  font-weight: 500;
  color: #ffffff;
}

/* Slide up animation with bounce */
.cart-slide-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.cart-slide-leave-active {
  transition: all 0.3s ease-out;
}

.cart-slide-enter-from {
  transform: translateY(150%);
  opacity: 0;
}

.cart-slide-leave-to {
  transform: translateY(150%);
  opacity: 0;
}

/* Mobile adjustments */
@media (max-width: 768px) {
  .cart-wrapper {
    padding: 0.75rem;
  }

  .cart-button {
    max-width: 320px;
    height: 56px;
    padding: 0 1.5rem;
  }

  .cart-text {
    font-size: 15px;
  }

  .cart-icon {
    width: 16px;
    height: 15px;
  }
}

@media (max-width: 480px) {
  .cart-wrapper {
    padding: 0.5rem;
  }

  .cart-button {
    max-width: 300px;
    height: 52px;
    padding: 0 1.25rem;
    gap: 0.5rem;
  }

  .cart-text {
    font-size: 14px;
  }

  .cart-icon {
    width: 15px;
    height: 14px;
  }
}
</style>
