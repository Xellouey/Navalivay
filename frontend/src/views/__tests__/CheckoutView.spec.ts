import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { flushPromises, mount } from "@vue/test-utils";
import CheckoutView from "@/views/CheckoutView.vue";
import { useCartStore } from "@/stores/cart";
import { useCatalogStore } from "@/stores/catalog";
import { useSettingsStore } from "@/stores/settings";

const routerPush = vi.fn();

vi.mock("vue-router", () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}));

function createJsonResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    headers: {
      get: () => "application/json",
    },
    json: async () => data,
  };
}

function buildActiveOrder() {
  return {
    found: true,
    id: "order-1",
    order_number: 101,
    status: "new",
    delivery_type: "pickup",
    delivery_address: null,
    phone: null,
    notes: null,
    total_amount: 15,
    discount_amount: 5,
    final_amount: 10,
    promo_code_text: "SAVE10",
    telegram_username: "checkout_user",
    created_at: "2026-03-24T10:00:00.000Z",
    updated_at: "2026-03-24T10:00:00.000Z",
    needs_manager_action: 0,
    manager_action_type: null,
    manager_action_note: null,
    can_edit: true,
    can_cancel: true,
    items: [
      {
        id: "oi-1",
        product_id: "p-1",
        product_title: "Liquid Cherry",
        base_product_title: "Liquid Cherry",
        quantity: 1,
        price_per_unit: 15,
        discount_amount: 0,
        total_price: 15,
        total_cost: 0,
        image: "/img/liquid.png",
        group_name: "Жидкости",
        variant_name: null,
        cart_item: {
          productId: "p-1",
          title: "Liquid Cherry",
          productTitle: "Liquid Cherry",
          groupName: "Жидкости",
          priceRub: 15,
          quantity: 1,
          image: "/img/liquid.png",
          variantId: null,
          variantName: null,
          groupId: "group-1",
          categoryId: "cat-1",
        },
      },
    ],
  };
}

function buildLoyaltySnapshot() {
  return {
    found: true,
    customer_id: "customer-1",
    telegram_username: "checkout_user",
    has_available_bonus: true,
    categories: [
      {
        id: "loyalty-liquids",
        key: "liquids",
        title: "Liquids",
        description: null,
        threshold: 10,
        discount_amount: 10,
        balance: 10,
        available_bonus_count: 1,
        remaining_to_next: 0,
        active: 1,
      },
    ],
  };
}

function buildLoyaltyPreview(appliedUnits = 0) {
  return {
    customer_id: "customer-1",
    promo_blocked: false,
    total_loyalty_discount: appliedUnits * 10,
    categories: [
      {
        category_id: "loyalty-liquids",
        category_key: "liquids",
        title: "Liquids",
        description: null,
        threshold: 10,
        discount_amount: 10,
        current_balance: 10,
        current_available_bonus_count: 1,
        items_in_cart: 1,
        eligible_purchase_units: 1,
        loyalty_units_applied: appliedUnits,
        spent_now: appliedUnits * 10,
        earned_after_fulfillment: Math.max(1 - appliedUnits, 0),
        projected_balance: appliedUnits > 0 ? 0 : 11,
        available_bonus_count: appliedUnits > 0 ? 0 : 1,
        remaining_to_next: appliedUnits > 0 ? 9 : 0,
        line_items: [
          {
            key: "p-1::",
            product_id: "p-1",
            variant_id: null,
            quantity: 1,
            loyalty_units_applied: appliedUnits,
            max_redeemable_units: 1,
            product_title: "Liquid Cherry",
          },
        ],
      },
    ],
  };
}

