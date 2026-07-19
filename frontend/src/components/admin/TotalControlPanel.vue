<template>
  <section
    ref="panelRef"
    class="rounded-xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5"
    :aria-busy="loading"
  >
    <header class="mb-4">
      <h2 class="text-lg font-bold text-gray-900 sm:text-xl">Тотальный контроль</h2>
      <p class="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">
        Общий остаток выбранных линеек и быстрая разбивка по товарам, вкусам или цветам.
      </p>
    </header>

    <div
      v-if="loading && !groups.length"
      class="grid gap-3 sm:grid-cols-2"
      role="status"
      aria-label="Загрузка сводки тотального контроля"
    >
      <div v-for="index in 2" :key="index" class="h-40 animate-pulse rounded-xl bg-gray-100"></div>
    </div>

    <div
      v-if="errorText"
      class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-700"
      :class="groups.length ? 'mb-3' : ''"
      role="alert"
    >
      <span>{{ errorText }}</span>
      <button type="button" class="font-semibold underline" @click="loadGroups">Повторить</button>
    </div>

    <div
      v-if="!loading && !groups.length && !errorText"
      class="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-600"
      role="status"
    >
      Нет линеек на контроле. Включите «Тотальный контроль» в настройках нужной линейки в разделе «Категории».
    </div>

    <div v-if="groups.length" class="grid items-start gap-3 lg:grid-cols-2">
      <article
        v-for="group in groups"
        :key="group.id"
        :data-total-control-group-id="group.id"
        class="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3 sm:p-4"
      >
        <div class="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-gray-200">
          <img
            v-if="coverImages[group.id]"
            :src="coverImages[group.id]"
            alt=""
            class="h-full w-full object-cover"
            loading="lazy"
          />
          <span v-else class="text-sm font-bold text-blue-600" aria-hidden="true">
            {{ initialsFor(group.name) }}
          </span>
        </div>

        <div class="min-w-0 flex-1">
          <h3 class="truncate text-sm font-bold text-gray-900" :title="group.name">{{ group.name }}</h3>
          <p v-if="group.categoryName" class="truncate text-xs text-gray-500">{{ group.categoryName }}</p>
          <p class="mt-1 text-sm text-gray-700">
            Всего: <span class="font-bold text-blue-600">{{ group.totalStock }} шт</span>
          </p>

          <ul
            v-if="group.items.length"
            :id="`total-control-items-${group.id}`"
            class="mt-2 space-y-1 text-xs text-gray-700"
          >
            <li
              v-for="item in visibleItems(group)"
              :key="item.id"
              class="flex min-w-0 items-baseline justify-between gap-3"
            >
              <span class="min-w-0 break-words leading-4">— {{ item.label }}</span>
              <span class="flex-shrink-0 font-semibold text-gray-900">{{ item.stock }} шт</span>
            </li>
          </ul>
          <p v-else class="mt-2 text-xs text-gray-500">В линейке пока нет товаров</p>

          <button
            v-if="group.items.length > PREVIEW_LIMIT"
            type="button"
            class="mt-2 text-xs font-semibold text-blue-600 transition hover:text-blue-800"
            :aria-expanded="isExpanded(group.id)"
            :aria-controls="`total-control-items-${group.id}`"
            @click="toggleExpanded(group.id)"
          >
            {{ isExpanded(group.id) ? 'Скрыть полный список' : `Показать полный список (${group.items.length})` }}
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useCrmStore, type TotalControlGroup } from "@/stores/crm";

const PREVIEW_LIMIT = 4;
const crmStore = useCrmStore();
const {
  totalControlGroups: groups,
  totalControlGroupsLoading: loading,
  totalControlGroupsError: errorText,
} = storeToRefs(crmStore);
const expandedIds = ref<string[]>([]);
const panelRef = ref<HTMLElement | null>(null);
const coverImages = reactive<Record<string, string>>({});
const coverFetchInFlight = new Set<string>();
let coverObserver: IntersectionObserver | null = null;

function isExpanded(groupId: string) {
  return expandedIds.value.includes(groupId);
}

function toggleExpanded(groupId: string) {
  expandedIds.value = isExpanded(groupId)
    ? expandedIds.value.filter((id) => id !== groupId)
    : [...expandedIds.value, groupId];
}

function visibleItems(group: TotalControlGroup) {
  return isExpanded(group.id) ? group.items : group.items.slice(0, PREVIEW_LIMIT);
}

function initialsFor(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

async function loadCoverImage(groupId: string) {
  if (!groupId || coverImages[groupId] || coverFetchInFlight.has(groupId)) return;
  coverFetchInFlight.add(groupId);
  try {
    const response = await fetch(`/api/admin/category-groups/${encodeURIComponent(groupId)}/image`, {
      credentials: "include",
    });
    if (!response.ok) return;
    const data = await response.json() as { cover_image?: string | null };
    if (data.cover_image) coverImages[groupId] = data.cover_image;
  } catch (error) {
    console.warn("[TotalControlPanel] cover load failed", error);
  } finally {
    coverFetchInFlight.delete(groupId);
  }
}

async function loadGroups() {
  try {
    await crmStore.fetchTotalControlGroups();
  } catch (error) {
    console.error("[TotalControlPanel] groups load failed", error);
  }
}

function observeCoverCards() {
  void nextTick(() => {
    const cards = panelRef.value?.querySelectorAll<HTMLElement>("[data-total-control-group-id]") || [];
    if (!coverObserver) return;
    cards.forEach((card) => coverObserver?.observe(card));
  });
}

watch(groups, (list) => {
  const liveIds = new Set(list.map((group) => group.id));
  expandedIds.value = expandedIds.value.filter((id) => liveIds.has(id));
  for (const group of list) {
    if (!group.hasCoverImage) delete coverImages[group.id];
  }
  observeCoverCards();
}, { immediate: true });

onMounted(() => {
  if (typeof IntersectionObserver !== "undefined") {
    coverObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const groupId = (entry.target as HTMLElement).dataset.totalControlGroupId || "";
        const group = groups.value.find((item) => item.id === groupId);
        if (group?.hasCoverImage) void loadCoverImage(group.id);
        coverObserver?.unobserve(entry.target);
      }
    }, { rootMargin: "160px" });
  }
  observeCoverCards();
  void loadGroups();
});

onBeforeUnmount(() => coverObserver?.disconnect());
</script>
