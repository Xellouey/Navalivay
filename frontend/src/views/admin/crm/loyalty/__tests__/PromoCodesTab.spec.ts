import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import PromoCodesTab from "@/views/admin/crm/loyalty/PromoCodesTab.vue";

const fetchPromoCodesMock = vi.fn();
const createPromoCodeMock = vi.fn();
const updatePromoCodeMock = vi.fn();
const deletePromoCodeMock = vi.fn();
const fetchPromoUsageMock = vi.fn();
const promoCodesMock = vi.hoisted(() => [] as any[]);

vi.mock("@/stores/crm", () => ({
  useCrmStore: () => ({
    promoCodes: promoCodesMock,
    promoCodesLoading: false,
    fetchPromoCodes: fetchPromoCodesMock,
    createPromoCode: createPromoCodeMock,
    updatePromoCode: updatePromoCodeMock,
    deletePromoCode: deletePromoCodeMock,
    fetchPromoUsage: fetchPromoUsageMock,
  }),
}));

describe("PromoCodesTab zero-discount gift handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    promoCodesMock.splice(0);
    fetchPromoCodesMock.mockResolvedValue(undefined);
    createPromoCodeMock.mockResolvedValue({ id: "promo-gift-zero" });
    updatePromoCodeMock.mockResolvedValue(undefined);
    deletePromoCodeMock.mockResolvedValue(undefined);
    fetchPromoUsageMock.mockResolvedValue([]);
  });

  it("loads regular promo codes by default and can switch to wheel codes", async () => {
    const wrapper = mount(PromoCodesTab);
    await flushPromises();

    expect(fetchPromoCodesMock).toHaveBeenCalledWith(
      expect.objectContaining({ source: "regular" }),
    );

    await wrapper.findAll("button").find((item) => item.text().includes("Рулетка"))!.trigger("click");
    await flushPromises();

    expect(fetchPromoCodesMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: "wheel" }),
    );
  });

  it("marks only wheel promo templates with a badge", async () => {
    promoCodesMock.push(
      {
        id: "template-1",
        code: "SPIN-TEMPLATE",
        description: "Wheel template",
        customer_description: "Wheel template",
        manager_description: null,
        has_gift: 0,
        is_wheel_template: 1,
        is_wheel_generated: 0,
        wheel_owner_customer_id: null,
        discount_type: "fixed",
        discount_value: 5,
        min_order_amount: 0,
        max_uses: 10,
        current_uses: 0,
        valid_from: null,
        valid_until: null,
        active: 1,
        created_at: "2026-06-01",
      },
      {
        id: "issued-1",
        code: "WHEEL-123456",
        description: "Issued by wheel",
        customer_description: "Issued by wheel",
        manager_description: null,
        has_gift: 0,
        is_wheel_template: 0,
        is_wheel_generated: 1,
        wheel_owner_customer_id: "customer-1",
        discount_type: "fixed",
        discount_value: 5,
        min_order_amount: 0,
        max_uses: 1,
        current_uses: 0,
        valid_from: null,
        valid_until: null,
        active: 1,
        created_at: "2026-06-01",
      },
    );

    const wrapper = mount(PromoCodesTab);
    await flushPromises();

    expect(wrapper.text()).toContain("Шаблон рулетки");
    expect(wrapper.text()).not.toContain("Выдан рулеткой");
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
