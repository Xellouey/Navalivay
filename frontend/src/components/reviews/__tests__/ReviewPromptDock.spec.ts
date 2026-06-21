import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import ReviewPromptDock from "@/components/reviews/ReviewPromptDock.vue";
import {
  TAB_BAR_NOTCH_DEPTH_RATIO,
  TAB_BAR_NOTCH_FLOOR_CSS,
  TAB_BAR_SHAPE_HEIGHT,
  computeReviewDockExtrusion,
} from "@/utils/reviewDockGeometry";

const routerPush = vi.hoisted(() => vi.fn());

const routeState = vi.hoisted(() => {
  const { reactive } = require("vue") as typeof import("vue");
  return reactive({
    path: "/",
    fullPath: "/",
    name: "home" as string | undefined,
    params: {} as Record<string, string>,
    query: {} as Record<string, string>,
  });
});

vi.mock("vue-router", () => ({
  useRoute: () => routeState,
  useRouter: () => ({ push: routerPush }),
}));

const fetchReviewPromptMock = vi.hoisted(() => vi.fn());

const reviewPromptState = vi.hoisted(() => ({
  value: {
    show: true,
    order_id: "ord1",
    order_number: 1001,
    group_id: "grp1",
    group_name: "Подонки",
    purchased_variant_name: "Ананасовая шипучка",
    pending_review_count: 1,
    lottery_hint_text: "В конце месяца разыгрываем 5 подарков среди оставивших отзывы",
  },
}));

vi.mock("@/composables/useCustomerOrders", () => ({
  useCustomerOrders: () => ({
    reviewPrompt: reviewPromptState,
    fetchReviewPrompt: fetchReviewPromptMock,
  }),
}));

