import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import ReviewPromptDock from "@/components/reviews/ReviewPromptDock.vue";

const routerPush = vi.hoisted(() => vi.fn());

vi.mock("vue-router", () => ({
  useRoute: () => ({ path: "/", fullPath: "/", query: {} }),
  useRouter: () => ({ push: routerPush }),
}));

const fetchReviewPromptMock = vi.hoisted(() => vi.fn());

vi.mock("@/composables/useCustomerOrders", () => ({
  useCustomerOrders: () => ({
    reviewPrompt: {
      value: {
        show: true,
        order_id: "ord1",
        order_number: 1001,
        group_id: "grp1",
        group_name: "Подонки",
        purchased_variant_name: "Ананасовая шипучка",
        pending_review_count: 1,
        lottery_hint_text: "Оставьте отзыв — участвуйте в розыгрыше",
      },
    },
    fetchReviewPrompt: fetchReviewPromptMock,
  }),
}));

describe("ReviewPromptDock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.style.removeProperty("--app-review-dock-height");
    fetchReviewPromptMock.mockResolvedValue({ show: true });
  });

  it("renders outline stars and lottery hint", async () => {
    const wrapper = mount(ReviewPromptDock);
    await flushPromises();

    expect(wrapper.text()).toContain("Подонки");
    expect(wrapper.text()).toContain("Оставьте отзыв — участвуйте в розыгрыше");
    expect(wrapper.findAll(".review-prompt-dock__star")).toHaveLength(5);

    const starPath = wrapper.find(".review-prompt-dock__star svg path");
    expect(starPath.attributes("fill")).toBe("transparent");
    expect(starPath.attributes("stroke")).toContain("255");

    wrapper.unmount();
  });

  it("navigates to order detail with rating and groupId on star tap", async () => {
    const wrapper = mount(ReviewPromptDock);
    await flushPromises();

    const stars = wrapper.findAll(".review-prompt-dock__star");
    await stars[3].trigger("click");

    expect(routerPush).toHaveBeenCalledWith({
      name: "order-detail",
      params: { orderId: "ord1" },
      query: {
        rating: "4",
        groupId: "grp1",
      },
    });

    wrapper.unmount();
  });

  it("sets review dock height css variable when visible", async () => {
    const wrapper = mount(ReviewPromptDock);
    await flushPromises();

    expect(
      document.documentElement.style.getPropertyValue("--app-review-dock-height"),
    ).toBe("72px");

    wrapper.unmount();
  });
});