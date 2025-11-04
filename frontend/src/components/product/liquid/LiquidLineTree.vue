<template>
  <div class="liquid-tree-item">
    <!-- Линейка с товарами -->
    <LiquidLineCard
      :group-id="group.id"
      :title="group.name"
      :products="group.products"
      :cover-image="group.coverImage"
      :badge="group.badge ?? undefined"
      :badge-color="group.badgeColor ?? undefined"
      :subgroups="[]"
      :expanded="isExpanded"
      @toggle="toggleExpand"
      @show-toast="$emit('showToast', $event)"
    />

    <!-- Подлинейки (рекурсивно) -->
    <div v-if="group.children.length" ref="childrenWrapper" class="liquid-tree-children-wrapper" :style="wrapperStyle">
      <div class="liquid-tree-children">
        <LiquidLineTree
          v-for="child in group.children"
          :key="child.id"
          :group="child"
          :expanded-groups="expandedGroups"
          @toggle="$emit('toggle', $event)"
          @showToast="$emit('showToast', $event)"
          @heightChanged="handleChildHeightChange"
        />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import LiquidLineCard from './LiquidLineCard.vue'
import type { Product } from '@/stores/catalog'

interface LiquidGroup {
  id: string
  name: string
  order: number
  coverImage: string | null
  products: Product[]
  badge?: string | null
  badgeColor?: string | null
  children: LiquidGroup[]
}

const props = defineProps<{
  group: LiquidGroup
  expandedGroups: Record<string, boolean>
}>()

const emit = defineEmits<{
  (e: 'toggle', groupId: string): void
  (e: 'showToast', message: string, type: 'error' | 'success' | 'info'): void
  (e: 'heightChanged'): void
}>()

const childrenWrapper = ref<HTMLElement | null>(null)
const childrenHeight = ref(0)

const isExpanded = computed(() => props.expandedGroups[props.group.id] ?? false)

const wrapperStyle = computed(() => {
  if (!isExpanded.value) {
    return { maxHeight: '0px' }
  }
  // Всегда используем конкретное значение высоты для плавной анимации
  const height = childrenHeight.value > 0 ? childrenHeight.value : 5000
  return { maxHeight: `${height}px` }
})

// Функция для расчёта высоты дочерних элементов
const calculateHeight = async () => {
  await nextTick()
  if (childrenWrapper.value) {
    childrenHeight.value = childrenWrapper.value.scrollHeight
    // Уведомляем родителя об изменении высоты
    emit('heightChanged')
  }
}

// Пересчитываем высоту при раскрытии
watch(() => isExpanded.value, async (newVal) => {
  if (newVal && props.group.children.length > 0) {
    // Сначала рассчитываем высоту для плавной анимации
    await nextTick()
    await calculateHeight()
    // Дополнительные пересчёты для плавности
    setTimeout(() => calculateHeight(), 50)
    setTimeout(() => calculateHeight(), 150)
    setTimeout(() => calculateHeight(), 350)
  } else {
    // При сворачивании сбрасываем высоту
    childrenHeight.value = 0
  }
})

// Пересчитываем при изменении состояния дочерних элементов
watch(() => props.expandedGroups, async () => {
  if (isExpanded.value && props.group.children.length > 0) {
    await calculateHeight()
    setTimeout(() => calculateHeight(), 50)
    setTimeout(() => calculateHeight(), 150)
    setTimeout(() => calculateHeight(), 300)
  }
}, { deep: true })

// Обработчик изменения высоты дочерних элементов
function handleChildHeightChange() {
  if (isExpanded.value) {
    calculateHeight()
  }
}

function toggleExpand(groupId: string) {
  emit('toggle', groupId)
}

</script>

<style scoped>
.liquid-tree-item {
  @apply mb-4;
  animation: fadeInItem 0.5s ease-out 0.3s both;
}

@keyframes fadeInItem {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.liquid-tree-children-wrapper {
  @apply overflow-hidden;
  transition: max-height 500ms cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 0;
}

.liquid-tree-children {
  @apply ml-4 mt-2 space-y-2;
}
</style>