describe("ReviewPromptDock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.style.removeProperty("--app-review-dock-height");
    document.documentElement.style.setProperty("--app-bottom-tab-bar-height", "130px");
    fetchReviewPromptMock.mockResolvedValue({ show: true });
    routeState.path = "/";
    routeState.fullPath = "/";
    routeState.name = "home";
    routeState.params = {};
    reviewPromptState.value = {
      show: true,
      order_id: "ord1",
      order_number: 1001,
      group_id: "grp1",
      group_name: "Подонки",
      purchased_variant_name: "Ананасовая шипучка",
      pending_review_count: 1,
      lottery_hint_text: "В конце месяца разыгрываем 5 подарков среди оставивших отзывы",
    };
  });

  it("renders order number, cta label and three stars", async () => {
    const wrapper = mount(ReviewPromptDock);
    await flushPromises();

    expect(wrapper.text()).toContain("Заказ №1001");
    expect(wrapper.text()).toContain("Оцените заказ:");
    expect(wrapper.text()).not.toContain("Подонки");
    expect(wrapper.findAll(".review-prompt-dock__star")).toHaveLength(3);

    const starPath = wrapper.find(".review-prompt-dock__star path");
    expect(starPath.attributes("fill")).toBe("currentColor");
    expect(starPath.attributes("stroke")).toBe("currentColor");

    wrapper.unmount();
  });

  it("navigates to order detail on full dock tap", async () => {
    const wrapper = mount(ReviewPromptDock);
    await flushPromises();

    await wrapper.find(".review-prompt-dock").trigger("click");

    expect(routerPush).toHaveBeenCalledWith({
      name: "order-detail",
      params: { orderId: "ord1" },
      query: {
        groupId: "grp1",
      },
    });

    wrapper.unmount();
  });

  it("sets review dock extrusion css variable when visible", async () => {
    const wrapper = mount(ReviewPromptDock);
    await flushPromises();

    const dock = wrapper.find(".review-prompt-dock").element as HTMLButtonElement;
    const expected = computeReviewDockExtrusion(dock.offsetHeight, TAB_BAR_SHAPE_HEIGHT);
    const dockHeight = document.documentElement.style.getPropertyValue("--app-review-dock-height");
    expect(dockHeight).toBe(`${expected}px`);

    wrapper.unmount();
  });

  it("exposes notch floor geometry for styling", () => {
    const wrapper = mount(ReviewPromptDock, { props: { autoLoad: false } });
    expect(wrapper.vm.TAB_BAR_NOTCH_FLOOR_CSS).toBe(TAB_BAR_NOTCH_FLOOR_CSS);
    wrapper.unmount();
  });

  it("fetches prompt on mount for catalog routes", async () => {
    const wrapper = mount(ReviewPromptDock);
    await flushPromises();

    expect(fetchReviewPromptMock).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("skips prompt fetch on order routes", async () => {
    routeState.path = "/profile/orders";
    routeState.fullPath = "/profile/orders";

    const wrapper = mount(ReviewPromptDock);
    await flushPromises();
    expect(fetchReviewPromptMock).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("skips prompt fetch when autoLoad is disabled", async () => {
    routeState.path = "/";
    routeState.fullPath = "/";

    const wrapper = mount(ReviewPromptDock, { props: { autoLoad: false } });
    await flushPromises();
    expect(fetchReviewPromptMock).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("refetches prompt when route changes back to catalog", async () => {
    routeState.path = "/profile";
    routeState.fullPath = "/profile";

    const wrapper = mount(ReviewPromptDock);
    await flushPromises();
    const callsAfterMount = fetchReviewPromptMock.mock.calls.length;
    expect(callsAfterMount).toBeGreaterThanOrEqual(1);

    fetchReviewPromptMock.mockClear();
    Object.assign(routeState, { path: "/", fullPath: "/" });
    await flushPromises();

    expect(fetchReviewPromptMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    wrapper.unmount();
  });

  it("hides dock on order detail page for the prompted order", async () => {
    routeState.path = "/profile/orders/ord1";
    routeState.fullPath = "/profile/orders/ord1?rating=4&groupId=grp1";
    routeState.name = "order-detail";
    routeState.params = { orderId: "ord1" };

    const wrapper = mount(ReviewPromptDock, { props: { autoLoad: false } });
    await flushPromises();

    expect(wrapper.find(".review-prompt-dock").exists()).toBe(false);
    expect(
      document.documentElement.style.getPropertyValue("--app-review-dock-height"),
    ).toBe("0px");

    wrapper.unmount();
  });

  it("hides dock on order history page", async () => {
    routeState.path = "/profile/orders";
    routeState.fullPath = "/profile/orders";
    routeState.name = "order-history";
    routeState.params = {};

    const wrapper = mount(ReviewPromptDock, { props: { autoLoad: false } });
    await flushPromises();

    expect(wrapper.find(".review-prompt-dock").exists()).toBe(false);
    expect(
      document.documentElement.style.getPropertyValue("--app-review-dock-height"),
    ).toBe("0px");

    wrapper.unmount();
  });

  describe("adversarial scenarios", () => {
    it("falls back order label when order number is missing or zero", async () => {
      reviewPromptState.value = {
        ...reviewPromptState.value,
        order_number: undefined,
      };

      let wrapper = mount(ReviewPromptDock, { props: { autoLoad: false } });
      await flushPromises();
      expect(wrapper.text()).toContain("Ваш заказ");
      wrapper.unmount();

      reviewPromptState.value = {
        ...reviewPromptState.value,
        order_number: 0,
      };
      wrapper = mount(ReviewPromptDock, { props: { autoLoad: false } });
      await flushPromises();
      expect(wrapper.text()).toContain("Ваш заказ");
      wrapper.unmount();
    });

    it("does not navigate when prompt lost order id", async () => {
      reviewPromptState.value = {
        ...reviewPromptState.value,
        order_id: "",
        show: true,
      };

      const wrapper = mount(ReviewPromptDock, { props: { autoLoad: false } });
      await flushPromises();

      expect(wrapper.find(".review-prompt-dock").exists()).toBe(false);
      expect(routerPush).not.toHaveBeenCalled();
      wrapper.unmount();
    });

    it("navigates without groupId query when group is absent", async () => {
      reviewPromptState.value = {
        ...reviewPromptState.value,
        group_id: null,
      };

      const wrapper = mount(ReviewPromptDock, { props: { autoLoad: false } });
      await flushPromises();

      await wrapper.find(".review-prompt-dock").trigger("click");
      expect(routerPush).toHaveBeenCalledWith({
        name: "order-detail",
        params: { orderId: "ord1" },
        query: {},
      });

      wrapper.unmount();
    });

    it("survives prompt fetch failure on mount", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      fetchReviewPromptMock.mockRejectedValueOnce(new Error("network down"));

      const wrapper = mount(ReviewPromptDock);
      await flushPromises();

      expect(wrapper.find(".review-prompt-dock").exists()).toBe(true);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
      wrapper.unmount();
    });

    it("ignores transient refetch errors on route change", async () => {
      const wrapper = mount(ReviewPromptDock);
      await flushPromises();

      fetchReviewPromptMock.mockRejectedValueOnce(new Error("timeout"));
      routeState.fullPath = "/profile?tab=orders";
      routeState.path = "/profile";
      await wrapper.vm.$nextTick();
      await flushPromises();

      expect(wrapper.find(".review-prompt-dock").exists()).toBe(true);
      wrapper.unmount();
    });

    it("syncDockHeight uses responsive tab bar height from css variable", async () => {
      document.documentElement.style.setProperty("--app-bottom-tab-bar-height", "108px");

      const wrapper = mount(ReviewPromptDock, { props: { autoLoad: false } });
      await flushPromises();

      const dock = wrapper.find(".review-prompt-dock").element as HTMLButtonElement;
      const expected = computeReviewDockExtrusion(dock.offsetHeight, 108);
      expect(
        document.documentElement.style.getPropertyValue("--app-review-dock-height"),
      ).toBe(`${expected}px`);

      wrapper.unmount();
    });

    it("syncDockHeight falls back when tab bar css is invalid", async () => {
      document.documentElement.style.setProperty("--app-bottom-tab-bar-height", "not-a-size");

      const wrapper = mount(ReviewPromptDock, { props: { autoLoad: false } });
      await flushPromises();

      const dock = wrapper.find(".review-prompt-dock").element as HTMLButtonElement;
      const expected = computeReviewDockExtrusion(dock.offsetHeight, TAB_BAR_SHAPE_HEIGHT);
      expect(
        document.documentElement.style.getPropertyValue("--app-review-dock-height"),
      ).toBe(`${expected}px`);

      wrapper.unmount();
    });

    it("manual syncDockHeight resets css variable when hidden", async () => {
      const wrapper = mount(ReviewPromptDock, { props: { autoLoad: false } });
      await flushPromises();

      wrapper.vm.syncDockHeight(false);
      expect(
        document.documentElement.style.getPropertyValue("--app-review-dock-height"),
      ).toBe("0px");

      wrapper.unmount();
    });

    it("does not render group marketing copy in the dock", async () => {
      reviewPromptState.value = {
        ...reviewPromptState.value,
        group_name: "SECRET BRAND",
        purchased_variant_name: "SECRET VARIANT",
        lottery_hint_text: "SECRET LOTTERY",
      };

      const wrapper = mount(ReviewPromptDock, { props: { autoLoad: false } });
      await flushPromises();

      expect(wrapper.text()).not.toContain("SECRET BRAND");
      expect(wrapper.text()).not.toContain("SECRET VARIANT");
      expect(wrapper.text()).not.toContain("SECRET LOTTERY");
      wrapper.unmount();
    });

    it("sets accessible label from order label", async () => {
      const wrapper = mount(ReviewPromptDock, { props: { autoLoad: false } });
      await flushPromises();

      expect(wrapper.find(".review-prompt-dock").attributes("aria-label")).toBe(
        "Заказ №1001. Оцените заказ",
      );
      wrapper.unmount();
    });

    it("recalculates extrusion after order label changes", async () => {
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      });

      const wrapper = mount(ReviewPromptDock, { props: { autoLoad: false } });
      await flushPromises();

      const before = document.documentElement.style.getPropertyValue("--app-review-dock-height");
      reviewPromptState.value = {
        ...reviewPromptState.value,
        order_number: 99999999,
      };
      await wrapper.vm.$nextTick();
      await flushPromises();

      const after = document.documentElement.style.getPropertyValue("--app-review-dock-height");
      expect(before).toMatch(/^\d+px$/);
      expect(after).toMatch(/^\d+px$/);

      vi.mocked(window.requestAnimationFrame).mockRestore();
      wrapper.unmount();
    });

    it("extrusion math matches notch overlap ratio", () => {
      const dockHeight = 48;
      const overlap = TAB_BAR_SHAPE_HEIGHT * TAB_BAR_NOTCH_DEPTH_RATIO;
      expect(computeReviewDockExtrusion(dockHeight, TAB_BAR_SHAPE_HEIGHT)).toBe(
        Math.ceil(dockHeight - overlap),
      );
    });
  });
});