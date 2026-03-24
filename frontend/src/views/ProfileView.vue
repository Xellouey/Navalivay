<template>
  <div class="profile-page">
    <div class="profile-container">
      <div class="user-card">
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
              <circle cx="12" cy="8" r="4" stroke="#aab2bd" stroke-width="1.8" />
              <path d="M4 21C4 17.134 7.58172 14 12 14C16.4183 14 20 17.134 20 21" stroke="#aab2bd" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </div>
        </div>

        <div class="user-info">
          <h2 class="user-name">
            <template v-if="userStore.isLoading">Загрузка...</template>
            <template v-else>{{ userStore.displayName }}</template>
          </h2>
          <p v-if="userStore.hasUsername" class="user-username">@{{ userStore.profile?.telegramUsername }}</p>
          <p v-else class="user-username user-username--missing">Username не установлен</p>
        </div>
      </div>

      <section class="loyalty-section">
        <div class="loyalty-section-head">
          <div>
            <p class="loyalty-kicker">Скидки за покупки</p>
            <h3 class="loyalty-title">Ваши категории бонусов</h3>
          </div>
          <p v-if="loyaltyStore.loadingSnapshot" class="loyalty-loading">Обновляем...</p>
        </div>

        <div class="loyalty-grid">
          <article
            v-for="category in loyaltyStore.snapshot"
            :key="category.id"
            class="loyalty-card"
          >
            <div class="loyalty-card-top">
              <div>
                <p class="loyalty-card-title">{{ category.title }}</p>
                <p class="loyalty-card-copy">
                  За каждые {{ category.threshold }} покупок скидка {{ category.discount_amount }} BYN
                </p>
              </div>
              <span class="loyalty-chip">{{ category.balance }} покупок</span>
            </div>

            <div class="loyalty-progress-track">
              <div class="loyalty-progress-fill" :style="{ width: `${progressPercent(category)}%` }"></div>
            </div>

            <div class="loyalty-stats">
              <span>Доступно скидок: {{ category.available_bonus_count }}</span>
              <span>До следующей: {{ category.remaining_to_next }}</span>
            </div>

            <button class="loyalty-rules-btn" @click="activeRulesKey = category.key">
              Как работают скидки за покупки?
            </button>
          </article>
        </div>

        <div v-if="loyaltyStore.snapshotError" class="loyalty-error">
          {{ loyaltyStore.snapshotError }}
        </div>
      </section>

      <section v-if="activeRulesCategory" class="rules-card">
        <p class="rules-title">Как работает {{ activeRulesCategory.title.toLowerCase() }}</p>
        <ul class="rules-list">
          <li>{{ rulesHeadline(activeRulesCategory) }}</li>
          <li>За покупку со скидкой, бонусом или промокодом покупки не начисляются.</li>
          <li>Если username сменится, накопленные покупки сбросятся.</li>
        </ul>
        <button class="rules-close" @click="activeRulesKey = null">Понятно</button>
      </section>

      <button class="channel-button" @click="openTelegramChannel">
        <span class="channel-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-16.5 7.5a2.25 2.25 0 0 0 .126 4.169l3.7 1.11a.75.75 0 0 0 .691-.137l7.955-6.364a.75.75 0 0 1 .984 1.13l-6.542 6.542a.75.75 0 0 0-.174.584l.75 4.5a2.25 2.25 0 0 0 4.088.811l2.1-3.15 3.825 2.55a2.25 2.25 0 0 0 3.469-1.394l3-13.5a2.25 2.25 0 0 0-2.45-2.566Z" fill="#aab2bd"/>
          </svg>
        </span>
        <span class="channel-text">Наш телеграм канал</span>
      </button>
    </div>

    <LoyaltyBonusPopup
      :open="showLoyaltyPopup"
      :categories="loyaltyStore.availableCategories"
      @close="showLoyaltyPopup = false"
      @open-profile="showLoyaltyPopup = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { useLoyaltyStore, type LoyaltySnapshotCategory } from '@/stores/loyalty'
import { getTelegramIdentity } from '@/utils/customerOrders'
import LoyaltyBonusPopup from '@/components/LoyaltyBonusPopup.vue'

const userStore = useUserStore()
const loyaltyStore = useLoyaltyStore()
const avatarError = ref(false)
const activeRulesKey = ref<string | null>(null)
const showLoyaltyPopup = ref(false)

const TELEGRAM_CHANNEL = 'https://t.me/navalivay_shop'

const activeRulesCategory = computed(() =>
  loyaltyStore.snapshot.find((category) => category.key === activeRulesKey.value) || null,
)

