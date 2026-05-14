import { defineStore } from "pinia";
import { ref, computed } from "vue";

const API_BASE = "/api/admin/crm";

export interface Employee {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  position: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  telegram_id: string | null;
  telegram_username: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  first_visit_at: string;
  last_visit_at: string | null;
  last_order_at: string | null;
  total_orders: number;
  total_spent: number;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  blocked_count?: number;
  orders?: Order[];
  blocks?: CustomerBlock[];
  visitLogs?: VisitLog[];
  recent_visits?: VisitLog[];
}

export interface CustomerBlock {
  id: string;
  customer_id: string;
  block_type: string;
  reason: string | null;
  blocked_at: string;
  blocked_by: string | null;
  active: number;
}

/**
 * Активный блок реального клиента (есть в customers).
 * Возвращается из GET /api/admin/crm/blocks как `active[]`.
 */
export interface ActiveCustomerBlock {
  id: string;
  kind: "active";
  customer_id: string;
  block_until: string | null; // SQLite UTC datetime, null = бессрочно
  reason: string | null;
  blocked_at: string;
  blocked_by: string | null;
  unblocked_at: string | null;
  unblocked_by: string | null;
  unblock_reason: string | null;
  customer?: {
    telegram_id: string | null;
    telegram_username: string | null;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  };
}

/**
 * Pending-блок: превентивный бан по @username, клиент ещё не появлялся в БД.
 * Активируется автоматически при первом upsertPublicCustomer.
 */
export interface PendingCustomerBlock {
  id: number;
  kind: "pending";
  telegram_username: string;
  block_until: string | null;
  reason: string | null;
  blocked_at: string;
  blocked_by: string | null;
}

export interface CustomerBlockDuration {
  unit: "minutes" | "hours" | "days" | "forever";
  value?: number;
}

export interface CreateCustomerBlockPayload {
  customer_id?: string;
  telegram_username?: string;
  reason?: string | null;
  duration: CustomerBlockDuration;
}

export interface Order {
  id: string;
  order_number: number;
  customer_id: string | null;
  employee_id: string | null;
  status: "new" | "in_progress" | "completed" | "delivered" | "cancelled";
  delivery_type: "pickup" | "delivery";
  delivery_address: string | null;
  total_amount: number;
  discount_amount: number;
  discount_percent: number;
  final_amount: number;
  profit: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  payment_type?: "cash" | "card" | null;
  payment_account_id?: string | null;
  paid_amount?: number | null;
  paid_at?: string | null;
  payment_notes?: string | null;
  telegram_username?: string;
  customer_name?: string;
  phone?: string | null;
  needs_manager_action?: number;
  manager_action_type?: 'modified' | 'cancelled_by_customer' | null;
  manager_action_note?: string | null;
  promo_code_id?: string | null;
  promo_code_text?: string | null;
  promo_has_gift?: number;
  promo_manager_description?: string | null;
  promo_customer_description?: string | null;
  is_wholesale?: number;
  wholesale_tier_id?: string | null;
  wholesale_tier_label?: string | null;
  wholesale_min_amount?: number | null;
  items?: OrderItem[];
  // Свод последней авто-отправки уведомления клиенту (sent/failed). null
  // если для этого заказа auto-notify ещё не запускался. Используется для
  // подсветки красной рамкой в карточке заказа когда сообщение не дошло.
  auto_notification?: {
    status: 'sent' | 'failed';
    error?: string | null;
    via?: string | null;
    via_attempt?: number | null;
    warn?: string | null;
  } | null;
  // true = у клиента уже были завершённые заказы (постоянный), false/undefined = первый заказ
  is_returning_customer?: boolean;
  is_blocked?: boolean;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id?: string | null;
  product_title: string;
  product_description?: string | null;
  group_name?: string | null;
  base_product_id?: string | null;
  base_product_title?: string | null;
  variant_name?: string | null;
  quantity: number;
  price_per_unit: number;
  cost_per_unit: number;
  manual_discount_amount?: number;
  loyalty_discount_amount?: number;
  loyalty_units_applied?: number;
  discount_amount: number;
  total_price: number;
  total_cost: number;
}

export interface CrmLoyaltyMapping {
  id: string;
  loyalty_category_id: string;
  category_id: string | null;
  group_id: string | null;
  created_at: string;
}

export interface CrmLoyaltyCategory {
  id: string;
  key: string;
  title: string;
  description: string | null;
  threshold: number;
  discount_amount: number;
  sort_order: number;
  active: number;
  mappings: CrmLoyaltyMapping[];
}

export interface CrmLoyaltyCustomer {
  id: string;
  telegram_username: string | null;
  first_name: string | null;
  last_name: string | null;
  last_activity_at: string | null;
  categories: Array<{
    key: string;
    balance: number;
    available_bonus_count: number;
  }>;
}

export interface CrmLoyaltyLedgerEntry {
  id: string;
  customer_id: string;
  loyalty_category_id: string;
  order_id: string | null;
  order_item_id: string | null;
  delta: number;
  balance_after: number;
  reason: string;
  created_at: string;
  category_key: string;
  category_title: string;
}

export interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  customer_description?: string | null;
  manager_description?: string | null;
  has_gift?: number;
  discount_type: 'fixed' | 'percent';
  discount_value: number;
  min_order_amount: number;
  max_uses: number;
  current_uses: number;
  valid_from_date?: string | null;
  duration_days?: number | null;
  effective_valid_until_date?: string | null;
  valid_from: string | null;
  valid_until: string | null;
  active: number;
  created_at: string;
}

export interface PromoUsage {
  id: string;
  promo_code_id: string;
  order_id: string;
  customer_id: string | null;
  discount_applied: number;
  used_at: string;
  order_number?: number;
  order_amount?: number;
  customer_name?: string;
  telegram_username?: string;
}

export interface Procurement {
  id: string;
  procurement_number: number;
  employee_id: string | null;
  supplier_name: string | null;
  total_amount: number;
  status: "draft" | "completed";
  notes: string | null;
  created_at: string;
  completed_at: string | null;
  employee_name?: string;
  expense_transaction_id?: string | null;
  items?: ProcurementItem[];
}

export interface ProcurementItem {
  id: string;
  procurement_id: string;
  product_id: string;
  product_title: string;
  product_image?: string | null;
  group_name?: string | null;
  variant_id?: string | null;
  variant_name?: string | null;
  variant_stock?: number | null;
  quantity: number;
  cost_per_unit: number;
  total_cost: number;
  stock?: number;
  min_stock?: number;
}

export interface WriteOff {
  id: string;
  writeoff_number: number;
  employee_id: string | null;
  reason: string;
  notes: string | null;
  created_at: string;
  employee_name?: string;
  items?: WriteOffItem[];
}

export interface WriteOffItem {
  id: string;
  writeoff_id: string;
  product_id: string;
  variant_id?: string | null;
  product_title: string;
  group_name?: string | null;
  variant_name?: string | null;
  quantity: number;
  cost_per_unit: number;
  total_cost: number;
  stock?: number;
}

export interface CrmProductSummary {
  id: string;
  productId?: string; // Для вариантов - ID базового товара
  title: string;
  description?: string | null; // Описание товара (расшифровка вкуса и т.п.)
  priceRub: number;
  costPrice: number;
  stock: number;
  minStock: number;
  categoryId: string;
  categoryName?: string | null;
  groupId?: string | null;
  groupName?: string | null;
  isVariant?: boolean; // Это вариант товара
  variantName?: string | null; // Название варианта (цвет)
  imageUrl?: string | null; // URL изображения товара или линейки
  image?: string | null; // Итоговое фото (товар > линейка > категория)
}

export interface CashAccount {
  id: string;
  name: string;
  balance: number;
  is_default: number;
  active: number;
  created_at: string;
}

export interface CashTransaction {
  id: string;
  account_id: string;
  account_name: string;
  type: "income" | "expense";
  amount: number;
  description: string | null;
  order_id: string | null;
  pos_sale_id?: string | null;
  pos_sale_number?: number | null;
  employee_id: string | null;
  employee_name: string | null;
  created_at: string;
}

