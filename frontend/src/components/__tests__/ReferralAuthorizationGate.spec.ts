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
    vi.useRealTimers();
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
    expect((wrapper.find("input").element as HTMLInputElement).value).toBe("@Good_User");
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

  it("keeps the same focused input while typing and deleting characters", async () => {
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

    const input = wrapper.find("input");
    const inputElement = input.element as HTMLInputElement;
    const submitButton = wrapper.find("button[type='submit']");
    const submitButtonElement = submitButton.element;
    expect(submitButton.attributes("disabled")).toBeUndefined();
    inputElement.focus();
    for (const value of ["@r", "@rk", "@rk0", "@rk", "@r", ""]) {
      await input.setValue(value);
      expect(input.element).toBe(inputElement);
      expect(document.activeElement).toBe(inputElement);
      expect(inputElement.value).toBe(value);
      expect(wrapper.find("button[type='submit']").element).toBe(submitButtonElement);
      expect(wrapper.find("button[type='submit']").attributes("disabled")).toBeUndefined();
    }

    await input.setValue("  @Good_User  ");
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      inviter_username: "Good_User",
    });
    wrapper.unmount();
  });

  it("does not call the server for an empty username and returns focus to the input", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      enabled: true,
      required: true,
      attempts_used: 0,
      attempts_remaining: 3,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ReferralAuthorizationGate, {
      attachTo: document.body,
      global: { stubs: { CustomerModalShell: shellStub } },
    });
    await flushPromises();

    const inputElement = wrapper.find("input").element as HTMLInputElement;
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("Введите username пригласившего");
    expect(document.activeElement).toBe(inputElement);
    wrapper.unmount();
  });

  it("removes @ only when a username is pasted and keeps the input focused", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({
      enabled: true,
      required: true,
      attempts_used: 0,
      attempts_remaining: 3,
    })));

    const wrapper = mount(ReferralAuthorizationGate, {
      attachTo: document.body,
      global: { stubs: { CustomerModalShell: shellStub } },
    });
    await flushPromises();

    const input = wrapper.find("input");
    const inputElement = input.element as HTMLInputElement;
    inputElement.focus();
    inputElement.setSelectionRange(0, 0);
    await input.trigger("paste", {
      clipboardData: { getData: () => "  @rk0ff  " },
    });
    expect(inputElement.value).toBe("rk0ff");
    expect(document.activeElement).toBe(inputElement);

    await input.setValue("");
    inputElement.setSelectionRange(0, 0);
    await input.trigger("paste", {
      clipboardData: { getData: () => "plain_user" },
    });
    expect(inputElement.value).toBe("plain_user");
    expect(document.activeElement).toBe(inputElement);
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

  it("asks Telegram users without a username to set one in Telegram settings", async () => {
    Object.defineProperty(window, "Telegram", {
      configurable: true,
      value: {
        WebApp: {
          initData: "signed-init-data",
          initDataUnsafe: {
            user: { id: 990000031, first_name: "No Username" },
          },
        },
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(response({
      ok: true,
      status: "missing",
      hasUsername: false,
      username: null,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ReferralAuthorizationGate, {
      global: { stubs: { CustomerModalShell: shellStub } },
    });
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/telegram\/username-status\?check=/),
      expect.objectContaining({ credentials: "include", cache: "no-store" }),
    );
    expect(wrapper.find(".modal-shell").exists()).toBe(true);
    expect(wrapper.text()).toContain("Установите имя пользователя @username в настройках Telegram");
    expect(wrapper.emitted("gate-active")?.at(-1)).toEqual([true]);
    wrapper.unmount();
  });

  it("rechecks a username after returning to the open Mini App and gives immediate feedback", async () => {
    Object.defineProperty(window, "Telegram", {
      configurable: true,
      value: {
        WebApp: {
          initData: "signed-init-data",
          initDataUnsafe: {
            user: { id: 990000032, first_name: "Fresh Username" },
          },
          HapticFeedback: { impactOccurred: vi.fn() },
        },
      },
    });
    let resolveRetry!: (value: Response) => void;
    const retryResponse = new Promise<Response>((resolve) => {
      resolveRetry = resolve;
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ status: "missing", hasUsername: false }))
      .mockReturnValueOnce(retryResponse)
      .mockResolvedValueOnce(response({
        enabled: true,
        required: true,
        attempts_remaining: 3,
      }));
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ReferralAuthorizationGate, {
      global: { stubs: { CustomerModalShell: shellStub } },
    });
    await flushPromises();
    expect(wrapper.text()).toContain("Установите имя пользователя");

    await wrapper.find("button").trigger("click");
    expect(window.Telegram?.WebApp.HapticFeedback.impactOccurred).toHaveBeenCalledWith("light");
    expect(wrapper.text()).toContain("Проверяем ваш доступ");
    expect(wrapper.text()).not.toContain("Повторить");

    resolveRetry(response({ status: "confirmed", hasUsername: true, username: "fresh_username" }));
    await flushPromises();

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/referral-authorization/status",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(wrapper.text()).toContain("Кто порекомендовал нас?");
    wrapper.unmount();
  });

  it("keeps polling while Telegram still returns the old missing username", async () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "Telegram", {
      configurable: true,
      value: {
        WebApp: {
          initData: "signed-init-data",
          initDataUnsafe: {
            user: { id: 990000034, first_name: "Delayed Username" },
          },
          HapticFeedback: { impactOccurred: vi.fn() },
        },
      },
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ status: "missing", hasUsername: false }))
      .mockResolvedValueOnce(response({ status: "missing", hasUsername: false }))
      .mockResolvedValueOnce(response({ status: "confirmed", hasUsername: true, username: "delayed_username" }))
      .mockResolvedValueOnce(response({ enabled: true, required: true, attempts_remaining: 3 }));
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ReferralAuthorizationGate, {
      global: { stubs: { CustomerModalShell: shellStub } },
    });
    await flushPromises();

    await wrapper.find("button").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("Проверяем ваш доступ");

    await vi.advanceTimersByTimeAsync(1500);
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(wrapper.text()).toContain("Кто порекомендовал нас?");
    wrapper.unmount();
  });

  it("caps a slow Telegram retry and keeps the close fallback available", async () => {
    vi.useFakeTimers();
    const close = vi.fn();
    Object.defineProperty(window, "Telegram", {
      configurable: true,
      value: {
        WebApp: {
          initData: "signed-init-data",
          initDataUnsafe: {
            user: { id: 990000037, first_name: "Slow Telegram" },
          },
          HapticFeedback: { impactOccurred: vi.fn() },
          close,
        },
      },
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ status: "missing", hasUsername: false }))
      .mockImplementationOnce((_url: string, options?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }));
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ReferralAuthorizationGate, {
      global: { stubs: { CustomerModalShell: shellStub } },
    });
    await flushPromises();
    await wrapper.find("button").trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Проверяем ваш доступ");
    expect(wrapper.text()).toContain("Закрыть магазин");

    await vi.advanceTimersByTimeAsync(16000);
    await flushPromises();

    expect(wrapper.text()).toContain("Telegram отвечает дольше обычного");
    expect(wrapper.text()).toContain("Повторить");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });

  it("ignores a late result from a superseded retry", async () => {
    Object.defineProperty(window, "Telegram", {
      configurable: true,
      value: {
        WebApp: {
          initData: "signed-init-data",
          initDataUnsafe: {
            user: { id: 990000038, first_name: "Overlapping Retry" },
          },
          HapticFeedback: { impactOccurred: vi.fn() },
        },
      },
    });
    let resolveOldRetry!: (value: Response) => void;
    const oldRetry = new Promise<Response>((resolve) => {
      resolveOldRetry = resolve;
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ status: "missing", hasUsername: false }))
      .mockReturnValueOnce(oldRetry)
      .mockResolvedValueOnce(response({ status: "confirmed", hasUsername: true, username: "overlap_username" }))
      .mockResolvedValueOnce(response({ enabled: true, required: true, attempts_remaining: 3 }));
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ReferralAuthorizationGate, {
      global: { stubs: { CustomerModalShell: shellStub } },
    });
    await flushPromises();
    await wrapper.find("button").trigger("click");
    await flushPromises();

    window.dispatchEvent(new Event("referral-authorization-required"));
    await flushPromises();
    expect(wrapper.text()).toContain("Кто порекомендовал нас?");

    resolveOldRetry(response({ status: "missing", hasUsername: false }));
    await flushPromises();
    expect(wrapper.text()).toContain("Кто порекомендовал нас?");
    expect(wrapper.text()).not.toContain("Установите имя пользователя");
    wrapper.unmount();
  });

  it("automatically rechecks when the Mini App returns from a minimized state", async () => {
    let activatedHandler: (() => void) | undefined;
    const onEvent = vi.fn((eventType: string, handler: () => void) => {
      if (eventType === "activated") activatedHandler = handler;
    });
    const offEvent = vi.fn();
    Object.defineProperty(window, "Telegram", {
      configurable: true,
      value: {
        WebApp: {
          initData: "signed-init-data",
          initDataUnsafe: {
            user: { id: 990000035, first_name: "Activated Username" },
          },
          onEvent,
          offEvent,
        },
      },
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ status: "missing", hasUsername: false }))
      .mockResolvedValueOnce(response({ status: "confirmed", hasUsername: true, username: "activated_username" }))
      .mockResolvedValueOnce(response({ enabled: true, required: true, attempts_remaining: 3 }));
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ReferralAuthorizationGate, {
      global: { stubs: { CustomerModalShell: shellStub } },
    });
    await flushPromises();
    expect(activatedHandler).toBeTypeOf("function");

    activatedHandler?.();
    await flushPromises();

    expect(wrapper.text()).toContain("Кто порекомендовал нас?");
    wrapper.unmount();
    expect(offEvent).toHaveBeenCalledWith("activated", activatedHandler);
  });

  it("can close the Mini App as a fallback without bypassing authorization", async () => {
    const close = vi.fn();
    Object.defineProperty(window, "Telegram", {
      configurable: true,
      value: {
        WebApp: {
          initData: "signed-init-data",
          initDataUnsafe: {
            user: { id: 990000036, first_name: "Close Fallback" },
          },
          close,
        },
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ status: "missing", hasUsername: false })));

    const wrapper = mount(ReferralAuthorizationGate, {
      global: { stubs: { CustomerModalShell: shellStub } },
    });
    await flushPromises();

    const closeButton = wrapper.findAll("button").find((button) => button.text() === "Закрыть магазин");
    expect(closeButton).toBeDefined();
    await closeButton?.trigger("click");
    expect(close).toHaveBeenCalledOnce();
    expect(wrapper.find(".modal-shell").exists()).toBe(true);
    wrapper.unmount();
  });

  it("does not blame a missing username when Telegram live verification is temporarily unavailable", async () => {
    Object.defineProperty(window, "Telegram", {
      configurable: true,
      value: {
        WebApp: {
          initData: "signed-init-data",
          initDataUnsafe: {
            user: { id: 990000033, first_name: "Retry Later" },
          },
        },
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({
      status: "retry",
      hasUsername: false,
      message: "Telegram временно не ответил. Попробуйте ещё раз.",
    })));

    const wrapper = mount(ReferralAuthorizationGate, {
      global: { stubs: { CustomerModalShell: shellStub } },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("Telegram временно не ответил");
    expect(wrapper.text()).not.toContain("Установите имя пользователя");
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
      attachTo: document.body,
      global: { stubs: { CustomerModalShell: shellStub } },
    });
    await flushPromises();
    const input = wrapper.find("input");
    const inputElement = input.element as HTMLInputElement;
    inputElement.focus();
    await input.setValue("missing_user");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.find(".modal-shell").exists()).toBe(true);
    expect(wrapper.text()).toContain("Осталось попыток: 2");
    expect(wrapper.text()).toContain("Пользователь не найден");
    expect(input.attributes("disabled")).toBeUndefined();
    expect(document.activeElement).toBe(inputElement);

    await input.setValue("corrected_user");
    expect(wrapper.text()).not.toContain("Пользователь не найден");
    expect(document.activeElement).toBe(inputElement);
    wrapper.unmount();
  });

  it("keeps the submitted username unchanged while the server checks it", async () => {
    let resolveAuthorization!: (value: Response) => void;
    const authorizationResponse = new Promise<Response>((resolve) => {
      resolveAuthorization = resolve;
    });
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(response({ enabled: true, required: true, attempts_remaining: 3 }))
      .mockReturnValueOnce(authorizationResponse));

    const wrapper = mount(ReferralAuthorizationGate, {
      attachTo: document.body,
      global: { stubs: { CustomerModalShell: shellStub } },
    });
    await flushPromises();

    const input = wrapper.find("input");
    const inputElement = input.element as HTMLInputElement;
    inputElement.focus();
    await input.setValue("first_user");
    await wrapper.find("form").trigger("submit");

    const beforeInput = new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      data: "x",
      inputType: "insertText",
    });
    expect(inputElement.dispatchEvent(beforeInput)).toBe(false);
    inputElement.value = "changed_user";
    inputElement.dispatchEvent(new Event("input", { bubbles: true }));
    expect(inputElement.value).toBe("first_user");
    expect(document.activeElement).toBe(inputElement);

    resolveAuthorization(response({
      error: "referral_inviter_not_eligible",
      message: "Пользователь не найден",
      attempts_remaining: 2,
    }, false, 422));
    await flushPromises();
    expect(wrapper.text()).toContain("Пользователь не найден");
    wrapper.unmount();
  });
});
