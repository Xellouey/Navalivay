<template>
  <section
    v-if="isVisible && groups.length"
    class="rounded-xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5 shadow-sm"
  >
    <header class="mb-3 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="flex items-center gap-2 text-sm font-semibold text-amber-900 sm:text-base">
          <span
            class="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white"
            aria-hidden="true"
          >!</span>
          Заканчивающиеся линейки
          <span class="text-xs font-medium text-amber-700">({{ groups.length }})</span>
        </h2>
        <p class="mt-1 text-xs text-amber-800/80">
          Линейки, у которых суммарный остаток ниже минимального порога. Нажмите «Скрыть» рядом с тайлом, чтобы убрать линейку из плашки.
        </p>
      </div>
      <button
        type="button"
        class="flex-shrink-0 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 transition hover:bg-amber-100"
        @click="hidePanel"
      >
        ✕ Скрыть
      </button>
    </header>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="group in visibleGroups"
        :key="group.id"
        :data-low-stock-group-id="group.id"
        class="flex gap-3 rounded-lg border border-amber-200 bg-white p-3 shadow-sm"
      >
        <div class="flex-shrink-0">
          <div
            v-if="group.hasCoverImage && coverImages[group.id]"
            class="h-16 w-16 overflow-hidden rounded-md bg-gray-100"
          >
            <img
              :src="coverImages[group.id]"
              :alt="group.name"
              class="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
          <div
            v-else
            class="flex h-16 w-16 items-center justify-center rounded-md bg-amber-100 text-xs font-medium uppercase text-amber-700"
            aria-hidden="true"
          >
            {{ initialsFor(group.name) }}
          </div>
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="truncate text-sm font-semibold text-gray-900" :title="group.name">
            {{ group.name }}
          </h3>
          <p
            v-if="group.categoryName"
            class="truncate text-[11px] text-gray-500"
            :title="group.categoryName"
          >
            {{ group.categoryName }}
          </p>
          <p class="mt-1 text-xs text-amber-800">
            <template v-if="group.threshold && group.threshold > 0">
              Осталось менее {{ group.threshold }} шт
            </template>
            <template v-else>
              Линейка обнулилась
            </template>
          </p>
          <p
            class="mt-0.5 text-sm font-bold"
            :class="group.totalStock === 0 ? 'text-red-600' : 'text-orange-600'"
          >
            Фактически: {{ group.totalStock }} шт
          </p>
          <div class="mt-2">
            <div class="relative inline-block">
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                :disabled="busyGroupId === group.id"
                @click.stop="toggleMenu(group.id)"
              >
                <span v-if="busyGroupId === group.id">…</span>
                <template v-else>
                  Скрыть
                  <svg class="h-3 w-3" viewBox="0 0 12 12" fill="none">
                    <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </template>
              </button>
              <div
                v-if="openMenuId === group.id"
                class="absolute right-0 z-20 mt-1.5 flex w-56 flex-col gap-1.5 rounded-xl bg-white p-2 shadow-xl ring-1 ring-black/5 sm:left-0 sm:right-auto"
              >
                <button
                  v-for="(reason, key) in reasonsList"
                  :key="key"
                  type="button"
                  class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 active:bg-gray-100"
                  @click.stop="onPause(group.id, key as LowStockPauseReason)"
                >
                  {{ reason.label }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>

    <button
      v-if="canExpand"
      type="button"
      class="mt-3 inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-100"
      @click="expanded = !expanded"
    >
      <template v-if="expanded">Свернуть</template>
      <template v-else>Показать ещё ({{ groups.length - INITIAL_VISIBLE_COUNT }})</template>
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, reactive, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useCrmStore, type LowStockPauseReason, type LowStockPauseConfig } from "@/stores/crm";

const INITIAL_VISIBLE_COUNT = 3;

// Дефолтный набор причин на случай, если ответ ещё не пришёл —
// dropdown не должен моргать пустым (фикс race-condition при быстром
// клике до завершения первого fetch).
const DEFAULT_REASONS: Record<LowStockPauseReason, LowStockPauseConfig> = {
  short: { label: "Скрыть на 3 дня", days: 3 },
  no_supply: { label: "Скрыть на 5 дней", days: 5 },
  not_produced: { label: "Скрыть на 20 дней", days: 20 },
};

const crmStore = useCrmStore();
const { lowStockGroups, lowStockReasons, lowStockCount } = storeToRefs(crmStore);

