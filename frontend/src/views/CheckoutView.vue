<template>
  <div class="checkout-page" @click="handlePageClick">
    <div class="header-area">
      <div class="checkout-header">
        <button class="checkout-back-button" @click="handleBack" aria-label="Назад">
          <svg
            class="checkout-back-icon"
            width="7"
            height="12"
            viewBox="0 0 7 12"
            fill="none"
          >
            <path
              d="M6 1L1 6L6 11"
              stroke="#191919"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <h1 class="checkout-title">{{ checkoutTitle }}</h1>
        <button
          v-if="cartStore.items.length"
          @click="handleClearCart"
          class="header-trash-btn"
          aria-label="Очистить корзину"
        >
          <svg width="18" height="20" viewBox="0 0 18 20" fill="none">
            <path
              d="M1 5H17M15 5V17C15 18 14 19 13 19H5C4 19 3 18 3 17V5M6 5V3C6 2 7 1 8 1H10C11 1 12 2 12 3V5"
              stroke="#AAB2BD"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>

    <div class="checkout-container">
      <div v-if="!cartStore.items.length" class="empty-cart">
        <div class="empty-cart-icon">🛒</div>
        <p>Корзина пуста</p>
        <button @click="handleBack" class="back-to-shop-btn">
          Вернуться к покупкам
        </button>
      </div>

      <div v-else class="checkout-content">
        <div class="cart-card">
          <div class="cart-items">
            <TransitionGroup name="list" tag="div">
              <div
                v-for="(item, index) in displayedItems"
                :key="item.productId + (item.variantId || '')"
                class="cart-item"
                :class="{
                  'cart-item-border': index < displayedItems.length - 1,
                }"
              >
                <div class="cart-item-image-wrap">
                  <div class="cart-item-image">
                    <img
                      v-if="item.image"
                      :src="item.image"
                      :alt="item.title"
                    />
                    <div v-else class="cart-item-placeholder">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#ccc"
                        stroke-width="1.5"
                      >
                        <rect
                          x="3"
                          y="3"
                          width="18"
                          height="18"
                          rx="2"
                          ry="2"
                        />
                      </svg>
                    </div>
                  </div>
                  <span v-if="isIceProduct(item)" class="ice-badge">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M5 0.5V9.5M0.5 5H9.5M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5"
                        stroke="white"
                        stroke-width="1.4"
                        stroke-linecap="round"
                      />
                    </svg>
                  </span>
                </div>

                <div class="cart-item-info">
                  <p v-if="item.groupName" class="cart-item-group">
                    {{ item.groupName }}
                  </p>
                  <h3 class="cart-item-title">
                    {{ item.title }}
                  </h3>
                  <p class="cart-item-meta" v-if="item.variantName">
                    {{ item.variantName }}
                  </p>
                  <p v-if="getItemMetaText(item)" class="cart-item-meta cart-item-meta-info">
                    {{ getItemMetaText(item) }}
                  </p>

                  <!-- <div class="item-badge-new">
                    <svg width="7" height="10" viewBox="0 0 7 10" fill="white">
                      <path d="M4.5 0L0 5.5H3L2.5 10L7 4.5H4L4.5 0Z" />
                    </svg>
                    <span>Новинка</span>
                  </div> -->

                  <p class="cart-item-price">
                    {{ formatPrice(item.priceRub * item.quantity) }} BYN
                  </p>
                </div>

                <div class="cart-item-controls">
                  <button
                    @click="incrementQuantity(item.productId, item.variantId)"
                    class="qty-btn"
                    :class="{ 'qty-btn-disabled': !canIncrement(item) }"
                    :disabled="!canIncrement(item)"
                    aria-label="Увеличить количество"
                  >
                    <span>+</span>
                  </button>
                  <div class="qty-value">
                    <span>{{ item.quantity }}</span>
                  </div>
                  <button
                    @click="decrementQuantity(item.productId, item.variantId)"
                    class="qty-btn"
                    aria-label="Уменьшить количество"
                  >
                    <span>−</span>
                  </button>
                </div>
              </div>
            </TransitionGroup>
          </div>
        </div>

        <button
          v-if="cartStore.items.length > 1"
          @click="toggleItemsExpanded"
          class="toggle-items-btn"
        >
          <span>{{
            isItemsExpanded ? "Скрыть товары" : "Показать товары"
          }}</span>
          <span class="toggle-count">{{ cartStore.items.length }}</span>
        </button>

        <div v-if="isEditingOrder" class="editing-order-card">
          <p class="editing-order-kicker">Редактирование заказа</p>
          <p class="editing-order-title">
            Заказ №{{ editingOrderDetails?.order_number || cartStore.editingOrderId }}
          </p>
          <p class="editing-order-text">
            После сохранения заказ снова попадет в новые, а менеджер увидит, что состав изменился.
          </p>
        </div>

        <div class="promo-card" :class="{ 'promo-card-applied': promoResult, 'promo-card-error': promoError }">
          <p class="promo-label">Есть промокод?</p>

          <div v-if="!promoResult" class="promo-input-row">
            <input
              ref="promoInputRef"
              v-model="promoCode"
              type="text"
              class="promo-input"
              placeholder="Введите промокод"
              enterkeyhint="done"
              :disabled="promoValidating"
              @keydown.enter="handlePromoApply"
              @input="promoError = ''"
            />
            <button
              class="promo-apply-btn"
              :disabled="!promoCode.trim() || promoValidating"
              @click="handlePromoApply"
            >
              {{ promoValidating ? '...' : 'Применить' }}
            </button>
          </div>

          <div v-else class="promo-applied-row">
            <div class="promo-applied-info">
              <span class="promo-input-label">Промокод</span>
              <div class="promo-code-display">
                <span class="promo-code-text">{{ promoCode.toUpperCase() }}</span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7L5.5 10.5L12 3.5" stroke="#34c759" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
            <button class="promo-cancel-btn" @click="handlePromoClear">Убрать</button>
          </div>

          <p v-if="promoError" class="promo-error-text">{{ promoError }}</p>

          <p v-if="promoResult" class="promo-discount-text">
            Скидка: -{{ formatPrice(promoResult.calculated_discount) }} BYN
            <template v-if="promoResult.description"> - {{ promoResult.description }}</template>
          </p>
        </div>

        <div v-if="promoResult" class="summary-row">
          <span class="summary-label">Скидка по промокоду</span>
          <span class="summary-discount">-{{ formatPrice(promoResult.calculated_discount) }} BYN</span>
        </div>

        <section v-if="selectedCheckoutLoyaltyCategory" class="loyalty-section">
          <article class="loyalty-card loyalty-card--checkout">
            <div class="loyalty-card-header">
              <h2 class="loyalty-card-title-main">Бонусная система</h2>
            </div>

            <div class="loyalty-tabs" role="tablist" aria-label="Категории бонусов">
              <button
                v-for="tabCategory in orderedCheckoutLoyaltyCategories"
                :key="tabCategory.category_id"
                type="button"
                class="loyalty-tab"
                :class="{ 'loyalty-tab--active': tabCategory.category_key === activeCheckoutLoyaltyKey }"
                @click="activeCheckoutLoyaltyKey = tabCategory.category_key"
              >
                {{ checkoutLoyaltyCategoryLabel(tabCategory) }}
              </button>
            </div>

            <div class="loyalty-progress-row">
              <div class="loyalty-progress-track">
                <div
                  class="loyalty-progress-fill"
                  :style="{ width: `${checkoutProgressPercent(selectedCheckoutLoyaltyCategory)}%` }"
                ></div>
              </div>
              <span class="loyalty-progress-value">
                {{ checkoutProgressLabel(selectedCheckoutLoyaltyCategory) }}
              </span>
            </div>

            <div class="loyalty-copy-row">
              <p class="loyalty-copy">
                <template
                  v-for="(line, index) in selectedCheckoutLoyaltyDescriptionLines"
                  :key="`${selectedCheckoutLoyaltyCategory.category_key}-${index}`"
                >
                  <span class="loyalty-copy-line">
                    {{ line }}
                    <span
                      v-if="index === selectedCheckoutLoyaltyDescriptionLines.length - 1"
                      class="loyalty-discount"
                    >
                      {{ formatPrice(selectedCheckoutLoyaltyCategory.discount_amount) }} BYN
                    </span>
                  </span>
                  <br v-if="index < selectedCheckoutLoyaltyDescriptionLines.length - 1" />
                </template>
              </p>
            </div>

            <div v-if="promoResult" class="loyalty-disabled-note">
              При активном промокоде скидки за покупки недоступны.
            </div>

            <div
              v-else-if="selectedCheckoutLoyaltyCategory.current_available_bonus_count > 0"
              class="loyalty-line-list"
            >
              <div
                v-for="line in selectedCheckoutLoyaltyCategory.line_items"
                :key="line.key"
                class="loyalty-line-item"
              >
                <div class="loyalty-line-copy">
                  <span class="loyalty-line-title">{{ line.product_title }}</span>
                  <span class="loyalty-line-meta">Макс.: {{ line.max_redeemable_units }}</span>
                </div>
                <select
                  class="loyalty-line-select"
                  :value="getItemLoyaltyUnits(line.product_id, line.variant_id)"
                  @change="handleLoyaltyUnitsChange(selectedCheckoutLoyaltyCategory, line, $event)"
                >
                  <option
                    v-for="units in loyaltyOptionsForLine(selectedCheckoutLoyaltyCategory, line)"
                    :key="`${line.key}-${units}`"
                    :value="units"
                  >
                    {{ units }} шт.
                  </option>
                </select>
              </div>
            </div>

            <p v-else class="loyalty-copy loyalty-copy--secondary">
              До скидки {{ formatPrice(selectedCheckoutLoyaltyCategory.discount_amount) }} BYN осталось
              {{ selectedCheckoutLoyaltyCategory.remaining_to_next }} покупок.
            </p>

            <button
              type="button"
              class="loyalty-rules-link loyalty-rules-link--static"
              @click="openLoyaltyRules(selectedCheckoutLoyaltyCategory.category_key)"
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
          </article>
        </section>

        <div v-if="loyaltyDiscountAmount > 0" class="summary-row">
          <span class="summary-label">Скидка за покупки</span>
          <span class="summary-discount">-{{ formatPrice(loyaltyDiscountAmount) }} BYN</span>
        </div>

        <div class="total-block">
          <span class="total-label">Итого</span>
          <span class="total-amount"
            >{{ formatPrice(finalTotal) }} BYN</span
          >
        </div>

        <!-- Вне Telegram Mini App даём ввести username вручную -->
        <div
          v-if="shouldShowManualUsernameInput"
          class="user-info-card"
        >
          <p class="user-info-label">Ваши данные</p>
          <div class="user-info-input-row">
            <input
              v-model.trim="form.telegramUsername"
              type="text"
              class="user-info-input"
              placeholder="@username"
              @input="errors.telegramUsername = ''"
            />
          </div>
          <p v-if="errors.telegramUsername" class="user-info-error">{{ errors.telegramUsername }}</p>
        </div>

        <div
          v-else-if="requiresTelegramUsername"
          class="user-info-card user-info-card-warning"
        >
          <p class="user-info-label">Нужен Telegram username</p>
          <p class="username-warning-text">
            Без username мы не сможем связаться с вами по заказу в Telegram.
          </p>
          <div class="username-warning-actions">
            <button
              type="button"
              class="username-warning-primary"
              @click="openUsernameRequiredModal"
            >
              Как поставить username
            </button>
          </div>
        </div>

        <div v-if="errors.phone" class="submit-error">{{ errors.phone }}</div>
        <div v-if="errors.address" class="submit-error">{{ errors.address }}</div>

        <button
          @click="submitOrder"
          @touchstart="handleSubmitTouchStart"
          @mousedown="handleSubmitMouseDown"
          @pointerdown="handleSubmitPointerDown"
          :disabled="isSubmitting"
          class="submit-button"
          type="button"
          style="touch-action: manipulation; -webkit-tap-highlight-color: transparent;"
        >
          {{ submitButtonLabel }}
        </button>

        <div v-if="submitError" class="submit-error">{{ submitError }}</div>
      </div>
    </div>

    <MinDeliveryBanner
      :isOpen="showMinDeliveryBanner"
      :minAmount="minDeliveryAmount"
      :currentAmount="cartStore.totalAmount"
      :bannerImage="settingsStore.settings.min_delivery_banner_image"
      :buttonText="settingsStore.settings.min_delivery_banner_button_text"
      :buttonColor="settingsStore.settings.min_delivery_banner_button_color"
      @close="showMinDeliveryBanner = false"
    />

    <DeliveryConditionsBanner
      :isOpen="showDeliveryConditionsBanner"
      :image="settingsStore.settings.delivery_conditions_image"
      @close="showDeliveryConditionsBanner = false"
    />

    <CustomerModalShell
      :open="showUsernameRequiredModal"
      title="Нужен Telegram username"
      close-label="Закрыть окно"
      @close="closeUsernameRequiredModal"
    >
      <div class="checkout-modal-copy">
        <p>Без username оформление заказа недоступно.</p>
        <ol class="checkout-modal-list">
          <li>Зайдите в настройки профиля Telegram.</li>
          <li>Найдите поле «@Имя Пользователя» и установите его.</li>
          <li>Вернитесь сюда и нажмите «Закрыть и перезайти».</li>
        </ol>
      </div>
      <template #footer>
        <button
          type="button"
          class="checkout-modal-cta"
          @click="closeMiniApp"
        >
          Закрыть и перезайти
        </button>
      </template>
    </CustomerModalShell>

    <CustomerModalShell
      :open="Boolean(activeLoyaltyRulesCategory)"
      title="Как работают скидки"
      close-label="Закрыть окно"
      @close="activeLoyaltyRulesCategory = null"
    >
      <div v-if="activeLoyaltyRulesCategory" class="checkout-modal-copy">
        <p>{{ loyaltyRulesDescription(activeLoyaltyRulesCategory) }}</p>
        <p>{{ loyaltyRulesHeadline(activeLoyaltyRulesCategory) }}</p>
        <p>За товары, купленные по промокоду, бонусу или ручной скидке, отметки не начисляются.</p>
        <p>Если username изменится, накопленные покупки сбросятся.</p>
      </div>
      <template #footer>
        <button
          type="button"
          class="checkout-modal-cta"
          @click="activeLoyaltyRulesCategory = null"
        >
          Понятно
        </button>
      </template>
    </CustomerModalShell>

    <LoyaltyBonusPopup
      :open="showLoyaltyPopup"
      :categories="loyaltyStore.availableCategories"
      @close="showLoyaltyPopup = false"
      @open-profile="openProfileFromLoyaltyPopup"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { useCartStore } from "@/stores/cart";
