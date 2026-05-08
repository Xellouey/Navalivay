<template>
  <AdminModal
    :isOpen="isOpen"
    :title="modalTitle"
    size="sm"
    :showActions="false"
    @cancel="$emit('close')"
    @close="$emit('close')"
  >
    <div class="space-y-4">
      <p class="text-sm text-gray-600">
        Когда суммарный остаток линейки опустится ниже этого числа, она появится в плашке «Заканчивающиеся» в разделе Закупки.
      </p>

      <div class="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
        <p class="text-xs uppercase tracking-wide text-gray-500">Сейчас на складе</p>
        <p class="mt-1 text-lg font-semibold text-gray-900">
          {{ currentStock }} шт
        </p>
        <p
          v-if="currentThreshold && currentStock < currentThreshold"
          class="mt-1 text-xs text-red-600"
        >
          Уже ниже текущего порога ({{ currentThreshold }} шт). Линейка попала в «Заканчивающиеся».
        </p>
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium text-gray-700">
          Минимальный остаток
        </label>
        <input
          ref="inputRef"
          v-model="inputValue"
          type="number"
          min="0"
          step="1"
          inputmode="numeric"
          placeholder="Например 45"
          class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
          @keydown.enter="handleApply"
        />
        <p class="text-xs text-gray-500">
          Если пусто, оповещение появится только при полном обнулении товара.
        </p>
      </div>

      <div class="space-y-1">
        <p class="text-xs uppercase tracking-wide text-gray-500">Быстро</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="preset in PRESETS"
            :key="preset"
            type="button"
            class="rounded-md border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 transition hover:border-slate-400 hover:bg-slate-50"
            @click="inputValue = String(preset)"
          >
            {{ preset }} шт
          </button>
        </div>
      </div>

      <div v-if="errorText" class="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
        {{ errorText }}
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2 pt-2">
        <button
          v-if="currentThreshold"
          type="button"
          class="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="busy"
          @click="handleClear"
        >
          Очистить порог
        </button>
        <button
          type="button"
          class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
          :disabled="busy"
          @click="$emit('close')"
        >
          Отмена
        </button>
        <button
          type="button"
          class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="busy || !canApply"
          @click="handleApply"
        >
          {{ busy ? 'Сохраняем…' : 'Применить' }}
        </button>
      </div>
    </div>
  </AdminModal>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import AdminModal from "@/components/AdminModal.vue";

interface Props {
  isOpen: boolean;
  groupName: string;
  currentThreshold: number | null;
  currentStock: number;
  busy?: boolean;
  errorText?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  busy: false,
  errorText: null,
});

const emit = defineEmits<{
  close: [];
  apply: [value: number | null];
}>();

const PRESETS = [25, 45, 80, 120] as const;

const inputRef = ref<HTMLInputElement | null>(null);
const inputValue = ref<string>("");

const modalTitle = computed(() =>
  `Минимальный остаток ${props.groupName ? `для ${props.groupName}` : ''}`.trim(),
);

const parsedValue = computed<number | null>(() => {
  const raw = inputValue.value.trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
});

const canApply = computed(() => {
  // Кнопка активна если значение валидно ИЛИ если поле пустое и ранее
  // был задан порог (тогда «Применить» = очистить, дублирует кнопку
  // «Очистить порог» — но это удобный fallback на Enter с пустым полем).
  if (inputValue.value.trim() === "") {
    return props.currentThreshold !== null;
  }
  return parsedValue.value !== null;
});

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      // При открытии заполняем поле текущим значением и фокусируем для
      // быстрого редактирования (Костин workflow — пробежать по списку
      // и поправить пороги).
      inputValue.value = props.currentThreshold ? String(props.currentThreshold) : "";
      nextTick(() => inputRef.value?.focus());
    }
  },
  { immediate: true },
);

function handleApply() {
  if (!canApply.value) return;
  emit("apply", parsedValue.value);
}

function handleClear() {
  emit("apply", null);
}
</script>