function buildMultiCategoryLoyaltyPreview() {
  return {
    customer_id: "customer-1",
    promo_blocked: false,
    total_loyalty_discount: 0,
    categories: [
      {
        category_id: "loyalty-liquids",
        category_key: "liquids",
        title: "Жидкости и снюс",
        description: null,
        threshold: 10,
        discount_amount: 10,
        current_balance: 0,
        current_available_bonus_count: 0,
        items_in_cart: 2,
        eligible_purchase_units: 2,
        loyalty_units_applied: 0,
        spent_now: 0,
        earned_after_fulfillment: 2,
        projected_balance: 2,
        available_bonus_count: 0,
        remaining_to_next: 8,
        line_items: [
          {
            key: "p-1::",
            product_id: "p-1",
            variant_id: null,
            quantity: 1,
            loyalty_units_applied: 0,
            max_redeemable_units: 1,
            product_title: "Liquid Cherry",
          },
          {
            key: "p-2::",
            product_id: "p-2",
            variant_id: null,
            quantity: 1,
            loyalty_units_applied: 0,
            max_redeemable_units: 1,
            product_title: "Snus Mint",
          },
        ],
      },
      {
        category_id: "loyalty-disposables",
        category_key: "disposables",
        title: "Одноразки",
        description: null,
        threshold: 5,
        discount_amount: 15,
        current_balance: 0,
        current_available_bonus_count: 0,
        items_in_cart: 1,
        eligible_purchase_units: 1,
        loyalty_units_applied: 0,
        spent_now: 0,
        earned_after_fulfillment: 1,
        projected_balance: 1,
        available_bonus_count: 0,
        remaining_to_next: 4,
        line_items: [
          {
            key: "p-3::",
            product_id: "p-3",
            variant_id: null,
            quantity: 1,
            loyalty_units_applied: 0,
            max_redeemable_units: 1,
            product_title: "Disposable Mint",
          },
        ],
      },
      {
        category_id: "loyalty-devices",
        category_key: "devices",
        title: "Устройства",
        description: null,
        threshold: 4,
        discount_amount: 25,
        current_balance: 0,
        current_available_bonus_count: 0,
        items_in_cart: 1,
        eligible_purchase_units: 1,
        loyalty_units_applied: 0,
        spent_now: 0,
        earned_after_fulfillment: 1,
        projected_balance: 1,
        available_bonus_count: 0,
        remaining_to_next: 3,
        line_items: [
          {
            key: "p-4::",
            product_id: "p-4",
            variant_id: null,
            quantity: 1,
            loyalty_units_applied: 0,
            max_redeemable_units: 1,
            product_title: "Device X",
          },
        ],
      },
    ],
  };
}

function buildSingleBonusChoicePreview() {
  return {
    customer_id: "customer-1",
    promo_blocked: false,
    total_loyalty_discount: 0,
    categories: [
      {
        category_id: "loyalty-liquids",
        category_key: "liquids",
        title: "Жидкости и снюс",
        description: null,
        threshold: 10,
        discount_amount: 10,
        current_balance: 10,
        current_available_bonus_count: 1,
        items_in_cart: 2,
        eligible_purchase_units: 2,
        loyalty_units_applied: 0,
        spent_now: 0,
        earned_after_fulfillment: 1,
        projected_balance: 1,
        available_bonus_count: 0,
        remaining_to_next: 9,
        line_items: [
          {
            key: "p-1::",
            product_id: "p-1",
            variant_id: null,
            quantity: 1,
            loyalty_units_applied: 0,
            max_redeemable_units: 1,
            product_title: "Liquid Cherry",
          },
          {
            key: "p-2::",
            product_id: "p-2",
            variant_id: null,
            quantity: 1,
            loyalty_units_applied: 0,
            max_redeemable_units: 1,
            product_title: "Snus Mint",
          },
        ],
      },
      {
        category_id: "loyalty-devices",
        category_key: "devices",
        title: "Устройства",
        description: null,
        threshold: 4,
        discount_amount: 25,
        current_balance: 0,
        current_available_bonus_count: 0,
        items_in_cart: 1,
        eligible_purchase_units: 1,
        loyalty_units_applied: 0,
        spent_now: 0,
        earned_after_fulfillment: 1,
        projected_balance: 1,
        available_bonus_count: 0,
        remaining_to_next: 3,
        line_items: [
          {
            key: "p-3::",
            product_id: "p-3",
            variant_id: null,
            quantity: 1,
            loyalty_units_applied: 0,
            max_redeemable_units: 1,
            product_title: "Device X",
          },
        ],
      },
    ],
  };
}

