<template>
  <div class="profile-page">
    <div class="profile-container">
      <section class="user-card">
        <div class="user-avatar-wrap">
          <img
            v-if="userStore.photoUrl && !avatarError"
            :src="userStore.photoUrl"
            :alt="userStore.displayName"
            class="user-avatar"
            @error="avatarError = true"
          />
          <div v-else class="user-avatar user-avatar--placeholder">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" stroke="#AAB2BD" stroke-width="1.8" />
              <path
                d="M4 21C4 17.134 7.58172 14 12 14C16.4183 14 20 17.134 20 21"
                stroke="#AAB2BD"
                stroke-width="1.8"
                stroke-linecap="round"
              />
            </svg>
          </div>
        </div>

        <div class="user-info">
          <h1 class="user-name">
            <template v-if="userStore.isLoading">Загрузка...</template>
            <template v-else>{{ userStore.displayName }}</template>
          </h1>
          <p v-if="userStore.hasUsername" class="user-username">
            @{{ userStore.profile?.telegramUsername }}
          </p>
          <p v-else class="user-username user-username--missing">
            Username не установлен
          </p>
        </div>
      </section>

      <section class="loyalty-section">
        <article class="loyalty-card" :class="{ 'loyalty-card--empty': !selectedLoyaltyCategory }">
          <div class="loyalty-card-header">
            <h2 class="loyalty-card-title-main">Бонусная система</h2>
            <p v-if="loyaltyStore.loadingSnapshot" class="loyalty-loading">Обновляем...</p>
          </div>

          <template v-if="selectedLoyaltyCategory">
            <div class="loyalty-tabs" role="tablist" aria-label="Категории бонусов">
              <button
                v-for="category in orderedLoyaltyCategories"
                :key="category.id"
                type="button"
                class="loyalty-tab"
                :class="{ 'loyalty-tab--active': category.key === activeLoyaltyKey }"
                @click="activeLoyaltyKey = category.key"
              >
                {{ loyaltyCategoryLabel(category) }}
              </button>
            </div>

            <div class="loyalty-progress-row">
              <div class="loyalty-progress-track">
                <div
                  class="loyalty-progress-fill"
                  :style="{ width: `${progressPercent(selectedLoyaltyCategory)}%` }"
                ></div>
              </div>
              <span class="loyalty-progress-value">
                {{ progressLabel(selectedLoyaltyCategory) }}
              </span>
            </div>

            <div class="loyalty-copy-row">
              <p class="loyalty-copy">
                <template
                  v-for="(line, index) in selectedLoyaltyDescriptionLines"
                  :key="`${selectedLoyaltyCategory.key}-${index}`"
                >
                  <span class="loyalty-copy-line">
                    {{ line }}
                    <span
                      v-if="index === selectedLoyaltyDescriptionLines.length - 1"
                      class="loyalty-discount"
                    >
                      {{ selectedLoyaltyCategory.discount_amount }} BYN
                    </span>
                  </span>
                  <br v-if="index < selectedLoyaltyDescriptionLines.length - 1" />
                </template>
              </p>
            </div>

            <button
              type="button"
              class="loyalty-rules-link"
              @click="openRulesModal"
            >
              <span>Как работают скидки за покупки</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path
                  d="M3 1.5L7.5 6L3 10.5"
                  stroke="white"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </template>

          <template v-else>
            <p class="loyalty-empty-copy">
              Как только у вас появятся покупки по бонусным категориям, здесь появится прогресс.
            </p>
          </template>
        </article>

        <div v-if="loyaltyStore.snapshotError" class="loyalty-error">
          {{ loyaltyStore.snapshotError }}
        </div>
      </section>

    </div>

    <Transition name="rules-modal">
      <div
        v-if="showRulesModal"
        class="rules-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-modal-title"
        @click.self="closeRulesModal"
      >
        <section class="rules-modal-card">
          <div class="rules-modal-header">
            <h2 id="rules-modal-title" class="rules-modal-title">Как получить скидку?</h2>
            <button
              type="button"
              class="rules-modal-close"
              aria-label="Закрыть окно"
              @click="closeRulesModal"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M4 4L12 12M12 4L4 12"
                  stroke="#191919"
                  stroke-width="1.8"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </div>

          <div class="rules-modal-copy">
            <p>Покупайте товары и собирайте штампы в своей карте лояльности.</p>
            <p>
              Каждая купленная позиция добавляет один штамп в соответствующую категорию.
              Если в одном заказе несколько товаров одной бонусной категории, штампы
              начисляются за каждую позицию. Когда карта заполнится — вы получите скидку на
              следующую покупку.
            </p>
            <p>В одном заказе можно применить по одной бонусной скидке на каждую бонусную категорию.</p>
            <p>Обратите внимание: штампы начисляются только за товары без акций, промокодов и ручных скидок.</p>
          </div>

          <button type="button" class="rules-modal-cta" @click="goShopping">
            За покупками
          </button>
        </section>
      </div>
    </Transition>

    <LoyaltyBonusPopup
      :open="showLoyaltyPopup"
      :categories="loyaltyStore.availableCategories"
      @close="showLoyaltyPopup = false"
      @open-profile="showLoyaltyPopup = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import router from "@/router";