export interface CashPacingMonth {
  id: string;
  month_key: string;
  title: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CashPacingItem {
  id: string;
  month_id: string;
  entry_type: "base" | "addition";
  title: string;
  quantity: number;
  cost_with_vat: number;
  markup_percent: number;
  effective_from: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  retail_unit: number;
  retail_total_precise: number;
  retail_total: number;
}

export interface CashPacingDailyFact {
  id: string;
  month_id: string;
  fact_date: string;
  actual_amount: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface CashPacingDayPlan {
  date: string;
  active_limit: number;
  recommended_amount: number;
  actual_amount: number | null;
  deviation_amount: number | null;
  cumulative_actual: number;
  remaining_after_day: number;
  has_fact: boolean;
}

export interface CashPacingSummary {
  month_key: string;
  total_limit: number;
  actual_total: number;
  remaining_total: number;
  remaining_days: number;
  recommendation_date: string | null;
  recommendation_amount: number | null;
  active_limit_on_recommendation_date: number;
  days_in_month: number;
  days_with_facts: number;
  completion_percent: number;
  overrun_amount: number;
  month_status: "past" | "current" | "future";
}

export interface CashPacingMonthListItem {
  month: CashPacingMonth;
  summary: CashPacingSummary;
}

export interface CashPacingMonthDetail {
  month: CashPacingMonth;
  items: CashPacingItem[];
  daily_facts: CashPacingDailyFact[];
  daily_plan: CashPacingDayPlan[];
  summary: CashPacingSummary;
}

export interface PosSale {
  id: string;
  sale_number: number;
  transaction_id?: string | null;
  product_name: string;
  price: number;
  cost_price: number | null;
  profit: number | null;
  status: 'completed' | 'pending';
  notes: string | null;
  employee_id: string | null;
  employee_name?: string | null;
  // Привязанный клиент (после миграции add_pos_customer_link).
  // Null если чек анонимный.
  customer_id?: string | null;
  // Поля приходят из LEFT JOIN customers в GET /api/admin/pos/pending —
  // используются для отображения клиента в списке отложенных чеков.
  customer_first_name?: string | null;
  customer_last_name?: string | null;
  customer_phone?: string | null;
  customer_telegram_username?: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface VisitLog {
  id: string;
  customer_id: string | null;
  telegram_id: string | null;
  telegram_username: string | null;
  page_path: string | null;
  action: string | null;
  visited_at: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  type: string;
  active: number;
  created_at: string;
  updated_at: string | null;
}

export interface CustomerFeedback {
  id: string;
  customer_id: string;
  telegram_username: string | null;
  customer_name: string | null;
  reason: string;
  processed_at: string;
  created_at: string;
}

export interface DashboardStats {
  period: string;
  stats: {
    totalSales: number;
    revenue: number;
    profit: number;
    averageCheck: number;
    uniqueCustomers: number;
  };
  topProducts: Array<{
    group_id: string;
    group_name: string;
    cover_image: string | null;
    total_quantity: number;
    total_revenue: number;
    total_profit: number;
  }>;
  topProductsHasMore?: boolean;
  ordersByStatus: Array<{
    status: string;
    count: number;
  }>;
  deliveryStats?: {
    deliveries: number;
    profit: number;
  };
  pickupStats?: {
    pickups: number;
    profit: number;
  };
}

/**
 * Линейка с заканчивающимся остатком — для плашки в «Закупки».
 * Бэк: GET /api/admin/crm/low-stock-groups → { items, reasons }.
 *
 * Полное cover_image (может быть base64 на сотни KB) НЕ передаётся в этом
 * payload — приходит только `hasCoverImage`. Сама картинка лениво подгружается
 * в компоненте через GET /api/admin/category-groups/:id/image.
 */
export interface LowStockGroup {
  id: string;
  name: string;
  slug: string | null;
  hasCoverImage: boolean;
  threshold: number | null;
  totalStock: number;
  categoryId: string | null;
  categoryName: string | null;
}

/**
 * Причина паузы линейки — соответствует PAUSE_REASONS на бэке
 * (server/utils/low-stock-groups.js).
 */
export type LowStockPauseReason = "short" | "no_supply" | "not_produced";

export interface LowStockPauseConfig {
  label: string;
  days: number;
}

/**
 * Результат авто-отправки уведомления при смене статуса заказа.
 * Возвращается из PATCH /api/admin/crm/orders/:id рядом с обновлённым заказом.
 *  - sent=true       → клиенту улетело сообщение
 *  - sent=false + skipped=true → не отправляли намеренно (например, клиент не верифицирован)
 *  - sent=false без skipped → попытка была, но Telegram отказал
 */
export interface AutoNotificationResult {
  sent: boolean;
  skipped?: boolean;
  reason?: string;
  event?: string;
  telegram_message_id?: number | null;
}

/**
 * Маркер ошибки авторизации. Бросается из fetchAPI при 401.
 * Caller'ы могут проверить через `error instanceof UnauthorizedError`.
 * Поддерживает `cause` — присваивается вручную, потому что текущий
 * tsconfig.lib не тянет ES2022-сигнатуру конструктора Error(options).
 */
export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized", options?: { cause?: unknown }) {
    super(message);
    this.name = "UnauthorizedError";
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

// TODO: при появлении ролевой модели (manager/cashier) — рассмотреть отдельную
// обработку 403 (Forbidden). Сейчас на бэке используется только 401 для всех
// auth-сценариев, поэтому отдельная ветка не нужна.
async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(endpoint, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  // Обработка 401: реактивно сбрасываем auth-state — AdminView через
  // <CashierLockScreen v-if="!isAuthenticated"> сам перерисуется на lock-screen.
  // Никакого window.location.reload — это вызывало бесконечный цикл, когда
  // незалогиненный пользователь открывал /admin (CashierLockScreen в onMounted
  // звал защищённый /api/admin/pos/pending → 401 → reload → снова /admin → ...).
  if (response.status === 401) {
    // Динамический импорт, чтобы не создавать циклическую зависимость stores.
    try {
      const { useAdminStore } = await import("./admin");
      const adminStore = useAdminStore();
      // Идемпотентность: при N параллельных 401 не плодим лишних logout-операций
      // (важно если когда-нибудь logout станет реально асинхронным с side-effects).
      if (adminStore.isAuthenticated) {
        await adminStore.logout();
      }
    } catch (logoutError) {
      console.warn("[CRM] Failed to clear admin state on 401:", logoutError);
    }
    throw new UnauthorizedError();
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "unknown" }));
    throw new Error(error.error || error.message || "Request failed");
  }

  return response.json();
}

