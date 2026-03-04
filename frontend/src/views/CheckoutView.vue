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
        <h1 class="checkout-title">Оформление заказа</h1>
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

        <div class="promo-card">
          <p class="promo-label">Есть промокод?</p>

          <div class="promo-input-row">
            <input
              ref="promoInputRef"
              v-model="promoCode"
              type="text"
              class="promo-input"
              placeholder="Введите промокод"
              enterkeyhint="done"
              @keydown.enter="handlePromoInputDone"
            />
          </div>

          <p v-if="promoCode.trim()" class="promo-info-text">
            Раздел с промокодами пока не работает, но скоро мы его добавим. Система промокодов уже разрабатывается и будет автоматизирована!
          </p>
        </div>

        <div v-if="promoApplied" class="summary-row">
          <span class="summary-label">Скидка</span>
          <span class="summary-discount">−8 BYN</span>
        </div>

        <div class="total-block">
          <span class="total-label">Итого</span>
          <span class="total-amount"
            >{{ formatPrice(cartStore.totalAmount) }} BYN</span
          >
        </div>

        <!-- Форма для ввода данных пользователя (показывается, если нет username в Telegram или мы вне Mini App) -->
        <div v-if="!telegramUser || !telegramUser?.username" class="user-info-card">
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
          {{ isSubmitting ? "Оформляем..." : "Оформить заказ" }}
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { useCartStore } from "@/stores/cart";
import { useCatalogStore } from "@/stores/catalog";
import { useSettingsStore } from "@/stores/settings";
import MinDeliveryBanner from "@/components/MinDeliveryBanner.vue";
import DeliveryConditionsBanner from "@/components/DeliveryConditionsBanner.vue";

const router = useRouter();
const cartStore = useCartStore();
const settingsStore = useSettingsStore();
const catalogStore = useCatalogStore();

const isItemsExpanded = ref(false);
const promoCode = ref("");
const promoApplied = ref(false);
const promoInputRef = ref<HTMLInputElement | null>(null);

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

const telegramUser = computed(() => {
  if (typeof window !== "undefined" && window.Telegram?.WebApp) {
    return window.Telegram.WebApp.initDataUnsafe?.user;
  }
  return null;
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

function toggleItemsExpanded() {
  isItemsExpanded.value = !isItemsExpanded.value;
}

function handlePromoInputDone() {
  // Скрываем клавиатуру на iOS при нажатии Enter/Done
  promoInputRef.value?.blur();
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

function applyPromoCode() {
  if (promoCode.value.trim()) {
    promoApplied.value = true;
  }
}

function cancelPromoCode() {
  promoApplied.value = false;
  promoCode.value = "";
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
  const user = telegramUser.value;
  if (user?.username) {
    form.telegramUsername = user.username;
  }
});

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
  // Скрываем клавиатуру перед отправкой
  blurActiveInput();
  
  const validationResult = validateForm();
  if (!validationResult) return;

  submitError.value = "";
  isSubmitting.value = true;

  try {
    const user = telegramUser.value;
    const cleanUsername = form.telegramUsername.trim().replace(/^@/, "");

    const orderData = {
      telegram_id: user?.id ? String(user.id) : undefined,
      telegram_username: cleanUsername,
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
      })),
    };

    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData),
    });

    let result: any;
    try {
      result = await response.json();
    } catch {
      if (!response.ok) throw new Error("Не удалось создать заказ");
    }

    if (!response.ok) {
      if (result?.error === "min_delivery_amount_not_met") {
        showMinDeliveryBanner.value = true;
        form.deliveryType = "pickup";
        throw new Error(
          result.message || "Сумма заказа меньше минимальной для доставки",
        );
      }
      throw new Error(result?.message || "Не удалось создать заказ");
    }

    cartStore.clearCart();

    const redirectTelegram =
      settingsStore.settings.order_redirect_telegram?.trim();
    const showSuccessAlert = (message: string, callback: () => void) => {
      const tg = window.Telegram?.WebApp;
      if (
        tg &&
        typeof tg.showAlert === "function" &&
        tg.version &&
        parseFloat(tg.version) >= 6.2
      ) {
        try {
          tg.showAlert(message, callback);
        } catch {
          alert(message);
          callback();
        }
      } else {
        alert(message);
        callback();
      }
    };

    if (redirectTelegram) {
      const textTemplate =
        settingsStore.settings.order_redirect_text_template ||
        "Мой номер заказа - #{order_number}";
      const messageText = textTemplate
        .replace("{order_number}", result.order_number)
        .replace("#{order_number}", result.order_number);
      const tgLink = `https://t.me/${redirectTelegram}?text=${encodeURIComponent(messageText)}`;
      showSuccessAlert(
        "Заказ успешно оформлен! Номер заказа: " + result.order_number,
        () => {
          window.open(tgLink, "_blank");
          setTimeout(() => {
            window.location.href = "/";
          }, 100);
        },
      );
    } else {
      showSuccessAlert(
        "Заказ успешно оформлен! Номер заказа: " + result.order_number,
        () => {
          window.location.href = "/";
        },
      );
    }
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

.promo-card {
  background: #ffffff;
  border-radius: 20px;
  padding: 24px 16px;
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