import { useUserStore } from "@/stores/user";
import { useLoyaltyStore, type LoyaltySnapshotCategory } from "@/stores/loyalty";
import { getTelegramIdentity } from "@/utils/customerOrders";
import LoyaltyBonusPopup from "@/components/LoyaltyBonusPopup.vue";

const userStore = useUserStore();
const loyaltyStore = useLoyaltyStore();
const avatarError = ref(false);
const activeLoyaltyKey = ref<string | null>(null);
const showRulesModal = ref(false);
const showLoyaltyPopup = ref(false);

const LOYALTY_CATEGORY_ORDER = ["liquids", "disposables", "devices"];
const LOYALTY_CATEGORY_LABELS: Record<string, string> = {
  liquids: "Жидкости",
  disposables: "Одноразки",
  devices: "Устройства",
};

const orderedLoyaltyCategories = computed(() => {
  return [...loyaltyStore.snapshot].sort((left, right) => {
    const leftIndex = LOYALTY_CATEGORY_ORDER.indexOf(left.key);
    const rightIndex = LOYALTY_CATEGORY_ORDER.indexOf(right.key);
    const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;

    if (normalizedLeft !== normalizedRight) {
      return normalizedLeft - normalizedRight;
    }

    return left.title.localeCompare(right.title, "ru");
  });
});

const selectedLoyaltyCategory = computed(() => {
  if (!orderedLoyaltyCategories.value.length) {
    return null;
  }

  return (
    orderedLoyaltyCategories.value.find(
      (category) => category.key === activeLoyaltyKey.value,
    ) || orderedLoyaltyCategories.value[0]
  );
});

const selectedLoyaltyDescriptionLines = computed(() => {
  if (!selectedLoyaltyCategory.value) {
    return [];
  }

  return loyaltyDescriptionLines(selectedLoyaltyCategory.value);
});

watch(
  orderedLoyaltyCategories,
  (categories) => {
    if (!categories.length) {
      activeLoyaltyKey.value = null;
      return;
    }

    if (!categories.some((category) => category.key === activeLoyaltyKey.value)) {
      activeLoyaltyKey.value = categories[0].key;
    }
  },
  { immediate: true },
);

watch(showRulesModal, (isOpen) => {
  if (typeof document === "undefined") {
    return;
  }

  const overflowValue = isOpen ? "hidden" : "";
  document.documentElement.style.overflow = overflowValue;
  document.body.style.overflow = overflowValue;
});

onBeforeUnmount(() => {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
});

onMounted(async () => {
  const identity = getTelegramIdentity();

  await Promise.allSettled([userStore.fetchProfile(), loyaltyStore.fetchSnapshot(identity)]);

  if (loyaltyStore.canShowAvailableBonusPopup()) {
    loyaltyStore.markPopupSeen();
    showLoyaltyPopup.value = true;
  }
});

function loyaltyCategoryLabel(category: LoyaltySnapshotCategory) {
  return LOYALTY_CATEGORY_LABELS[category.key] || category.title;
}

function progressCurrentValue(category: LoyaltySnapshotCategory) {
  const threshold = Number(category.threshold || 0);
  if (!threshold) return 0;

  const remaining = Math.max(0, Number(category.remaining_to_next || 0));
  if (remaining === 0) {
    return threshold;
  }

  return Math.max(0, Math.min(threshold, threshold - remaining));
}

