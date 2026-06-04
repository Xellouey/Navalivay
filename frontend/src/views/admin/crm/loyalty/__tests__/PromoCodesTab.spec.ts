import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import PromoCodesTab from "@/views/admin/crm/loyalty/PromoCodesTab.vue";

const fetchPromoCodesMock = vi.fn();
const createPromoCodeMock = vi.fn();
const updatePromoCodeMock = vi.fn();

vi.mock("@/stores/crm", () => ({
  useCrmStore: () => ({
    promoCodes: [],
    promoCodesLoading: false,
    fetchPromoCodes: fetchPromoCodesMock,
    createPromoCode: createPromoCodeMock,
    updatePromoCode: updatePromoCodeMock,
  }),
}));

describe("PromoCodesTab zero-discount gift handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fetchPromoCodesMock.mockResolvedValue(undefined);
    createPromoCodeMock.mockResolvedValue({ id: "promo-gift-zero" });
    updatePromoCodeMock.mockResolvedValue(undefined);
  });

  it("submits zero discount as a gift promo without a separate checkbox", async () => {
    const wrapper = mount(PromoCodesTab);
    await flushPromises();

    await wrapper.findAll("button").find((item) => item.text().includes("Создать"))!.trigger("click");
    await flushPromises();

    await wrapper.find('input[type="text"]').setValue("ZERO");
    await wrapper.find('input[type="number"]').setValue("0");
    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();

    expect(wrapper.text()).not.toContain("Есть подарок к заказу");
    expect(createPromoCodeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "ZERO",
        discount_value: 0,
        has_gift: 1,
      }),
    );
  });

  it("submits positive discount as a regular promo", async () => {
    const wrapper = mount(PromoCodesTab);
    await flushPromises();

    await wrapper.findAll("button").find((item) => item.text().includes("Создать"))!.trigger("click");
    await flushPromises();

    await wrapper.find('input[type="text"]').setValue("SAVE10");
    await wrapper.find('input[type="number"]').setValue("10");
    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();

    expect(createPromoCodeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "SAVE10",
        discount_value: 10,
        has_gift: 0,
      }),
    );
  });
});
