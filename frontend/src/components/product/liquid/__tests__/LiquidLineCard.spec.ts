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

  it("shows meta in info and price under the image", () => {
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

    expect(wrapper.find(".liquid-line-meta").text()).toBe("Крепость 20 мг");
    expect(wrapper.find(".liquid-line-info .liquid-line-image-price").exists()).toBe(false);
    expect(wrapper.find(".liquid-line-image-price").exists()).toBe(true);
    expect(wrapper.find(".liquid-line-image-price-amount").text()).toBe("15");
    expect(wrapper.find(".liquid-line-image-wrapper .liquid-line-image-price").exists()).toBe(true);
  });

  it("hides flavor prices in the expanded list when they match the header price", () => {
    const wrapper = mount(LiquidLineCard, {
      global: {
        plugins: [pinia],
        stubs: {
          ColorPreviewModal: true,
        },
      },
      props: {
        groupId: "g-podgon",
        title: "PODONKI PODGON",
        products: [
          makeProduct({ id: "p-1", title: "Малиновая конфета", priceRub: 15 }),
          makeProduct({ id: "p-2", title: "Апельсин", priceRub: 15 }),
        ],
        expanded: true,
        coverImage: null,
        fallbackImage: "/placeholder-category.png",
        subgroups: [],
        metaLabel: "Крепость",
        metaValue: "50 мг",
      },
    });

    expect(wrapper.findAll(".liquid-flavor-price").length).toBe(0);
    expect(wrapper.find(".liquid-line-image-price-amount").text()).toBe("15");
  });

  it("shows only differing flavor prices in red in the expanded list", () => {
    const wrapper = mount(LiquidLineCard, {
      global: {
        plugins: [pinia],
        stubs: {
          ColorPreviewModal: true,
        },
      },
      props: {
        groupId: "g-mix",
        title: "MIX LINE",
        products: [
          makeProduct({ id: "p-1", title: "Обычный", priceRub: 18 }),
          makeProduct({ id: "p-2", title: "Премиум", priceRub: 20 }),
        ],
        expanded: true,
        coverImage: null,
        fallbackImage: "/placeholder-category.png",
        subgroups: [],
        metaLabel: null,
        metaValue: null,
      },
    });

    const flavorPrices = wrapper.findAll(".liquid-flavor-price");
    expect(flavorPrices.length).toBe(1);
    expect(flavorPrices[0]?.text()).toBe("20 BYN");
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

    expect(wrapper.find(".liquid-line-image-price").exists()).toBe(false);
  });

  it("shows price under the image when meta is absent", () => {
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

    expect(wrapper.find(".liquid-line-image-price").exists()).toBe(true);
    expect(wrapper.find(".liquid-line-image-price-amount").text()).toBe("15");
  });
});