import { useCatalogStore } from "@/stores/catalog";
import {
  useLoyaltyStore,
  type LoyaltyPreviewCategory,
  type LoyaltyPreviewLineItem,
  type LoyaltySnapshotCategory,
} from "@/stores/loyalty";
import { useSettingsStore } from "@/stores/settings";
import MinDeliveryBanner from "@/components/MinDeliveryBanner.vue";
import DeliveryConditionsBanner from "@/components/DeliveryConditionsBanner.vue";
import CustomerModalShell from "@/components/CustomerModalShell.vue";
import LoyaltyBonusPopup from "@/components/LoyaltyBonusPopup.vue";
import {
  fetchMyActiveOrder,
  getTelegramIdentity,
  type CustomerActiveOrder,
} from "@/utils/customerOrders";
import { withTelegramAuthHeaders } from "@/utils/telegramAuth";

interface TelegramMiniAppUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code: string;
  is_premium?: boolean;
}

const router = useRouter();
const cartStore = useCartStore();
const settingsStore = useSettingsStore();
const catalogStore = useCatalogStore();
const loyaltyStore = useLoyaltyStore();
const activeCheckoutLoyaltyKey = ref<string | null>(null);

const LOYALTY_CATEGORY_ORDER = ["liquids", "disposables", "devices"];
const LOYALTY_CATEGORY_LABELS: Record<string, string> = {
  liquids: "Жидкости",
  disposables: "Одноразки",
  devices: "Устройства",
};