function progressLabel(category: LoyaltySnapshotCategory) {
  return `${progressCurrentValue(category)} / ${category.threshold}`;
}

function progressPercent(category: LoyaltySnapshotCategory) {
  const threshold = Number(category.threshold || 0);
  if (!threshold) return 0;
  return Math.round((progressCurrentValue(category) / threshold) * 100);
}

function loyaltyDescriptionLines(category: LoyaltySnapshotCategory) {
  const threshold = Number(category.threshold || 0);

  if (category.key === "liquids") {
    return [
      `За каждую ${threshold}-ую купленную`,
      "жидкость/снюс вы получите",
      "скидку на товар",
    ];
  }

  if (category.key === "disposables") {
    return [`За каждую ${threshold}-ую купленную одноразку`, "вы получите скидку на товар"];
  }

  if (category.key === "devices") {
    return [`За каждое ${threshold}-ое купленное устройство`, "вы получите скидку на товар"];
  }

  return [
    `За каждые ${threshold} покупок в категории`,
    `${loyaltyCategoryLabel(category).toLowerCase()} вы получите`,
    "скидку на товар",
  ];
}

function openRulesModal() {
  showRulesModal.value = true;
}

function closeRulesModal() {
  showRulesModal.value = false;
}

async function goShopping() {
  showRulesModal.value = false;

  if (router.currentRoute.value.name !== "home") {
    await router.push({ name: "home" });
  }
}
</script>

<style scoped>
.profile-page {
  min-height: 100vh;
  background: #f5f7fa;
  padding-bottom: 24px;
}

.profile-container {
  width: min(393px, 100%);
  margin: 0 auto;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-sizing: border-box;
}

.user-card {
  background: #ffffff;
  border-radius: 24px;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  box-shadow: 0 10px 24px rgba(25, 25, 25, 0.06);
}

.user-avatar-wrap {
  flex-shrink: 0;
}

.user-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
}

.user-avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border: 1px solid #e6e9ed;
}

.user-info {
  min-width: 0;
}

.user-name {
  margin: 0 0 4px;
  font-family: "Montserrat", sans-serif;
  font-weight: 700;
  font-size: 20px;
  line-height: 24px;
  color: #191919;
}

.user-username {
  margin: 0;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 14px;
  line-height: 17px;
  color: #aab2bd;
}

.user-username--missing {
  color: #dc2626;
}

