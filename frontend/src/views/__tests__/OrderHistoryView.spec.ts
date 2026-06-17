import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import OrderHistoryView from "@/views/OrderHistoryView.vue";

const routerPush = vi.hoisted(() => vi.fn());
const fetchOrderHistoryMock = vi.hoisted(() => vi.fn());

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock("@/composables/useCustomerOrders", () => ({
  formatOrderDate: (value: string) => value.slice(0, 10),
  formatOrderStatus: (status: string) => (status === "delivered" ? "Доставлен" : status),
  useCustomerOrders: () => ({
    fetchOrderHistory: fetchOrderHistoryMock,
  }),
}));

describe("OrderHistoryView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders order cards with badge and opens detail on tap", async () => {
    fetchOrderHistoryMock.mockResolvedValue({
      items: [
        {
          id: "ord1",
          order_number: 1001,
          status: "delivered",
          created_at: "2026-06-01T10:00:00.000Z",
          completed_at: "2026-06-01T12:00:00.000Z",
          final_amount: 42,
          category_icons: [],
          category_icons_overflow: 0,
          pending_review_count: 2,
          has_reviews: false,
        },
      ],
      next_cursor: null,
    });

    const wrapper = mount(OrderHistoryView);
    await flushPromises();

    expect(wrapper.text()).toContain("Мои заказы");
    expect(wrapper.text()).toContain("Заказ №1001");
    expect(wrapper.text()).toContain("Оценить");

    await wrapper.find(".order-history-card").trigger("click");
    expect(routerPush).toHaveBeenCalledWith({
      name: "order-detail",
      params: { orderId: "ord1" },
    });

    wrapper.unmount();
  });

  it("shows empty state when history has no items", async () => {
    fetchOrderHistoryMock.mockResolvedValue({ items: [], next_cursor: null });

    const wrapper = mount(OrderHistoryView);
    await flushPromises();

    expect(wrapper.text()).toContain("Здесь появятся завершённые заказы");

    wrapper.unmount();
  });

  it("loads more orders when cursor is present", async () => {
    fetchOrderHistoryMock
      .mockResolvedValueOnce({
        items: [
          {
            id: "ord1",
            order_number: 1001,
            status: "delivered",
            created_at: "2026-06-01T10:00:00.000Z",
            completed_at: "2026-06-01T12:00:00.000Z",
            final_amount: 42,
            category_icons: [],
            category_icons_overflow: 0,
            pending_review_count: 0,
            has_reviews: true,
          },
        ],
        next_cursor: "cursor-1",
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: "ord2",
            order_number: 1000,
            status: "delivered",
            created_at: "2026-05-01T10:00:00.000Z",
            completed_at: "2026-05-01T12:00:00.000Z",
            final_amount: 30,
            category_icons: [],
            category_icons_overflow: 0,
            pending_review_count: 0,
            has_reviews: false,
          },
        ],
        next_cursor: null,
      });

    const wrapper = mount(OrderHistoryView);
    await flushPromises();

    expect(wrapper.findAll(".order-history-card")).toHaveLength(1);

    await wrapper.find(".order-history-more").trigger("click");
    await flushPromises();

    expect(fetchOrderHistoryMock).toHaveBeenLastCalledWith({
      cursor: "cursor-1",
      limit: 20,
    });
    expect(wrapper.findAll(".order-history-card")).toHaveLength(2);

    wrapper.unmount();
  });

  it("shows retry on fetch error", async () => {
    fetchOrderHistoryMock.mockRejectedValue(new Error("Сеть недоступна"));

    const wrapper = mount(OrderHistoryView);
    await flushPromises();

    expect(wrapper.text()).toContain("Сеть недоступна");
    expect(wrapper.find(".order-history-retry").exists()).toBe(true);

    wrapper.unmount();
  });
});