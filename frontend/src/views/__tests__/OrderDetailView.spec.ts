import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import OrderDetailView from "@/views/OrderDetailView.vue";

const routerPush = vi.hoisted(() => vi.fn());
const fetchOrderDetailMock = vi.hoisted(() => vi.fn());
const fetchReviewPromptMock = vi.hoisted(() => vi.fn());

const routeState = vi.hoisted(() => ({
  params: { orderId: "ord1" },
  query: {} as Record<string, string>,
}));

vi.mock("vue-router", () => ({
  useRoute: () => routeState,
  useRouter: () => ({ push: routerPush }),
}));

vi.mock("@/composables/useCustomerOrders", () => ({
  formatDurationMinutes: (minutes: number) => `${minutes} мин`,
  formatOrderDate: (value: string) => value.slice(0, 10),
  formatOrderDateTime: (value: string) => value.replace("T", " ").slice(0, 16),
  formatOrderStatus: (status: string) => (status === "delivered" ? "Доставлен" : status),
  useCustomerOrders: () => ({
    fetchOrderDetail: fetchOrderDetailMock,
    fetchReviewPrompt: fetchReviewPromptMock,
    reviewPreferences: { value: { reviews_prefer_anonymous: false, reviews_opt_out: false } },
  }),
}));

const orderDetail = {
  id: "ord1",
  order_number: 1001,
  status: "delivered",
  created_at: "2026-06-01T10:00:00.000Z",
  completed_at: "2026-06-01T12:00:00.000Z",
  final_amount: 42,
  fulfillment: {
    created_at: "2026-06-01T10:00:00.000Z",
    completed_at: "2026-06-01T12:00:00.000Z",
    duration_minutes: 120,
  },
  status_timeline: [
    {
      new_status: "delivered",
      changed_at: "2026-06-01T12:00:00.000Z",
      note: null,
    },
  ],
  lottery_hint_text: "Оставьте отзыв — участвуйте в розыгрыше",
  reviewable_lines: [
    {
      group_id: "grp1",
      group_name: "Подонки",
      group_cover_image: null,
      category_cover_image: null,
      purchased_variant_name: "Ананасовая шипучка",
      order_item_id: "oi1",
      review_category_key: "liquids",
      items: [{ total_price: 42 }],
      eligibility: { canReview: true, reason: null, cooldownEndsAt: null },
      latest_review: null,
    },
  ],
};

describe("OrderDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeState.params = { orderId: "ord1" };
    routeState.query = {};
    fetchOrderDetailMock.mockResolvedValue(orderDetail);
    fetchReviewPromptMock.mockResolvedValue({ show: false });
    vi.spyOn(document, "getElementById").mockReturnValue({
      scrollIntoView: vi.fn(),
    } as unknown as HTMLElement);
  });

  it("renders order summary and review section", async () => {
    const wrapper = mount(OrderDetailView, {
      global: {
        stubs: {
          ReviewLineCard: {
            props: ["line", "orderId", "initialRating", "highlighted"],
            template:
              '<div class="review-line-stub" :data-rating="initialRating" :data-highlighted="highlighted">{{ line.group_name }}</div>',
          },
        },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("Заказ №1001");
    expect(wrapper.text()).toContain("Доставлен");
    expect(wrapper.text()).toContain("Оставьте отзыв — участвуйте в розыгрыше");
    expect(wrapper.find(".review-line-stub").text()).toBe("Подонки");

    wrapper.unmount();
  });

  it("passes deep-link rating and highlight to matching line", async () => {
    routeState.query = { rating: "4", groupId: "grp1" };

    const wrapper = mount(OrderDetailView, {
      global: {
        stubs: {
          ReviewLineCard: {
            props: ["line", "orderId", "initialRating", "highlighted"],
            template:
              '<div class="review-line-stub" :data-rating="initialRating" :data-highlighted="highlighted" />',
          },
        },
      },
    });
    await flushPromises();

    const stub = wrapper.find(".review-line-stub");
    expect(stub.attributes("data-rating")).toBe("4");
    expect(stub.attributes("data-highlighted")).toBe("true");
    expect(document.getElementById).toHaveBeenCalledWith("review-line-grp1");

    wrapper.unmount();
  });

  it("ignores invalid deep-link rating", async () => {
    routeState.query = { rating: "9", groupId: "grp1" };

    const wrapper = mount(OrderDetailView, {
      global: {
        stubs: {
          ReviewLineCard: {
            props: ["initialRating"],
            template: '<div class="review-line-stub" :data-rating="initialRating" />',
          },
        },
      },
    });
    await flushPromises();

    expect(wrapper.find(".review-line-stub").attributes("data-rating")).toBe("0");

    wrapper.unmount();
  });

  it("navigates back to order history", async () => {
    const wrapper = mount(OrderDetailView, {
      global: { stubs: { ReviewLineCard: true } },
    });
    await flushPromises();

    await wrapper.find(".order-detail-back").trigger("click");
    expect(routerPush).toHaveBeenCalledWith({ name: "order-history" });

    wrapper.unmount();
  });
});