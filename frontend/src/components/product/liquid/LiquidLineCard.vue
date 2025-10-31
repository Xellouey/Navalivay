<template>
  <div class="liquid-group" :class="{ expanded }">
    <button
      class="liquid-group-header"
      type="button"
      :aria-expanded="expanded"
      :aria-controls="`liquid-group-body-${props.groupId}`"
      @click="toggle"
    >
      <div class="liquid-group-content">
        <div class="liquid-group-cover" role="presentation">
          <img :src="coverUrl" :alt="`${title} – обложка линейки`" loading="lazy" />
        </div>
        <div class="liquid-group-meta">
          <span class="liquid-group-title">{{ title }}</span>
          <span class="liquid-group-count">{{ countLabel }}</span>
          <span class="liquid-group-hint">Нажмите, чтобы посмотреть вкусы</span>
        </div>
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
      <div
        v-show="expanded"
        class="liquid-group-body"
        :id="`liquid-group-body-${props.groupId}`"
      >
        <div v-if="products.length" class="liquid-product-header">
          <span class="liquid-header-cell liquid-header-title">Вкус</span>
          <span class="liquid-header-cell liquid-header-strength">Крепость</span>
          <span class="liquid-header-cell liquid-header-price">Цена</span>
          <span class="liquid-header-cell liquid-header-stock">Наличие</span>
        </div>
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
.liquid-group {
  border-radius: 24px;
  border: 3px solid var(--navalivay-black);
  background: var(--navalivay-white);
  box-shadow: var(--navalivay-shadow);
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.liquid-group.expanded {
  transform: translate(-4px, -4px);
  box-shadow: var(--navalivay-shadow-hover);
}

.liquid-group-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.2rem 1.4rem;
  text-align: left;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.02) 0%, rgba(0, 0, 0, 0.06) 100%);
  transition: background 0.2s ease;
  gap: 1.2rem;
}

.liquid-group-header:hover {
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.04) 0%, rgba(0, 0, 0, 0.08) 100%);
}

.liquid-group-content {
  display: flex;
  align-items: center;
  gap: 1.2rem;
}

.liquid-group-cover {
  width: 112px;
  height: 112px;
  border-radius: 20px;
  overflow: hidden;
  border: 4px solid rgba(0, 0, 0, 0.08);
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.08) 0%, rgba(0, 0, 0, 0.16) 100%);
  flex-shrink: 0;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
}

.liquid-group-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.liquid-group-meta {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.liquid-group-title {
  font-family: var(--font-display);
  font-size: 1.35rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--navalivay-black);
}

.liquid-group-count {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--navalivay-gray);
}

.liquid-group-hint {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(0, 0, 0, 0.45);
}

.liquid-group.expanded .liquid-group-hint {
  color: rgba(0, 0, 0, 0.3);
}

.liquid-group-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 3px solid var(--navalivay-black);
  background: var(--navalivay-white);
  color: var(--navalivay-black);
}

.liquid-group-body {
  padding: 0 1rem 1.25rem;
  background: rgba(255, 255, 255, 0.96);
}

.liquid-product-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

@media (max-width: 1024px) {
  .liquid-group-header {
    padding: 1.1rem 1.2rem;
  }

  .liquid-group-cover {
    width: 96px;
    height: 96px;
  }
}

@media (max-width: 720px) {
  .liquid-group {
    border-width: 2px;
    border-radius: 20px;
  }

  .liquid-group-header {
    align-items: flex-start;
    padding: 0.95rem 1.05rem;
    gap: 1rem;
  }

  .liquid-group-content {
    align-items: flex-start;
    gap: 0.95rem;
  }

  .liquid-group-cover {
    width: 78px;
    height: 78px;
    border-width: 3px;
  }

  .liquid-group-meta {
    gap: 0.15rem;
  }

  .liquid-group-title {
    font-size: 1rem;
  }

  .liquid-group-count {
    font-size: 0.7rem;
  }

  .liquid-group-hint {
    font-size: 0.6rem;
  }

  .liquid-group-icon {
    width: 38px;
    height: 38px;
  }

  .liquid-group-body {
    padding: 0 0.85rem 1.05rem;
  }
}

@media (max-width: 600px) {
  .liquid-group-header {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
    padding: 0.85rem 1rem;
  }

  .liquid-group-content {
    width: 100%;
    align-items: stretch;
    gap: 0.75rem;
  }

  .liquid-group-cover {
    width: 100%;
    height: auto;
    aspect-ratio: 4 / 3;
  }

  .liquid-group-meta {
    gap: 0.25rem;
  }

  .liquid-group-title {
    font-size: 1.05rem;
  }

  .liquid-group-icon {
    align-self: flex-end;
    width: 36px;
    height: 36px;
  }
}

@media (max-width: 480px) {
  .liquid-group-header {
    padding: 0.75rem 0.85rem;
  }

  .liquid-group-body {
    padding: 0 0.65rem 0.85rem;
  }
}
</style>
