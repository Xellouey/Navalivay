import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import WheelView from "@/views/WheelView.vue";

const routerMock = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
}));

const wheelStoreMock = vi.hoisted(() => ({
  balance: {
    spins_available: 1,
    accumulated_byn: 0,
    threshold_byn: 40,
    progress_percent: 0,
    consecutive_nothing: 0,
  },
  sortedPrizes: [
    {
      id: "prize-visible",
      title: "Скидка 10%",
      description: "Промокод на скидку",
      image_url: null,
      rarity: null,
      weight: 1,
      effective_weight: 1,
      max_total: 0,
      issued_count: 0,
      is_exhausted: false,
      sort_order: 1,
    },
  ],
  rarities: [
    {
      code: "common",
      label: "Обычный",
      bgColor: "#27A3FF",
      textColor: "#FFFFFF",
      isElite: false,
    },
    {
      code: "nothing",
      label: "Ничего",
      bgColor: "#8D8D8D",
      textColor: "#FFFFFF",
      isElite: false,
    },
  ],
  feed: [],
  myActivePrizes: [],
  hasSpins: true,
  isSpinning: false,
  isLoading: false,
  lastFetchedAt: Date.now(),
  accessAllowed: true,
  feedConsentRequired: false,
  fetchState: vi.fn(async () => undefined),
  spin: vi.fn(),
  setFeedConsent: vi.fn(async () => undefined),
}));

vi.mock("vue-router", () => ({
  useRouter: () => routerMock,
}));

vi.mock("@/stores/wheel", () => ({
  WHEEL_STATE_CACHE_TTL_MS: 60_000,
  useWheelStore: () => wheelStoreMock,
}));

function spinResult(overrides: Record<string, unknown> = {}) {
  return {
    spin_id: "spin-1",
    prize: {
      id: "prize-1",
      title: "Скидка 10%",
      description: "Промокод на скидку",
      image_url: null,
      rarity_code: "common",
    },
    is_epic_release: false,
    is_pity_release: false,
    promo_code: "SAVE10",
    promo_valid_until: "2026-07-01",
    animation_seed: 123,
    spins_left: 0,
    accumulated_byn: 0,
    ...overrides,
  };
}

async function mountAndSpin(result: ReturnType<typeof spinResult>) {
  wheelStoreMock.spin.mockResolvedValueOnce(result);

  const WheelStripStub = defineComponent({
    name: "WheelStrip",
    props: {
      prizes: {
        type: Array,
        default: () => [],
      },
    },
    setup(_props, { expose }) {
      expose({ runSpin: vi.fn(async () => undefined) });
      return () => h("div", { class: "wheel-strip-stub" });
    },
  });

  const wrapper = mount(WheelView, {
    attachTo: document.body,
    global: {
      stubs: {
        WheelStrip: WheelStripStub,
        WheelLiveFeed: true,
        WheelConsentModal: true,
        ToastNotification: true,
        RouterLink: {
          props: ["to"],
          template: "<a><slot /></a>",
        },
      },
    },
  });

  await flushPromises();
  await wrapper.find(".wheel-stage__cta").trigger("click");
  await flushPromises();

  return wrapper;
}

describe("WheelView result modal", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
    wheelStoreMock.balance.spins_available = 1;
    wheelStoreMock.hasSpins = true;
    wheelStoreMock.isSpinning = false;
    wheelStoreMock.lastFetchedAt = Date.now();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows a fixed losing dialog for the nothing rarity", async () => {
    const wrapper = await mountAndSpin(spinResult({
      prize: {
        id: "nothing-1",
        title: "Вейпшоп",
        description: "Вы выиграли весь шоп",
        image_url: null,
        rarity_code: "nothing",
      },
      promo_code: "BAD-NOTHING-CODE",
      promo_valid_until: "2026-07-01",
    }));

    const modalText = document.body.textContent || "";

    expect(modalText).toContain("В этот раз без приза");
    expect(modalText).toContain("Попробуешь ещё?");
    expect(modalText).toContain("Понятно");
    expect(document.body.querySelector(".wheel-result-body__sad-face")).not.toBeNull();

    expect(modalText).not.toContain("Не повезло");
    expect(modalText).not.toContain("Ничего не выиграли");
    expect(modalText).not.toContain("Не расстраивайся");
    expect(modalText).not.toContain("Поздравляем");
    expect(modalText).not.toContain("Тебе выпало");
    expect(modalText).not.toContain("Забрать");
    expect(modalText).not.toContain("Вейпшоп");
    expect(modalText).not.toContain("Вы выиграли весь шоп");
    expect(modalText).not.toContain("Промокод");
    expect(modalText).not.toContain("BAD-NOTHING-CODE");
    expect(modalText).not.toContain("Действует до");
    expect(document.body.querySelector(".wheel-result-body__rarity-band")).toBeNull();

    wrapper.unmount();
  });

  it("keeps the winning dialog unchanged for real prizes", async () => {
    const wrapper = await mountAndSpin(spinResult());
    const modalText = document.body.textContent || "";

    expect(modalText).toContain("Поздравляем");
    expect(modalText).toContain("Тебе выпало");
    expect(modalText).toContain("Скидка 10%");
    expect(modalText).toContain("Промокод на скидку");
    expect(modalText).toContain("Промокод");
    expect(modalText).toContain("SAVE10");
    expect(modalText).toContain("Забрать");
    expect(document.body.querySelector(".wheel-result-body__rarity-band")).not.toBeNull();
    expect(document.body.querySelector(".wheel-result-body__sad-face")).toBeNull();

    wrapper.unmount();
  });
});