function buildCrossCategoryMultiBonusPreview() {
  return {
    customer_id: "customer-1",
    promo_blocked: false,
    total_loyalty_discount: 0,
    categories: [
      {
        category_id: "loyalty-liquids",
        category_key: "liquids",
        title: "Жидкости и снюс",
        description: null,
        threshold: 10,
        discount_amount: 10,
        current_balance: 20,
        current_available_bonus_count: 1,
        items_in_cart: 2,
        eligible_purchase_units: 2,
        loyalty_units_applied: 0,
        spent_now: 0,
        earned_after_fulfillment: 2,
        projected_balance: 22,
        available_bonus_count: 2,
        remaining_to_next: 8,
        line_items: [
          {
            key: "p-1::",
            product_id: "p-1",
            variant_id: null,
            quantity: 1,
            loyalty_units_applied: 0,
            max_redeemable_units: 1,
            product_title: "Liquid Cherry",
          },
          {
            key: "p-2::",
            product_id: "p-2",
            variant_id: null,
            quantity: 1,
            loyalty_units_applied: 0,
            max_redeemable_units: 1,
            product_title: "Snus Mint",
          },
        ],
      },
      {
        category_id: "loyalty-devices",
        category_key: "devices",
        title: "Устройства",
        description: null,
        threshold: 4,
        discount_amount: 25,
        current_balance: 8,
        current_available_bonus_count: 1,
        items_in_cart: 1,
        eligible_purchase_units: 1,
        loyalty_units_applied: 0,
        spent_now: 0,
        earned_after_fulfillment: 1,
        projected_balance: 9,
        available_bonus_count: 2,
        remaining_to_next: 3,
        line_items: [
          {
            key: "p-3::",
            product_id: "p-3",
            variant_id: null,
            quantity: 1,
            loyalty_units_applied: 0,
            max_redeemable_units: 1,
            product_title: "Device X",
          },
        ],
      },
    ],
  };
}