export const useCrmStore = defineStore("crm", () => {
  // Profit access - restore localStorage handling
  const savedProfitState =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("crm_profit_unlocked")
      : null;
  const profitUnlocked = ref(savedProfitState === "true");
  const verifyingProfitAccess = ref(false);
  const isProfitUnlocked = computed(() => profitUnlocked.value);

  function lockProfitAccess() {
    profitUnlocked.value = false;
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("crm_profit_unlocked");
    }
  }

  // ========== Global Order Notifications ==========
  const newOrdersCount = ref(0);
  const unseenOrderIds = ref<Set<string>>(new Set());
  const lastKnownOrderIds = ref<Set<string>>(new Set());
  const actionRequiredCount = ref(0);
  const unseenActionIds = ref<Set<string>>(new Set());
  const lastKnownActionIds = ref<Set<string>>(new Set());
  // In-app toast notification (fallback for Safari)
  const inAppToast = ref<{ show: boolean; message: string; count: number }>({
    show: false,
    message: "",
    count: 0,
  });
  const notificationsEnabled = ref(
    typeof localStorage !== "undefined"
      ? localStorage.getItem("crm_notifications_enabled") !== "false"
      : true
  );
  const soundEnabled = ref(
    typeof localStorage !== "undefined"
      ? localStorage.getItem("crm_sound_enabled") !== "false"
      : true
  );
  const autoRefreshEnabled = ref(true);
  let pollingTimer: ReturnType<typeof setInterval> | null = null;
  let pollingInitialized = false;
  const POLLING_INTERVAL_MS = 15000;

  function setNotificationsEnabled(enabled: boolean) {
    notificationsEnabled.value = enabled;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("crm_notifications_enabled", enabled ? "true" : "false");
    }
    if (enabled) {
      ensureNotificationPermission();
    }
  }

  function setSoundEnabled(enabled: boolean) {
    soundEnabled.value = enabled;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("crm_sound_enabled", enabled ? "true" : "false");
    }
    // Unlock AudioContext on user interaction (required for Safari)
    if (enabled) {
      unlockAudioContext();
    }
  }

  function setAutoRefreshEnabled(enabled: boolean) {
    autoRefreshEnabled.value = enabled;
    if (enabled) {
      startPolling();
    } else {
      stopPolling();
    }
  }

  // Pre-created audio context for Safari (needs user gesture to unlock)
  let audioContextUnlocked = false;
  let cachedAudioContext: AudioContext | null = null;
  
  function unlockAudioContext() {
    if (audioContextUnlocked) return;
    try {
      cachedAudioContext = new AudioContext();
      // Create a silent buffer to unlock
      const buffer = cachedAudioContext.createBuffer(1, 1, 22050);
      const source = cachedAudioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(cachedAudioContext.destination);
      source.start(0);
      audioContextUnlocked = true;
    } catch (e) {
      // ignore
    }
  }

  function playNotificationSound() {
    if (typeof window === "undefined") return;
    try {
      // Try to use cached context or create new one
      const ctx = cachedAudioContext && cachedAudioContext.state !== 'closed' 
        ? cachedAudioContext 
        : new AudioContext();
      
      // Resume if suspended (Safari)
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = "triangle";
      oscillator.frequency.value = 880;
      oscillator.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1);

      oscillator.start(now);
      oscillator.stop(now + 1);

      // Don't close cached context
      if (ctx !== cachedAudioContext) {
        setTimeout(() => ctx.close().catch(() => null), 1500);
      }
    } catch (error) {
      console.warn("[CRM] Notification sound failed:", error);
    }
  }

  function triggerBrowserNotification(count: number, isActionRequired = false) {
    // Always show in-app toast (works in Safari and all browsers)
    const toastMessage = isActionRequired
      ? (count === 1 ? "Заказ требует действий!" : `Заказов требует действий: ${count}`)
      : (count === 1 ? "Новый заказ!" : `Новых заказов: ${count}`);
    inAppToast.value = { show: true, message: toastMessage, count };
    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (inAppToast.value.count === count) {
        inAppToast.value = { show: false, message: "", count: 0 };
      }
    }, 10000);
    
    // Also try browser notification (may not work in Safari)
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const title = isActionRequired
      ? (count === 1 ? "Требует действий" : `Требует действий: ${count}`)
      : (count === 1 ? "Новый заказ" : `Новых заказов: ${count}`);
    const body = isActionRequired
      ? (count === 1
          ? "Заказ требует внимания менеджера."
          : "Несколько заказов требуют внимания менеджера.")
      : (count === 1
          ? "Появился новый заказ в колонке «Новые»."
          : "На доске появились новые заказы. Проверьте колонку «Новые».");

    try {
      new Notification(title, {
        body,
        icon: "/favicon.ico",
      });
    } catch (error) {
      console.warn("[CRM] Browser notification failed:", error);
    }
  }
  
  function hideInAppToast() {
    inAppToast.value = { show: false, message: "", count: 0 };
  }

  async function ensureNotificationPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    if (Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch (error) {
        console.warn("[CRM] Notification permission request failed:", error);
      }
    }
  }

  async function checkForNewOrders() {
    try {
      const data = await fetchAPI<{ orders: Order[] }>(
        `${API_BASE}/orders?status=new&limit=100`
      );
      const currentNewOrders = data.orders || [];
      const currentIds = new Set(currentNewOrders.map((o) => o.id));

      // Find truly new orders (not seen before)
      const newIds: string[] = [];
      currentIds.forEach((id) => {
        if (!lastKnownOrderIds.value.has(id)) {
          newIds.push(id);
          unseenOrderIds.value.add(id);
        }
      });

      // Update last known IDs
      lastKnownOrderIds.value = currentIds;

      // Clean up unseen IDs that are no longer in "new" status
      const cleanedUnseen = new Set<string>();
      unseenOrderIds.value.forEach((id) => {
        if (currentIds.has(id)) {
          cleanedUnseen.add(id);
        }
      });
      unseenOrderIds.value = cleanedUnseen;
      newOrdersCount.value = unseenOrderIds.value.size;

      // Trigger notifications for new orders (only if not first load)
      if (pollingInitialized && newIds.length > 0) {
        if (notificationsEnabled.value) {
          triggerBrowserNotification(newIds.length);
        }
        if (soundEnabled.value) {
          playNotificationSound();
        }
      }

      pollingInitialized = true;
    } catch (error) {
      console.error("[CRM] Check for new orders failed:", error);
    }
  }

  async function checkForActionRequired() {
    try {
      const data = await fetchAPI<{ orders: Order[] }>(
        `${API_BASE}/orders?limit=200`
      );
      const allOrders = data.orders || [];
      const actionOrders = allOrders.filter((o) => o.needs_manager_action === 1);
      const currentIds = new Set(actionOrders.map((o) => o.id));

      const newActionIds: string[] = [];
      currentIds.forEach((id) => {
        if (!lastKnownActionIds.value.has(id)) {
          newActionIds.push(id);
          unseenActionIds.value.add(id);
        }
      });

      lastKnownActionIds.value = currentIds;

      const cleanedUnseen = new Set<string>();
      unseenActionIds.value.forEach((id) => {
        if (currentIds.has(id)) {
          cleanedUnseen.add(id);
        }
      });
      unseenActionIds.value = cleanedUnseen;
      actionRequiredCount.value = unseenActionIds.value.size;

      if (pollingInitialized && newActionIds.length > 0) {
        if (notificationsEnabled.value) {
          triggerBrowserNotification(newActionIds.length, true);
        }
        if (soundEnabled.value) {
          playNotificationSound();
        }
      }
    } catch (error) {
      console.error("[CRM] Check for action required failed:", error);
    }
  }

  function startPolling() {
    if (pollingTimer) return;
    checkForNewOrders(); // Initial check
    checkForActionRequired();
    // Низкий приоритет — индикатор сайдбара. Ловим .catch чтобы не валить
    // основные опросы заказов.
    fetchLowStockSummary().catch(() => {});
    pollingTimer = setInterval(() => {
      checkForNewOrders();
      checkForActionRequired();
      fetchLowStockSummary().catch(() => {});
    }, POLLING_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  }

  function markOrderAsSeen(orderId: string) {
    if (unseenOrderIds.value.has(orderId)) {
      unseenOrderIds.value.delete(orderId);
      unseenOrderIds.value = new Set(unseenOrderIds.value);
      newOrdersCount.value = unseenOrderIds.value.size;
    }
  }

  function markAllOrdersAsSeen() {
    unseenOrderIds.value.clear();
    unseenOrderIds.value = new Set();
    newOrdersCount.value = 0;
  }

  function isOrderUnseen(orderId: string): boolean {
    return unseenOrderIds.value.has(orderId);
  }
  // ========== End Global Order Notifications ==========

  // Dashboard
  const dashboardStats = ref<DashboardStats | null>(null);
  const loadingDashboard = ref(false);

  async function fetchDashboard(
    period: "today" | "week" | "month" | "year" | "custom" = "today",
    offset: number = 0,
    options: {
      from?: string;          // YYYY-MM-DD, нужен только при period === 'custom'
      to?: string;            // YYYY-MM-DD, нужен только при period === 'custom'
      topSort?: "profit" | "quantity";
      topLimit?: number;
      topSearch?: string;
    } = {},
  ) {
    // Для произвольного периода без обеих границ — не делаем запрос.
    // Backend всё равно вернёт 400, и это бы зашумляло UX (мигание ошибки при инициализации).
    if (period === "custom" && (!options.from || !options.to)) {
      return;
    }

    loadingDashboard.value = true;
    try {
      const params = new URLSearchParams({
        period,
        offset: String(offset),
      });
      if (period === "custom") {
        params.append("from", options.from!);
        params.append("to", options.to!);
      }
      if (options.topSort) params.append("top_sort", options.topSort);
      if (options.topLimit !== undefined) {
        params.append("top_limit", String(options.topLimit));
      }
      if (options.topSearch) params.append("top_search", options.topSearch);

      dashboardStats.value = await fetchAPI<DashboardStats>(
        `${API_BASE}/dashboard?${params.toString()}`,
      );
    } finally {
      loadingDashboard.value = false;
    }
  }

  // Dashboard Timeseries - детализированные данные для графиков
  const dashboardTimeseries = ref<
    Array<{ label: string; orders: number; revenue: number; profit: number }>
  >([]);
  const loadingTimeseries = ref(false);

  async function fetchDashboardTimeseries(
    period: "today" | "month" | "year" = "month",
    offset: number = 0,
    year?: number,
  ) {
    loadingTimeseries.value = true;
    try {
      const params = new URLSearchParams({ period, offset: offset.toString() });
      if (year) params.append("year", year.toString());
      const data = await fetchAPI<
        Array<{
          label: string;
          orders: number;
          revenue: number;
          profit: number;
        }>
      >(`${API_BASE}/dashboard-timeseries?${params.toString()}`);
      dashboardTimeseries.value = data;
    } catch (error) {
      console.error("[CRM] Failed to fetch timeseries:", error);
      dashboardTimeseries.value = [];
    } finally {
      loadingTimeseries.value = false;
    }
  }

  // Employees
  const employees = ref<Employee[]>([]);
  const loadingEmployees = ref(false);

  async function fetchEmployees() {
    loadingEmployees.value = true;
    try {
      employees.value = await fetchAPI<Employee[]>(`${API_BASE}/employees`);
    } finally {
      loadingEmployees.value = false;
    }
  }

  async function createEmployee(data: {
    username: string;
    password: string;
    first_name: string;
    last_name: string;
    position?: string;
  }) {
    const employee = await fetchAPI<Employee>(`${API_BASE}/employees`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    employees.value.push(employee);
    return employee;
  }

  async function updateEmployee(
    id: string,
    data: Partial<
      Omit<Employee, "id" | "username" | "created_at" | "updated_at">
    >,
  ) {
    const employee = await fetchAPI<Employee>(`${API_BASE}/employees/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    const index = employees.value.findIndex((e) => e.id === id);
    if (index !== -1) {
      employees.value[index] = employee;
    }
    return employee;
  }

  async function deleteEmployee(id: string) {
    await fetchAPI(`${API_BASE}/employees/${id}`, { method: "DELETE" });
    employees.value = employees.value.filter((e) => e.id !== id);
  }

  // Customers
  const customers = ref<Customer[]>([]);
  const currentCustomer = ref<Customer | null>(null);
  const loadingCustomers = ref(false);

  // Customer Feedbacks
  const customerFeedbacks = ref<CustomerFeedback[]>([]);
  const loadingCustomerFeedbacks = ref(false);

  async function fetchCustomers(filter?: "inactive" | "cold") {
    loadingCustomers.value = true;
    try {
      const url = filter
        ? `${API_BASE}/customers?filter=${filter}`
        : `${API_BASE}/customers`;
      customers.value = await fetchAPI<Customer[]>(url);
    } finally {
      loadingCustomers.value = false;
    }
  }

  async function fetchCustomer(id: string) {
    currentCustomer.value = await fetchAPI<Customer>(
      `${API_BASE}/customers/${id}`,
    );
    return currentCustomer.value;
  }

  async function updateCustomer(
    id: string,
    data: { notes?: string; phone?: string },
  ) {
    const customer = await fetchAPI<Customer>(`${API_BASE}/customers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    const index = customers.value.findIndex((c) => c.id === id);
    if (index !== -1) {
      customers.value[index] = customer;
    }
    return customer;
  }

  async function blockCustomer(id: string, reason: string) {
    await fetchAPI(`${API_BASE}/customers/${id}/block`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    await fetchCustomer(id);
  }

  async function unblockCustomer(id: string) {
    await fetchAPI(`${API_BASE}/customers/${id}/unblock`, {
      method: "POST",
    });
    await fetchCustomer(id);
  }

  // ===== Универсальные блокировки клиентов (новый API) =====
  const customerBlocksList = ref<{
    active: ActiveCustomerBlock[];
    pending: PendingCustomerBlock[];
  }>({ active: [], pending: [] });
  const loadingCustomerBlocks = ref(false);

  async function fetchCustomerBlocksList() {
    loadingCustomerBlocks.value = true;
    try {
      customerBlocksList.value = await fetchAPI<{
        active: ActiveCustomerBlock[];
        pending: PendingCustomerBlock[];
      }>(`${API_BASE}/blocks`);
      return customerBlocksList.value;
    } finally {
      loadingCustomerBlocks.value = false;
    }
  }

  async function createCustomerBlock(payload: CreateCustomerBlockPayload) {
    const result = await fetchAPI<{
      ok: true;
      kind: "active" | "pending";
      block: ActiveCustomerBlock | PendingCustomerBlock;
    }>(`${API_BASE}/blocks`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return result;
  }

  async function removeCustomerBlock(blockId: string | number, unblock_reason?: string) {
    return fetchAPI<{ ok: true; kind: "unblocked" | "pending_removed" }>(
      `${API_BASE}/blocks/${blockId}`,
      {
        method: "DELETE",
        body: JSON.stringify({ unblock_reason: unblock_reason ?? null }),
      },
    );
  }

  // ===== POS-клиенты (касса): поиск, создание/merge, история покупок =====

  async function searchCustomersForPos(
    q: string,
    limit = 20,
    options: { includeRecent?: boolean; allCustomers?: boolean } = {},
  ) {
    const trimmed = (q || "").trim();
    // includeRecent=true → бэк возвращает последних клиентов при пустом q
    // (для постоянно видимого «блокнота» на кассирском экране).
    if (!trimmed && !options.includeRecent) return [] as Customer[];
    const params = new URLSearchParams({ q: trimmed, limit: String(limit) });
    if (options.includeRecent) params.set("recent", "1");
    // По умолчанию POS-блокнот показывает только клиентов проходняка
    // (без telegram_id или с pos_sales). Костин TZ — «база на проходняк»,
    // онлайн-клиенты Mini App там лишние. Передай allCustomers=true чтобы
    // отключить фильтр (если функция переиспользуется в общем CRM-поиске).
    if (!options.allCustomers) params.set("pos_only", "1");
    const result = await fetchAPI<{ items: Customer[] }>(
      `${API_BASE}/customers/search?${params.toString()}`,
    );
    return result.items;
  }

  async function createPosCustomer(payload: { name: string; phone: string }) {
    return fetchAPI<{ ok: true; customer: Customer; merged: boolean }>(
      `${API_BASE}/pos-customers`,
      { method: "POST", body: JSON.stringify(payload) },
    );
  }

  /**
   * Soft-delete клиента из блокнота кассы. Запись остаётся в БД, история
   * чеков сохраняется, но клиент пропадает из всех списков-выдач.
   * Используется кнопкой «Удалить» в PosCustomerPanel.
   */
  async function deletePosCustomer(customerId: string) {
    return fetchAPI<{ ok: true; removed: number }>(
      `${API_BASE}/pos-customers/${encodeURIComponent(customerId)}`,
      { method: "DELETE" },
    );
  }

  async function fetchCustomerPurchaseHistory(customerId: string, limit = 50) {
    const params = new URLSearchParams({ limit: String(limit) });
    const result = await fetchAPI<{
      items: Array<{
        id: string;
        source: "order" | "pos";
        number: number | null;
        amount: number;
        status: string;
        created_at: string;
        completed_at: string | null;
      }>;
    }>(`${API_BASE}/customers/${customerId}/purchases?${params.toString()}`);
    return result.items;
  }

  async function deleteCustomer(id: string) {
    await fetchAPI(`${API_BASE}/customers/${id}`, {
      method: "DELETE",
    });
    customers.value = customers.value.filter((c) => c.id !== id);
  }

  // Customer Feedbacks
  async function fetchCustomerFeedbacks() {
    loadingCustomerFeedbacks.value = true;
    try {
      customerFeedbacks.value = await fetchAPI<CustomerFeedback[]>(
        `${API_BASE}/customer-feedbacks`,
      );
    } finally {
      loadingCustomerFeedbacks.value = false;
    }
  }

  async function createCustomerFeedback(data: {
    customer_id: string;
    reason: string;
  }) {
    const feedback = await fetchAPI<CustomerFeedback>(
      `${API_BASE}/customer-feedbacks`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
    customerFeedbacks.value.unshift(feedback);
    return feedback;
  }

  async function deleteCustomerFeedback(id: string) {
    await fetchAPI(`${API_BASE}/customer-feedbacks/${id}`, {
      method: "DELETE",
    });
    customerFeedbacks.value = customerFeedbacks.value.filter(
      (f) => f.id !== id,
    );
  }

  // Orders
  const orders = ref<Order[]>([]);
  const currentOrder = ref<Order | null>(null);
  const loadingOrders = ref(false);
  const ordersPagination = ref({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  async function fetchOrders(params?: {
    status?: string;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    loadingOrders.value = true;
    try {
      const query = new URLSearchParams();
      if (params?.status) query.append("status", params.status);
      if (params?.page) query.append("page", params.page.toString());
      if (params?.limit) query.append("limit", params.limit.toString());
      if (params?.search) query.append("search", params.search);

      const response = await fetchAPI<{
        orders: Order[];
        pagination: typeof ordersPagination.value;
      }>(`${API_BASE}/orders?${query}`);
      orders.value = response.orders;
      ordersPagination.value = response.pagination;
    } finally {
      loadingOrders.value = false;
    }
  }

  async function fetchOrder(id: string) {
    currentOrder.value = await fetchAPI<Order>(`${API_BASE}/orders/${id}`);
    return currentOrder.value;
  }

  async function fetchOrderHistory(id: string) {
    return await fetchAPI<Array<{
      id: string;
      order_id: string;
      previous_status: string | null;
      new_status: string;
      changed_at: string;
      note: string | null;
    }>>(`${API_BASE}/orders/${id}/history`);
  }

  const deliveredOrders = ref<Order[]>([]);
  const loadingDelivered = ref(false);
  const deliveredStats = ref<{
    totalCount: number;
    totalAmount: number;
    deliveryCount: number;
    deliveryAmount: number;
    pickupCount: number;
    pickupAmount: number;
  } | null>(null);
  const deliveredPagination = ref<{ page: number; limit: number; total: number; totalPages: number } | null>(null);

  async function fetchDeliveredOrders(params?: { page?: number; limit?: number; search?: string; period?: string }) {
    loadingDelivered.value = true;
    try {
      const query = new URLSearchParams();
      if (params?.page) query.append("page", params.page.toString());
      if (params?.limit) query.append("limit", params.limit.toString());
      if (params?.search) query.append("search", params.search);
      if (params?.period) query.append("period", params.period);
      const response = await fetchAPI<{
        orders: Order[];
        stats: typeof deliveredStats.value;
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(
        `${API_BASE}/orders/delivered?${query}`,
      );
      if (params?.page && params.page > 1) {
        deliveredOrders.value = [...deliveredOrders.value, ...response.orders];
      } else {
        deliveredOrders.value = response.orders;
      }
      deliveredStats.value = response.stats;
      deliveredPagination.value = response.pagination;
      return response;
    } finally {
      loadingDelivered.value = false;
    }
  }

  async function createOrder(data: {
    customer_id?: string;
    delivery_type: "pickup" | "delivery";
    delivery_address?: string;
    discount_amount?: number;
    discount_percent?: number;
    notes?: string;
    items: Array<{
      product_id: string;
      variant_id?: string | null;
      quantity: number;
      price_per_unit?: number;
      discount_amount?: number;
      manual_discount_amount?: number;
      loyalty_discount_amount?: number;
      loyalty_units_applied?: number;
      variant_name?: string | null;
    }>;
  }) {
    const order = await fetchAPI<Order>(`${API_BASE}/orders`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    orders.value = [order, ...orders.value];
    return order;
  }

  async function updateOrder(
    id: string,
    data: {
      status?: string;
      delivery_address?: string | null;
      notes?: string | null;
      discount_amount?: number;
      discount_percent?: number;
      items?: Array<{
        product_id: string;
        variant_id?: string | null;
        quantity: number;
        price_per_unit?: number;
        discount_amount?: number;
        manual_discount_amount?: number;
        loyalty_discount_amount?: number;
        loyalty_units_applied?: number;
        variant_name?: string | null;
      }>;
      payment_type?: "cash";
      payment_account_id?: string;
      paid_amount?: number;
      payment_notes?: string;
      reactivate?: boolean;
    },
  ) {
    const response = await fetchAPI<Order & { auto_notification?: AutoNotificationResult | null }>(
      `${API_BASE}/orders/${id}`,
      { method: "PATCH", body: JSON.stringify(data) },
    );
    // Отделяем технический результат авто-уведомления от полей самого заказа,
    // чтобы он не утекал в orders.value (там должен лежать чистый Order).
    const { auto_notification: autoNotification, ...order } = response;
    const index = orders.value.findIndex((o) => o.id === id);
    if (index !== -1) {
      orders.value[index] = order as Order;
    }
    return { ...(order as Order), auto_notification: autoNotification ?? null };
  }

  async function resolveManagerAction(id: string) {
    const order = await fetchAPI<Order>(`${API_BASE}/orders/${id}/resolve-action`, {
      method: "POST",
    });
    const index = orders.value.findIndex((o) => o.id === id);
    if (index !== -1) {
      orders.value[index] = order;
    }
    // Remove from unseen action ids
    if (unseenActionIds.value.has(id)) {
      unseenActionIds.value.delete(id);
      unseenActionIds.value = new Set(unseenActionIds.value);
      actionRequiredCount.value = unseenActionIds.value.size;
    }
    return order;
  }

  async function issueOrder(
    id: string,
    data: {
      payment_type: "cash";
      payment_account_id: string;
      amount: number;
      payment_notes?: string;
    },
  ) {
    const response = await fetchAPI<{
      order: Order;
      transaction: CashTransaction;
      // Бэкенд возвращает результат авто-уведомления клиенту (см.
      // server/routes/crm-operations.js POST /orders/:id/issue). Фронт
      // показывает по нему тост (CrmOrders.vue submitPayment), чтобы
      // менеджер сразу видел: «сообщение клиенту дошло» или причину фейла.
      auto_notification?: AutoNotificationResult | null;
    }>(`${API_BASE}/orders/${id}/issue`, {
      method: "POST",
      body: JSON.stringify({
        payment_type: data.payment_type,
        payment_account_id: data.payment_account_id,
        amount: data.amount,
        payment_notes: data.payment_notes,
      }),
    });

    const index = orders.value.findIndex((o) => o.id === id);
    if (index !== -1) {
      orders.value[index] = response.order;
    }

    cashTransactions.value.unshift(response.transaction);
    return response;
  }

  async function deleteOrderPayment(id: string) {
    const order = await fetchAPI<Order>(`${API_BASE}/orders/${id}/payment`, {
      method: "DELETE",
    });

    const index = orders.value.findIndex((o) => o.id === id);
    if (index !== -1) {
      orders.value[index] = order;
    }
    if (currentOrder.value?.id === id) {
      currentOrder.value = order;
    }

    return order;
  }

  // Procurements
  const procurements = ref<Procurement[]>([]);
  const currentProcurement = ref<Procurement | null>(null);
  const loadingProcurements = ref(false);

  async function fetchProcurements() {
    loadingProcurements.value = true;
    try {
      procurements.value = await fetchAPI<Procurement[]>(
        `${API_BASE}/procurements`,
      );
    } finally {
      loadingProcurements.value = false;
    }
  }

  async function fetchProcurement(id: string) {
    currentProcurement.value = await fetchAPI<Procurement>(
      `${API_BASE}/procurements/${id}`,
    );
    return currentProcurement.value;
  }

  async function createProcurement(data: {
    supplier_name?: string;
    notes?: string;
    items: Array<{
      product_id: string;
      quantity: number;
      cost_per_unit: number;
    }>;
  }) {
    const procurement = await fetchAPI<Procurement>(
      `${API_BASE}/procurements`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
    procurements.value.unshift(procurement);
    return procurement;
  }

  async function completeProcurement(id: string) {
    const procurement = await fetchAPI<Procurement>(
      `${API_BASE}/procurements/${id}/complete`,
      {
        method: "POST",
      },
    );
    const index = procurements.value.findIndex((p) => p.id === id);
    if (index !== -1) {
      procurements.value[index] = procurement;
    }
    return procurement;
  }

  async function updateProcurement(
    id: string,
    data: {
      supplier_name?: string;
      notes?: string;
      items?: Array<{
        product_id: string;
        quantity: number;
        cost_per_unit: number;
      }>;
    },
  ) {
    const procurement = await fetchAPI<Procurement>(
      `${API_BASE}/procurements/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    );
    const index = procurements.value.findIndex((p) => p.id === id);
    if (index !== -1) {
      procurements.value[index] = procurement;
    }
    if (currentProcurement.value?.id === id) {
      currentProcurement.value = procurement;
    }
    return procurement;
  }

  async function deleteProcurement(id: string) {
    await fetchAPI(`${API_BASE}/procurements/${id}`, { method: "DELETE" });
    procurements.value = procurements.value.filter((p) => p.id !== id);
    if (currentProcurement.value?.id === id) {
      currentProcurement.value = null;
    }
  }

  async function removeProcurementPayment(id: string) {
    const procurement = await fetchAPI<Procurement>(
      `${API_BASE}/procurements/${id}/payment`,
      {
        method: "DELETE",
      },
    );
    const index = procurements.value.findIndex((p) => p.id === id);
    if (index !== -1) {
      procurements.value[index] = procurement;
    }
    if (currentProcurement.value?.id === id) {
      currentProcurement.value = procurement;
    }
    return procurement;
  }

  // Write-offs
  const writeOffs = ref<WriteOff[]>([]);
  const currentWriteOff = ref<WriteOff | null>(null);
  const loadingWriteOffs = ref(false);

  async function fetchWriteOffs() {
    loadingWriteOffs.value = true;
    try {
      writeOffs.value = await fetchAPI<WriteOff[]>(`${API_BASE}/write-offs`);
    } finally {
      loadingWriteOffs.value = false;
    }
  }

  async function fetchWriteOff(id: string) {
    currentWriteOff.value = await fetchAPI<WriteOff>(
      `${API_BASE}/write-offs/${id}`,
    );
    return currentWriteOff.value;
  }

  async function createWriteOff(data: {
    reason: string;
    notes?: string;
    items: Array<{
      product_id: string;
      variant_id?: string;
      quantity: number;
    }>;
  }) {
    const writeOff = await fetchAPI<WriteOff>(`${API_BASE}/write-offs`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    writeOffs.value.unshift(writeOff);
    return writeOff;
  }

  async function updateWriteOff(
    id: string,
    data: {
      reason?: string;
      notes?: string;
      items?: Array<{
        product_id: string;
        variant_id?: string;
        quantity: number;
      }>;
    },
  ) {
    const writeOff = await fetchAPI<WriteOff>(`${API_BASE}/write-offs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });

    const index = writeOffs.value.findIndex((w) => w.id === id);
    if (index !== -1) {
      writeOffs.value[index] = writeOff;
    }
    if (currentWriteOff.value?.id === id) {
      currentWriteOff.value = writeOff;
    }

    return writeOff;
  }

  async function deleteWriteOff(id: string) {
    await fetchAPI(`${API_BASE}/write-offs/${id}`, { method: "DELETE" });
    writeOffs.value = writeOffs.value.filter((w) => w.id !== id);
    if (currentWriteOff.value?.id === id) {
      currentWriteOff.value = null;
    }
  }

  // Cash
  const cashAccounts = ref<CashAccount[]>([]);
  const cashTransactions = ref<CashTransaction[]>([]);
  const loadingCash = ref(false);

  async function fetchCashAccounts() {
    loadingCash.value = true;
    try {
      cashAccounts.value = await fetchAPI<CashAccount[]>(
        `${API_BASE}/cash-accounts`,
      );
    } finally {
      loadingCash.value = false;
    }
  }

  async function createCashAccount(data: {
    name: string;
    balance?: number;
    is_default?: boolean;
  }) {
    const account = await fetchAPI<CashAccount>(`${API_BASE}/cash-accounts`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    cashAccounts.value.push(account);
    return account;
  }

  async function updateCashAccount(
    id: string,
    data: { name?: string; is_default?: boolean },
  ) {
    const account = await fetchAPI<CashAccount>(
      `${API_BASE}/cash-accounts/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    );
    const index = cashAccounts.value.findIndex((a) => a.id === id);
    if (index !== -1) {
      cashAccounts.value[index] = account;
    }
    return account;
  }

  async function deleteCashAccount(id: string) {
    await fetchAPI(`${API_BASE}/cash-accounts/${id}`, { method: "DELETE" });
    cashAccounts.value = cashAccounts.value.filter((a) => a.id !== id);
  }

  async function fetchCashTransactions(params?: {
    account_id?: string;
    type?: "income" | "expense";
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.account_id) query.append("account_id", params.account_id);
    if (params?.type) query.append("type", params.type);
    if (params?.limit) query.append("limit", params.limit.toString());
    if (params?.offset) query.append("offset", params.offset.toString());

    cashTransactions.value = await fetchAPI<CashTransaction[]>(
      `${API_BASE}/cash-transactions?${query}`,
    );
  }

  async function createCashTransaction(data: {
    account_id: string;
    type: "income" | "expense";
    amount: number;
    description?: string;
  }) {
    const transaction = await fetchAPI<CashTransaction>(
      `${API_BASE}/cash-transactions`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
    cashTransactions.value.unshift(transaction);
    return transaction;
  }

  async function updateCashTransaction(
    id: string,
    data: {
      account_id?: string;
      type?: "income" | "expense";
      amount?: number;
      description?: string;
    },
  ) {
    const transaction = await fetchAPI<CashTransaction>(
      `${API_BASE}/cash-transactions/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    );
    const index = cashTransactions.value.findIndex((t) => t.id === id);
    if (index !== -1) {
      cashTransactions.value[index] = transaction;
    }
    await fetchCashAccounts();
    return transaction;
  }

  async function deleteCashTransaction(id: string) {
    await fetchAPI(`${API_BASE}/cash-transactions/${id}`, { method: "DELETE" });
    cashTransactions.value = cashTransactions.value.filter((t) => t.id !== id);
  }

  // Cash pacing
  const cashPacingMonths = ref<CashPacingMonthListItem[]>([]);
  const currentCashPacingMonth = ref<CashPacingMonthDetail | null>(null);
  const loadingCashPacing = ref(false);
  const suggestedCashPacingMonthKey = ref("");

  async function fetchCashPacingMonths() {
    loadingCashPacing.value = true;
    try {
      const response = await fetchAPI<{
        months: CashPacingMonthListItem[];
        suggested_month_key: string;
      }>(`${API_BASE}/cash-pacing/months`);
      cashPacingMonths.value = response.months;
      suggestedCashPacingMonthKey.value = response.suggested_month_key;
      return response;
    } finally {
      loadingCashPacing.value = false;
    }
  }

  async function fetchCashPacingMonth(id: string) {
    loadingCashPacing.value = true;
    try {
      const detail = await fetchAPI<CashPacingMonthDetail>(
        `${API_BASE}/cash-pacing/months/${id}`,
      );
      currentCashPacingMonth.value = detail;
      return detail;
    } finally {
      loadingCashPacing.value = false;
    }
  }

  async function createCashPacingMonth(data: {
    month_key: string;
    title?: string;
    notes?: string;
  }) {
    const detail = await fetchAPI<CashPacingMonthDetail>(
      `${API_BASE}/cash-pacing/months`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
    currentCashPacingMonth.value = detail;
    await fetchCashPacingMonths();
    return detail;
  }

  async function updateCashPacingMonth(
    id: string,
    data: { title?: string; notes?: string },
  ) {
    const detail = await fetchAPI<CashPacingMonthDetail>(
      `${API_BASE}/cash-pacing/months/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    );
    currentCashPacingMonth.value = detail;
    await fetchCashPacingMonths();
    return detail;
  }

  async function createCashPacingItem(
    monthId: string,
    data: {
      title: string;
      quantity: number;
      cost_with_vat: number;
      markup_percent: number;
      effective_from: string;
      entry_type?: "base" | "addition";
      note?: string;
    },
  ) {
    const detail = await fetchAPI<CashPacingMonthDetail>(
      `${API_BASE}/cash-pacing/months/${monthId}/items`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
    currentCashPacingMonth.value = detail;
    await fetchCashPacingMonths();
    return detail;
  }

  async function updateCashPacingItem(
    itemId: string,
    data: {
      title?: string;
      quantity?: number;
      cost_with_vat?: number;
      markup_percent?: number;
      effective_from?: string;
      entry_type?: "base" | "addition";
      note?: string;
    },
  ) {
    const detail = await fetchAPI<CashPacingMonthDetail>(
      `${API_BASE}/cash-pacing/items/${itemId}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    );
    currentCashPacingMonth.value = detail;
    await fetchCashPacingMonths();
    return detail;
  }

  async function deleteCashPacingItem(itemId: string) {
    const detail = await fetchAPI<CashPacingMonthDetail>(
      `${API_BASE}/cash-pacing/items/${itemId}`,
      {
        method: "DELETE",
      },
    );
    currentCashPacingMonth.value = detail;
    await fetchCashPacingMonths();
    return detail;
  }

  async function upsertCashPacingDailyFact(
    monthId: string,
    data: {
      fact_date: string;
      actual_amount: number;
      note?: string;
    },
  ) {
    const detail = await fetchAPI<CashPacingMonthDetail>(
      `${API_BASE}/cash-pacing/months/${monthId}/daily-facts`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
    currentCashPacingMonth.value = detail;
    await fetchCashPacingMonths();
    return detail;
  }

  async function deleteCashPacingDailyFact(monthId: string, factDate: string) {
    const detail = await fetchAPI<CashPacingMonthDetail>(
      `${API_BASE}/cash-pacing/months/${monthId}/daily-facts/${factDate}`,
      {
        method: "DELETE",
      },
    );
    currentCashPacingMonth.value = detail;
    await fetchCashPacingMonths();
    return detail;
  }

  // POS Sales
  const posSales = ref<PosSale[]>([]);
  const pendingPosSales = ref<PosSale[]>([]);
  const loadingPosSales = ref(false);
  const posSalesTotal = ref(0);

  async function fetchPosSales(params?: {
    status?: 'completed' | 'pending';
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) {
    loadingPosSales.value = true;
    try {
      const query = new URLSearchParams();
      if (params?.status) query.append('status', params.status);
      if (params?.from) query.append('from', params.from);
      if (params?.to) query.append('to', params.to);
      if (params?.limit) query.append('limit', params.limit.toString());
      if (params?.offset) query.append('offset', params.offset.toString());

      const response = await fetchAPI<{ sales: PosSale[]; total: number }>(
        `/api/admin/pos/sales?${query}`
      );
      posSales.value = response.sales;
      posSalesTotal.value = response.total;
      return response;
    } finally {
      loadingPosSales.value = false;
    }
  }

  async function fetchPendingPosSales() {
    try {
      pendingPosSales.value = await fetchAPI<PosSale[]>('/api/admin/pos/pending');
      return pendingPosSales.value;
    } catch (error) {
      console.error('Failed to fetch pending POS sales:', error);
      return [];
    }
  }

  async function createPosSale(data: {
    product_name: string;
    price: number;
    cost_price?: number | null;
    notes?: string;
    employee_id?: string;
    customer_id?: string | null;
  }) {
    const sale = await fetchAPI<PosSale>('/api/admin/pos/sales', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    if (sale.status === 'pending') {
      pendingPosSales.value.unshift(sale);
    } else {
      posSales.value.unshift(sale);
    }
    
    return sale;
  }

  async function updatePosSale(
    id: string,
    data: {
      product_name?: string;
      price?: number;
      cost_price?: number;
      notes?: string;
    }
  ) {
    const sale = await fetchAPI<PosSale>(`/api/admin/pos/sales/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });

    // Обновляем в списке отложенных
    const pendingIndex = pendingPosSales.value.findIndex((s) => s.id === id);
    if (pendingIndex !== -1) {
      if (sale.status === 'completed') {
        // Убираем из отложенных, добавляем в основной список
        pendingPosSales.value.splice(pendingIndex, 1);
        posSales.value.unshift(sale);
      } else {
        pendingPosSales.value[pendingIndex] = sale;
      }
    } else {
      // Обновляем в основном списке
      const index = posSales.value.findIndex((s) => s.id === id);
      if (index !== -1) {
        posSales.value[index] = sale;
      }
    }

    return sale;
  }

  async function deletePosSale(id: string) {
    await fetchAPI(`/api/admin/pos/sales/${id}`, { method: 'DELETE' });
    posSales.value = posSales.value.filter((s) => s.id !== id);
    pendingPosSales.value = pendingPosSales.value.filter((s) => s.id !== id);
  }

  // Promo Codes
  const promoCodes = ref<PromoCode[]>([]);
  const promoCodesLoading = ref(false);
  const promoCodesTotal = ref(0);

  async function fetchPromoCodes(params?: { search?: string; filter?: string; limit?: number; offset?: number }) {
    promoCodesLoading.value = true;
    try {
      const query = new URLSearchParams();
      if (params?.search) query.set('search', params.search);
      if (params?.filter) query.set('filter', params.filter);
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.offset) query.set('offset', String(params.offset));
      const qs = query.toString();
      const data = await fetchAPI<{ promo_codes: PromoCode[]; total: number }>(`${API_BASE}/promo-codes${qs ? `?${qs}` : ''}`);
      promoCodes.value = data.promo_codes;
      promoCodesTotal.value = data.total;
      return data;
    } finally {
      promoCodesLoading.value = false;
    }
  }

  async function createPromoCode(data: Partial<PromoCode>) {
    const promo = await fetchAPI<PromoCode>(`${API_BASE}/promo-codes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    promoCodes.value = [promo, ...promoCodes.value];
    promoCodesTotal.value++;
    return promo;
  }

  async function updatePromoCode(id: string, data: Partial<PromoCode>) {
    const promo = await fetchAPI<PromoCode>(`${API_BASE}/promo-codes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const idx = promoCodes.value.findIndex((p) => p.id === id);
    if (idx !== -1) promoCodes.value[idx] = promo;
    return promo;
  }

  async function deletePromoCode(id: string) {
    await fetchAPI(`${API_BASE}/promo-codes/${id}`, { method: 'DELETE' });
    promoCodes.value = promoCodes.value.filter((p) => p.id !== id);
    promoCodesTotal.value = Math.max(promoCodesTotal.value - 1, 0);
  }

  async function fetchPromoUsage(id: string) {
    return await fetchAPI<PromoUsage[]>(`${API_BASE}/promo-codes/${id}/usage`);
  }

  // Loyalty
  const loyaltyCategories = ref<CrmLoyaltyCategory[]>([]);
  const loyaltyCustomers = ref<CrmLoyaltyCustomer[]>([]);
  const loyaltyLedger = ref<CrmLoyaltyLedgerEntry[]>([]);
  const loyaltyLoading = ref(false);

  async function fetchLoyaltyCategories() {
    loyaltyLoading.value = true;
    try {
      const data = await fetchAPI<{ categories: CrmLoyaltyCategory[] }>(
        `${API_BASE}/loyalty/categories`,
      );
      loyaltyCategories.value = data.categories || [];
      return loyaltyCategories.value;
    } finally {
      loyaltyLoading.value = false;
    }
  }

  async function updateLoyaltyCategory(
    id: string,
    data: {
      threshold: number;
      discount_amount: number;
      title: string;
      description?: string | null;
      active: boolean;
    },
  ) {
    const category = await fetchAPI<CrmLoyaltyCategory>(
      `${API_BASE}/loyalty/categories/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    );
    const index = loyaltyCategories.value.findIndex((item) => item.id === id);
    if (index !== -1) {
      loyaltyCategories.value[index] = category;
    }
    return category;
  }

  async function updateLoyaltyMappings(
    id: string,
    data: { category_ids: string[]; group_ids: string[] },
  ) {
    const category = await fetchAPI<CrmLoyaltyCategory>(
      `${API_BASE}/loyalty/categories/${id}/mappings`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    );
    const index = loyaltyCategories.value.findIndex((item) => item.id === id);
    if (index !== -1) {
      loyaltyCategories.value[index] = category;
    }
    return category;
  }

  async function fetchLoyaltyCustomers(search = "") {
    const query = new URLSearchParams();
    if (search.trim()) query.set("search", search.trim());
    const data = await fetchAPI<{ customers: CrmLoyaltyCustomer[] }>(
      `${API_BASE}/loyalty/customers?${query.toString()}`,
    );
    loyaltyCustomers.value = data.customers || [];
    return loyaltyCustomers.value;
  }

  async function fetchLoyaltyLedger(customerId: string) {
    const data = await fetchAPI<{ entries: CrmLoyaltyLedgerEntry[] }>(
      `${API_BASE}/loyalty/customers/${customerId}/ledger`,
    );
    loyaltyLedger.value = data.entries || [];
    return loyaltyLedger.value;
  }

  // Low stock
  const lowStockProducts = ref<any[]>([]);

  async function fetchLowStockProducts() {
    lowStockProducts.value = await fetchAPI<any[]>(
      `${API_BASE}/products/low-stock`,
    );
  }

  // Low stock GROUPS (линейки) — отдельная сущность, плашка в Закупках.
  const lowStockGroups = ref<LowStockGroup[]>([]);
  const lowStockReasons = ref<Record<LowStockPauseReason, LowStockPauseConfig>>(
    {} as Record<LowStockPauseReason, LowStockPauseConfig>,
  );
  const lowStockGroupsLoading = ref(false);
  const lowStockHasAny = ref(false);
  const lowStockCount = ref(0);

  async function fetchLowStockGroups() {
    lowStockGroupsLoading.value = true;
    try {
      const data = await fetchAPI<{
        items: LowStockGroup[];
        reasons: Record<LowStockPauseReason, LowStockPauseConfig>;
      }>(`${API_BASE}/low-stock-groups`);
      lowStockGroups.value = Array.isArray(data?.items) ? data.items : [];
      lowStockReasons.value = data?.reasons ?? ({} as Record<LowStockPauseReason, LowStockPauseConfig>);
      // Держим summary в синхроне с детальным списком, чтобы индикатор сайдбара
      // не «лагал» сразу после действия пользователя.
      lowStockHasAny.value = lowStockGroups.value.length > 0;
      lowStockCount.value = lowStockGroups.value.length;
      return lowStockGroups.value;
    } finally {
      lowStockGroupsLoading.value = false;
    }
  }

  async function fetchLowStockSummary() {
    try {
      const data = await fetchAPI<{ hasAny: boolean; count: number }>(
        `${API_BASE}/low-stock-groups/summary`,
      );
      lowStockHasAny.value = Boolean(data?.hasAny);
      lowStockCount.value = Number(data?.count ?? 0);
      return data;
    } catch (err) {
      // Ошибка summary не должна ломать UI — просто оставляем последнее значение.
      console.warn("[CRM] Failed to fetch low-stock summary:", err);
      return { hasAny: lowStockHasAny.value, count: lowStockCount.value };
    }
  }

  async function pauseLowStockGroup(groupId: string, reason: LowStockPauseReason) {
    if (!groupId) {
      throw new Error("group_id_required");
    }
    await fetchAPI(`${API_BASE}/low-stock-groups/${groupId}/pause`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    // Локально удаляем линейку из плашки сразу — пользователь увидит результат
    // моментально, без ожидания нового запроса.
    lowStockGroups.value = lowStockGroups.value.filter((g) => g.id !== groupId);
    lowStockHasAny.value = lowStockGroups.value.length > 0;
    lowStockCount.value = lowStockGroups.value.length;
  }

  async function resumeLowStockGroup(groupId: string) {
    if (!groupId) {
      throw new Error("group_id_required");
    }
    await fetchAPI(`${API_BASE}/low-stock-groups/${groupId}/pause`, {
      method: "DELETE",
    });
    // После снятия паузы линейка может снова появиться — перечитываем список.
    await fetchLowStockGroups();
  }

  async function searchCrmProducts(
    params: { search?: string; page?: number; limit?: number } = {},
  ) {
    const query = new URLSearchParams();
    query.set("limit", String(params.limit ?? 25));
    if (params.search) {
      query.set("search", params.search);
    }

    const response = await fetch(
      `/api/admin/crm/products/search?${query.toString()}`,
      {
        credentials: "include",
      },
    );

    if (!response.ok) {
      throw new Error("Не удалось загрузить товары");
    }

    const rawProducts = await response.json();
    const productsArray = Array.isArray(rawProducts) ? rawProducts : [];

    return productsArray.map((product: any) => ({
      id: String(product.id),
      productId: product.product_id
        ? String(product.product_id)
        : String(product.id),
      title: product.title ?? "Без названия",
      description: product.description ?? null,
      priceRub: Number(product.priceRub ?? product.price_rub ?? 0),
      costPrice: Number(product.costPrice ?? product.cost_price ?? 0),
      stock: Number(product.stock ?? 0),
      minStock: Number(product.minStock ?? product.min_stock ?? 0),
      categoryId: String(product.categoryId ?? product.category_id),
      categoryName: product.categoryName ?? product.category_name ?? null,
      groupId: product.groupId
        ? String(product.groupId)
        : product.group_id
          ? String(product.group_id)
          : null,
      groupName: product.groupName ?? product.group_name ?? null,
      isVariant: product.is_variant === true,
      variantName: product.variant_name ?? null,
      imageUrl: product.imageUrl ?? null,
      image: product.image ?? null,
    })) as CrmProductSummary[];
  }

  // Generate message for order contact
  async function generateOrderMessage(orderId: string, templateId?: string) {
    return await fetchAPI<{
      message: string;
      telegramUsername: string | null;
      templateUsed: string;
    }>(`${API_BASE}/orders/${orderId}/generate-message`, {
      method: "POST",
      body: JSON.stringify({ templateId }),
    });
  }

  // Message Templates
  const messageTemplates = ref<MessageTemplate[]>([]);
  const loadingTemplates = ref(false);

  async function fetchMessageTemplates() {
    loadingTemplates.value = true;
    try {
      messageTemplates.value = await fetchAPI<MessageTemplate[]>(
        `${API_BASE}/message-templates`,
      );
    } finally {
      loadingTemplates.value = false;
    }
  }

  async function createMessageTemplate(data: {
    name: string;
    content: string;
    type?: string;
  }) {
    const template = await fetchAPI<MessageTemplate>(
      `${API_BASE}/message-templates`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
    messageTemplates.value.push(template);
    return template;
  }

  async function updateMessageTemplate(
    id: string,
    data: Partial<Omit<MessageTemplate, "id" | "created_at" | "updated_at">>,
  ) {
    const template = await fetchAPI<MessageTemplate>(
      `${API_BASE}/message-templates/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    );
    const index = messageTemplates.value.findIndex((t) => t.id === id);
    if (index !== -1) {
      messageTemplates.value[index] = template;
    }
    return template;
  }

  async function deleteMessageTemplate(id: string) {
    await fetchAPI(`${API_BASE}/message-templates/${id}`, { method: "DELETE" });
    messageTemplates.value = messageTemplates.value.filter((t) => t.id !== id);
  }

  async function verifyProfitPassword(password: string) {
    verifyingProfitAccess.value = true;
    try {
      const result = await fetchAPI<{ ok: boolean }>(
        `/api/admin/settings/profit-password/verify`,
        {
          method: "POST",
          body: JSON.stringify({ password }),
        },
      );
      if (result.ok) {
        profitUnlocked.value = true;
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("crm_profit_unlocked", "true");
        }
      }
      return result;
    } catch (error) {
      profitUnlocked.value = false;
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("crm_profit_unlocked");
      }
      throw error;
    } finally {
      verifyingProfitAccess.value = false;
    }
  }

  return {
    // Profit access
    profitUnlocked,
    isProfitUnlocked,
    verifyingProfitAccess,
    lockProfitAccess,

    // Global Order Notifications
    newOrdersCount,
    unseenOrderIds,
    actionRequiredCount,
    unseenActionIds,
    notificationsEnabled,
    soundEnabled,
    autoRefreshEnabled,
    setNotificationsEnabled,
    setSoundEnabled,
    setAutoRefreshEnabled,
    startPolling,
    stopPolling,
    checkForNewOrders,
    checkForActionRequired,
    markOrderAsSeen,
    markAllOrdersAsSeen,
    isOrderUnseen,
    // In-app toast (Safari fallback)
    inAppToast,
    hideInAppToast,
    // Audio unlock for Safari
    unlockAudioContext,

    // Dashboard
    dashboardStats,
    loadingDashboard,
    fetchDashboard,
    dashboardTimeseries,
    loadingTimeseries,
    fetchDashboardTimeseries,

    // Employees
    employees,
    loadingEmployees,
    fetchEmployees,
    createEmployee,
    updateEmployee,
    deleteEmployee,

    // Customers
    customers,
    currentCustomer,
    loadingCustomers,
    fetchCustomers,
    fetchCustomer,
    updateCustomer,
    blockCustomer,
    unblockCustomer,
    deleteCustomer,

    // Универсальные блокировки (новый API: pre-ban по @username + срок)
    customerBlocksList,
    loadingCustomerBlocks,
    fetchCustomerBlocksList,
    createCustomerBlock,
    removeCustomerBlock,

    // POS-клиенты (касса)
    searchCustomersForPos,
    createPosCustomer,
    deletePosCustomer,
    fetchCustomerPurchaseHistory,

    // Customer Feedbacks
    customerFeedbacks,
    loadingCustomerFeedbacks,
    fetchCustomerFeedbacks,
    createCustomerFeedback,
    deleteCustomerFeedback,

    // Orders
    orders,
    currentOrder,
    loadingOrders,
    ordersPagination,
    fetchOrders,
    fetchOrder,
    fetchOrderHistory,
    deliveredOrders,
    loadingDelivered,
    deliveredStats,
    deliveredPagination,
    fetchDeliveredOrders,
    createOrder,
    updateOrder,
    resolveManagerAction,
    issueOrder,

    // Procurements
    procurements,
    currentProcurement,
    loadingProcurements,
    fetchProcurements,
    fetchProcurement,
    createProcurement,
    completeProcurement,

    // Write-offs
    writeOffs,
    currentWriteOff,
    loadingWriteOffs,
    fetchWriteOffs,
    fetchWriteOff,
    createWriteOff,
    updateWriteOff,
    deleteWriteOff,

    // Cash
    cashAccounts,
    cashTransactions,
    loadingCash,
    fetchCashAccounts,
    createCashAccount,
    updateCashAccount,
    deleteCashAccount,
    fetchCashTransactions,
    createCashTransaction,
    updateCashTransaction,
    deleteCashTransaction,

    // Cash pacing
    cashPacingMonths,
    currentCashPacingMonth,
    loadingCashPacing,
    suggestedCashPacingMonthKey,
    fetchCashPacingMonths,
    fetchCashPacingMonth,
    createCashPacingMonth,
    updateCashPacingMonth,
    createCashPacingItem,
    updateCashPacingItem,
    deleteCashPacingItem,
    upsertCashPacingDailyFact,
    deleteCashPacingDailyFact,

    // POS Sales
    posSales,
    pendingPosSales,
    loadingPosSales,
    posSalesTotal,
    fetchPosSales,
    fetchPendingPosSales,
    createPosSale,
    updatePosSale,
    deletePosSale,

    // Promo Codes
    promoCodes,
    promoCodesLoading,
    promoCodesTotal,
    fetchPromoCodes,
    createPromoCode,
    updatePromoCode,
    deletePromoCode,
    fetchPromoUsage,

    // Loyalty
    loyaltyCategories,
    loyaltyCustomers,
    loyaltyLedger,
    loyaltyLoading,
    fetchLoyaltyCategories,
    updateLoyaltyCategory,
    updateLoyaltyMappings,
    fetchLoyaltyCustomers,
    fetchLoyaltyLedger,

    // Low stock
    lowStockProducts,
    fetchLowStockProducts,

    // Low stock GROUPS (линейки) — плашка в Закупках + индикатор в сайдбаре
    lowStockGroups,
    lowStockReasons,
    lowStockGroupsLoading,
    lowStockHasAny,
    lowStockCount,
    fetchLowStockGroups,
    fetchLowStockSummary,
    pauseLowStockGroup,
    resumeLowStockGroup,

    searchCrmProducts,
    generateOrderMessage,

    // Message Templates
    messageTemplates,
    loadingTemplates,
    fetchMessageTemplates,
    createMessageTemplate,
    updateMessageTemplate,
    deleteMessageTemplate,

    // Payments management
    deleteOrderPayment,
    updateProcurement,
    deleteProcurement,
    removeProcurementPayment,
    verifyProfitPassword,
  };
});
