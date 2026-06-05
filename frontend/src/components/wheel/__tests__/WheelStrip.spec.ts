import { describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import WheelStrip from "@/components/wheel/WheelStrip.vue";

function buildPrize(id: string, title: string, rarityCode = "common") {
  return {
    id,
    title,
    description: null,
    image_url: null,
    rarity: {
      code: rarityCode,
      label: rarityCode,
      bgColor: "#27A3FF",
      textColor: "#FFFFFF",
      isElite: false,
    },
    weight: 1,
    effective_weight: 1,
    max_total: 0,
    issued_count: 0,
    is_exhausted: false,
    sort_order: 0,
  };
}

describe("WheelStrip", () => {
  it("lands on the authoritative spin result snapshot instead of the stale prop pool", async () => {
    const stalePrize = buildPrize("stale-prize", "Обычный приз", "common");
    const resultPrize = buildPrize("result-prize", "Мифический приз", "mythic");

    const wrapper = mount(WheelStrip, {
      props: {
        prizes: [stalePrize],
      },
      global: {
        stubs: {
          WheelPrizeCard: {
            props: ["prize"],
            template: "<article>{{ prize.title }}</article>",
          },
        },
      },
    });

    await wrapper.vm.runSpin({
      prizeId: resultPrize.id,
      seed: 123,
      durationMs: 0,
      prizes: [stalePrize, resultPrize],
    });
    await flushPromises();

    const landed = wrapper.find(".wheel-strip__card--landed");
    expect(landed.exists()).toBe(true);
    expect(landed.text()).toContain("Мифический приз");
    expect(wrapper.emitted("animationDone")?.[0]).toEqual([{ prizeId: "result-prize" }]);
  });

  it("does not rebuild the visible strip from prop updates while a spin is running", async () => {
    vi.useFakeTimers();
    const stalePrize = buildPrize("stale-prize", "Старый приз");
    const resultPrize = buildPrize("result-prize", "Приз результата");
    const newPropPrize = buildPrize("new-prop-prize", "Новый приз из фона");

    const wrapper = mount(WheelStrip, {
      props: {
        prizes: [stalePrize],
      },
      global: {
        stubs: {
          WheelPrizeCard: {
            props: ["prize"],
            template: "<article>{{ prize.title }}</article>",
          },
        },
      },
    });

    const spinPromise = wrapper.vm.runSpin({
      prizeId: resultPrize.id,
      seed: 123,
      durationMs: 5000,
      prizes: [stalePrize, resultPrize],
    });
    await flushPromises();
    await wrapper.setProps({ prizes: [newPropPrize] });

    expect(wrapper.text()).toContain("Приз результата");
    expect(wrapper.text()).not.toContain("Новый приз из фона");

    await vi.advanceTimersByTimeAsync(5080);
    await spinPromise;
    vi.useRealTimers();
  });
});