onMounted(async () => {
  await Promise.allSettled([
    userStore.fetchProfile(),
    loyaltyStore.fetchSnapshot(getTelegramIdentity()),
  ])

  if (loyaltyStore.canShowAvailableBonusPopup()) {
    loyaltyStore.markPopupSeen()
    showLoyaltyPopup.value = true
  }
})

function progressPercent(category: LoyaltySnapshotCategory) {
  if (!category.threshold) return 0
  const current = Number(category.balance || 0) % Number(category.threshold || 1)
  if (current === 0 && category.balance > 0 && category.available_bonus_count === 0) {
    return 100
  }
  return Math.min(100, Math.round((current / category.threshold) * 100))
}

function rulesHeadline(category: LoyaltySnapshotCategory) {
  return `Одна покупка в категории = одна отметка. Как только наберете ${category.threshold}, сможете применить скидку ${category.discount_amount} BYN к одной позиции этой категории.`
}

function openTelegramChannel() {
  const tg = window.Telegram?.WebApp
  if (tg?.openTelegramLink) {
    tg.openTelegramLink(TELEGRAM_CHANNEL)
  } else {
    window.open(TELEGRAM_CHANNEL, '_blank')
  }
}
</script>

<style scoped>
.profile-page {
  min-height: 100vh;
  background: #f5f7fa;
  padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px) + 16px);
}

.profile-container {
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.user-card,
.rules-card,
.channel-button {
  background: #ffffff;
  border-radius: 20px;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
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

.user-name {
  font-family: "Montserrat", sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 22px;
  color: #191919;
  margin: 0 0 4px;
}

.user-username {
  margin: 0;
  font-size: 14px;
  line-height: 17px;
  color: #aab2bd;
}

.user-username--missing {
  color: #dc2626;
  font-style: italic;
}

.loyalty-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.loyalty-section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.loyalty-kicker {
  margin: 0 0 4px;
  font-size: 12px;
  line-height: 14px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #a90f0e;
  font-weight: 700;
}

.loyalty-title {
  margin: 0;
  font-family: "Montserrat", sans-serif;
  font-size: 20px;
  line-height: 24px;
  color: #191919;
}

.loyalty-loading {
  margin: 0;
  font-size: 13px;
  color: #aab2bd;
}

.loyalty-grid {
  display: grid;
  gap: 12px;
}

.loyalty-card {
  padding: 18px;
  border-radius: 20px;
  background: linear-gradient(135deg, #191919 0%, #373737 100%);
  color: #ffffff;
  box-shadow: 0 18px 42px rgba(25, 25, 25, 0.12);
}

.loyalty-card-top,
.loyalty-stats {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.loyalty-card-title {
  margin: 0 0 6px;
  font-family: "Montserrat", sans-serif;
  font-size: 18px;
  line-height: 21px;
  font-weight: 700;
}

.loyalty-card-copy {
  margin: 0;
  font-size: 13px;
  line-height: 18px;
  color: rgba(255, 255, 255, 0.72);
}

.loyalty-chip {
  padding: 8px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  font-size: 12px;
  line-height: 14px;
  white-space: nowrap;
}

.loyalty-progress-track {
  margin-top: 16px;
  height: 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  overflow: hidden;
}

.loyalty-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #f50302 0%, #ff8a00 100%);
}

.loyalty-stats {
  margin-top: 12px;
  font-size: 12px;
  line-height: 16px;
  color: rgba(255, 255, 255, 0.72);
}

.loyalty-rules-btn,
.rules-close {
  margin-top: 14px;
  width: 100%;
  min-height: 44px;
  border-radius: 14px;
  border: none;
  font-family: "Montserrat", sans-serif;
  font-size: 14px;
  font-weight: 700;
}

.loyalty-rules-btn {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}

.loyalty-error {
  padding: 14px 16px;
  border-radius: 16px;
  background: #fff1f2;
  color: #be123c;
  font-size: 14px;
}

.rules-card {
  padding: 18px;
}

.rules-title {
  margin: 0 0 12px;
  font-family: "Montserrat", sans-serif;
  font-size: 18px;
  line-height: 22px;
  color: #191919;
  font-weight: 700;
}

.rules-list {
  margin: 0;
  padding-left: 20px;
  color: #5f6772;
  font-size: 14px;
  line-height: 20px;
}

.channel-button {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 18px 20px;
  border: none;
}

.channel-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border-radius: 50%;
}

.channel-text {
  font-family: "Montserrat", sans-serif;
  font-weight: 600;
  font-size: 15px;
  line-height: 18px;
  color: #191919;
}
</style>