const isItemsExpanded = ref(false);
const promoCode = ref("");
const promoValidating = ref(false);
const promoResult = ref<{
  discount_type: 'fixed' | 'percent';
  discount_value: number;
  calculated_discount: number;
  description?: string;
} | null>(null);
const promoError = ref("");
const promoInputRef = ref<HTMLInputElement | null>(null);
const telegramUser = ref<TelegramMiniAppUser | null>(null);
const showUsernameRequiredModal = ref(false);
const telegramUsernameVerified = ref(false);
const detectedTelegramUsername = ref("");
const verifiedTelegramUsername = ref("");

const form = reactive({
  deliveryType: "pickup" as "pickup" | "delivery",
  telegramUsername: "",
  phone: "",
  address: "",
  notes: "",
});

const errors = reactive({
  telegramUsername: "",
  phone: "",
  address: "",
});

const isSubmitting = ref(false);
const submitError = ref("");
const stockLimits = ref<Map<string, number>>(new Map());
const stockLoading = ref(false);
const showMinDeliveryBanner = ref(false);
const showDeliveryConditionsBanner = ref(false);
const deliveryConditionsShown = ref(false);
const editingOrderDetails = ref<CustomerActiveOrder | null>(null);
const activeLoyaltyRulesCategory = ref<LoyaltySnapshotCategory | null>(null);
const showLoyaltyPopup = ref(false);

const orderedCheckoutLoyaltyCategories = computed(() => {
  return [...loyaltyStore.previewCategories].sort((left, right) => {
    const leftIndex = LOYALTY_CATEGORY_ORDER.indexOf(left.category_key);
    const rightIndex = LOYALTY_CATEGORY_ORDER.indexOf(right.category_key);
    const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;

    if (normalizedLeft !== normalizedRight) {
      return normalizedLeft - normalizedRight;
    }

    return left.title.localeCompare(right.title, "ru");
  });
});

const selectedCheckoutLoyaltyCategory = computed(() => {
  if (!orderedCheckoutLoyaltyCategories.value.length) {
    return null;
  }

  return (
    orderedCheckoutLoyaltyCategories.value.find(
      (category) => category.category_key === activeCheckoutLoyaltyKey.value,
    ) || orderedCheckoutLoyaltyCategories.value[0]
  );
});

const selectedCheckoutLoyaltyDescriptionLines = computed(() => {
  if (!selectedCheckoutLoyaltyCategory.value) {
    return [];
  }

  return checkoutLoyaltyDescriptionLines(selectedCheckoutLoyaltyCategory.value);
});

const isEditingOrder = computed(() => Boolean(cartStore.editingOrderId));
const checkoutTitle = computed(() =>
  isEditingOrder.value ? "Изменение заказа" : "Оформление заказа",
);
const submitButtonLabel = computed(() => {
  if (isSubmitting.value) {
    return isEditingOrder.value ? "Сохраняем..." : "Оформляем...";
  }
  return isEditingOrder.value ? "Сохранить изменения" : "Оформить заказ";
});

const minDeliveryAmount = computed(() => {
  const val = parseFloat(settingsStore.settings.min_delivery_amount || "0");
  return isNaN(val) ? 0 : val;
});

const canUseDelivery = computed(() => {
  return (
    minDeliveryAmount.value <= 0 ||
    cartStore.totalAmount >= minDeliveryAmount.value
  );
});

const isTelegramMiniApp = computed(() => {
  return typeof window !== "undefined" && Boolean(window.Telegram?.WebApp);
});

const requiresTelegramUsername = computed(() => {
  return isTelegramMiniApp.value && !verifiedTelegramUsername.value;
});

const shouldShowManualUsernameInput = computed(() => {
  return !isTelegramMiniApp.value;
});

const displayedItems = computed(() => {
  if (isItemsExpanded.value || cartStore.items.length <= 1) {
    return cartStore.items;
  }
  return cartStore.items.slice(0, 1);
});

const groupMetaMap = computed(() => {
  const map = new Map<string, string>();
  for (const category of catalogStore.categories) {
    for (const group of category.groups || []) {
      const label = (group.metaLabel ?? "").trim();
      const value = (group.metaValue ?? "").trim();
      const text = label && value ? `${label} ${value}` : (label || value);
      if (text) {
        map.set(group.id, text);
      }
    }
  }
  return map;
});

function getItemMetaText(item: (typeof cartStore.items)[0]): string | null {
  if (!item.groupId) return null;
  return groupMetaMap.value.get(item.groupId) || null;
}

function isIceProduct(item: (typeof cartStore.items)[0]): boolean {
  const title = (item.title || "").toLowerCase();
  const variant = (item.variantName || "").toLowerCase();
  return title.includes("ice") || variant.includes("ice");
}

const finalTotal = computed(() => {
  const base = cartStore.totalAmount;
  if (loyaltyDiscountAmount.value > 0) {
    return Math.max(base - loyaltyDiscountAmount.value, 0);
  }
  if (promoResult.value) {
    return Math.max(base - promoResult.value.calculated_discount, 0);
  }
  return base;
});

const loyaltyDiscountAmount = computed(() =>
  promoResult.value ? 0 : Number(loyaltyStore.totalLoyaltyDiscount || 0),
);

function checkoutLoyaltyCategoryLabel(category: LoyaltyPreviewCategory) {
  return LOYALTY_CATEGORY_LABELS[category.category_key] || category.title;
}

