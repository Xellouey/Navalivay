import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getStrengthLabel,
  useCategoryFilters,
  type FilterableGroup,
} from "@/composables/useCategoryFilters";

const makeGroup = (
  overrides: Partial<FilterableGroup> & Pick<FilterableGroup, "id" | "name">,
): FilterableGroup => ({
  products: [],
  children: [],
  ...overrides,
});

describe("useCategoryFilters", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("getStrengthLabel returns Russian labels", () => {
    expect(getStrengthLabel("very_strong")).toBe("Очень крепкие");
    expect(getStrengthLabel("strong")).toBe("Крепкие");
    expect(getStrengthLabel("light")).toBe("Легкие");
  });

  it("filters by strength tier", () => {
    const { strengthTier, toggleStrengthFilter, filterGroupTree } =
      useCategoryFilters();
    const groups = [
      makeGroup({ id: "g1", name: "A", strengthTier: "strong" }),
      makeGroup({ id: "g2", name: "B", strengthTier: "light" }),
    ];

    toggleStrengthFilter("strong");
    expect(strengthTier.value).toBe("strong");

    const filtered = filterGroupTree(groups);
    expect(filtered.map((g) => g.id)).toEqual(["g1"]);
  });

  it("filters by search across group name and product titles", () => {
    const { searchQuery, filterGroupTree } = useCategoryFilters();
    const groups = [
      makeGroup({
        id: "g1",
        name: "Alpha",
        products: [{ title: "Mango" }],
      }),
      makeGroup({
        id: "g2",
        name: "Beta",
        products: [{ title: "DuDu ice" }],
      }),
    ];

    searchQuery.value = "dudu";
    expect(filterGroupTree(groups).map((g) => g.id)).toEqual(["g2"]);

    searchQuery.value = "alpha";
    expect(filterGroupTree(groups).map((g) => g.id)).toEqual(["g1"]);
  });

  it("top filter keeps parent when matching child remains", () => {
    const { topActive, topSales, toggleTopFilter, filterGroupTree } =
      useCategoryFilters();
    topSales.value = [{ groupId: "child", rank: 1, groupName: "Child" }];
    toggleTopFilter();
    expect(topActive.value).toBe(true);

    const groups = [
      makeGroup({
        id: "parent",
        name: "Parent",
        children: [makeGroup({ id: "child", name: "Child", strengthTier: "light" })],
      }),
      makeGroup({ id: "other", name: "Other" }),
    ];

    const filtered = filterGroupTree(groups);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("parent");
    expect(filtered[0].children?.map((c) => c.id)).toEqual(["child"]);
  });

  it("sorts by top rank when top filter active", () => {
    const { topActive, topSales, filterGroupTree } = useCategoryFilters();
    topActive.value = true;
    topSales.value = [
      { groupId: "g2", rank: 1 },
      { groupId: "g1", rank: 2 },
    ];

    const groups = [
      makeGroup({ id: "g1", name: "B-line" }),
      makeGroup({ id: "g2", name: "A-line" }),
    ];

    const filtered = filterGroupTree(groups);
    expect(filtered.map((g) => g.id)).toEqual(["g2", "g1"]);
  });

  it("resetFilters clears all active state", () => {
    const { searchQuery, topActive, strengthTier, resetFilters } =
      useCategoryFilters();
    searchQuery.value = "test";
    topActive.value = true;
    strengthTier.value = "light";
    resetFilters();
    expect(searchQuery.value).toBe("");
    expect(topActive.value).toBe(false);
    expect(strengthTier.value).toBeNull();
  });

  it("loadTopSales maps API payload and handles errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ groupId: "g1", rank: 1, groupName: "Line" }],
        }),
      })
      .mockResolvedValueOnce({ ok: false });
    vi.stubGlobal("fetch", fetchMock);

    const { loadTopSales, topSales, topSalesError } = useCategoryFilters();
    await loadTopSales("cat-1", 5);
    expect(topSales.value).toEqual([{ groupId: "g1", rank: 1, groupName: "Line" }]);
    expect(topSalesError.value).toBeNull();

    await loadTopSales("cat-1");
    expect(topSales.value).toEqual([]);
    expect(topSalesError.value).toBe("failed_to_load_top_sales");
  });
});