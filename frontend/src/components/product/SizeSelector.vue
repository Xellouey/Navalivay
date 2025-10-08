<template>
  <div class="size-selector">
    <!-- Size Guide Button -->
    <div class="flex justify-between items-center mb-3 px-4">
      <h3 class="font-semibold text-brand-dark">Выберите размер</h3>
      <button
        @click="showSizeGuide = true"
        class="text-sm text-brand-primary hover:text-brand-dark transition-colors flex items-center gap-1"
      >
        <CalculatorIcon class="w-4 h-4" />
        <span>Таблица размеров</span>
      </button>
    </div>

    <!-- Size Options -->
    <div class="px-4">
      <div class="grid grid-cols-4 gap-2">
        <button
          v-for="size in sizes"
          :key="size.value"
          @click="selectSize(size)"
          :disabled="!size.available"
          class="relative p-3 rounded-xl border-2 font-semibold transition-all duration-200"
          :class="getSizeButtonClass(size)"
        >
          <!-- Size Label -->
          <span class="relative z-10">{{ size.label }}</span>
          
          <!-- Out of Stock Overlay -->
          <div
            v-if="!size.available"
            class="absolute inset-0 flex items-center justify-center"
          >
            <div class="absolute inset-0 bg-gray-100 rounded-lg opacity-50"></div>
            <div class="absolute w-full h-0.5 bg-gray-400 transform rotate-45"></div>
          </div>
          
          <!-- Selected Indicator -->
          <Transition
            enter-active-class="transition-all duration-300"
            enter-from-class="opacity-0 scale-0"
            enter-to-class="opacity-100 scale-100"
            leave-active-class="transition-all duration-200"
            leave-from-class="opacity-100 scale-100"
            leave-to-class="opacity-0 scale-0"
          >
            <div
              v-if="selectedSize?.value === size.value"
              class="absolute -top-1 -right-1 w-5 h-5 bg-brand-primary rounded-full flex items-center justify-center"
            >
              <CheckIcon class="w-3 h-3 text-brand-dark" />
            </div>
          </Transition>
        </button>
      </div>

      <!-- Selected Size Info -->
      <Transition
        enter-active-class="transition-all duration-300"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-200"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div 
          v-if="selectedSize"
          class="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg"
        >
          <div class="flex items-center gap-2">
            <CheckCircleIcon class="w-5 h-5 text-green-600" />
            <span class="text-sm text-green-800">
              Размер {{ selectedSize.label }} выбран • {{ selectedSize.stock }} шт. в наличии
            </span>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Size Guide Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-all duration-300"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-all duration-200"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showSizeGuide"
          class="fixed inset-0 z-50 bg-white/40 backdrop-blur-sm flex items-end justify-center"
          @click="showSizeGuide = false"
        >
          <Transition
            enter-active-class="transition-all duration-300"
            enter-from-class="translate-y-full"
            enter-to-class="translate-y-0"
            leave-active-class="transition-all duration-200"
            leave-from-class="translate-y-0"
            leave-to-class="translate-y-full"
          >
            <div
              v-if="showSizeGuide"
              class="bg-white w-full max-w-lg rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto"
              @click.stop
            >
              <!-- Modal Header -->
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-semibold text-brand-dark">Таблица размеров</h3>
                <button
                  @click="showSizeGuide = false"
                  class="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <XMarkIcon class="w-4 h-4 text-gray-600" />
                </button>
              </div>

              <!-- Size Chart -->
              <div class="mb-6">
                <h4 class="font-medium text-brand-dark mb-3">Мужская одежда</h4>
                <div class="overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="border-b">
                        <th class="text-left py-2 pr-4 font-medium text-gray-600">Размер</th>
                        <th class="text-center px-4 py-2 font-medium text-gray-600">RU</th>
                        <th class="text-center px-4 py-2 font-medium text-gray-600">Грудь (см)</th>
                        <th class="text-center px-4 py-2 font-medium text-gray-600">Талия (см)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in sizeChart" :key="row.size" class="border-b">
                        <td class="py-2 pr-4 font-semibold">{{ row.size }}</td>
                        <td class="text-center px-4 py-2">{{ row.ru }}</td>
                        <td class="text-center px-4 py-2">{{ row.chest }}</td>
                        <td class="text-center px-4 py-2">{{ row.waist }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- How to Measure -->
              <div class="p-4 bg-gray-50 rounded-xl">
                <h4 class="font-medium text-brand-dark mb-2 flex items-center gap-2">
                  <InformationCircleIcon class="w-5 h-5 text-brand-primary" />
                  Как измерить
                </h4>
                <ul class="space-y-2 text-sm text-gray-600">
                  <li class="flex items-start gap-2">
                    <span class="font-semibold">Грудь:</span>
                    <span>Измерьте обхват груди по самым выступающим точкам</span>
                  </li>
                  <li class="flex items-start gap-2">
                    <span class="font-semibold">Талия:</span>
                    <span>Измерьте обхват талии в самом узком месте</span>
                  </li>
                </ul>
              </div>

              <!-- Recommendation -->
              <div class="mt-4 p-3 bg-brand-primary/10 border border-brand-primary/20 rounded-lg">
                <p class="text-sm text-brand-dark">
                  <span class="font-semibold">Совет:</span> Если вы между размерами, рекомендуем выбрать больший размер для комфортной посадки.
                </p>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  CalculatorIcon,
  CheckIcon,
  CheckCircleIcon,
  XMarkIcon,
  InformationCircleIcon
} from '@heroicons/vue/24/outline'

