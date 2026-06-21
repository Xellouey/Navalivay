import { computed, ref } from "vue";

export type StrengthTier = "very_strong" | "strong" | "light";
export type StorefrontFiltersProfile = "none" | "liquids" | "snus_plates";

export interface TopSalesItem {
  groupId: string;
  rank: number;
  groupName?: string;
}

export interface FilterableGroup {
  id: string;
  name: string;
  strengthTier?: string | null;
  products?: Array<{ title: string }>;
  children?: FilterableGroup[];
}

const STRENGTH_LABELS: Record<StrengthTier, string> = {
  very_strong: "Очень крепкие",
  strong: "Крепкие",
  light: "Легкие",
};

export function getStrengthLabel(tier: StrengthTier): string {
  return STRENGTH_LABELS[tier];
}

export function useCategoryFilters() {
  const searchQuery = ref("");
  const topActive = ref(false);
  const strengthTier = ref<StrengthTier | null>(null);
  const topSales = ref<TopSalesItem[]>([]);
  const topSalesLoading = ref(false);
  const topSalesError = ref<string | null>(null);

  const topRankByGroupId = computed(() => {
    const map = new Map<string, number>();
    topSales.value.forEach((item) => {
      map.set(String(item.groupId), item.rank);
    });
    return map;
  });

  const hasActiveFilters = computed(
    () =>
      searchQuery.value.trim().length > 0 ||
      topActive.value ||
      strengthTier.value !== null,
  );

  async function loadTopSales(categoryId: string, limit = 5) {
    topSalesLoading.value = true;
    topSalesError.value = null;
    try {
      const params = new URLSearchParams({
        category: categoryId,
        limit: String(limit),
      });
      const response = await fetch(`/api/top-sales-groups?${params.toString()}`);
      if (!response.ok) {
        throw new Error("failed_to_load_top_sales");
      }
      const data = await response.json();
      topSales.value = Array.isArray(data.items)
        ? data.items.map((row: Record<string, unknown>) => ({
            groupId: String(row.groupId),
            rank: Number(row.rank ?? 0),
            groupName:
              typeof row.groupName === "string" ? row.groupName : undefined,
          }))
        : [];
    } catch (error) {
      topSales.value = [];
      topSalesError.value =
        error instanceof Error ? error.message : "unknown_error";
    } finally {
      topSalesLoading.value = false;
    }
  }

  function resetFilters() {
    searchQuery.value = "";
    topActive.value = false;
    strengthTier.value = null;
  }

  function toggleTopFilter() {
    topActive.value = !topActive.value;
  }

  function toggleStrengthFilter(tier: StrengthTier) {
    strengthTier.value = strengthTier.value === tier ? null : tier;
  }

  function normalizeSearch(value: string): string {
    return value.trim().toLowerCase();
  }

  function groupMatchesSearch(group: FilterableGroup, query: string): boolean {
    if (!query) return true;
    const normalized = normalizeSearch(query);
    if (group.name.toLowerCase().includes(normalized)) {
      return true;
    }
    return (group.products ?? []).some((product) =>
      product.title.toLowerCase().includes(normalized),
    );
  }

  function groupMatchesStrength(group: FilterableGroup, tier: StrengthTier | null) {
    if (!tier) return true;
    return String(group.strengthTier ?? "").toLowerCase() === tier;
  }

  function groupMatchesTop(group: FilterableGroup, useTop: boolean) {
    if (!useTop) return true;
    return topRankByGroupId.value.has(String(group.id));
  }

  function compareByTopRank(a: FilterableGroup, b: FilterableGroup): number {
    const rankA = topRankByGroupId.value.get(String(a.id)) ?? 999;
    const rankB = topRankByGroupId.value.get(String(b.id)) ?? 999;
    if (rankA !== rankB) return rankA - rankB;
    return (a.name || "").localeCompare(b.name || "", "ru");
  }

  function collectTopMatches<T extends FilterableGroup>(
    groups: T[],
    query: string,
    tier: StrengthTier | null,
  ): T[] {
    const collected: T[] = [];

    const walk = (group: T) => {
      (group.children ?? []).forEach((child) => walk(child as T));

      const selfMatches =
        groupMatchesSearch(group, query) &&
        groupMatchesStrength(group, tier) &&
        groupMatchesTop(group, true);

      if (!selfMatches) return;

      collected.push({
        ...group,
        children: [],
      });
    };

    groups.forEach((group) => walk(group));
    return [...collected].sort(compareByTopRank);
  }

  function filterGroupTree<T extends FilterableGroup>(groups: T[]): T[] {
    const query = normalizeSearch(searchQuery.value);
    const useTop = topActive.value;
    const tier = strengthTier.value;

    if (useTop) {
      return collectTopMatches(groups, query, tier);
    }

    const walk = (group: T): T | null => {
      const filteredChildren = (group.children ?? [])
        .map((child) => walk(child as T))
        .filter((child): child is T => child !== null);

      const selfMatches =
        groupMatchesSearch(group, query) &&
        groupMatchesStrength(group, tier) &&
        groupMatchesTop(group, useTop);

      if (selfMatches) {
        return {
          ...group,
          children: filteredChildren,
        };
      }

      if (filteredChildren.length > 0) {
        return {
          ...group,
          products: [],
          children: filteredChildren,
        };
      }

      return null;
    };

    return groups
      .map((group) => walk(group))
      .filter((group): group is T => group !== null);
  }

  function getTopRank(groupId: string): number | null {
    if (!topActive.value) return null;
    return topRankByGroupId.value.get(String(groupId)) ?? null;
  }

  return {
    searchQuery,
    topActive,
    strengthTier,
    topSales,
    topSalesLoading,
    topSalesError,
    topRankByGroupId,
    hasActiveFilters,
    loadTopSales,
    resetFilters,
    toggleTopFilter,
    toggleStrengthFilter,
    filterGroupTree,
    getTopRank,
    getStrengthLabel,
  };
}