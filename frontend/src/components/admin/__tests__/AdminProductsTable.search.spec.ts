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

  function mountTable() {
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
});