interface Size {
  value: string
  label: string
  available: boolean
  stock: number
}

interface Props {
  availableSizes?: Size[]
}

const props = withDefaults(defineProps<Props>(), {
  availableSizes: () => [
    { value: 'xs', label: 'XS', available: false, stock: 0 },
    { value: 's', label: 'S', available: true, stock: 3 },
    { value: 'm', label: 'M', available: true, stock: 5 },
    { value: 'l', label: 'L', available: true, stock: 2 },
    { value: 'xl', label: 'XL', available: true, stock: 4 },
    { value: '2xl', label: '2XL', available: false, stock: 0 },
    { value: '3xl', label: '3XL', available: true, stock: 1 },
    { value: '4xl', label: '4XL', available: false, stock: 0 }
  ]
})

const emit = defineEmits<{
  select: [size: Size]
}>()

const selectedSize = ref<Size | null>(null)
const showSizeGuide = ref(false)

const sizes = computed(() => props.availableSizes)

const sizeChart = [
  { size: 'XS', ru: '42-44', chest: '86-89', waist: '73-76' },
  { size: 'S', ru: '44-46', chest: '90-93', waist: '77-80' },
  { size: 'M', ru: '46-48', chest: '94-97', waist: '81-84' },
  { size: 'L', ru: '48-50', chest: '98-101', waist: '85-88' },
  { size: 'XL', ru: '50-52', chest: '102-105', waist: '89-92' },
  { size: '2XL', ru: '52-54', chest: '106-109', waist: '93-96' },
  { size: '3XL', ru: '54-56', chest: '110-113', waist: '97-100' },
  { size: '4XL', ru: '56-58', chest: '114-117', waist: '101-104' }
]

function selectSize(size: Size) {
  if (!size.available) return
  
  selectedSize.value = size
  emit('select', size)
  
  // Haptic feedback
  if (window.Telegram?.WebApp?.HapticFeedback) {
    window.Telegram.WebApp.HapticFeedback.impactOccurred('light')
  }
}

function getSizeButtonClass(size: Size) {
  const isSelected = selectedSize.value?.value === size.value
  
  if (!size.available) {
    return 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
  }
  
  if (isSelected) {
    return 'border-brand-primary bg-brand-primary text-brand-dark shadow-md transform scale-105'
  }
  
  return 'border-gray-300 bg-white text-brand-dark hover:border-brand-primary hover:bg-brand-primary/5 active:scale-95'
}
</script>

<style scoped>
/* Additional custom styles if needed */
</style>