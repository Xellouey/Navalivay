import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import AdminProductsTable from "@/components/admin/AdminProductsTable.vue";

describe("AdminProductsTable search regressions", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function mountTable(extraProps: Record<string, unknown> = {}) {
    return mount(AdminProductsTable, {
      props: {
        products: [],
        categories: [
          { id: "cat-hookah", name: "Кальянка" },
          { id: "cat-other", name: "Другая" },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 1,
        },
        ...extraProps,
      },
      global: {
        stubs: {
          AdminSectionHero: {
            template: "<section><slot name=\"actions\" /><slot /></section>",
          },
          Teleport: true,
        },
      },
    });
  }

  it("debounces product search and emits only the final query", async () => {
    const wrapper = mountTable();
    const searchInput = wrapper.find('input[type="text"]');

    await searchInput.setValue("п");
    await searchInput.setValue("пе");
    await searchInput.setValue("персик");

    await vi.advanceTimersByTimeAsync(299);
    expect(wrapper.emitted("filters")).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1);
    expect(wrapper.emitted("filters")).toEqual([
      [{ search: "персик", category: "", group: "" }],
    ]);
  });

  it("category changes cancel pending search debounce and emit immediately", async () => {
    const wrapper = mountTable();
    const searchInput = wrapper.find('input[type="text"]');
    const categorySelect = wrapper.find("select");

    await searchInput.setValue("персик");
    await vi.advanceTimersByTimeAsync(100);
    await categorySelect.setValue("cat-hookah");

    expect(wrapper.emitted("filters")).toEqual([
      [{ search: "персик", category: "cat-hookah", group: "" }],
    ]);

    await vi.advanceTimersByTimeAsync(300);
    expect(wrapper.emitted("filters")).toHaveLength(1);
  });

  it("shows a safe empty warehouse state without catalog editing actions", () => {
    const wrapper = mountTable({ location: "warehouse" });

    expect(wrapper.text()).toContain("На складе пока нет товаров");
    expect(wrapper.text()).toContain("Перемещение");
    expect(wrapper.text()).not.toContain("Добавить товар");
    expect(wrapper.text()).not.toContain("Выбрать все");
  });

  it("фильтрует по линейке чипом и снимает фильтр повторным кликом", async () => {
    const wrapper = mountTable({
      location: "warehouse",
      availableGroups: [
        { id: "group-podonki", name: "PODONKI PODGON", categoryId: "cat-hookah" },
        { id: "group-isterika", name: "PODONKI ISTERIKA", categoryId: "cat-hookah" },
      ],
    });

    const chips = wrapper.findAll('[data-test="product-group-chip"]');
    // Первый чип сбрасывает фильтр, дальше сами линейки.
    expect(chips).toHaveLength(3);
    expect(chips[0].text()).toBe("Все линейки");

    await chips[1].trigger("click");
    expect(wrapper.emitted("filters")).toEqual([
      [{ search: "", category: "", group: "group-isterika" }],
    ]);

    await chips[1].trigger("click");
    expect(wrapper.emitted("filters")).toHaveLength(2);
    expect(wrapper.emitted("filters")![1]).toEqual([
      { search: "", category: "", group: "" },
    ]);
  });

  it("не показывает ленту линеек в рознице, там их сотни", () => {
    const wrapper = mountTable({
      location: "retail",
      availableGroups: [
        { id: "group-podonki", name: "PODONKI PODGON", categoryId: "cat-hookah" },
      ],
    });

    expect(wrapper.findAll('[data-test="product-group-chip"]')).toHaveLength(0);
  });

  it("emits warehouse location switch", async () => {
    const wrapper = mountTable();
    const warehouseButton = wrapper.find('[data-test="location-warehouse"]');

    expect(warehouseButton.exists()).toBe(true);
    await warehouseButton.trigger("click");
    expect(wrapper.emitted("changeLocation")).toEqual([["warehouse"]]);
  });
});
