import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { flushPromises, mount } from "@vue/test-utils";
import ProfileView from "@/views/ProfileView.vue";

function createJsonResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    headers: {
      get: () => "application/json",
    },
    json: async () => data,
  };
}

describe("ProfileView loyalty section", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    sessionStorage.clear();

    (window as any).Telegram = {
      WebApp: {
        initData: "signed_init_data",
        initDataUnsafe: {
          user: {
            id: 11,
            username: "profile_user",
            first_name: "Profile",
            last_name: "User",
          },
        },
      },
    };
  });

  it("renders loyalty showcase card and shows popup when a bonus is available", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/customer/me")) {
        return createJsonResponse({
          id: "customer-1",
          telegram_id: "11",
          telegram_username: "profile_user",
          first_name: "Profile",
          last_name: "User",
          total_orders: 2,
          total_spent: 30,
          member_since: "2026-03-01T10:00:00.000Z",
        });
      }
      if (url.startsWith("/api/loyalty/me")) {
        return createJsonResponse({
          found: true,
          customer_id: "customer-1",
          telegram_username: "profile_user",
          has_available_bonus: true,
          categories: [
            {
              id: "loyalty-liquids",
              key: "liquids",
              title: "Liquids",
              description: null,
              threshold: 10,
              discount_amount: 10,
              balance: 12,
              available_bonus_count: 1,
              remaining_to_next: 8,
              active: 1,
            },
          ],
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ProfileView, {
      global: {
        stubs: {
          LoyaltyBonusPopup: {
            props: ["open"],
            template: "<div v-if=\"open\" class=\"bonus-popup-stub\"></div>",
          },
        },
      },
    });

    await flushPromises();

    expect(wrapper.findAll(".loyalty-card")).toHaveLength(1);
    expect(wrapper.text()).toContain("Бонусная система");
    expect(wrapper.find(".loyalty-tab--active").text()).toContain("Жидкости");
    expect(wrapper.find(".loyalty-progress-value").text()).toContain("2 / 10");
    expect(wrapper.find(".bonus-popup-stub").exists()).toBe(true);

    await wrapper.find(".loyalty-rules-link").trigger("click");

    expect(wrapper.find(".rules-modal-overlay").exists()).toBe(true);
    expect(wrapper.text()).toContain("Как получить скидку?");
    expect(wrapper.text()).toContain("Каждая купленная позиция добавляет один штамп");
    expect(wrapper.text()).toContain("штампы начисляются за каждую позицию");

    await wrapper.find(".rules-modal-close").trigger("click");

    expect(wrapper.find(".rules-modal-overlay").exists()).toBe(false);

    wrapper.unmount();
  });
});
