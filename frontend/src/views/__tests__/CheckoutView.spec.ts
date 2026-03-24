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

describe("CheckoutView order flows", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    routerPush.mockReset();

    (window as any).Telegram = {
      WebApp: {
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
          LoyaltyBonusPopup: { template: "<div />" },
        },
      },
    });

    await flushPromises();

    const select = wrapper.find(".loyalty-line-select");
    expect(select.exists()).toBe(true);

    await select.setValue("1");
    await flushPromises();
    await wrapper.find(".submit-button").trigger("click");
    await flushPromises();

    expect(submittedBody?.items?.[0]?.loyalty_units_applied).toBe(1);
    expect(routerPush).toHaveBeenCalledWith("/my-order");

    wrapper.unmount();
  });
});
