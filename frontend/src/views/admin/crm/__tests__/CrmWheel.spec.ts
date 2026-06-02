import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import CrmWheel from "@/views/admin/crm/CrmWheel.vue";

const uploadFilesMock = vi.fn();

vi.mock("@/stores/admin", () => ({
  useAdminStore: () => ({
    uploadFiles: uploadFilesMock,
  }),
}));

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

function buildPrize(overrides: Record<string, unknown> = {}) {
  return {
    id: "prize-1",
    rarity_code: "common",
    title: "Скидка 10%",
    description: "Промокод на скидку",
    image_url: "/uploads/wheel-prizes/existing.png",
    weight: 1,
    max_total: 0,
    issued_count: 0,
    is_for_retail: true,
    is_for_wholesale: false,
    promo_template_id: "promo-1",
    promo_validity_days: 90,
    epic_pool_size: 5,
    epic_pool_threshold_byn: 300,
    is_active: true,
    sort_order: 10,
    rarity: {
      code: "common",
      label: "Обычный",
      bgColor: "#27A3FF",
      textColor: "#FFFFFF",
    },
    ...overrides,
  };
}

function installFetchMock(prizes: Array<Record<string, unknown>> = [buildPrize()]) {
  const prizeWrites: Array<{ method: string; payload: Record<string, unknown> }> = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || "GET";

    if (url.endsWith("/api/admin/crm/wheel/rarities")) {
      return createJsonResponse({
        rarities: [
          {
            code: "common",
            label: "Обычный",
            bgColor: "#27A3FF",
            textColor: "#FFFFFF",
          },
          {
            code: "nothing",
            label: "Ничего",
            bgColor: "#8D8D8D",
            textColor: "#FFFFFF",
          },
        ],
      });
    }

    if (url.endsWith("/api/admin/crm/wheel/prizes") && method === "GET") {
      return createJsonResponse({ prizes });
    }

    if (url.endsWith("/api/admin/crm/wheel/prizes") && method === "POST") {
      prizeWrites.push({ method, payload: JSON.parse(String(init?.body || "{}")) });
      return createJsonResponse({ ok: true });
    }

    if (url.includes("/api/admin/crm/wheel/prizes/") && method === "PUT") {
      prizeWrites.push({ method, payload: JSON.parse(String(init?.body || "{}")) });
      return createJsonResponse({ ok: true });
    }

    if (url.endsWith("/api/admin/crm/wheel/settings")) {
      return createJsonResponse({
        spin_byn_retail: 40,
        spin_byn_wholesale: 200,
        pity_threshold: 3,
        default_promo_validity_days: 90,
        feed_size: 30,
        start_collecting_at: null,
        elite_rarities: [],
      });
    }

    if (url.endsWith("/api/admin/crm/wheel/dashboard")) {
      return createJsonResponse({
        totals: {
          total_spins: 0,
          nothing_spins: 0,
          epic_releases: 0,
          pity_releases: 0,
        },
        rarity_breakdown: [],
        active_epic_pools: [],
        prizes_issued: [],
      });
    }

    if (url.endsWith("/api/admin/crm/promo-codes")) {
      return createJsonResponse({
        promo_codes: [
          {
            id: "promo-1",
            code: "SAVE10",
            discount_type: "fixed",
            discount_value: 10,
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch: ${method} ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, prizeWrites };
}

async function mountWheel(prizes?: Array<Record<string, unknown>>) {
  installFetchMock(prizes);
  const wrapper = mount(CrmWheel);
  await flushPromises();
  return wrapper;
}

async function openPrizesTab(wrapper: VueWrapper<any>) {
  const button = wrapper.findAll("button").find((item) => item.text().includes("Призы"));
  expect(button).toBeTruthy();
  await button!.trigger("click");
  await flushPromises();
}

describe("CrmWheel prize image flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    localStorage.setItem("admin_token", "token");
    uploadFilesMock.mockReset();
  });

  it("uploads the selected file and saves the returned URL in a new prize payload", async () => {
    const { prizeWrites } = installFetchMock([]);
    uploadFilesMock.mockResolvedValue(["/uploads/wheel-prizes/uploaded.png"]);

    const wrapper = mount(CrmWheel);
    await flushPromises();
    await openPrizesTab(wrapper);

    const createButton = wrapper.findAll("button").find((item) => item.text().includes("Новый приз"));
    expect(createButton).toBeTruthy();
    await createButton!.trigger("click");
    await flushPromises();

    await wrapper.find('input[type="text"]').setValue("Скидка 15%");
    await wrapper.findAll("select")[1].setValue("promo-1");

    const fileInput = wrapper.find('input[type="file"]');
    const file = new File(["img"], "prize.png", { type: "image/png" });
    Object.defineProperty(fileInput.element, "files", {
      value: [file],
      configurable: true,
    });
    await fileInput.trigger("change");
    await flushPromises();

    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();

    expect(uploadFilesMock).toHaveBeenCalledTimes(1);
    expect(uploadFilesMock).toHaveBeenCalledWith([file], "wheel-prizes");
    expect(prizeWrites).toHaveLength(1);
    expect(prizeWrites[0].method).toBe("POST");
    expect(prizeWrites[0].payload.image_url).toBe("/uploads/wheel-prizes/uploaded.png");
    expect(prizeWrites[0].payload.title).toBe("Скидка 15%");
  });

  it("lets the manager clear an existing image without triggering a re-upload", async () => {
    const { prizeWrites } = installFetchMock([buildPrize()]);
    uploadFilesMock.mockResolvedValue(["/uploads/wheel-prizes/should-not-be-used.png"]);

    const wrapper = mount(CrmWheel);
    await flushPromises();
    await openPrizesTab(wrapper);

    const editButton = wrapper.findAll("button").find((item) => item.text().includes("Редактировать"));
    expect(editButton).toBeTruthy();
    await editButton!.trigger("click");
    await flushPromises();

    const clearButton = wrapper.findAll("button").find((item) => item.text().includes("Удалить фото"));
    expect(clearButton).toBeTruthy();
    await clearButton!.trigger("click");
    await flushPromises();

    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();

    expect(uploadFilesMock).not.toHaveBeenCalled();
    expect(prizeWrites).toHaveLength(1);
    expect(prizeWrites[0].method).toBe("PUT");
    expect(prizeWrites[0].payload.image_url).toBeNull();
  });

  it("does not save the prize when image upload fails", async () => {
    const { prizeWrites } = installFetchMock([]);
    uploadFilesMock.mockRejectedValue(new Error("upload failed"));

    const wrapper = mount(CrmWheel);
    await flushPromises();
    await openPrizesTab(wrapper);

    const createButton = wrapper.findAll("button").find((item) => item.text().includes("Новый приз"));
    expect(createButton).toBeTruthy();
    await createButton!.trigger("click");
    await flushPromises();

    await wrapper.find('input[type="text"]').setValue("Скидка 20%");
    await wrapper.findAll("select")[1].setValue("promo-1");

    const fileInput = wrapper.find('input[type="file"]');
    const file = new File(["img"], "broken.png", { type: "image/png" });
    Object.defineProperty(fileInput.element, "files", {
      value: [file],
      configurable: true,
    });
    await fileInput.trigger("change");
    await flushPromises();

    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();

    expect(uploadFilesMock).toHaveBeenCalledTimes(1);
    expect(prizeWrites).toHaveLength(0);
    expect(wrapper.text()).toContain("upload failed");
  });
});