function checkoutProgressCurrentValue(category: LoyaltyPreviewCategory) {
  const threshold = Number(category.threshold || 0);
  if (!threshold) return 0;

  const remaining = Math.max(0, Number(category.remaining_to_next || 0));
  if (remaining === 0) {
    return threshold;
  }

  return Math.max(0, Math.min(threshold, threshold - remaining));
}

function checkoutProgressLabel(category: LoyaltyPreviewCategory) {
  return `${checkoutProgressCurrentValue(category)} / ${category.threshold}`;
}

function checkoutProgressPercent(category: LoyaltyPreviewCategory) {
  const threshold = Number(category.threshold || 0);
  if (!threshold) return 0;
  return Math.round((checkoutProgressCurrentValue(category) / threshold) * 100);
}

function checkoutLoyaltyDescriptionLines(category: LoyaltyPreviewCategory) {
  const threshold = Number(category.threshold || 0);

  if (category.category_key === "liquids") {
    return [
      `За каждую ${threshold}-ую купленную`,
      "жидкость/снюс вы получите",
      "скидку на товар",
    ];
  }

  if (category.category_key === "disposables") {
    return [
      `За каждую ${threshold}-ую купленную одноразку`,
      "вы получите скидку на товар",
    ];
  }

  if (category.category_key === "devices") {
    return [
      `За каждое ${threshold}-ое купленное устройство`,
      "вы получите скидку на товар",
    ];
  }

  return [
    `За каждые ${threshold} покупок в категории`,
    `${checkoutLoyaltyCategoryLabel(category).toLowerCase()} вы получите`,
    "скидку на товар",
  ];
}

function toggleItemsExpanded() {
  isItemsExpanded.value = !isItemsExpanded.value;
}

function handlePromoInputDone() {
  promoInputRef.value?.blur();
}

async function handlePromoApply() {
  const code = promoCode.value.trim();
  if (!code || promoValidating.value) return;

  promoInputRef.value?.blur();
  promoError.value = '';
  promoResult.value = null;
  promoValidating.value = true;

  try {
    const response = await fetch('/api/promo/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        order_amount: cartStore.totalAmount,
        editing_order_id: isEditingOrder.value ? cartStore.editingOrderId : undefined,
      }),
    });

    const data = await response.json();

    if (data.valid) {
      cartStore.clearLoyaltySelections();
      promoResult.value = {
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        calculated_discount: data.calculated_discount,
        description: data.description,
      };
      if (isEditingOrder.value) {
        cartStore.setEditingPromoCode(code);
      }
    } else {
      promoError.value = data.message || 'Недействительный промокод';
    }
  } catch {
    promoError.value = 'Не удалось проверить промокод';
  } finally {
    promoValidating.value = false;
    await refreshLoyaltyPreview();
  }
}

function handlePromoClear() {
  promoCode.value = '';
  promoResult.value = null;
  promoError.value = '';
  if (isEditingOrder.value) {
    cartStore.setEditingPromoCode('');
  }
  void refreshLoyaltyPreview();
}

function buildLoyaltyIdentity() {
  const user = telegramUser.value;
  return {
    telegram_id: user?.id ? String(user.id) : undefined,
    telegram_username: normalizeTelegramUsername(
      verifiedTelegramUsername.value || detectedTelegramUsername.value || form.telegramUsername,
    ) || undefined,
  };
}

async function refreshLoyaltyPreview() {
  if (!cartStore.items.length) {
    loyaltyStore.resetPreview();
    return;
  }

  try {
    await loyaltyStore.fetchCheckoutPreview({
      ...buildLoyaltyIdentity(),
      promo_code: promoResult.value ? promoCode.value.trim() : undefined,
      editing_order_id: cartStore.editingOrderId || undefined,
      items: cartStore.items.map((item) => ({
        product_id: item.productId,
        variant_id: item.variantId || null,
        product_title: item.productTitle || item.title,
        quantity: item.quantity,
        price_per_unit: item.priceRub,
        loyalty_units_applied: Number(item.loyaltyUnitsApplied || 0),
      })),
    });
  } catch (error) {
    console.warn("[Checkout] Failed to refresh loyalty preview", error);
  }
}

function getItemLoyaltyUnits(productId: string | null, variantId: string | null) {
  const item = cartStore.items.find(
    (cartItem) =>
      cartItem.productId === productId &&
      (cartItem.variantId || null) === (variantId || null),
  );
  return Math.max(0, Number(item?.loyaltyUnitsApplied || 0));
}

function loyaltyOptionsForLine(category: LoyaltyPreviewCategory, line: LoyaltyPreviewLineItem) {
  const currentUnits = getItemLoyaltyUnits(line.product_id, line.variant_id);
  const usedByOtherLines = category.line_items.reduce((sum, currentLine) => {
    if (currentLine.key === line.key) return sum;
    return sum + getItemLoyaltyUnits(currentLine.product_id, currentLine.variant_id);
  }, 0);
  const maxAllowed = Math.max(
    0,
    Math.min(
      Number(line.max_redeemable_units || 0),
      Number(category.current_available_bonus_count || 0),
      1 - usedByOtherLines + currentUnits,
    ),
  );

  return Array.from({ length: maxAllowed + 1 }, (_, index) => index);
}

function handleLoyaltyUnitsChange(
  category: LoyaltyPreviewCategory,
  line: LoyaltyPreviewLineItem,
  event: Event,
) {
  const target = event.target as HTMLSelectElement;
  const nextUnits = Number(target.value || 0);
  const maxAllowed = Math.max(...loyaltyOptionsForLine(category, line), 0);
  cartStore.setLoyaltyUnits(
    String(line.product_id || ""),
    Math.min(maxAllowed, Math.max(0, nextUnits)),
    line.variant_id || null,
  );
}

function openLoyaltyRules(categoryKey: string) {
  activeLoyaltyRulesCategory.value =
    loyaltyStore.snapshot.find((category) => category.key === categoryKey) || null;
}

function loyaltyRulesHeadline(category: LoyaltySnapshotCategory) {
  return `Одна купленная позиция в категории = одна отметка. Если в одном заказе несколько товаров этой категории, отметки начисляются за каждую позицию. За каждые ${category.threshold} купленных позиций можно применить скидку ${formatPrice(category.discount_amount)} BYN к одной позиции этой категории. В одном заказе можно применить по одной бонусной скидке на каждую бонусную категорию.`;
}

function loyaltyRulesDescription(category: LoyaltySnapshotCategory) {
  return `${category.title}: скидка действует только на товары этой категории.`;
}

async function openProfileFromLoyaltyPopup() {
  showLoyaltyPopup.value = false;
  await router.push("/profile");
}

function blurActiveInput() {
  // Снимаем фокус с любого активного input (скрывает клавиатуру на iOS)
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

function handlePageClick(event: MouseEvent) {
  // Скрываем клавиатуру при тапе вне input на iOS
  const target = event.target as HTMLElement;
  if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
    blurActiveInput();
  }
}

function normalizeTelegramUsername(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/^@+/, "") : "";
}

function readTelegramUser(): TelegramMiniAppUser | null {
  if (!isTelegramMiniApp.value) {
    return null;
  }
  return window.Telegram?.WebApp?.initDataUnsafe?.user ?? null;
}

