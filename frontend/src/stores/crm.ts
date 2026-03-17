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
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_title: string;
  product_description?: string | null;
  group_name?: string | null;
  base_product_id?: string | null;
  base_product_title?: string | null;
  variant_name?: string | null;
  quantity: number;
  price_per_unit: number;
  cost_per_unit: number;
  discount_amount: number;
  total_price: number;
  total_cost: number;
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
  group_name?: string | null;
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
  product_title: string;
  group_name?: string | null;
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
  employee_id: string | null;
  employee_name: string | null;
  created_at: string;
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
    total_quantity: number;
    total_revenue: number;
    total_profit: number;
  }>;
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

  // Обработка 401 - перенаправление на админ логин
  if (response.status === 401) {
    console.warn("[CRM] Unauthorized - redirecting to login");
    window.location.href = "/admin";
    throw new Error("Unauthorized");
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

  function triggerBrowserNotification(count: number) {
    // Always show in-app toast (works in Safari and all browsers)
    const toastMessage = count === 1 ? "Новый заказ!" : `Новых заказов: ${count}`;
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

    const title = count === 1 ? "Новый заказ" : `Новых заказов: ${count}`;
    const body =
      count === 1
        ? "Появился новый заказ в колонке «Новые»."
        : "На доске появились новые заказы. Проверьте колонку «Новые».";

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

  function startPolling() {
    if (pollingTimer) return;
    checkForNewOrders(); // Initial check
    pollingTimer = setInterval(checkForNewOrders, POLLING_INTERVAL_MS);
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
    period: "today" | "week" | "month" | "year" = "today",
    offset: number = 0,
  ) {
    loadingDashboard.value = true;
    try {
      dashboardStats.value = await fetchAPI<DashboardStats>(
        `${API_BASE}/dashboard?period=${period}&offset=${offset}`,
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

  async function createOrder(data: {
    customer_id?: string;
    delivery_type: "pickup" | "delivery";
    delivery_address?: string;
    discount_amount?: number;
    discount_percent?: number;
    notes?: string;
    items: Array<{
      product_id: string;
      quantity: number;
      price_per_unit?: number;
      discount_amount?: number;
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
      delivery_address?: string;
      notes?: string;
      discount_amount?: number;
      discount_percent?: number;
      items?: Array<{
        product_id: string;
        quantity: number;
        price_per_unit?: number;
        discount_amount?: number;
      }>;
      payment_type?: "cash";
      payment_account_id?: string;
      paid_amount?: number;
      payment_notes?: string;
      reactivate?: boolean;
    },
  ) {
    const order = await fetchAPI<Order>(`${API_BASE}/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    const index = orders.value.findIndex((o) => o.id === id);
    if (index !== -1) {
      orders.value[index] = order;
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
      }

      return result;
    } catch (error) {
      profitUnlocked.value = false;
      throw error;
    } finally {
      verifyingProfitAccess.value = false;
    }
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

  // Low stock
  const lowStockProducts = ref<any[]>([]);

  async function fetchLowStockProducts() {
    lowStockProducts.value = await fetchAPI<any[]>(
      `${API_BASE}/products/low-stock`,
    );
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
    notificationsEnabled,
    soundEnabled,
    autoRefreshEnabled,
    setNotificationsEnabled,
    setSoundEnabled,
    setAutoRefreshEnabled,
    startPolling,
    stopPolling,
    checkForNewOrders,
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
    createOrder,
    updateOrder,
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

    // Low stock
    lowStockProducts,
    fetchLowStockProducts,

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
