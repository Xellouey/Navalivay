import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import GroupLineItem from "@/components/product/GroupLineItem.vue";
import type { Product } from "@/stores/catalog";

const fetchGroupReviewSummaryMock = vi.hoisted(() => vi.fn());

vi.mock("@/composables/useCustomerOrders", () => ({
  useCustomerOrders: () => ({
    fetchGroupReviewSummary: fetchGroupReviewSummaryMock,
  }),
}));

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
    fetchGroupReviewSummaryMock.mockReset();
    fetchGroupReviewSummaryMock.mockResolvedValue({
      review_count: 0,
      average_rating: null,
    });
  });

  const baseNode = {
    slug: "line",
    order: 0,
    productCount: 1,
    totalProductCount: 1,
    depth: 0,
    parentId: null,
    metaLabel: null,
    metaValue: null,
    children: [] as Array<Record<string, unknown>>,
    products: [makeProduct()],
  };

  async function mountLine(node: Record<string, unknown>) {
    const wrapper = mount(GroupLineItem, {
      global: {
        plugins: [pinia],
        stubs: {
          Transition: false,
          GroupLineItemContent: true,
          GroupReviewsModal: true,
          ChevronDownIcon: true,
        },
      },
      props: {
        categoryImage: null,
        expandedGroups: {},
        node,
      },
    });
    await flushPromises();
    return wrapper;
  }

  it("shows empty review state on parent group rows without a view button", async () => {
    const wrapper = await mountLine({
      ...baseNode,
      id: "brand",
      name: "PODONKI",
      children: [
        {
          ...baseNode,
          id: "line",
          name: "PODONKI PODGON",
          parentId: "brand",
          depth: 1,
        },
      ],
      products: [],
      productCount: 0,
      totalProductCount: 2,
    });

    expect(fetchGroupReviewSummaryMock).toHaveBeenCalledWith("brand");
    expect(wrapper.text().toLowerCase()).toContain("нет отзывов");
    expect(wrapper.text().toLowerCase()).not.toContain("посмотреть отзывы");
  });

  it("shows rating and view-reviews action on leaf lines with reviews", async () => {
    fetchGroupReviewSummaryMock.mockResolvedValueOnce({
      review_count: 1,
      average_rating: 5,
    });

    const wrapper = await mountLine({
      ...baseNode,
      id: "blood",
      name: "PODONKI BLOOD",
    });

    expect(fetchGroupReviewSummaryMock).toHaveBeenCalledWith("blood");
    expect(wrapper.text()).toContain("5");
    expect(wrapper.text().toLowerCase()).toContain("посмотреть отзывы");
  });

  it("shows empty review state on leaf lines without reviews", async () => {
    const wrapper = await mountLine({
      ...baseNode,
      id: "critical",
      name: "PODONKI CRITICAL",
    });

    expect(wrapper.text().toLowerCase()).toContain("нет отзывов");
    expect(wrapper.text().toLowerCase()).not.toContain("посмотреть отзывы");
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
          products: [
            makeProduct({
              id: "p-root",
              title: "VAPORESSO XROS",
              priceRub: 80,
            }),
          ],
        },
      },
    });

    expect(wrapper.find(".group-line-price").exists()).toBe(false);
  });

  it("shows the direct group price when the group has its own products", () => {
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
          id: "g-leaf",
          name: "SMOANT PASITO MINI",
          slug: "smoant-pasito-mini",
          order: 0,
          productCount: 1,
          totalProductCount: 1,
          depth: 0,
          parentId: null,
          metaLabel: null,
          metaValue: null,
          children: [],
          products: [
            makeProduct({
              id: "p-leaf",
              title: "SMOANT PASITO MINI",
              priceRub: 90,
            }),
          ],
        },
      },
    });

    const priceWrapper = wrapper.find(".group-line-price");
    expect(priceWrapper.exists()).toBe(true);
    expect(wrapper.find(".group-line-price-amount").text()).toBe("90");
    expect(wrapper.find(".group-line-price-currency").text()).toBe("BYN");
  });
});