function updateTelegramUserUsername(username: string) {
  const currentUser = telegramUser.value;
  if (!currentUser) {
    return;
  }

  telegramUser.value = username
    ? { ...currentUser, username }
    : { ...currentUser, username: undefined };
}

function applyDetectedUsername(username: string | null) {
  const normalizedUsername = normalizeTelegramUsername(username);
  detectedTelegramUsername.value = normalizedUsername;
  updateTelegramUserUsername(normalizedUsername);

  if (normalizedUsername) {
    form.telegramUsername = normalizedUsername;
    errors.telegramUsername = "";
  } else if (isTelegramMiniApp.value && !verifiedTelegramUsername.value) {
    form.telegramUsername = "";
  }

  return normalizedUsername;
}

function applyVerifiedUsername(username: string | null) {
  const normalizedUsername = applyDetectedUsername(username);
  verifiedTelegramUsername.value = normalizedUsername;
  telegramUsernameVerified.value = Boolean(normalizedUsername);

  if (normalizedUsername) {
    submitError.value = "";
    showUsernameRequiredModal.value = false;
  }

  return normalizedUsername;
}

function syncTelegramUserData(options: { trustCurrentUser?: boolean } = {}) {
  const { trustCurrentUser = false } = options;
  const user = readTelegramUser();
  telegramUser.value = user;

  const detectedUsername = applyDetectedUsername(user?.username ?? null);
  if (detectedUsername && trustCurrentUser) {
    applyVerifiedUsername(detectedUsername);
  }

  return { user, detectedUsername };
}

function openUsernameRequiredModal() {
  showUsernameRequiredModal.value = true;
}

function closeUsernameRequiredModal() {
  showUsernameRequiredModal.value = false;
}

function closeMiniApp() {
  // Закрываем Mini App через Telegram WebApp API
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.close) {
    tg.close();
  } else {
    // Fallback если API недоступен
    alert("Закройте магазин вручную и откройте заново");
  }
}

function cancelPromoCode() {
  handlePromoClear();
}

watch(
  () => form.deliveryType,
  (newType, oldType) => {
    if (newType === "delivery" && oldType === "pickup") {
      if (!canUseDelivery.value) {
        form.deliveryType = "pickup";
        showMinDeliveryBanner.value = true;
      } else if (
        !deliveryConditionsShown.value &&
        settingsStore.settings.delivery_conditions_image
      ) {
        setTimeout(() => {
          showDeliveryConditionsBanner.value = true;
          deliveryConditionsShown.value = true;
        }, 1000);
      }
    }
  },
);

onMounted(async () => {
  await settingsStore.fetchSettings();
  if (!catalogStore.categories.length) {
    const hasGroupItems = cartStore.items.some((item) => item.groupId);
    if (hasGroupItems) {
      await catalogStore.fetchCategories();
    }
  }
  await fetchStockLimits();
  syncTelegramUserData({ trustCurrentUser: true });
  await hydrateEditingOrder();
  await refreshLoyaltyPreview();
  try {
    await loyaltyStore.fetchSnapshot(getTelegramIdentity());
    if (loyaltyStore.canShowAvailableBonusPopup()) {
      loyaltyStore.markPopupSeen();
      showLoyaltyPopup.value = true;
    }
  } catch (error) {
    console.warn("[Checkout] Failed to fetch loyalty snapshot", error);
  }
  if (requiresTelegramUsername.value) {
    showUsernameRequiredModal.value = true;
  }
});

watch(
  orderedCheckoutLoyaltyCategories,
  (categories) => {
    if (!categories.length) {
      activeCheckoutLoyaltyKey.value = null;
      return;
    }

    if (!categories.some((category) => category.category_key === activeCheckoutLoyaltyKey.value)) {
      activeCheckoutLoyaltyKey.value = categories[0].category_key;
    }
  },
  { immediate: true },
);

watch(
  () =>
    JSON.stringify({
      promo: promoResult.value ? promoCode.value.trim() : "",
      edit: cartStore.editingOrderId,
      username: form.telegramUsername,
      items: cartStore.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId || null,
        quantity: item.quantity,
        priceRub: item.priceRub,
        loyaltyUnitsApplied: Number(item.loyaltyUnitsApplied || 0),
      })),
    }),
  () => {
    void refreshLoyaltyPreview();
  },
);

async function hydrateEditingOrder() {
  if (!isEditingOrder.value) {
    editingOrderDetails.value = null;
    return;
  }

  try {
    const activeOrder = await fetchMyActiveOrder(getTelegramIdentity());
    if (!activeOrder || activeOrder.id !== cartStore.editingOrderId) {
      cartStore.clearOrderEdit();
      editingOrderDetails.value = null;
      return;
    }

    editingOrderDetails.value = activeOrder;
    form.deliveryType = activeOrder.delivery_type;
    form.phone = activeOrder.phone || "";
    form.address = activeOrder.delivery_address || "";
    form.notes = activeOrder.notes || "";

    const orderUsername = normalizeTelegramUsername(activeOrder.telegram_username);
    if (orderUsername && !form.telegramUsername) {
      form.telegramUsername = orderUsername;
    }

    const orderPromoCode = activeOrder.promo_code_text || cartStore.editingPromoCode;
    if (orderPromoCode) {
      promoCode.value = orderPromoCode;
      cartStore.setEditingPromoCode(orderPromoCode);
      await handlePromoApply();
    } else {
      handlePromoClear();
    }
  } catch (error) {
    console.warn("[Checkout] Failed to hydrate editing order", error);
  }
}

async function fetchStockLimits() {
  stockLoading.value = true;
  const newLimits = new Map<string, number>();
  try {
    for (const item of cartStore.items) {
      const response = await fetch(`/api/product/${item.productId}`);
      if (response.ok) {
        const product = await response.json();
        let stock: number | null = null;
        if (item.variantId && product.variants) {
          const variant = product.variants.find(
            (v: any) => v.id === item.variantId,
          );
          stock = variant?.stock ?? null;
        } else if (!product.hasVariants) {
          stock = product.stock;
        }
        const key = item.variantId
          ? `${item.productId}_${item.variantId}`
          : item.productId;
        if (stock !== null) {
          newLimits.set(key, stock);
        }
      }
    }
    stockLimits.value = newLimits;
  } catch (error) {
    console.error("[Checkout] Failed to fetch stock limits:", error);
  } finally {
    stockLoading.value = false;
  }
}

function getMaxStock(
  productId: string,
  variantId?: string | null,
): number | null {
  const key = variantId ? `${productId}_${variantId}` : productId;
  return stockLimits.value.get(key) ?? null;
}

function canIncrement(item: (typeof cartStore.items)[0]): boolean {
  const maxStock = getMaxStock(item.productId, item.variantId);
  if (maxStock === null) return true;
  return item.quantity < maxStock;
}

function formatPrice(price: number): string {
  return price.toFixed(0);
}

function handleBack() {
  showMinDeliveryBanner.value = false;
  showDeliveryConditionsBanner.value = false;
  router.push("/");
}

function handleClearCart() {
  if (confirm("Очистить корзину?")) {
    cartStore.clearCart();
  }
}

