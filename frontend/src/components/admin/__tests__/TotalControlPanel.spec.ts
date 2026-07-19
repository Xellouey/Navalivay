import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import TotalControlPanel from "@/components/admin/TotalControlPanel.vue";
import { useCrmStore } from "@/stores/crm";

describe("TotalControlPanel", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("показывает четыре строки и раскрывает полный список", async () => {
    const store = useCrmStore();
    store.totalControlGroups = [{
      id: "g1",
      name: "Картриджи XROS",
      categoryId: "c1",
      categoryName: "Расходники",
      hasCoverImage: false,
      totalStock: 15,
      itemCount: 5,
      items: Array.from({ length: 5 }, (_, index) => ({
        id: `p${index}`,
        productId: `p${index}`,
        variantId: null,
        label: `Позиция ${index + 1}`,
        stock: index + 1,
      })),
    }];
    vi.spyOn(store, "fetchTotalControlGroups").mockResolvedValue(store.totalControlGroups);

    const wrapper = mount(TotalControlPanel);

    expect(wrapper.text()).toContain("Всего: 15 шт");
    expect(wrapper.findAll("li")).toHaveLength(4);

    const expandButton = wrapper.get("button[aria-expanded='false']");
    expect(expandButton.text()).toContain("Показать полный список (5)");
    expect(expandButton.attributes("aria-controls")).toBe("total-control-items-g1");
    await expandButton.trigger("click");

    expect(wrapper.findAll("li")).toHaveLength(5);
    expect(wrapper.get("button[aria-expanded='true']").text()).toContain("Скрыть полный список");
  });

  it("объясняет пустое состояние", () => {
    const store = useCrmStore();
    vi.spyOn(store, "fetchTotalControlGroups").mockResolvedValue([]);

    const wrapper = mount(TotalControlPanel);

    expect(wrapper.get("[role='status']").text()).toContain("Включите «Тотальный контроль»");
  });

  it("предупреждает об ошибке поверх ранее загруженных данных", () => {
    const store = useCrmStore();
    store.totalControlGroups = [{
      id: "g1",
      name: "XROS",
      categoryId: null,
      categoryName: null,
      hasCoverImage: false,
      totalStock: 10,
      itemCount: 0,
      items: [],
    }];
    store.totalControlGroupsError = "Не удалось обновить остатки. Показаны последние загруженные данные.";
    vi.spyOn(store, "fetchTotalControlGroups").mockRejectedValue(new Error("network"));

    const wrapper = mount(TotalControlPanel);

    expect(wrapper.get("[role='alert']").text()).toContain("Показаны последние загруженные данные");
    expect(wrapper.text()).toContain("Всего: 10 шт");
  });
});
