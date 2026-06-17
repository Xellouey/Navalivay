<template>
  <section v-if="visible" class="category-filter-bar" aria-label="Фильтры категории">
    <div
      v-if="chips.length"
      class="category-filter-chips scrollbar-hide"
      role="group"
      aria-label="Быстрые фильтры"
    >
      <button
        v-for="chip in chips"
        :key="chip.id"
        type="button"
        class="category-filter-chip"
        :class="{ 'is-active': chip.active, 'is-loading': chip.loading }"
        :disabled="chip.loading"
        @click="chip.onClick"
      >
        <span v-if="chip.rankIcon" class="category-filter-chip-rank">{{ chip.rankIcon }}</span>
        <span>{{ chip.label }}</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { StorefrontFiltersProfile, StrengthTier } from "@/composables/useCategoryFilters";
import { getStrengthLabel } from "@/composables/useCategoryFilters";

const props = withDefaults(
  defineProps<{
    profile?: StorefrontFiltersProfile;
    topActive?: boolean;
    strengthTier?: StrengthTier | null;
    topLoading?: boolean;
  }>(),
  {
    profile: "none",
    topActive: false,
    strengthTier: null,
    topLoading: false,
  },
);

const emit = defineEmits<{
  (e: "toggle-top"): void;
  (e: "toggle-strength", tier: StrengthTier): void;
}>();

const visible = computed(
  () => props.profile === "liquids" || props.profile === "snus_plates",
);

const showTop = computed(
  () => props.profile === "liquids" || props.profile === "snus_plates",
);
const showStrength = computed(() => props.profile === "liquids");

type ChipItem = {
  id: string;
  label: string;
  active: boolean;
  loading?: boolean;
  rankIcon?: string;
  onClick: () => void;
};

const chips = computed<ChipItem[]>(() => {
  const list: ChipItem[] = [];

  if (showTop.value) {
    list.push({
      id: "top",
      label: "Чаще берут",
      active: props.topActive,
      loading: props.topLoading,
      rankIcon: "★",
      onClick: () => emit("toggle-top"),
    });
  }

  if (showStrength.value) {
    (["very_strong", "strong", "light"] as StrengthTier[]).forEach((tier) => {
      list.push({
        id: tier,
        label: getStrengthLabel(tier),
        active: props.strengthTier === tier,
        onClick: () => emit("toggle-strength", tier),
      });
    });
  }

  return list;
});
</script>

<style scoped>
.category-filter-bar {
  margin-bottom: 16px;
}

.category-filter-chips {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;
}

.category-filter-chip {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  white-space: nowrap;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid #e6e9ed;
  background: #ffffff;
  color: #191919;
  font-family: "Montserrat", sans-serif;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

@media (hover: hover) and (pointer: fine) {
  .category-filter-chip:hover:not(:disabled):not(.is-active) {
    border-color: #d0d5dd;
    background: #f9fafb;
  }
}

.category-filter-chip.is-active,
.category-filter-chip.is-active:hover {
  border-color: transparent;
  color: #ffffff;
  background: linear-gradient(106.76deg, #f50302 -2.64%, #a90f0e 85.78%);
  box-shadow: 0 4px 12px rgba(211, 47, 47, 0.22);
}

.category-filter-chip.is-loading {
  opacity: 0.7;
  cursor: wait;
}

.category-filter-chip-rank {
  font-size: 12px;
  line-height: 1;
}
</style>