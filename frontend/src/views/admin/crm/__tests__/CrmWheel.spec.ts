import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import CrmWheel from "@/views/admin/crm/CrmWheel.vue";

const uploadFilesMock = vi.fn();
const createPromoCodeMock = vi.fn();

vi.mock("@/stores/admin", () => ({
  useAdminStore: () => ({
    uploadFiles: uploadFilesMock,
  }),
}));

vi.mock("@/stores/crm", () => ({
  useCrmStore: () => ({
    createPromoCode: createPromoCodeMock,
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
    template_available: true,
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

function installFetchMock(
  prizes: Array<Record<string, unknown>> = [buildPrize()],
  promos: Array<Record<string, unknown>> = [
    {
      id: "promo-1",
      code: "SAVE10",
      discount_type: "fixed",
      discount_value: 10,
      max_uses: 7,
      duration_days: 90,
      active: 1,
      wheel_owner_customer_id: null,
    },
  ],
  raritiesOverride: Array<Record<string, unknown>> | null = null,
  rarityPutHandler?: (url: string, init?: RequestInit) => unknown,
) {
  const prizeWrites: Array<{ method: string; payload: Record<string, unknown> }> = [];
  const rarityWrites: Array<{ url: string; payload: Record<string, unknown> }> = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || "GET";

    if (url.endsWith("/api/admin/crm/wheel/rarities")) {
      return createJsonResponse({
        rarities: raritiesOverride || [
          {
            code: "common",
            label: "Обычный",
            bgColor: "#27A3FF",
            textColor: "#FFFFFF",
            chancePercent: 25,
            prizeCount: prizes.filter((item) => item.rarity_code === "common").length,
            issuablePrizeCount: prizes.filter((item) => item.rarity_code === "common").length,
            issuedCount: 0,
            isAvailable: true,
          },
          {
            code: "nothing",
            label: "Ничего",
            bgColor: "#8D8D8D",
            textColor: "#FFFFFF",
            chancePercent: 75,
            chanceIsDerived: true,
            prizeCount: prizes.filter((item) => item.rarity_code === "nothing").length,
            issuablePrizeCount: prizes.filter((item) => item.rarity_code === "nothing").length,
            issuedCount: 0,
            isAvailable: true,
          },
          {
            code: "valuable",
            label: "Ценный",
            bgColor: "#FFAB00",
            textColor: "#FFFFFF",
            chancePercent: 0,
            prizeCount: prizes.filter((item) => item.rarity_code === "valuable").length,
            issuablePrizeCount: prizes.filter((item) => item.rarity_code === "valuable").length,
            issuedCount: 0,
            isAvailable: true,
            valuablePool: {
              poolSize: 5,
              thresholdByn: 300,
              qualifiedCount: 0,
              isHot: false,
            },
          },
        ],
      });
    }

    if (url.includes("/api/admin/crm/wheel/rarities/") && method === "PUT") {
      const payload = JSON.parse(String(init?.body || "{}"));
      rarityWrites.push({ url, payload });
      if (rarityPutHandler) {
        const response = await rarityPutHandler(url, init);
        return response;
      }
      return createJsonResponse({ ok: true });
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
        promo_codes: promos,
      });
    }

    throw new Error(`Unexpected fetch: ${method} ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, prizeWrites, rarityWrites };
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
    createPromoCodeMock.mockReset();
  });

  it("uploads the selected file and saves the returned URL in a new prize payload", async () => {
    const { prizeWrites } = installFetchMock([]);
    uploadFilesMock.mockResolvedValue(["/uploads/wheel-prizes/uploaded.png"]);

    const wrapper = mount(CrmWheel);
    await flushPromises();
    await openPrizesTab(wrapper);

    const createButton = wrapper.findAll("button").find((item) => item.text().includes("Добавить приз"));
    expect(createButton).toBeTruthy();
    await createButton!.trigger("click");
    await flushPromises();

    await wrapper.find('input[type="text"]').setValue("Скидка 15%");
    await wrapper.find("#wheel-prize-promo-template").setValue("promo-1");

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
    expect(prizeWrites[0].payload).not.toHaveProperty("max_total");
    expect(prizeWrites[0].payload).not.toHaveProperty("promo_validity_days");
  });

  it("lets the manager clear an existing image without triggering a re-upload", async () => {
    const { prizeWrites } = installFetchMock([buildPrize()]);
    uploadFilesMock.mockResolvedValue(["/uploads/wheel-prizes/should-not-be-used.png"]);

    const wrapper = mount(CrmWheel);
    await flushPromises();
    await openPrizesTab(wrapper);

    const editButton = wrapper.findAll("button").find((item) => item.text().includes("Изменить"));
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

    const createButton = wrapper.findAll("button").find((item) => item.text().includes("Добавить приз"));
    expect(createButton).toBeTruthy();
    await createButton!.trigger("click");
    await flushPromises();

    await wrapper.find('input[type="text"]').setValue("Скидка 20%");
    await wrapper.find("#wheel-prize-promo-template").setValue("promo-1");

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

  it("shows only reusable promo templates in the wheel prize selector", async () => {
    installFetchMock(
      [],
      [
        {
          id: "promo-active",
          code: "ACTIVE10",
          discount_type: "fixed",
          discount_value: 10,
          active: 1,
          wheel_owner_customer_id: null,
        },
        {
          id: "promo-wheel-child",
          code: "WHEEL-ONCE",
          discount_type: "fixed",
          discount_value: 25,
          active: 1,
          wheel_owner_customer_id: "customer-1",
        },
        {
          id: "promo-inactive",
          code: "OLD10",
          discount_type: "fixed",
          discount_value: 10,
          active: 0,
          wheel_owner_customer_id: null,
        },
      ],
    );
    const wrapper = mount(CrmWheel);
    await flushPromises();
    await openPrizesTab(wrapper);

    const createButton = wrapper.findAll("button").find((item) => item.text().includes("Добавить приз"));
    expect(createButton).toBeTruthy();
    await createButton!.trigger("click");
    await flushPromises();

    const promoSelect = wrapper.find("#wheel-prize-promo-template");
    expect(promoSelect.text()).toContain("ACTIVE10");
    expect(promoSelect.text()).not.toContain("WHEEL-ONCE");
    expect(promoSelect.text()).not.toContain("OLD10");
    expect(promoSelect.text()).toContain("ACTIVE10");
  });

  it("saves rarity-level wheel rules", async () => {
    const { fetchMock } = installFetchMock([]);
    const wrapper = mount(CrmWheel);
    await flushPromises();

    const settingsTab = wrapper.findAll("button").find((item) => item.text().includes("Правила выпадения"));
    expect(settingsTab).toBeTruthy();
    await settingsTab!.trigger("click");
    await flushPromises();

    const chanceInput = wrapper
      .findAll('input[type="number"]')
      .find((input) => (input.element as HTMLInputElement).value === "25");
    expect(chanceInput).toBeTruthy();
    await chanceInput!.setValue("33");

    const saveRarityButton = wrapper.findAll("button").find((item) => item.text() === "Сохранить редкость");
    expect(saveRarityButton).toBeTruthy();
    await saveRarityButton!.trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/crm/wheel/rarities/common",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          chance_percent: 33,
          valuable_pool_size: 5,
          valuable_threshold_byn: 300,
        }),
      }),
    );
  });

  it("saves an explicit zero chance instead of falling back to the previous value", async () => {
    const rarities = [
      {
        code: "common",
        label: "Обычный",
        chancePercent: 25,
        chance_percent: 25,
        prizeCount: 1,
        issuablePrizeCount: 1,
        issuedCount: 0,
        isAvailable: true,
      },
      {
        code: "nothing",
        label: "Ничего",
        chancePercent: 75,
        chanceIsDerived: true,
        prizeCount: 1,
        issuablePrizeCount: 1,
        issuedCount: 0,
        isAvailable: true,
      },
      {
        code: "valuable",
        label: "Ценный",
        chancePercent: 0,
        prizeCount: 0,
        issuablePrizeCount: 0,
        issuedCount: 0,
        isAvailable: true,
        valuablePool: { poolSize: 5, thresholdByn: 300, qualifiedCount: 0, isHot: false },
      },
    ];
    const { rarityWrites } = installFetchMock([], undefined, rarities);
    const wrapper = mount(CrmWheel);
    await flushPromises();

    const settingsTab = wrapper.findAll("button").find((item) => item.text().includes("Правила выпадения"));
    expect(settingsTab).toBeTruthy();
    await settingsTab!.trigger("click");
    await flushPromises();

    const chanceInput = wrapper
      .findAll('input[type="number"]')
      .find((input) => (input.element as HTMLInputElement).value === "25");
    expect(chanceInput).toBeTruthy();
    await chanceInput!.setValue("0");

    const saveRarityButton = wrapper.findAll("button").find((item) => item.text() === "Сохранить редкость");
    expect(saveRarityButton).toBeTruthy();
    await saveRarityButton!.trigger("click");
    await flushPromises();

    expect(rarityWrites).toHaveLength(1);
    expect(rarityWrites[0].payload).toMatchObject({
      chance_percent: 0,
      valuable_pool_size: 5,
      valuable_threshold_byn: 300,
    });
  });

  it("shows backend validation details when rarity save is rejected", async () => {
    installFetchMock(
      [],
      undefined,
      null,
      async () => createJsonResponse({ error: "validation_failed", details: ["chance_sum_exceeds_100"] }, false, 400),
    );
    const wrapper = mount(CrmWheel);
    await flushPromises();

    const settingsTab = wrapper.findAll("button").find((item) => item.text().includes("Правила выпадения"));
    expect(settingsTab).toBeTruthy();
    await settingsTab!.trigger("click");
    await flushPromises();

    const chanceInput = wrapper
      .findAll('input[type="number"]')
      .find((input) => (input.element as HTMLInputElement).value === "25");
    expect(chanceInput).toBeTruthy();
    await chanceInput!.setValue("33");

    const saveRarityButton = wrapper.findAll("button").find((item) => item.text() === "Сохранить редкость");
    expect(saveRarityButton).toBeTruthy();
    await saveRarityButton!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("chance_sum_exceeds_100");
  });

  it("blocks saving a valuable rarity with a fractional queue size before request", async () => {
    const rarities = [
      {
        code: "common",
        label: "Обычный",
        chancePercent: 25,
        prizeCount: 1,
        issuablePrizeCount: 1,
        issuedCount: 0,
        isAvailable: true,
      },
      {
        code: "nothing",
        label: "Ничего",
        chancePercent: 75,
        chanceIsDerived: true,
        prizeCount: 1,
        issuablePrizeCount: 1,
        issuedCount: 0,
        isAvailable: true,
      },
      {
        code: "valuable",
        label: "Ценный",
        chancePercent: 0,
        prizeCount: 0,
        issuablePrizeCount: 0,
        issuedCount: 0,
        isAvailable: true,
        valuablePoolSize: 5,
        valuableThresholdByn: 300,
        valuablePool: { poolSize: 5, thresholdByn: 300, qualifiedCount: 0, isHot: false },
      },
    ];
    const { fetchMock } = installFetchMock([], undefined, rarities);
    const wrapper = mount(CrmWheel);
    await flushPromises();

    const settingsTab = wrapper.findAll("button").find((item) => item.text().includes("Правила выпадения"));
    expect(settingsTab).toBeTruthy();
    await settingsTab!.trigger("click");
    await flushPromises();

    const poolInput = wrapper
      .findAll('input[type="number"]')
      .find((input) => (input.element as HTMLInputElement).value === "5");
    expect(poolInput).toBeTruthy();
    await poolInput!.setValue("1.5");

    const saveButtons = wrapper.findAll("button").filter((item) => item.text() === "Сохранить редкость");
    expect(saveButtons.length).toBeGreaterThan(1);
    await saveButtons.at(-1)!.trigger("click");
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/admin/crm/wheel/rarities/valuable",
      expect.anything(),
    );
    expect(wrapper.text()).toContain("Размер очереди должен быть целым числом от 1.");
  });

  it("does not save rarity chance when total chance exceeds 100%", async () => {
    const rarities = [
      {
        code: "common",
        label: "Обычный",
        chancePercent: 80,
        prizeCount: 1,
        issuablePrizeCount: 1,
        issuedCount: 0,
        isAvailable: true,
      },
      {
        code: "rare",
        label: "Редкий",
        chancePercent: 20,
        prizeCount: 1,
        issuablePrizeCount: 1,
        issuedCount: 0,
        isAvailable: true,
      },
      {
        code: "nothing",
        label: "Ничего",
        chancePercent: 0,
        chanceIsDerived: true,
        prizeCount: 1,
        issuablePrizeCount: 1,
        issuedCount: 0,
        isAvailable: true,
      },
    ];
    const { fetchMock } = installFetchMock([], undefined, rarities);
    const wrapper = mount(CrmWheel);
    await flushPromises();

    const settingsTab = wrapper.findAll("button").find((item) => item.text().includes("Правила выпадения"));
    expect(settingsTab).toBeTruthy();
    await settingsTab!.trigger("click");
    await flushPromises();

    const rareInput = wrapper
      .findAll('input[type="number"]')
      .find((input) => (input.element as HTMLInputElement).value === "20");
    expect(rareInput).toBeTruthy();
    await rareInput!.setValue("30");

    const saveButtons = wrapper.findAll("button").filter((item) => item.text() === "Сохранить редкость");
    expect(saveButtons.length).toBeGreaterThan(1);
    await saveButtons[1].trigger("click");
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/admin/crm/wheel/rarities/rare",
      expect.anything(),
    );
    expect(wrapper.text()).toContain("Сумма шансов не может быть больше 100%.");
  });

  it("does not show prize frequency controls because prizes are random inside rarity", async () => {
    installFetchMock([]);
    const wrapper = mount(CrmWheel);
    await flushPromises();
    await openPrizesTab(wrapper);

    const createButton = wrapper.findAll("button").find((item) => item.text().includes("Добавить приз"));
    expect(createButton).toBeTruthy();
    await createButton!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).not.toContain("Как часто выпадать среди этой редкости");
    expect(wrapper.text()).not.toContain("Частота выпадения");
  });

  it("hides duplicated prize sorting, limit, and expiry fields in the prize modal", async () => {
    installFetchMock([]);
    const wrapper = mount(CrmWheel);
    await flushPromises();
    await openPrizesTab(wrapper);

    const createButton = wrapper.findAll("button").find((item) => item.text().includes("Добавить приз"));
    expect(createButton).toBeTruthy();
    await createButton!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).not.toContain("Позиция");
    expect(wrapper.text()).not.toContain("Лимит выдачи");
    expect(wrapper.text()).not.toContain("Срок действия, дней");
    expect(wrapper.text()).toContain("Лимит победителей берётся из выбранного промокода.");
    expect(wrapper.text()).toContain("Выберите промокод: срок действия берётся из его настроек.");
  });

  it("shows the effective end date from the selected promo template duration", async () => {
    installFetchMock(
      [],
      [
        {
          id: "promo-90",
          code: "SAVE90",
          discount_type: "fixed",
          discount_value: 10,
          duration_days: 90,
          active: 1,
          wheel_owner_customer_id: null,
        },
      ],
    );
    const wrapper = mount(CrmWheel);
    await flushPromises();
    await openPrizesTab(wrapper);

    const createButton = wrapper.findAll("button").find((item) => item.text().includes("Добавить приз"));
    expect(createButton).toBeTruthy();
    await createButton!.trigger("click");
    await flushPromises();
    await wrapper.find("#wheel-prize-promo-template").setValue("promo-90");

    const expectedEnd = new Date();
    expectedEnd.setHours(0, 0, 0, 0);
    expectedEnd.setDate(expectedEnd.getDate() + 89);
    const formattedEnd = expectedEnd.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    expect(wrapper.text()).toContain("Срок промокода: 90 дн.");
    expect(wrapper.text()).toContain(`до ${formattedEnd} включительно`);
  });

  it("creates a promo template from the wheel modal and auto-selects it", async () => {
    const promos = [
      {
        id: "promo-1",
        code: "SAVE10",
        discount_type: "fixed",
        discount_value: 10,
        active: 1,
        wheel_owner_customer_id: null,
      },
    ];
    installFetchMock([], promos);
    createPromoCodeMock.mockImplementation(async (payload) => {
      const created = {
        id: "promo-quick",
        code: payload.code,
        discount_type: payload.discount_type,
        discount_value: payload.discount_value,
        active: 1,
        wheel_owner_customer_id: null,
      };
      promos.push(created);
      return created;
    });

    const wrapper = mount(CrmWheel);
    await flushPromises();
    await openPrizesTab(wrapper);

    const createButton = wrapper.findAll("button").find((item) => item.text().includes("Добавить приз"));
    expect(createButton).toBeTruthy();
    await createButton!.trigger("click");
    await flushPromises();

    const quickTemplateButton = wrapper.findAll("button").find((item) => item.text().includes("Создать промокод"));
    expect(quickTemplateButton).toBeTruthy();
    await quickTemplateButton!.trigger("click");
    await flushPromises();

    const modalInputs = wrapper.findAll('input[type="text"]');
    await modalInputs[modalInputs.length - 1].setValue("wheel-quick");
    await wrapper.find("#wheel-promo-quick-max-uses").setValue("3");
    const textareas = wrapper.findAll("textarea");
    await textareas[textareas.length - 2].setValue("Новый шаблон для клиента");
    const createTemplateConfirm = wrapper.findAll("button").filter((item) => item.text() === "Создать промокод").at(-1);
    expect(createTemplateConfirm).toBeTruthy();
    await createTemplateConfirm!.trigger("click");
    await flushPromises();

    expect(createPromoCodeMock).toHaveBeenCalledTimes(1);
    expect(createPromoCodeMock).toHaveBeenCalledWith(
      expect.objectContaining({ max_uses: 3 }),
    );
    const promoSelect = wrapper.find("#wheel-prize-promo-template");
    expect((promoSelect.element as HTMLSelectElement).value).toBe("promo-quick");
    expect(wrapper.text()).toContain("Промокод создан.");
  });
});