function incrementQuantity(productId: string, variantId?: string | null) {
  const item = cartStore.items.find(
    (i) =>
      i.productId === productId && (!variantId || i.variantId === variantId),
  );
  if (item && canIncrement(item)) {
    cartStore.updateQuantity(productId, item.quantity + 1, variantId);
  }
}

function decrementQuantity(productId: string, variantId?: string | null) {
  const item = cartStore.items.find(
    (i) =>
      i.productId === productId && (!variantId || i.variantId === variantId),
  );
  if (item && item.quantity > 1) {
    cartStore.updateQuantity(productId, item.quantity - 1, variantId);
  } else if (item && item.quantity === 1) {
    cartStore.removeItem(productId, variantId);
  }
}

function validateForm(): boolean {
  errors.telegramUsername = "";
  errors.phone = "";
  errors.address = "";

  if (requiresTelegramUsername.value) {
    submitError.value = "Без Telegram username оформить заказ нельзя.";
    showUsernameRequiredModal.value = true;
    return false;
  }

  if (!form.telegramUsername.trim()) {
    errors.telegramUsername = "Укажите ваш Telegram username";
    return false;
  }

  const username = form.telegramUsername.trim().replace(/^@/, "");
  if (!/^[a-zA-Z0-9_]{5,32}$/.test(username)) {
    errors.telegramUsername = "Username должен содержать от 5 до 32 символов";
    return false;
  }

  if (form.deliveryType === "delivery") {
    if (!form.phone.trim()) {
      errors.phone = "Укажите номер телефона";
      return false;
    }
    if (!form.address.trim()) {
      errors.address = "Укажите адрес доставки";
      return false;
    }
  }

  return true;
}

function handleSubmitTouchStart(event: TouchEvent) {
  event.preventDefault();
  event.stopPropagation();
  submitOrder();
}

function handleSubmitMouseDown(event: MouseEvent) {
  void event;
}

function handleSubmitPointerDown(event: PointerEvent) {
  void event;
}

