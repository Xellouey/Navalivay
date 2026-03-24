import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useCartStore } from "@/stores/cart";

describe("cart store order edit mode", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it("replaces cart items from order and persists edit state", () => {
    const cartStore = useCartStore();

    cartStore.replaceItemsFromOrder([
      {
        id: "oi-1",
        product_id: "p-1",
        product_title: "Liquid Cherry",
        quantity: 2,
        price_per_unit: 15,
        discount_amount: 0,
        total_price: 30,
        total_cost: 0,
        cart_item: {
          productId: "p-1",
          title: "Liquid Cherry",
          productTitle: "Liquid Cherry",
          groupName: "Жидкости",
          priceRub: 15,
          quantity: 2,
          image: "/img/liquid.png",
          variantId: null,
          variantName: null,
          groupId: "group-1",
          categoryId: "cat-1",
        },
      },
    ]);
    cartStore.startOrderEdit("order-123", { promoCode: "SAVE10" });

    expect(cartStore.items).toHaveLength(1);
    expect(cartStore.items[0].productId).toBe("p-1");
    expect(cartStore.editingOrderId).toBe("order-123");
    expect(cartStore.editingPromoCode).toBe("SAVE10");
    expect(localStorage.getItem("navalivay_edit_order_id")).toBe("order-123");
    expect(localStorage.getItem("navalivay_edit_promo_code")).toBe("SAVE10");

    cartStore.finishOrderEdit();

    expect(cartStore.editingOrderId).toBeNull();
    expect(cartStore.editingPromoCode).toBe("");
    expect(localStorage.getItem("navalivay_edit_order_id")).toBeNull();
    expect(localStorage.getItem("navalivay_edit_promo_code")).toBeNull();
  });

  it("clamps loyalty selections and clears them explicitly", () => {
    const cartStore = useCartStore();

    cartStore.replaceItemsFromOrder([
      {
        productId: "p-1",
        title: "Liquid Cherry",
        productTitle: "Liquid Cherry",
        groupName: "Liquids",
        priceRub: 15,
        quantity: 3,
        image: "/img/liquid.png",
        variantId: null,
        variantName: null,
        groupId: "group-1",
        categoryId: "cat-1",
        loyaltyUnitsApplied: 2,
      },
    ]);

    expect(cartStore.items[0].loyaltyUnitsApplied).toBe(2);

    cartStore.updateQuantity("p-1", 1);
    expect(cartStore.items[0].loyaltyUnitsApplied).toBe(1);

    cartStore.setLoyaltyUnits("p-1", 9);
    expect(cartStore.items[0].loyaltyUnitsApplied).toBe(1);

    cartStore.clearLoyaltySelections();
    expect(cartStore.items[0].loyaltyUnitsApplied).toBe(0);
  });
});