// Локальный флаг скрытия панели на текущую сессию (просьба заказчика —
// без сохранения в БД, только до перезагрузки страницы).
const hiddenForSession = ref(false);
const expanded = ref(false);
const openMenuId = ref<string | null>(null);
const busyGroupId = ref<string | null>(null);
const error = ref<string | null>(null);

// Лениво подгружаемые cover-images (server не шлёт base64 в основном payload —
// см. selectGroupStockAggregates в server/utils/low-stock-groups.js).
const coverImages = reactive<Record<string, string>>({});
const coverFetchInFlight = new Set<string>();

const groups = computed(() => lowStockGroups.value);
const isVisible = computed(() => !hiddenForSession.value && groups.value.length > 0);

const visibleGroups = computed(() => {
  if (expanded.value) return groups.value;
  return groups.value.slice(0, INITIAL_VISIBLE_COUNT);
});

const canExpand = computed(() => groups.value.length > INITIAL_VISIBLE_COUNT);

const reasonsList = computed(() => {
  const fromServer = lowStockReasons.value;
  return fromServer && Object.keys(fromServer).length > 0 ? fromServer : DEFAULT_REASONS;
});

function hidePanel() {
  hiddenForSession.value = true;
  openMenuId.value = null;
}

function toggleMenu(groupId: string) {
  openMenuId.value = openMenuId.value === groupId ? null : groupId;
}

async function onPause(groupId: string, reason: LowStockPauseReason) {
  openMenuId.value = null;
  busyGroupId.value = groupId;
  error.value = null;
  try {
    await crmStore.pauseLowStockGroup(groupId, reason);
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
    console.error("[LowStockGroupsPanel] pause failed:", err);
  } finally {
    busyGroupId.value = null;
  }
}

function initialsFor(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?";
}

async function loadCoverImage(groupId: string) {
  if (!groupId || coverImages[groupId] || coverFetchInFlight.has(groupId)) return;
  coverFetchInFlight.add(groupId);
  try {
    const response = await fetch(
      `/api/admin/category-groups/${encodeURIComponent(groupId)}/image`,
      { credentials: "include" },
    );
    if (!response.ok) return;
    const data = (await response.json()) as { cover_image?: string | null };
    if (data?.cover_image) {
      coverImages[groupId] = data.cover_image;
    }
  } catch (err) {
    // Лениво — не критично. Покажем initials.
    console.warn("[LowStockGroupsPanel] failed to load cover for", groupId, err);
  } finally {
    coverFetchInFlight.delete(groupId);
  }
}

// Watcher: для каждой видимой группы с has_cover_image грузим картинку лениво.
watch(
  visibleGroups,
  (list) => {
    for (const group of list) {
      if (group.hasCoverImage) {
        loadCoverImage(group.id);
      }
    }
  },
  { immediate: true, flush: "post" },
);

// Watcher: очистка coverImages-кеша от групп, которых больше нет в плашке.
// Без этого base64-обложки накапливаются на странице с долгой жизнью
// (CRM-менеджер может работать часами, через цикл pause→resume в кеше
// останутся «мёртвые» строки).
watch(groups, (list) => {
  const liveIds = new Set(list.map((g) => g.id));
  for (const id of Object.keys(coverImages)) {
    if (!liveIds.has(id)) {
      delete coverImages[id];
    }
  }
});

// Watcher: если summary показывает другое число, чем у нас в локальном списке —
// данные у другого менеджера разошлись с нашими, перезапросим полный список.
// Триггерится polling'ом каждые 15 сек через crmStore.fetchLowStockSummary.
watch(lowStockCount, (newCount) => {
  if (newCount !== groups.value.length) {
    crmStore.fetchLowStockGroups().catch((err) => {
      console.warn("[LowStockGroupsPanel] background refresh failed:", err);
    });
  }
});

// Закрываем меню при клике вне карточки. Используем data-low-stock-group-id
// на article — клик внутри карточки ИМЕННО с открытым меню оставляет открытым,
// клик в любую другую карточку или вне любых карточек закрывает.
function handleDocumentClick(event: MouseEvent) {
  if (!openMenuId.value) return;
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const card = target.closest<HTMLElement>("[data-low-stock-group-id]");
  if (card?.dataset.lowStockGroupId === openMenuId.value) return;
  openMenuId.value = null;
}

onMounted(async () => {
  document.addEventListener("click", handleDocumentClick);
  try {
    await crmStore.fetchLowStockGroups();
  } catch (err) {
    console.warn("[LowStockGroupsPanel] initial fetch failed:", err);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleDocumentClick);
});
</script>
