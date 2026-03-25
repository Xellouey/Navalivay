import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import GroupLineItem from "@/components/product/GroupLineItem.vue";
import type { Product } from "@/stores/catalog";

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: "p-1",
  categoryId: "c-1",
  title: "Base product",
  priceRub: 100,
  description: "",
  images: [],
  createdAt: "2025-01-01T00:00:00.000Z",
  ...overrides,
});

describe("GroupLineItem", () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  it("does not show group price even when nested child products have prices", () => {
    const wrapper = mount(GroupLineItem, {
      global: {
        plugins: [pinia],
        stubs: {
          Transition: false,
          GroupLineItemContent: true,
        },
      },
      props: {
        categoryImage: null,
        expandedGroups: {},
        node: {
          id: "g-root",
          name: "VAPORESSO XROS",
          slug: "vaporesso-xros",
          order: 0,
          productCount: 0,
          totalProductCount: 2,
          depth: 0,
          parentId: null,
          metaLabel: null,
          metaValue: null,
          children: [
            {
              id: "g-expensive",
              name: "XROS PRO 2",
              slug: "xros-pro-2",
              order: 0,
              productCount: 1,
              totalProductCount: 1,
              depth: 1,
              parentId: "g-root",
              metaLabel: null,
              metaValue: null,
              children: [],
              products: [
                makeProduct({
                  id: "p-expensive",
                  title: "XROS PRO 2",
                  priceRub: 115,
                  hasVariants: true,
                  variants: [
                    {
                      id: "v-expensive",
                      name: "Black",
                      priceRub: 115,
                      stock: 3,
                      images: [],
                    },
                  ],
                }),
              ],
            },
            {
              id: "g-cheap",
              name: "XROS 3 MINI",
              slug: "xros-3-mini",
              order: 1,
              productCount: 1,
              totalProductCount: 1,
              depth: 1,
              parentId: "g-root",
              metaLabel: null,
              metaValue: null,
              children: [],
              products: [
                makeProduct({
                  id: "p-cheap",
                  title: "XROS 3 MINI",
                  priceRub: 55,
                  hasVariants: true,
                  variants: [
                    {
                      id: "v-cheap",
                      name: "Silver",
                      priceRub: 55,
                      stock: 3,
                      images: [],
                    },
                  ],
                }),
              ],
            },
          ],
          products: [],
        },
      },
    });

    expect(wrapper.find(".group-line-price").exists()).toBe(false);
  });
});
