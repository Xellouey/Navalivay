import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import ReferralAuthorizationGate from "@/components/ReferralAuthorizationGate.vue";

const blockMocks = vi.hoisted(() => ({
  applyBlockFromResponse: vi.fn(),
  refreshBlock: vi.fn(async () => undefined),
}));

vi.mock("@/composables/useCustomerBlock", () => ({
  useCustomerBlock: () => blockMocks,
}));

function response(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

const shellStub = {
  props: ["open", "title", "closable", "closeDisabled"],
  template: `
    <div v-if="open" class="modal-shell" :data-closable="String(closable)">
      <h2>{{ title }}</h2><slot /><slot name="footer" />
    </div>
  `,
};

describe("ReferralAuthorizationGate", () => {
  beforeEach(() => {
    Object.defineProperty(window, "Telegram", {
      configurable: true,
      value: {
        WebApp: {
          initData: "signed-init-data",
          initDataUnsafe: {
            user: { id: 990000030, username: "new_gate_user", first_name: "New" },
          },
        },
      },
    });
    blockMocks.applyBlockFromResponse.mockClear();
    blockMocks.refreshBlock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens immediately without a close action and authorizes before the catalog", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({
        enabled: true,
        required: true,
        attempts_used: 0,
        attempts_remaining: 3,
      }))
      .mockResolvedValueOnce(response({
        success: true,
        enabled: true,
        authorized: true,
        required: false,
        attempts_remaining: 3,
      }));
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ReferralAuthorizationGate, {
      attachTo: document.body,
      global: { stubs: { CustomerModalShell: shellStub } },
    });
    await flushPromises();

    expect(wrapper.find(".modal-shell").attributes("data-closable")).toBe("false");
    expect(wrapper.text()).toContain("Чтобы посмотреть цены");
    expect(wrapper.find("button[aria-label*='Закрыть']").exists()).toBe(false);
    expect(document.activeElement).toBe(wrapper.find("input").element);

    await wrapper.find("input").setValue("@Good_User");
    expect((wrapper.find("input").element as HTMLInputElement).value).toBe("Good_User");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/referral-authorization/authorize",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      inviter_username: "Good_User",
    });
    expect(wrapper.find(".modal-shell").exists()).toBe(false);
    wrapper.unmount();
  });

  it("accepts a manually entered username without @", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({
        enabled: true,
        required: true,
        attempts_used: 0,
        attempts_remaining: 3,
      }))
      .mockResolvedValueOnce(response({
        success: true,
        enabled: true,
        authorized: true,
        required: false,
        attempts_remaining: 3,
      }));
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ReferralAuthorizationGate, {
      global: { stubs: { CustomerModalShell: shellStub } },
    });
    await flushPromises();

    await wrapper.find("input").setValue("Good_User");
    expect((wrapper.find("input").element as HTMLInputElement).value).toBe("Good_User");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      inviter_username: "Good_User",
    });
    expect(wrapper.find(".modal-shell").exists()).toBe(false);
    wrapper.unmount();
  });

  it("fails closed when opened outside Telegram", async () => {
    Object.defineProperty(window, "Telegram", {
      configurable: true,
      value: { WebApp: { initData: "", initDataUnsafe: {} } },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ReferralAuthorizationGate, {
      global: { stubs: { CustomerModalShell: shellStub } },
    });
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(wrapper.find(".modal-shell").exists()).toBe(true);
    expect(wrapper.text()).toContain("Откройте приложение через Telegram");
    expect(wrapper.emitted("gate-active")?.at(-1)).toEqual([true]);
    wrapper.unmount();
  });

  it("switches an authorization ban to the common block screen", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({
      enabled: true,
      required: false,
      blocked: true,
      attempts_remaining: 0,
    })));

    const wrapper = mount(ReferralAuthorizationGate, {
      global: { stubs: { CustomerModalShell: shellStub } },
    });
    await flushPromises();

    expect(blockMocks.applyBlockFromResponse).toHaveBeenCalledWith({
      reason: "Авторизация не пройдена",
      block_until: null,
    });
    expect(wrapper.find(".modal-shell").exists()).toBe(false);
    wrapper.unmount();
  });

  it("keeps the mandatory window open and shows the remaining attempts", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(response({ enabled: true, required: true, attempts_remaining: 3 }))
      .mockResolvedValueOnce(response({
        error: "referral_inviter_not_eligible",
        message: "Пользователь не найден или ещё не забирал заказ",
        attempts_remaining: 2,
      }, false, 422)));

    const wrapper = mount(ReferralAuthorizationGate, {
      global: { stubs: { CustomerModalShell: shellStub } },
    });
    await flushPromises();
    await wrapper.find("input").setValue("missing_user");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.find(".modal-shell").exists()).toBe(true);
    expect(wrapper.text()).toContain("Осталось попыток: 2");
    expect(wrapper.text()).toContain("Пользователь не найден");
    wrapper.unmount();
  });
});