async function submitOrder() {
  if (isSubmitting.value) {
    return;
  }

  // Скрываем клавиатуру перед отправкой
  blurActiveInput();
  submitError.value = "";

  // Telegram кеширует initData — если username не был при открытии,
  // его не будет до перезапуска Mini App. Показываем модалку.
  if (requiresTelegramUsername.value) {
    showUsernameRequiredModal.value = true;
    return;
  }

  const validationResult = validateForm();
  if (!validationResult) return;

  isSubmitting.value = true;

  try {
    const user = telegramUser.value;
    const cleanUsername = normalizeTelegramUsername(
      verifiedTelegramUsername.value || detectedTelegramUsername.value || form.telegramUsername,
    );

    const orderData = {
      telegram_id: user?.id ? String(user.id) : undefined,
      telegram_username: cleanUsername,
      telegram_username_verified: user?.id ? telegramUsernameVerified.value : true,
      first_name: user?.first_name || undefined,
      last_name: user?.last_name || undefined,
      delivery_type: form.deliveryType,
      delivery_address:
        form.deliveryType === "delivery" ? form.address : undefined,
      phone: form.deliveryType === "delivery" ? form.phone : undefined,
      notes: form.notes || undefined,
      promo_code: promoCode.value || undefined,
      items: cartStore.items.map((item) => ({
        product_id: item.productId,
        variant_id: item.variantId || null,
        quantity: item.quantity,
        price_per_unit: item.priceRub,
        product_title: item.productTitle || item.title,
        variant_name: item.variantName || null,
        loyalty_units_applied: Number(item.loyaltyUnitsApplied || 0),
      })),
    };

    const response = await fetch(
      isEditingOrder.value && cartStore.editingOrderId
        ? `/api/orders/${cartStore.editingOrderId}/modify-by-customer`
        : "/api/orders",
      {
      method: isEditingOrder.value ? "PUT" : "POST",
      headers: withTelegramAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(orderData),
    });

    let result: any;
    try {
      result = await response.json();
    } catch {
      if (!response.ok) throw new Error("Не удалось создать заказ");
    }

    if (!response.ok) {
      if (result?.error === "active_order_exists") {
        await router.push("/my-order");
        return;
      }
      if (result?.error === "min_delivery_amount_not_met") {
        showMinDeliveryBanner.value = true;
        form.deliveryType = "pickup";
        throw new Error(
          result.message || "Сумма заказа меньше минимальной для доставки",
        );
      }
      if (isEditingOrder.value && result?.error === "not_found") {
        cartStore.clearOrderEdit();
        await router.push("/my-order");
        return;
      }
      if (
        result?.error === "promo_and_loyalty_conflict" ||
        result?.error === "loyalty_balance_not_enough" ||
        result?.error === "loyalty_category_not_available"
      ) {
        throw new Error("Не удалось применить скидку за покупки. Обновите корзину и попробуйте снова.");
      }
      throw new Error(result?.message || "Не удалось создать заказ");
    }

    cartStore.clearCart();
    cartStore.finishOrderEdit();
    await router.push("/my-order");
  } catch (error: any) {
    console.error("[Checkout] Submit error", error);
    submitError.value =
      error?.message || "Не удалось оформить заказ. Попробуйте снова.";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<style scoped>
.checkout-page {
  min-height: 100vh;
  background: #f5f7fa;
  padding-bottom: 32px;
}

.header-area {
  position: sticky;
  top: 0;
  z-index: 20;
  background: #ffffff;
  backdrop-filter: blur(11.5px);
  border-radius: 0 0 24px 24px;
  padding: 0;
  margin-bottom: 16px;
  box-shadow: 0 4px 32px rgba(170, 178, 189, 0.32);
}

.checkout-header {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 16px 16px 20px 16px;
  min-height: 56px;
}

.checkout-back-button {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 50%;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.2s ease;
}

.checkout-back-button:hover {
  background: #f5f7fa;
}

.checkout-back-button:active {
  background: #e6e9ed;
}

.checkout-back-icon {
  flex-shrink: 0;
  width: 7px;
  height: 12px;
}

.checkout-title {
  font-family: "Montserrat", sans-serif;
  font-weight: 700;
  font-size: 20px;
  line-height: 24px;
  color: #191919;
  margin: 0;
}

.header-trash-btn {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
}

.checkout-container {
  padding: 0 16px;
}

.empty-cart {
  text-align: center;
  padding: 60px 20px;
  background: #ffffff;
  border-radius: 20px;
}

.empty-cart-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-cart p {
  font-size: 16px;
  color: #666;
  margin-bottom: 24px;
}

.back-to-shop-btn {
  padding: 16px 32px;
  background: linear-gradient(90deg, #f50302 0%, #a90f0e 100%);
  color: #fff;
  border: none;
  border-radius: 528px;
  font-family: "Montserrat", sans-serif;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
}

.checkout-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cart-card {
  background: #ffffff;
  border-radius: 20px;
  overflow: hidden;
}

.cart-items {
  padding: 16px;
}

.cart-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding-bottom: 16px;
}

.cart-item-border {
  border-bottom: 1px solid #e6e9ed;
  margin-bottom: 16px;
}

.cart-item-image-wrap {
  position: relative;
  flex-shrink: 0;
}

.cart-item-image {
  width: 88px;
  height: 104px;
  border: 1px solid #e6e9ed;
  border-radius: 16px;
  overflow: hidden;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cart-item-image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.cart-item-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.ice-badge {
  position: absolute;
  bottom: 0px;
  right: 0px;
  width: 24px;
  height: 24px;
  background: linear-gradient(90deg, #09b5fd 0%, #00499f 100%);
  box-shadow: 0px 4px 24px rgba(0, 73, 159, 0.12);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.cart-item-info {
  flex: 1;
  min-width: 0;
}

.cart-item-group {
  font-family: "Montserrat", sans-serif;
  font-weight: 600;
  font-size: 12px;
  line-height: 16px;
  color: #2563eb;
  margin: 0 0 2px;
}

.cart-item-title {
  font-family: "Montserrat", sans-serif;
  font-weight: 700;
  font-size: 16px;
  line-height: 20px;
  color: #191919;
  margin: 0 0 4px;
}

.cart-item-meta {
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-weight: 400;
  font-size: 14px;
  line-height: 17px;
  color: #aab2bd;
  margin: 0 0 8px;
}

.cart-item-meta-info {
  font-weight: 500;
  font-size: 16.8px;
  line-height: 20.2px;
}

.item-badge-new {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: linear-gradient(90deg, #f50302 0%, #a90f0e 100%);
  border-radius: 23px;
  margin-bottom: 8px;
}

.item-badge-new span {
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-weight: 500;
  font-size: 10px;
  line-height: 12px;
  text-transform: uppercase;
  color: #ffffff;
}

.cart-item-price {
  font-family: "Montserrat", sans-serif;
  font-weight: 700;
  font-size: 20px;
  line-height: 24px;
  color: #191919;
  margin: 0;
}

.cart-item-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.qty-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border: none;
  border-radius: 512px;
  cursor: pointer;
  transition: background 0.15s;
}

.qty-btn:hover:not(:disabled) {
  background: #e6e9ed;
}

.qty-btn-disabled,
.qty-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.qty-btn span {
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-weight: 500;
  font-size: 16px;
  line-height: 19px;
  color: #191919;
}

.qty-value {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  border: 1px solid #e6e9ed;
  border-radius: 12px;
}

.qty-value span {
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-weight: 500;
  font-size: 16px;
  line-height: 19px;
  color: #191919;
}

.toggle-items-btn {
  width: 100%;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: #ffffff;
  border: 1px solid #e6e9ed;
  border-radius: 528px;
  cursor: pointer;
}

.toggle-items-btn:hover {
  background: #fafafa;
}

.toggle-items-btn span:first-child {
  font-family: "Montserrat", sans-serif;
  font-weight: 500;
  font-size: 16px;
  line-height: 20px;
  color: #191919;
}

.toggle-count {
  font-family: "Montserrat", sans-serif;
  font-weight: 500;
  font-size: 16px;
  line-height: 20px;
  color: #aab2be;
}

.editing-order-card {
  background: linear-gradient(145deg, #191919 0%, #363636 100%);
  border-radius: 20px;
  padding: 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #ffffff;
}

.editing-order-kicker {
  margin: 0;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 12px;
  line-height: 14px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.58);
}

.editing-order-title {
  margin: 0;
  font-family: "Montserrat", sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 22px;
}

.editing-order-text {
  margin: 0;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 14px;
  line-height: 19px;
  color: rgba(255, 255, 255, 0.78);
}

.promo-card {
  background: #ffffff;
  border-radius: 20px;
  padding: 24px 16px;
  transition: border-color 0.2s ease;
  border: 1px solid transparent;
}

.promo-card-applied {
  border-color: #34c759;
}

.promo-card-error {
  border-color: #dc2626;
}

.promo-error-text {
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-weight: 400;
  font-size: 14px;
  line-height: 18px;
  color: #dc2626;
  margin: 12px 0 0;
}

.promo-label {
  font-family: "Montserrat", sans-serif;
  font-weight: 700;
  font-size: 16px;
  line-height: 20px;
  color: #191919;
  margin: 0 0 16px;
}

.promo-info-text {
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-weight: 400;
  font-size: 14px;
  line-height: 18px;
  color: #aab2bd;
  margin: 12px 0 0;
}

.promo-input-row {
  display: flex;
  align-items: center;
  background: #ffffff;
  border: 1px solid #e6e9ed;
  border-radius: 16px;
  height: 64px;
  padding: 0 10px 0 16px;
  box-sizing: border-box;
  overflow: hidden;
}

.promo-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-weight: 400;
  font-size: 16px;
  line-height: 19px;
  color: #191919;
  background: transparent;
}

.promo-input::placeholder {
  color: #aab2bd;
}

.promo-apply-btn {
  width: 112px;
  height: 44px;
  padding: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  background: linear-gradient(98.83deg, #f50302 0%, #c20b0c 119.75%);
  border: none;
  border-radius: 528px;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-weight: 400;
  font-size: 14px;
  line-height: 17px;
  color: #f5f7fa;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}

.promo-apply-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.promo-apply-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.promo-applied-row {
  display: flex;
  align-items: center;
  background: #ffffff;
  border: 1px solid #e6e9ed;
  border-radius: 16px;
  height: 64px;
  padding-left: 16px;
}

.promo-applied-info {
  flex: 1;
}

.promo-input-label {
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-weight: 400;
  font-size: 12px;
  line-height: 14px;
  color: #aab2bd;
  display: block;
}

.promo-code-display {
  display: flex;
  align-items: center;
  gap: 6px;
}

.promo-code-text {
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-weight: 500;
  font-size: 16px;
  line-height: 19px;
  color: #34c759;
}

.promo-cancel-btn {
  margin: 10px;
  padding: 0 20px;
  height: 44px;
  background: #e6e9ed;
  border: none;
  border-radius: 528px;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 17px;
  color: #191919;
  cursor: pointer;
  white-space: nowrap;
}

.promo-discount-text {
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-weight: 400;
  font-size: 12px;
  line-height: 14px;
  color: #34c759;
  margin: 12px 0 0;
}

.loyalty-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 14px;
}

.loyalty-card {
  position: relative;
  overflow: hidden;
  padding: 22px 24px 20px;
  border-radius: 32px;
  background: linear-gradient(106.76deg, #f50302 -2.64%, #a90f0e 85.78%);
  color: #ffffff;
  box-shadow: 0 8px 16px rgba(97, 1, 0, 0.16);
}

.loyalty-card--checkout {
  min-height: 0;
}

.loyalty-card-header,
.loyalty-tabs,
.loyalty-progress-row,
.loyalty-copy-row,
.loyalty-rules-link,
.loyalty-cart-meta,
.loyalty-disabled-note,
.loyalty-line-list {
  position: relative;
  z-index: 1;
}

.loyalty-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
}

.loyalty-card-title-main {
  margin: 0;
  font-family: "Montserrat", sans-serif;
  font-weight: 700;
  font-size: 20px;
  line-height: 24px;
  color: #ffffff;
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
  margin-top: 16px;
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

.loyalty-copy-line {
  display: inline;
}

.loyalty-copy--secondary {
  margin-top: 14px;
  color: rgba(255, 255, 255, 0.88);
}

.loyalty-discount {
  display: inline;
  margin-left: 6px;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
}

.loyalty-cart-meta {
  margin: 14px 0 0;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 13px;
  line-height: 18px;
  color: rgba(255, 255, 255, 0.88);
}

.loyalty-disabled-note {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.14);
  font-size: 13px;
  line-height: 18px;
}

.loyalty-line-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
}

.loyalty-line-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.12);
}

.loyalty-line-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.loyalty-line-title {
  font-size: 14px;
  line-height: 18px;
  font-weight: 600;
}

.loyalty-line-meta {
  font-size: 12px;
  line-height: 14px;
  color: rgba(255, 255, 255, 0.82);
}

.loyalty-line-select {
  min-width: 78px;
  min-height: 36px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  padding: 0 10px;
}

.loyalty-rules-link {
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-weight: 400;
  font-size: 12px;
  line-height: 14px;
  color: #ffffff;
  cursor: pointer;
}

.loyalty-rules-link--static {
  margin-top: 16px;
}

.loyalty-rules-link svg {
  flex-shrink: 0;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 0 8px;
}

.summary-label {
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 14px;
  line-height: 17px;
  color: #aab2bd;
}

.summary-discount {
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-size: 14px;
  line-height: 17px;
  color: #aab2bd;
}

.total-block {
  display: flex;
  flex-direction: column;
  gap: 0px;
  padding: 0 8px;
  margin-top: 10px;
}

.total-label {
  font-family: "Montserrat", sans-serif;
  font-weight: 700;
  font-size: 16px;
  line-height: 20px;
  color: #191919;
  margin-bottom: 4px;
}

.total-amount {
  font-family: "Montserrat", sans-serif;
  font-weight: 700;
  font-size: 24px;
  line-height: 29px;
  color: #191919;
}

.submit-button {
  width: 100%;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(90deg, #f50302 0%, #a90f0e 100%);
  border: none;
  border-radius: 528px;
  font-family: "Montserrat", sans-serif;
  font-weight: 500;
  font-size: 16px;
  line-height: 20px;
  color: #ffffff;
  cursor: pointer;
  position: relative;
  z-index: 10;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  -webkit-user-select: none;
}

.submit-button:hover:not(:disabled) {
  opacity: 0.95;
}

.submit-button:active:not(:disabled) {
  opacity: 0.9;
  transform: scale(0.98);
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
}

.submit-error {
  padding: 12px 16px;
  background: #fee2e2;
  border-radius: 12px;
  font-size: 14px;
  color: #dc2626;
  text-align: center;
}

.user-info-card {
  background: #ffffff;
  border-radius: 20px;
  padding: 24px 16px;
}

.user-info-label {
  font-family: "Montserrat", sans-serif;
  font-weight: 700;
  font-size: 16px;
  line-height: 20px;
  color: #191919;
  margin: 0 0 16px;
}

.user-info-input-row {
  display: flex;
  align-items: center;
  background: #ffffff;
  border: 1px solid #e6e9ed;
  border-radius: 16px;
  height: 64px;
  padding: 0 16px;
  box-sizing: border-box;
}

.user-info-input-row:focus-within {
  border-color: #2563eb;
  outline: 2px solid rgba(37, 99, 235, 0.1);
  outline-offset: -2px;
}

.user-info-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-weight: 400;
  font-size: 16px;
  line-height: 19px;
  color: #191919;
  background: transparent;
}

.user-info-input::placeholder {
  color: #aab2bd;
}

.user-info-error {
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-weight: 400;
  font-size: 14px;
  line-height: 18px;
  color: #dc2626;
  margin: 12px 0 0;
}

.user-info-card-warning {
  border: 1px solid #fdba74;
  background: #fff7ed;
}

.username-warning-text,
.username-modal-text,
.username-modal-hint {
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-weight: 400;
  font-size: 14px;
  line-height: 20px;
  color: #7c2d12;
  margin: 0;
}

.username-warning-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.username-warning-primary,
.username-warning-secondary {
  width: 100%;
  min-height: 52px;
  border-radius: 16px;
  padding: 14px 18px;
  font-family: "Montserrat", sans-serif;
  font-weight: 600;
  font-size: 14px;
  line-height: 18px;
  cursor: pointer;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.username-warning-primary:disabled,
.username-warning-secondary:disabled {
  opacity: 0.6;
  cursor: wait;
}

.username-warning-primary {
  border: none;
  background: linear-gradient(90deg, #f50302 0%, #a90f0e 100%);
  color: #ffffff;
}

.username-warning-secondary {
  border: 1px solid #fdba74;
  background: #ffffff;
  color: #9a3412;
}

.username-warning-primary:hover,
.username-warning-secondary:hover {
  opacity: 0.95;
}

.username-warning-primary:active,
.username-warning-secondary:active {
  transform: scale(0.99);
}

.checkout-modal-copy {
  display: flex;
  flex-direction: column;
  gap: 14px;
  color: #191919;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  font-weight: 500;
  font-size: 16px;
  line-height: 19px;
}

.checkout-modal-copy p {
  margin: 0;
}

.checkout-modal-list {
  margin: 0;
  padding-left: 20px;
}

.checkout-modal-list li + li {
  margin-top: 10px;
}

.checkout-modal-cta {
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

@media (max-width: 768px) {
  .header-area {
    border-radius: 0 0 20px 20px;
  }

  .checkout-header {
    padding: 14px 14px 18px 14px;
    min-height: 52px;
  }

  .checkout-back-button {
    left: 14px;
    width: 30px;
    height: 30px;
  }

  .header-trash-btn {
    right: 14px;
  }

  .checkout-title {
    font-size: 18px;
    line-height: 22px;
  }
}

@media (max-width: 480px) {
  .header-area {
    border-radius: 0 0 18px 18px;
  }

  .checkout-header {
    padding: 12px 12px 16px 12px;
    min-height: 48px;
  }

  .checkout-back-button {
    left: 12px;
    width: 28px;
    height: 28px;
  }

  .header-trash-btn {
    right: 12px;
  }

  .checkout-title {
    font-size: 16px;
    line-height: 20px;
  }
}

@media (max-width: 360px) {
  .checkout-container {
    padding: 0 12px;
  }

  .cart-item-image {
    width: 72px;
    height: 88px;
  }

  .cart-item-title {
    font-size: 14px;
  }

  .cart-item-price {
    font-size: 18px;
  }

  .qty-btn,
  .qty-value {
    width: 36px;
    height: 36px;
  }

  .checkout-back-button {
    left: 10px;
    width: 26px;
    height: 26px;
  }

  .checkout-back-icon {
    width: 6px;
    height: 10px;
  }

  .header-area {
    border-radius: 0 0 16px 16px;
  }

  .checkout-header {
    padding: 10px 10px 14px 10px;
    min-height: 44px;
  }

  .header-trash-btn {
    right: 10px;
  }

  .checkout-title {
    font-size: 15px;
    line-height: 18px;
  }

  .loyalty-card--checkout {
    padding: 20px 20px 16px;
  }

  .loyalty-tabs {
    gap: 8px;
  }

  .loyalty-tab {
    padding: 8px 6px;
    font-size: 13px;
    line-height: 16px;
  }
}

.fade-btn-enter-active,
.fade-btn-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.fade-btn-enter-from,
.fade-btn-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>