.loyalty-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.loyalty-card {
  position: relative;
  overflow: hidden;
  height: 231px;
  display: flex;
  flex-direction: column;
  padding: 24px 24px 45px;
  border-radius: 24px;
  background: linear-gradient(106.76deg, #f50302 -2.64%, #a90f0e 85.78%);
  box-shadow: 0 8px 16px rgba(97, 1, 0, 0.16);
}

.loyalty-card--empty {
  justify-content: space-between;
}

.loyalty-card-header,
.loyalty-tabs,
.loyalty-progress-row,
.loyalty-copy-row,
.loyalty-rules-link,
.loyalty-empty-copy {
  position: relative;
  z-index: 1;
}

.loyalty-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.loyalty-card-title-main {
  margin: 0;
  font-family: "Montserrat", sans-serif;
  font-weight: 700;
  font-size: 20px;
  line-height: 24px;
  color: #ffffff;
}

.loyalty-loading {
  margin: 2px 0 0;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 12px;
  line-height: 14px;
  color: rgba(255, 255, 255, 0.88);
  white-space: nowrap;
}

.loyalty-tabs {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 9px;
  flex-wrap: nowrap;
}

.loyalty-tab {
  flex: 1 1 0;
  min-width: 0;
  min-height: 33px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  padding: 8px 10px;
  border-radius: 123px;
  background: transparent;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 17px;
  color: #ffffff;
  text-align: center;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}

.loyalty-tab--active {
  background: #ffffff;
  color: #191919;
}

.loyalty-progress-row {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 15px;
}

.loyalty-progress-track {
  position: relative;
  flex: 1;
  height: 12px;
  border-radius: 123px;
  background: rgba(230, 233, 237, 0.24);
  overflow: hidden;
}

.loyalty-progress-fill {
  height: 100%;
  min-width: 0;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(255, 227, 226, 0.72) 0%, #ffffff 100%);
  transition: width 0.24s ease;
}

.loyalty-progress-value {
  min-width: 29px;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-weight: 400;
  font-size: 12px;
  line-height: 14px;
  text-align: right;
  color: #ffffff;
}

.loyalty-copy-row {
  margin-top: 12px;
}

.loyalty-copy {
  max-width: 282px;
  margin: 0;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-weight: 400;
  font-size: 14px;
  line-height: 17px;
  color: #e9bbbb;
}

.loyalty-discount {
  display: inline;
  margin-left: 6px;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 17px;
  color: #ffffff;
  white-space: nowrap;
}

.loyalty-rules-link {
  position: absolute;
  left: 24px;
  bottom: 24px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-weight: 400;
  font-size: 12px;
  line-height: 14px;
  color: #ffffff;
  cursor: pointer;
}

.loyalty-rules-link svg {
  flex-shrink: 0;
}

.loyalty-empty-copy {
  max-width: 250px;
  margin: auto 0 0;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 14px;
  line-height: 19px;
  color: rgba(255, 255, 255, 0.86);
}

.loyalty-error {
  padding: 14px 16px;
  border-radius: 18px;
  background: #fff1f2;
  color: #be123c;
  font-size: 14px;
  line-height: 18px;
}

.rules-modal-overlay {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding:
    calc(24px + env(safe-area-inset-top, 0px))
    16px
    calc(var(--app-bottom-tab-bar-height, 130px) + 24px);
  background: rgba(101, 109, 119, 0.72);
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
}

.rules-modal-enter-active,
.rules-modal-leave-active {
  transition: opacity 0.24s ease;
}

.rules-modal-enter-active .rules-modal-card,
.rules-modal-leave-active .rules-modal-card {
  transition:
    opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.rules-modal-enter-from,
.rules-modal-leave-to {
  opacity: 0;
}

.rules-modal-enter-from .rules-modal-card,
.rules-modal-leave-to .rules-modal-card {
  opacity: 0;
  transform: translateY(18px) scale(0.985);
}

.rules-modal-card {
  width: min(361px, 100%);
  border-radius: 20px;
  background: #ffffff;
  box-sizing: border-box;
  padding: 16px;
  box-shadow: 0 24px 48px rgba(25, 25, 25, 0.12);
  transform-origin: center center;
  will-change: transform, opacity;
}

.rules-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.rules-modal-title {
  margin: 8px 0 0;
  font-family: "Montserrat", sans-serif;
  font-weight: 700;
  font-size: 20px;
  line-height: 24px;
  color: #191919;
}

.rules-modal-close {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border: none;
  border-radius: 512px;
  background: #f5f7fa;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.rules-modal-copy {
  margin-top: 12px;
  color: #191919;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-weight: 500;
  font-size: 16px;
  line-height: 19px;
}

.rules-modal-copy p {
  margin: 0;
}

.rules-modal-copy p + p {
  margin-top: 24px;
}

.rules-modal-cta {
  margin-top: 28px;
  width: 100%;
  min-height: 64px;
  border: none;
  border-radius: 528px;
  background: linear-gradient(90deg, #f50302 0%, #a90f0e 100%);
  color: #ffffff;
  font-family: "Montserrat", sans-serif;
  font-weight: 500;
  font-size: 16px;
  line-height: 20px;
  cursor: pointer;
}

@media (max-width: 360px) {
  .profile-container {
    padding: 20px 12px;
  }

  .loyalty-card {
    padding: 20px 20px 41px;
    height: auto;
    min-height: 231px;
  }

  .loyalty-copy-row {
  }

  .loyalty-copy {
    max-width: none;
  }

  .loyalty-tabs {
    gap: 8px;
  }

  .loyalty-tab {
    padding: 8px 6px;
    font-size: 13px;
    line-height: 16px;
  }

  .loyalty-rules-link {
    left: 20px;
    bottom: 20px;
    gap: 6px;
  }

  .rules-modal-overlay {
    padding:
      calc(20px + env(safe-area-inset-top, 0px))
      12px
      calc(var(--app-bottom-tab-bar-height, 130px) + 20px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .rules-modal-enter-active,
  .rules-modal-leave-active,
  .rules-modal-enter-active .rules-modal-card,
  .rules-modal-leave-active .rules-modal-card {
    transition-duration: 0.01ms;
  }
}
</style>

