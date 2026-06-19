import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import LiquidLineCard from "@/components/product/liquid/LiquidLineCard.vue";
import type { Product } from "@/stores/catalog";

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: "p-1",
  categoryId: "c-1",
  title: "CHAPPMAN",
  priceRub: 15,
  description: "",
  images: [],
  createdAt: "2025-01-01T00:00:00.000Z",
  ...overrides,
});

describe("LiquidLineCard", () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    localStorage.clear();
  });

  it("shows a price in the header for a line with direct products", () => {
    const wrapper = mount(LiquidLineCard, {
      global: {
        plugins: [pinia],
        stubs: {
          ColorPreviewModal: true,
        },
      },
      props: {
        groupId: "g-1",
        title: "CHAPPMAN",
        products: [
          makeProduct({
            hasVariants: true,
            variants: [
              { id: "v-1", name: "20 мг", priceRub: 15, stock: 5, images: [] },
            ],
          }),
        ],
        expanded: false,
        coverImage: null,
        fallbackImage: "/placeholder-category.png",
        subgroups: [],
        metaLabel: "Крепость",
        metaValue: "20 мг",
      },
    });

    expect(wrapper.find(".liquid-line-price").exists()).toBe(false);
    expect(wrapper.find(".liquid-line-meta").text()).toBe("Крепость 20 мг");
  });

  it("does not show a price for a parent line with subgroups", () => {
    const wrapper = mount(LiquidLineCard, {
      global: {
        plugins: [pinia],
        stubs: {
          ColorPreviewModal: true,
        },
      },
      props: {
        groupId: "g-2",
        title: "PODONKI",
        products: [makeProduct({ id: "p-2", priceRub: 12 })],
        expanded: false,
        coverImage: null,
        fallbackImage: "/placeholder-category.png",
        subgroups: [{ id: "child-1", name: "PODONKI V1", productCount: 3 }],
        metaLabel: null,
        metaValue: null,
      },
    });

    expect(wrapper.find(".liquid-line-price").exists()).toBe(false);
  });

  it("shows price as the second line when meta is absent", () => {
    const wrapper = mount(LiquidLineCard, {
      global: {
        plugins: [pinia],
        stubs: {
          ColorPreviewModal: true,
        },
      },
      props: {
        groupId: "g-3",
        title: "CHAPPMAN",
        products: [makeProduct({ priceRub: 15 })],
        expanded: false,
        coverImage: null,
        fallbackImage: "/placeholder-category.png",
        subgroups: [],
        metaLabel: null,
        metaValue: null,
      },
    });

    expect(wrapper.find(".liquid-line-price").exists()).toBe(true);
    expect(wrapper.find(".liquid-line-price-amount").text()).toBe("15");
  });
});