describe("CheckoutView order flows", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    routerPush.mockReset();

    (window as any).Telegram = {
      WebApp: {
        initData: "signed_init_data",
        initDataUnsafe: {
          user: {
            id: 1,
            username: "checkout_user",
            first_name: "Checkout",
            last_name: "User",
          },
        },
      },
    };

    const settingsStore = useSettingsStore();
    settingsStore.fetchSettings = vi.fn(async () => undefined);
    settingsStore.settings = {
      manager_telegram: "manager",
      min_delivery_amount: "0",
      min_delivery_banner_image: "",
      min_delivery_banner_button_text: "Ок",
      min_delivery_banner_button_color: "#ffffff",
      delivery_conditions_image: "",
      order_redirect_telegram: "",
      order_redirect_text_template: "",
    };

    const catalogStore = useCatalogStore();
    catalogStore.fetchCategories = vi.fn(async () => undefined);
    catalogStore.categories = [];
  });

  it("uses modify endpoint in edit mode", async () => {
    const cartStore = useCartStore();
    let promoValidateBody: any = null;
    cartStore.replaceItemsFromOrder([
      {
        productId: "p-1",
        title: "Liquid Cherry",
        productTitle: "Liquid Cherry",
        groupName: "Жидкости",
        priceRub: 15,
        quantity: 1,
        image: "/img/liquid.png",
        variantId: null,
        variantName: null,
        groupId: "group-1",
        categoryId: "cat-1",
      },
    ]);
    cartStore.startOrderEdit("order-1", { promoCode: "SAVE10" });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/product/")) {
        return createJsonResponse({ id: "p-1", hasVariants: false, stock: 10 });
      }
      if (url.startsWith("/api/orders/my-active")) {
        return createJsonResponse(buildActiveOrder());
      }
      if (url.startsWith("/api/loyalty/me")) {
        return createJsonResponse(buildLoyaltySnapshot());
      }
      if (url === "/api/loyalty/checkout-preview") {
        const body = JSON.parse(String(init?.body || "{}"));
        const applied = Number(body?.items?.[0]?.loyalty_units_applied || 0);
        return createJsonResponse(buildLoyaltyPreview(applied));
      }
      if (url === "/api/promo/validate") {
        promoValidateBody = JSON.parse(String(init?.body || "{}"));
        return createJsonResponse({
          valid: true,
          discount_type: "fixed",
          discount_value: 10,
          calculated_discount: 5,
          description: "Promo",
        });
      }
      if (url === "/api/orders/order-1/modify-by-customer" && init?.method === "PUT") {
        return createJsonResponse({ success: true });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(CheckoutView, {
      global: {
        stubs: {
          MinDeliveryBanner: { template: "<div />" },
          DeliveryConditionsBanner: { template: "<div />" },
          AdminModal: { template: "<div><slot /></div>" },
          CustomerModalShell: { template: "<div><slot /><slot name='footer' /></div>" },
          LoyaltyBonusPopup: { template: "<div />" },
        },
      },
    });

    await flushPromises();
    expect(wrapper.text()).toContain("Редактирование заказа");

    await wrapper.find(".submit-button").trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/orders/order-1/modify-by-customer",
      expect.objectContaining({
        method: "PUT",
      }),
    );
    expect(promoValidateBody?.editing_order_id).toBe("order-1");
    expect(cartStore.editingOrderId).toBeNull();
    expect(routerPush).toHaveBeenCalledWith("/my-order");

    wrapper.unmount();
  });

  it("redirects to my-order when create is blocked by active order", async () => {
    const cartStore = useCartStore();
    cartStore.replaceItemsFromOrder([
      {
        productId: "p-1",
        title: "Liquid Cherry",
        productTitle: "Liquid Cherry",
        groupName: "Жидкости",
        priceRub: 15,
        quantity: 1,
        image: "/img/liquid.png",
        variantId: null,
        variantName: null,
        groupId: "group-1",
        categoryId: "cat-1",
      },
    ]);

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/product/")) {
        return createJsonResponse({ id: "p-1", hasVariants: false, stock: 10 });
      }
      if (url === "/api/orders" && init?.method === "POST") {
        return createJsonResponse(
          {
            error: "active_order_exists",
            order_id: "order-1",
            order_number: 101,
          },
          false,
          409,
        );
      }
      if (url.startsWith("/api/loyalty/me")) {
        return createJsonResponse(buildLoyaltySnapshot());
      }
      if (url === "/api/loyalty/checkout-preview") {
        return createJsonResponse(buildLoyaltyPreview(0));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(CheckoutView, {
      global: {
        stubs: {
          MinDeliveryBanner: { template: "<div />" },
          DeliveryConditionsBanner: { template: "<div />" },
          AdminModal: { template: "<div><slot /></div>" },
          CustomerModalShell: { template: "<div><slot /><slot name='footer' /></div>" },
          LoyaltyBonusPopup: { template: "<div />" },
        },
      },
    });

    await flushPromises();
    await wrapper.find(".submit-button").trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/orders",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(routerPush).toHaveBeenCalledWith("/my-order");

    wrapper.unmount();
  });

  it("submits loyalty units selected in checkout", async () => {
    const cartStore = useCartStore();
    cartStore.replaceItemsFromOrder([
      {
        productId: "p-1",
        title: "Liquid Cherry",
        productTitle: "Liquid Cherry",
        groupName: "Liquids",
        priceRub: 15,
        quantity: 1,
        image: "/img/liquid.png",
        variantId: null,
        variantName: null,
        groupId: "group-1",
        categoryId: "c_liquids_salt",
      },
    ]);

    let submittedBody: any = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/product/")) {
        return createJsonResponse({ id: "p-1", hasVariants: false, stock: 10 });
      }
      if (url.startsWith("/api/loyalty/me")) {
        return createJsonResponse(buildLoyaltySnapshot());
      }
      if (url === "/api/loyalty/checkout-preview") {
        const body = JSON.parse(String(init?.body || "{}"));
        const applied = Number(body?.items?.[0]?.loyalty_units_applied || 0);
        return createJsonResponse(buildLoyaltyPreview(applied));
      }
      if (url === "/api/orders" && init?.method === "POST") {
        submittedBody = JSON.parse(String(init.body || "{}"));
        return createJsonResponse({ success: true, order_id: "order-loyalty" });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(CheckoutView, {
      global: {
        stubs: {
          MinDeliveryBanner: { template: "<div />" },
          DeliveryConditionsBanner: { template: "<div />" },
          AdminModal: { template: "<div><slot /></div>" },
          CustomerModalShell: { template: "<div><slot /><slot name='footer' /></div>" },
          LoyaltyBonusPopup: { template: "<div />" },
        },
      },
    });

    await flushPromises();
    await flushPromises();

    await wrapper.find(".loyalty-line-button").trigger("click");
    await flushPromises();
    await flushPromises();
    await wrapper.find(".submit-button").trigger("click");
    await flushPromises();

    expect(submittedBody?.items?.[0]?.loyalty_units_applied).toBe(1);
    expect(routerPush).toHaveBeenCalledWith("/my-order");

    wrapper.unmount();
  });

  it("shows loyalty preview widget in browser without Telegram", async () => {
    const cartStore = useCartStore();
    cartStore.replaceItemsFromOrder([
      {
        productId: "p-1",
        title: "Liquid Cherry",
        productTitle: "Liquid Cherry",
        groupName: "Liquids",
        priceRub: 15,
        quantity: 1,
        image: "/img/liquid.png",
        variantId: null,
        variantName: null,
        groupId: "group-1",
        categoryId: "c_liquids_salt",
      },
    ]);

    (window as any).Telegram = undefined;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/product/")) {
        return createJsonResponse({ id: "p-1", hasVariants: false, stock: 10 });
      }
      if (url.startsWith("/api/loyalty/me")) {
        return createJsonResponse(buildLoyaltySnapshot());
      }
      if (url === "/api/loyalty/checkout-preview") {
        return createJsonResponse(buildLoyaltyPreview(0));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(CheckoutView, {
      global: {
        stubs: {
          MinDeliveryBanner: { template: "<div />" },
          DeliveryConditionsBanner: { template: "<div />" },
          AdminModal: { template: "<div><slot /></div>" },
          CustomerModalShell: { template: "<div><slot /><slot name='footer' /></div>" },
          LoyaltyBonusPopup: { template: "<div />" },
        },
      },
    });

    await flushPromises();
    await flushPromises();

    expect(wrapper.find(".loyalty-card").exists()).toBe(true);
    expect(wrapper.findAll(".loyalty-tab")).toHaveLength(1);
    expect(wrapper.find(".loyalty-card-title-main").text()).toContain("Бонусная система");
    expect(wrapper.find(".user-info-input").exists()).toBe(true);

    wrapper.unmount();
  });

  it("renders one loyalty widget with tabs for preview categories", async () => {
    const cartStore = useCartStore();
    cartStore.replaceItemsFromOrder([
      {
        productId: "p-1",
        title: "Liquid Cherry",
        productTitle: "Liquid Cherry",
        groupName: "Жидкости",
        priceRub: 15,
        quantity: 1,
        image: "/img/liquid.png",
        variantId: null,
        variantName: null,
        groupId: "group-1",
        categoryId: "c_liquids_salt",
      },
      {
        productId: "p-2",
        title: "Snus Mint",
        productTitle: "Snus Mint",
        groupName: "Снюс",
        priceRub: 8,
        quantity: 1,
        image: "/img/snus.png",
        variantId: null,
        variantName: null,
        groupId: "group-2",
        categoryId: "c_snus",
      },
      {
        productId: "p-3",
        title: "Disposable Mint",
        productTitle: "Disposable Mint",
        groupName: "Одноразки",
        priceRub: 25,
        quantity: 1,
        image: "/img/disposable.png",
        variantId: null,
        variantName: null,
        groupId: "group-3",
        categoryId: "c_disposables",
      },
      {
        productId: "p-4",
        title: "Device X",
        productTitle: "Device X",
        groupName: "Устройства",
        priceRub: 55,
        quantity: 1,
        image: "/img/device.png",
        variantId: null,
        variantName: null,
        groupId: "group-4",
        categoryId: "c_devices",
      },
    ]);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/product/")) {
        return createJsonResponse({ id: "p-1", hasVariants: false, stock: 10 });
      }
      if (url.startsWith("/api/loyalty/me")) {
        return createJsonResponse(buildLoyaltySnapshot());
      }
      if (url === "/api/loyalty/checkout-preview") {
        return createJsonResponse(buildMultiCategoryLoyaltyPreview());
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(CheckoutView, {
      global: {
        stubs: {
          MinDeliveryBanner: { template: "<div />" },
          DeliveryConditionsBanner: { template: "<div />" },
          AdminModal: { template: "<div><slot /></div>" },
          CustomerModalShell: { template: "<div><slot /><slot name='footer' /></div>" },
          LoyaltyBonusPopup: { template: "<div />" },
        },
      },
    });

    await flushPromises();
    await flushPromises();

    expect(wrapper.findAll(".loyalty-card")).toHaveLength(1);
    expect(wrapper.findAll(".loyalty-tab")).toHaveLength(3);
    expect(wrapper.find(".loyalty-tab--active").exists()).toBe(true);

    const tabs = wrapper.findAll(".loyalty-tab");
    const initialActiveLabel = wrapper.find(".loyalty-tab--active").text();

    await tabs[1].trigger("click");
    await flushPromises();
    expect(wrapper.find(".loyalty-tab--active").text()).not.toBe(initialActiveLabel);

    expect(wrapper.find(".loyalty-progress-value").text()).toBe("1 / 5");
    expect(wrapper.find(".loyalty-copy").text()).toContain("15 BYN");

    expect(wrapper.text()).not.toContain("Жидкости и снюс");
    expect(wrapper.text()).toContain("Одноразки");
    expect(wrapper.text()).toContain("Устройства");

    wrapper.unmount();
  });

  it("lets user choose only one bonus unit inside the earned category", async () => {
    const cartStore = useCartStore();
    cartStore.replaceItemsFromOrder([
      {
        productId: "p-1",
        title: "Liquid Cherry",
        productTitle: "Liquid Cherry",
        groupName: "Жидкости",
        priceRub: 15,
        quantity: 1,
        image: "/img/liquid.png",
        variantId: null,
        variantName: null,
        groupId: "group-1",
        categoryId: "c_liquids_salt",
      },
      {
        productId: "p-2",
        title: "Snus Mint",
        productTitle: "Snus Mint",
        groupName: "Снюс",
        priceRub: 8,
        quantity: 1,
        image: "/img/snus.png",
        variantId: null,
        variantName: null,
        groupId: "group-2",
        categoryId: "c_snus",
      },
      {
        productId: "p-3",
        title: "Device X",
        productTitle: "Device X",
        groupName: "Устройства",
        priceRub: 55,
        quantity: 1,
        image: "/img/device.png",
        variantId: null,
        variantName: null,
        groupId: "group-3",
        categoryId: "c_devices",
      },
    ]);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/product/")) {
        return createJsonResponse({ id: "p-1", hasVariants: false, stock: 10 });
      }
      if (url.startsWith("/api/loyalty/me")) {
        return createJsonResponse(buildLoyaltySnapshot());
      }
      if (url === "/api/loyalty/checkout-preview") {
        return createJsonResponse(buildSingleBonusChoicePreview());
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(CheckoutView, {
      global: {
        stubs: {
          MinDeliveryBanner: { template: "<div />" },
          DeliveryConditionsBanner: { template: "<div />" },
          AdminModal: { template: "<div><slot /></div>" },
          CustomerModalShell: { template: "<div><slot /><slot name='footer' /></div>" },
          LoyaltyBonusPopup: { template: "<div />" },
        },
      },
    });

    await flushPromises();
    await flushPromises();

    expect(wrapper.text()).toContain("Liquid Cherry");
    expect(wrapper.text()).toContain("Snus Mint");
    expect(wrapper.text()).not.toContain("Device X");

    const buttons = wrapper.findAll(".loyalty-line-button");
    expect(buttons).toHaveLength(2);
    expect(buttons.map((button) => button.text())).toEqual(["Применить", "Применить"]);

    await buttons[0].trigger("click");
    await flushPromises();
    await flushPromises();

    const refreshedButtons = wrapper.findAll(".loyalty-line-button");
    expect(refreshedButtons).toHaveLength(1);
    expect(refreshedButtons[0].text()).toBe("Применено");
    expect(wrapper.findAll(".loyalty-line-state").map((item) => item.text())).toContain("Бонус уже выбран");

    const tabs = wrapper.findAll(".loyalty-tab");
    await tabs[1].trigger("click");
    await flushPromises();

    expect(wrapper.find(".loyalty-tab--active").text()).toContain("Устройства");
    expect(wrapper.find(".loyalty-progress-value").text()).toBe("1 / 4");
    expect(wrapper.findAll(".loyalty-line-button")).toHaveLength(0);
    expect(wrapper.find(".loyalty-copy--secondary").exists()).toBe(true);
    expect(wrapper.text()).not.toContain("Snus Mint");

    wrapper.unmount();
  });

  it("allows bonus selection in different categories within one order", async () => {
    const cartStore = useCartStore();
    cartStore.replaceItemsFromOrder([
      {
        productId: "p-1",
        title: "Liquid Cherry",
        productTitle: "Liquid Cherry",
        groupName: "Жидкости",
        priceRub: 15,
        quantity: 1,
        image: "/img/liquid.png",
        variantId: null,
        variantName: null,
        groupId: "group-1",
        categoryId: "c_liquids_salt",
      },
      {
        productId: "p-2",
        title: "Snus Mint",
        productTitle: "Snus Mint",
        groupName: "Снюс",
        priceRub: 8,
        quantity: 1,
        image: "/img/snus.png",
        variantId: null,
        variantName: null,
        groupId: "group-2",
        categoryId: "c_snus",
      },
      {
        productId: "p-3",
        title: "Device X",
        productTitle: "Device X",
        groupName: "Устройства",
        priceRub: 55,
        quantity: 1,
        image: "/img/device.png",
        variantId: null,
        variantName: null,
        groupId: "group-3",
        categoryId: "c_devices",
      },
    ]);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/product/")) {
        return createJsonResponse({ id: "p-1", hasVariants: false, stock: 10 });
      }
      if (url.startsWith("/api/loyalty/me")) {
        return createJsonResponse(buildLoyaltySnapshot());
      }
      if (url === "/api/loyalty/checkout-preview") {
        return createJsonResponse(buildCrossCategoryMultiBonusPreview());
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(CheckoutView, {
      global: {
        stubs: {
          MinDeliveryBanner: { template: "<div />" },
          DeliveryConditionsBanner: { template: "<div />" },
          AdminModal: { template: "<div><slot /></div>" },
          CustomerModalShell: { template: "<div><slot /><slot name='footer' /></div>" },
          LoyaltyBonusPopup: { template: "<div />" },
        },
      },
    });

    await flushPromises();
    await flushPromises();

    await wrapper.findAll(".loyalty-line-button")[0].trigger("click");
    await flushPromises();
    await flushPromises();

    await wrapper.findAll(".loyalty-tab")[1].trigger("click");
    await flushPromises();

    const deviceButton = wrapper.find(".loyalty-line-button");
    expect(deviceButton.exists()).toBe(true);
    expect(deviceButton.text()).toBe("Применить");

    wrapper.unmount();
  });
});
