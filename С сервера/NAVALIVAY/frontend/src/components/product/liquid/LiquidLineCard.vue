<template>
  <div class="liquid-group">
    <button
      class="liquid-group-header"
      type="button"
      :aria-expanded="expanded"
      @click="toggle"
    >
      <div class="liquid-group-cover" role="presentation">
        <img :src="coverUrl" :alt="`${title} – обложка линейки`" loading="lazy" />
      </div>
      <div class="liquid-group-meta">
        <span class="liquid-group-title">{{ title }}</span>
        <span class="liquid-group-count">{{ countLabel }}</span>
      </div>
      <span class="liquid-group-icon" aria-hidden="true">
        <svg v-if="expanded" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 15l-6-6-6 6"></path>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 9l6 6 6-6"></path>
        </svg>
      </span>
    </button>
    <transition name="liquid-collapse">
      <div v-show="expanded" class="liquid-group-body">
        <ul class="liquid-product-list">
          <LiquidFlavorRow
            v-for="product in products"
            :key="product.id"
            :product="product"
            @select="onSelect"
          />
        </ul>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LiquidFlavorRow from './LiquidFlavorRow.vue'
import type { Product } from '@/stores/catalog'

const props = defineProps<{
  groupId: string
  title: string
  products: Product[]
  expanded: boolean
  coverImage?: string | null
  fallbackImage: string
}>()

const emit = defineEmits<{
  (e: 'toggle', groupId: string): void
  (e: 'select', product: Product): void
}>()

const countLabel = computed(() => {
  const count = props.products.length
  if (count === 0) return 'нет вкусов'
  if (count % 10 === 1 && count % 100 !== 11) return `${count} вкус`
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return `${count} вкуса`
  }
  return `${count} вкусов`
})

const coverUrl = computed(() => props.coverImage || props.fallbackImage)

function toggle() {
  emit('toggle', props.groupId)
}

function onSelect(product: Product) {
  emit('select', product)
}
</script>

<style scoped>
.liquid-group-header {
  gap: 1rem;
  text-align: left;
}

.liquid-group-cover {
  width: 96px;
  height: 72px;
  flex-shrink: 0;
  border-radius: 18px;
  overflow: hidden;
  border: 3px solid rgba(0, 0, 0, 0.08);
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.06) 0%, rgba(0, 0, 0, 0.12) 100%);
}

.liquid-group-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

@media (max-width: 1024px) {
  .liquid-group-cover {
    width: 80px;
    height: 60px;
  }
}

@media (max-width: 640px) {
  .liquid-group-header {
    flex-direction: row;
    align-items: center;
  }

  .liquid-group-cover {
    width: 72px;
    height: 54px;
  }
}
</style>
