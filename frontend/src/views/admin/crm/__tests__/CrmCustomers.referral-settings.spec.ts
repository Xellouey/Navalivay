import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import CrmCustomers from "@/views/admin/crm/CrmCustomers.vue";
import { useCrmStore } from "@/stores/crm";

function response(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

function setupStore() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useCrmStore();
  store.fetchCustomers = vi.fn(async () => undefined);
  store.fetchCustomerFeedbacks = vi.fn(async () => undefined);
  store.fetchCustomerBlocksList = vi.fn(async () => undefined);
  return pinia;
}

function endpoint(input: RequestInfo | URL) {
  return String(input);
}

async function openAuthorization(pinia: ReturnType<typeof createPinia>) {
  const wrapper = mount(CrmCustomers, { global: { plugins: [pinia] } });
  await flushPromises();
  const authorizationTab = wrapper.findAll("button")
    .find((button) => button.text().includes("Авторизация"));
  if (!authorizationTab) throw new Error("Authorization tab not found");
  await authorizationTab.trigger("click");
  await flushPromises();
  return wrapper;
}

describe("CrmCustomers forbidden inviter settings", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads, batch-adds and removes usernames while updating the list", async () => {
    let items = [{ username: "admin_one", added_at: "2026-07-21", added_by: "admin" }];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = endpoint(input);
      if (url.endsWith("/referral-authorizations")) return response({ items: [] });
      if (url.endsWith("/invite-bans")) return response({ items: [] });
      if (url.includes("/disallowed-usernames/admin_two") && init?.method === "DELETE") {
        items = items.filter((item) => item.username !== "admin_two");
        return response({ ok: true });
      }
      if (url.endsWith("/disallowed-usernames") && init?.method === "POST") {
        const usernames = JSON.parse(String(init.body)).usernames as string[];
        items = [...new Set([...items.map((item) => item.username), ...usernames])]
          .map((username) => ({ username, added_at: "2026-07-21", added_by: "admin" }));
        return response({ items });
      }
      if (url.endsWith("/disallowed-usernames")) return response({ items });
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = await openAuthorization(setupStore());
    expect(wrapper.text()).toContain("@admin_one");

    await wrapper.get("#disallowed-inviter-input").setValue("@Admin_Two, admin_three");
    await wrapper.get("section form").trigger("submit");
    await flushPromises();

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ usernames: ["admin_two", "admin_three"] });
    expect(wrapper.text()).toContain("@admin_two");
    expect(wrapper.text()).toContain("@admin_three");

    await wrapper.get("button[aria-label='Удалить @admin_two из запрещённых пригласителей']").trigger("click");
    await flushPromises();
    expect(window.confirm).toHaveBeenCalledWith("Разрешить использовать @admin_two как пригласившего?");
    expect(wrapper.text()).not.toContain("@admin_two");
    wrapper.unmount();
  });

  it("keeps a load error visible and retries without showing a false empty list", async () => {
    let listRequests = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = endpoint(input);
      if (url.endsWith("/referral-authorizations")) return response({ items: [] });
      if (url.endsWith("/invite-bans")) return response({ items: [] });
      if (url.endsWith("/disallowed-usernames")) {
        listRequests += 1;
        if (listRequests === 1) return response({ error: "failed" }, false, 500);
        return response({ items: [{ username: "admin_retry", added_at: "", added_by: null }] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }));

    const wrapper = await openAuthorization(setupStore());
    expect(wrapper.text()).toContain("Не удалось загрузить запрещённые username");
    expect(wrapper.text()).not.toContain("Список пока пуст");
    const retry = wrapper.findAll("button").find((button) => button.text() === "Повторить");
    expect(retry).toBeTruthy();
    await retry!.trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("@admin_retry");
    wrapper.unmount();
  });

  it("blocks repeated submits and shows invalid and server errors", async () => {
    let resolvePost: ((value: Response) => void) | null = null;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = endpoint(input);
      if (url.endsWith("/referral-authorizations")) return Promise.resolve(response({ items: [] }));
      if (url.endsWith("/invite-bans")) return Promise.resolve(response({ items: [] }));
      if (url.endsWith("/disallowed-usernames") && init?.method === "POST") {
        return new Promise<Response>((resolve) => { resolvePost = resolve; });
      }
      if (url.endsWith("/disallowed-usernames")) return Promise.resolve(response({ items: [] }));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = await openAuthorization(setupStore());
    const input = wrapper.get("#disallowed-inviter-input");
    const form = wrapper.get("section form");
    await input.setValue("правда, ok_admin");
    await form.trigger("submit");
    await flushPromises();
    expect(wrapper.text()).toContain("Некорректные username: @правда");
    expect(input.attributes("aria-invalid")).toBe("true");

    await input.setValue("valid_admin");
    await form.trigger("submit");
    await form.trigger("submit");
    await flushPromises();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    resolvePost!(response({ error: "failed" }, false, 500));
    await flushPromises();
    expect(wrapper.text()).toContain("Не удалось сохранить список");
    wrapper.unmount();
  });
});
