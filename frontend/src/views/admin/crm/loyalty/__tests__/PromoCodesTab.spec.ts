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

describe("PromoCodesTab zero-discount gift validation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fetchPromoCodesMock.mockResolvedValue(undefined);
    createPromoCodeMock.mockResolvedValue({ id: "promo-gift-zero" });
    updatePromoCodeMock.mockResolvedValue(undefined);
  });

  it("rejects zero discount when the promo has no gift", async () => {
    const wrapper = mount(PromoCodesTab);
    await flushPromises();

    await wrapper.findAll("button").find((item) => item.text().includes("Создать"))!.trigger("click");
    await flushPromises();

    await wrapper.find('input[type="text"]').setValue("ZERO");
    await wrapper.find('input[type="number"]').setValue("0");
    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();

    expect(createPromoCodeMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Скидка должна быть больше 0, если промокод без подарка");
  });

  it("submits zero discount when gift is enabled", async () => {
    const wrapper = mount(PromoCodesTab);
    await flushPromises();

    await wrapper.findAll("button").find((item) => item.text().includes("Создать"))!.trigger("click");
    await flushPromises();

    await wrapper.find('input[type="text"]').setValue("GIFTZERO");
    await wrapper.find('input[type="number"]').setValue("0");
    await wrapper.findAll('input[type="checkbox"]')[1].setValue(true);
    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();

    expect(createPromoCodeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "GIFTZERO",
        discount_value: 0,
        has_gift: 1,
      }),
    );
  });
});
