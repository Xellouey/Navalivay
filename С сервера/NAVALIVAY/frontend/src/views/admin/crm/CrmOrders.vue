<template>
  <div class="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
    <div class="mx-auto w-full max-w-7xl space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
          <button
            @click="refreshOrders()"
            :disabled="isRefreshing"
            class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span v-if="!isRefreshing">Обновить</span>
            <span v-else>Обновляем...</span>
          </button>
          <button
            @click="autoRefreshEnabled = !autoRefreshEnabled"
            class="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
            :class="autoRefreshEnabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100'"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {{ autoRefreshEnabled ? 'Авто включено' : 'Включить авто' }}
          </button>
          <button
            @click="notificationsEnabled = !notificationsEnabled"
            :disabled="!notificationsSupported || notificationPermissionDenied"
            class="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            :class="notificationsEnabled ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100'"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {{ notificationsEnabled ? 'Уведомления' : 'Уведомления выкл' }}
          </button>
          <button
            @click="soundEnabled = !soundEnabled"
            class="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
            :class="soundEnabled ? 'border-purple-200 bg-purple-50 text-purple-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100'"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5l-6 6h4v5l6-6h-4V5z" />
            </svg>
            {{ soundEnabled ? 'Звук' : 'Звук выкл' }}
          </button>
          <button
            @click="showCreateModal = true"
            class="w-full rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 sm:w-auto"
          >
            Создать заказ
          </button>
        </div>
      </div>

      <header class="flex flex-col gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 sm:text-3xl">Заказы</h1>
          <p class="text-sm text-gray-600 sm:text-base">Канбан доска для статусов «Новый → Собран → Выдан»</p>
        </div>
        
        <div class="relative max-w-md">
          <input
            v-model.trim="orderSearch"
            type="search"
            placeholder="Поиск по номеру, клиенту, товарам..."
            class="w-full rounded-lg border border-gray-300 px-4 py-2 pl-10 text-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <svg 
            class="absolute left-3 top-2.5 h-5 w-5 text-gray-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <button
            v-if="orderSearch"
            @click="orderSearch = ''"
            class="absolute right-3 top-2.5 text-gray-400 transition hover:text-gray-600"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      <div class="flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span class="inline-flex items-center gap-1">
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Последнее обновление: <span class="font-semibold text-gray-700">{{ lastUpdateLabel }}</span>
        </span>
        <span v-if="autoRefreshEnabled" class="inline-flex items-center gap-1 text-emerald-600">
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3v4h.01M7 21a9 9 0 0010-8.94V11a4 4 0 10-8 0v1.06A9 9 0 007 21z" />
          </svg>
          Автообновление каждые {{ refreshIntervalMs / 1000 }}с
        </span>
        <span v-if="unseenOrdersCount > 0" class="inline-flex items-center gap-1 text-red-600">
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M12 18h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {{ unseenOrdersCount }} новых заказов не просмотрено
        </span>
      </div>

      <div v-if="loadingOrders" class="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-blue-200 bg-white">
        <div class="flex flex-col items-center gap-4">
          <div class="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-r-transparent"></div>
          <p class="text-sm text-gray-500">Загружаем заказы...</p>
        </div>
      </div>

      <div v-else class="space-y-6">
        <div class="grid gap-4 lg:grid-cols-3">
          <section
            v-for="column in kanbanColumns"
            :key="column.key"
            class="flex h-full flex-col rounded-xl border border-gray-200 bg-white shadow-sm"
          >
            <header class="border-b border-gray-100 px-5 py-4">
              <div class="flex items-center justify-between">
                <div>
                  <div class="flex items-center gap-2">
                    <h2 class="text-lg font-semibold text-gray-900">{{ column.label }}</h2>
                    <button
                      v-if="column.key === 'delivered'"
                      type="button"
                      class="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                      @click="openDeliveredModal('today')"
                    >
                      Смотреть все
                    </button>
                  </div>
                  <p class="text-xs text-gray-500">{{ column.description }}</p>
                </div>
                <div class="flex items-center gap-2">
                  <span :class="['rounded-full px-2 py-1 text-xs font-semibold', column.badgeClass]">
                    {{ column.orders.length }}
                  </span>
                  <span
                    v-if="column.key === 'new' && unseenOrdersCount > 0"
                    class="inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-700"
                  >
                    +{{ unseenOrdersCount }}
                  </span>
                </div>
              </div>
            </header>
            <div
              class="flex-1 space-y-3 overflow-y-auto px-4 py-4 transition"
              :class="[
                activeDropColumn === column.key
                  ? 'bg-blue-50/60 ring-2 ring-blue-300 ring-offset-2'
                  : column.key === 'new' && unseenOrdersCount > 0
                    ? 'ring-2 ring-amber-300 ring-offset-2'
                    : '',
                column.key === 'new' && newOrderHighlight ? 'animate-pulse' : ''
              ]"
              @dragover.prevent="onDragOver(column.key)"
              @dragenter.prevent="onDragOver(column.key)"
              @dragleave.prevent="onDragLeave(column.key)"
              @drop.prevent="onDrop(column.key)"
            >
              <p
                v-if="column.orders.length === 0"
                class="rounded-lg border border-dashed border-gray-200 px-3 py-8 text-center text-sm text-gray-400"
              >
                Нет заказов в этом статусе
              </p>

              <article
                v-for="order in column.orders"
                :key="order.id"
                class="cursor-grab rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md active:cursor-grabbing"
                :class="order.delivery_type === 'delivery' ? 'border-rose-200 ring-1 ring-rose-100' : ''"
                draggable="true"
                @dragstart="onDragStart(order)"
                @dragend="onDragEnd"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <span>#{{ order.order_number }}</span>
                    <button
                      v-if="deliveredStatuses.includes(order.status)"
                      type="button"
                      class="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-200"
                      @click.stop="openDeliveredModal()"
                    >
                      {{ orderStatusLabel(order.status) }}
                    </button>
                  </div>
                  <span :class="['rounded-full px-2 py-0.5 text-xs font-medium', deliveryBadgeClass(order)]">
                    {{ order.delivery_type === 'delivery' ? 'Доставка' : 'Самовывоз' }}
                  </span>
                </div>

                <div class="mt-2 space-y-1 text-sm text-gray-700">
                  <div class="font-medium">{{ order.customer_name || 'Без имени' }}</div>
                  <div v-if="order.telegram_username" class="text-xs text-blue-600">
                    <a :href="`https://t.me/${order.telegram_username}`" target="_blank">@{{ order.telegram_username }}</a>
                  </div>
                  <div
                    v-if="order.delivery_type === 'delivery' && order.delivery_address"
                    class="flex items-start gap-1 text-xs font-medium text-rose-600"
                  >
                    <svg class="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 11c1.66 0 3-1.34 3-3S13.66 5 12 5s-3 1.34-3 3 1.34 3 3 3z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 22s8-4.438 8-11a8 8 0 10-16 0c0 6.562 8 11 8 11z" />
                    </svg>
                    <span class="leading-snug">{{ order.delivery_address }}</span>
                  </div>
                  <p v-if="order.notes" class="text-xs text-gray-500">{{ order.notes }}</p>
                </div>

                <ul v-if="order.items?.length" class="mt-3 space-y-1 text-xs text-gray-600">
                  <li v-for="item in previewItems(order)" :key="item.id">
                    • {{ item.product_title }} × {{ item.quantity }}
                  </li>
                  <li v-if="(order.items?.length || 0) > previewLimit" class="text-[11px] text-gray-400">
                    и ещё {{ (order.items?.length || 0) - previewLimit }} позиций
                  </li>
                </ul>

                <div class="mt-4 flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="text-base font-semibold text-gray-900">{{ formatCurrency(order.final_amount) }}</div>
                      <div class="text-[11px] text-gray-400">Создан {{ formatDate(order.created_at) }}</div>
                    </div>
                    <div class="flex items-center gap-2">
                      <button
                        @click.stop="viewOrder(order.id)"
                        class="admin-link-button admin-link-button--compact admin-link-button--muted"
                      >
                        Подробнее
                      </button>
                      <button
                        v-if="canAdvance(order)"
                        @click.stop="advanceOrder(order)"
                        class="admin-link-button admin-link-button--compact"
                        :class="advanceButtonClass(order)"
                      >
                        {{ nextStatusLabel(order.status, order.delivery_type) }}
                      </button>
                    </div>
                  </div>
                  <button
                    v-if="order.telegram_username"
                    @click.stop="contactClient(order)"
                    class="flex items-center justify-center gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700 transition hover:bg-sky-100"
                  >
                    <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
                    </svg>
                    Связаться с клиентом
                  </button>
                </div>
              </article>
            </div>
          </section>
        </div>

        <section v-if="cancelledOrders.length" class="rounded-xl border border-red-100 bg-white p-4 shadow-sm">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-sm font-semibold uppercase text-red-600">Отмененные</h3>
            <span class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{{ cancelledOrders.length }}</span>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <article
              v-for="order in cancelledOrders"
              :key="order.id"
              class="rounded-lg border border-red-200 bg-white p-3 text-sm text-gray-600"
            >
              <div class="flex items-center justify-between text-xs text-red-500">
                <span class="font-semibold">#{{ order.order_number }}</span>
                <span>{{ formatDate(order.created_at) }}</span>
              </div>
              <div class="mt-1 font-medium text-gray-800">{{ order.customer_name || 'Без имени' }}</div>
              <div class="mt-1 text-xs text-gray-500">{{ order.notes || 'Причина не указана' }}</div>
            </article>
          </div>
        </section>
      </div>
    </div>

    <!-- Оплата и выдача -->
    <AdminModal
      :isOpen="paymentModalOpen && !!paymentOrder"
      :title="paymentOrder ? `Выдача заказа #${paymentOrder.order_number}` : 'Выдача заказа'"
      description="Выберите тип оплаты и кассу"
      size="md"
      :showActions="false"
      @close="closePaymentModal"
      @cancel="closePaymentModal"
    >
      <div class="grid gap-4">
        <div>
          <label class="text-sm font-medium text-gray-700">Сумма к оплате</label>
          <input
            v-model.number="paymentAmount"
            type="number"
            min="0"
            step="0.01"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div>
          <label class="text-sm font-medium text-gray-700">Тип оплаты</label>
          <div class="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            Наличные
          </div>
        </div>

        <div>
          <label class="text-sm font-medium text-gray-700">Касса</label>
          <select
            v-model="selectedAccountId"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="" disabled>Выберите счёт</option>
            <option v-for="account in cashAccounts" :key="account.id" :value="account.id">
              {{ account.name }} · {{ formatCurrency(account.balance) }}
            </option>
          </select>
        </div>

        <div>
          <label class="text-sm font-medium text-gray-700">Комментарий</label>
          <textarea
            v-model="paymentNotes"
            rows="3"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Например, имя кассира или примечания к оплате"
          ></textarea>
        </div>
      </div>

      <footer class="mt-6 flex justify-end gap-3">
        <button
          @click="closePaymentModal"
          class="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
          :disabled="isIssuing"
        >
          Отмена
        </button>
        <button
          @click="submitPayment"
          class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
          :disabled="isIssuing || !selectedAccountId || paymentAmount <= 0"
        >
          <svg v-if="isIssuing" class="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Подтвердить и выдать
        </button>
      </footer>
    </AdminModal>

    <AdminModal
      :isOpen="deliveredModalOpen"
      title="Доставленные заказы"
      description="Статистика выполненных заказов и доставок."
      size="xl"
      :showActions="false"
      @close="closeDeliveredModal"
      @cancel="closeDeliveredModal"
    >
      <div class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="option in deliveredFilterOptions"
              :key="option.value"
              type="button"
              class="rounded-full px-3 py-1 text-xs font-semibold transition"
              :class="deliveredFilter === option.value
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
              @click="deliveredFilter = option.value"
            >
              {{ option.label }}
            </button>
          </div>
          <div class="relative">
            <input
              v-model.trim="deliveredSearch"
              type="search"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 sm:w-64"
              placeholder="Поиск по номеру или клиенту"
            />
          </div>
        </div>

        <div class="grid gap-4 lg:grid-cols-4">
          <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div class="text-xs uppercase text-gray-500">Всего заказов</div>
            <div class="mt-2 text-2xl font-semibold text-gray-900">{{ deliveredSummary.totalCount }}</div>
            <p class="text-xs text-gray-500">{{ deliveredSummaryLabel }}</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div class="text-xs uppercase text-gray-500">Прибыль общая</div>
            <div class="mt-2 text-2xl font-semibold text-emerald-700">{{ formatCurrency(deliveredSummary.totalProfit) }}</div>
            <p class="text-xs text-gray-500">Со всех заказов</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div class="text-xs uppercase text-gray-500">Доставка курьером</div>
            <div class="mt-2 text-2xl font-semibold text-rose-700">{{ deliveredSummary.deliveryCount }}</div>
            <p class="text-xs text-rose-600">Прибыль: {{ formatCurrency(deliveredSummary.deliveryProfit) }}</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div class="text-xs uppercase text-gray-500">Самовывоз</div>
            <div class="mt-2 text-2xl font-semibold text-blue-700">{{ deliveredSummary.pickupCount }}</div>
            <p class="text-xs text-blue-600">Прибыль: {{ formatCurrency(deliveredSummary.pickupProfit) }}</p>
          </div>
        </div>

        <div v-if="filteredDeliveredOrders.length" class="overflow-hidden rounded-lg border border-gray-200">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th class="px-4 py-3 text-left">№</th>
                <th class="px-4 py-3 text-left">Клиент</th>
                <th class="px-4 py-3 text-left">Тип</th>
                <th class="px-4 py-3 text-left">Сумма</th>
                <th class="px-4 py-3 text-left">Завершён</th>
                <th class="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr
                v-for="order in filteredDeliveredOrders"
                :key="order.id"
                class="hover:bg-gray-50"
              >
                <td class="px-4 py-3 font-semibold text-gray-900">#{{ order.order_number }}</td>
                <td class="px-4 py-3 text-gray-700">{{ order.customer_name || 'Без имени' }}</td>
                <td class="px-4 py-3">
                  <span
                    :class="order.delivery_type === 'delivery' ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-600'"
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  >
                    {{ order.delivery_type === 'delivery' ? 'Доставка' : 'Самовывоз' }}
                  </span>
                </td>
                <td class="px-4 py-3 font-medium text-gray-900">{{ formatCurrency(order.final_amount) }}</td>
                <td class="px-4 py-3 text-gray-500">{{ formatDate(orderCompletedAt(order) || order.created_at) }}</td>
                <td class="px-4 py-3 text-right">
                  <button
                    class="text-sm font-medium text-blue-600 transition hover:text-blue-800"
                    @click="viewOrder(order.id)"
                  >
                    Открыть
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          За выбранный период доставленных заказов не найдено.
        </div>
      </div>
    </AdminModal>

    <!-- Создание заказа -->
    <OrderCreateModal
      :is-open="showCreateModal"
      @close="showCreateModal = false"
      @created="handleOrderCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import type { Order } from '@/stores/crm'
import { useCrmStore } from '@/stores/crm'
import OrderCreateModal from '@/components/crm/OrderCreateModal.vue'
import AdminModal from '@/components/AdminModal.vue'

const crmStore = useCrmStore()
const { orders, loadingOrders, cashAccounts } = storeToRefs(crmStore)

const router = useRouter()

const showCreateModal = ref(false)
const paymentModalOpen = ref(false)
const paymentOrder = ref<Order | null>(null)
const paymentMethod = ref<'cash'>('cash')
const selectedAccountId = ref('')
const paymentAmount = ref(0)
const paymentNotes = ref('')
const isIssuing = ref(false)
const dragOrder = ref<Order | null>(null)
const activeDropColumn = ref<string | null>(null)

const autoRefreshEnabled = ref(true)
const notificationsEnabled = ref(true)
const soundEnabled = ref(true)
const lastUpdateAt = ref<Date | null>(null)
const isRefreshing = ref(false)
const newOrderHighlight = ref(false)
const unseenOrderIds = ref<Set<string>>(new Set())

const notificationsSupported = typeof window !== 'undefined' && 'Notification' in window

const refreshIntervalMs = 15000
let refreshTimer: ReturnType<typeof setInterval> | null = null
let highlightTimer: ReturnType<typeof setTimeout> | null = null

const previewLimit = 4

const deliveredModalOpen = ref(false)
const deliveredFilter = ref<DeliveredFilter>('today')
const deliveredSearch = ref('')
const orderSearch = ref('')
const deliveredFilterOptions: Array<{ value: DeliveredFilter; label: string }> = [
  { value: 'today', label: 'Сегодня' },
  { value: 'week', label: '7 дней' },
  { value: 'month', label: '30 дней' },
  { value: 'all', label: 'За всё время' }
]

type KanbanColumnConfig = {
  key: 'new' | 'in_progress' | 'delivered'
  label: string
  description: string
  statuses: Order['status'][]
  badgeClass: string
}

type DeliveredFilter = 'today' | 'week' | 'month' | 'all'

const deliveredStatuses: Array<Order['status']> = ['delivered', 'completed']

const kanbanConfig: KanbanColumnConfig[] = [
  {
    key: 'new',
    label: 'Новые',
    description: 'Необходимо собрать заказ',
    statuses: ['new'],
    badgeClass: 'bg-amber-100 text-amber-700'
  },
  {
    key: 'in_progress',
    label: 'Собран',
    description: 'Ожидает выдачи клиенту',
    statuses: ['in_progress'],
    badgeClass: 'bg-blue-100 text-blue-700'
  },
  {
    key: 'delivered',
    label: 'Выдано',
    description: 'Оплаченные и выданные заказы (доставлено/выдано)',
    statuses: deliveredStatuses,
    badgeClass: 'bg-emerald-100 text-emerald-700'
  }
]

const kanbanColumns = computed(() =>
  kanbanConfig.map((column) => {
    let filtered = orders.value.filter((order) => column.statuses.includes(order.status))
    
    // Локальная фильтрация по поиску
    if (orderSearch.value) {
      const query = orderSearch.value.toLowerCase()
      filtered = filtered.filter((order) => {
        // Поиск по номеру заказа
        if (String(order.order_number).includes(query)) return true
        
        // Поиск по имени клиента
        if (order.customer_name && order.customer_name.toLowerCase().includes(query)) return true
        
        // Поиск по telegram username
        if (order.telegram_username && order.telegram_username.toLowerCase().includes(query)) return true
        
        // Поиск по адресу доставки
        if (order.delivery_address && order.delivery_address.toLowerCase().includes(query)) return true
        
        // Поиск по примечаниям
        if (order.notes && order.notes.toLowerCase().includes(query)) return true
        
        // Поиск по товарам в заказе
        if (order.items && order.items.length > 0) {
          return order.items.some((item) => 
            item.product_title && item.product_title.toLowerCase().includes(query)
          )
        }
        
        return false
      })
    }
    
    return {
      ...column,
      orders: filtered
    }
  })
)

const deliveredOrdersList = computed(() =>
  orders.value.filter((order) => deliveredStatuses.includes(order.status))
)

function orderCompletedAt(order: Order): string | null {
  return order.completed_at || order.paid_at || order.updated_at || order.created_at || null
}

function isDeliveredInRange(order: Order, filter: DeliveredFilter) {
  if (filter === 'all') return true
  const source = orderCompletedAt(order)
  if (!source) return false
  const date = new Date(source)
  const now = new Date()
  if (filter === 'today') {
    return date.toDateString() === now.toDateString()
  }
  const diff = now.getTime() - date.getTime()
  const dayMs = 24 * 60 * 60 * 1000
  if (filter === 'week') {
    return diff <= 7 * dayMs
  }
  if (filter === 'month') {
    return diff <= 30 * dayMs
  }
  return true
}

const filteredDeliveredOrders = computed(() => {
  const term = deliveredSearch.value.trim().toLowerCase()
  const filter = deliveredFilter.value
  return deliveredOrdersList.value
    .filter((order) => isDeliveredInRange(order, filter))
    .filter((order) => {
      if (!term) return true
      const orderNumberMatch = String(order.order_number).includes(term)
      const nameMatch = (order.customer_name || '').toLowerCase().includes(term)
      const typeLabel = order.delivery_type === 'delivery' ? 'доставка' : 'самовывоз'
      const typeMatch = typeLabel.includes(term)
      return orderNumberMatch || nameMatch || typeMatch
    })
    .sort((a, b) => {
      const dateB = orderCompletedAt(b)
      const dateA = orderCompletedAt(a)
      return (dateB ? new Date(dateB).getTime() : 0) - (dateA ? new Date(dateA).getTime() : 0)
    })
})

const deliveredSummary = computed(() => {
  const list = filteredDeliveredOrders.value
  const deliveryOrders = list.filter((order) => order.delivery_type === 'delivery')
  const pickupOrders = list.filter((order) => order.delivery_type === 'pickup')
  const sumProfit = (items: Order[]) => items.reduce((total, item) => total + (item.profit ?? 0), 0)
  return {
    totalCount: list.length,
    totalProfit: sumProfit(list),
    deliveryCount: deliveryOrders.length,
    deliveryProfit: sumProfit(deliveryOrders),
    pickupCount: pickupOrders.length,
    pickupProfit: sumProfit(pickupOrders)
  }
})

const deliveredSummaryLabel = computed(() => {
  switch (deliveredFilter.value) {
    case 'today':
      return 'сегодня'
    case 'week':
      return 'за 7 дней'
    case 'month':
      return 'за 30 дней'
    default:
      return 'за всё время'
  }
})

const cancelledOrders = computed(() => {
  let filtered = orders.value.filter((order) => order.status === 'cancelled')
  
  if (orderSearch.value) {
    const query = orderSearch.value.toLowerCase()
    filtered = filtered.filter((order) => {
      // Поиск по номеру заказа
      if (String(order.order_number).includes(query)) return true
      
      // Поиск по имени клиента
      if (order.customer_name && order.customer_name.toLowerCase().includes(query)) return true
      
      // Поиск по telegram username
      if (order.telegram_username && order.telegram_username.toLowerCase().includes(query)) return true
      
      // Поиск по примечаниям
      if (order.notes && order.notes.toLowerCase().includes(query)) return true
      
      return false
    })
  }
  
  return filtered
})

const unseenOrdersCount = computed(() => unseenOrderIds.value.size)

const lastUpdateLabel = computed(() => {
  if (!lastUpdateAt.value) return '—'
  return lastUpdateAt.value.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
})

const notificationPermissionDenied = computed(() => {
  if (!notificationsSupported || typeof Notification === 'undefined') return false
  return Notification.permission === 'denied'
})

const nextStatusMap: Record<Order['status'], 'in_progress' | 'delivered' | null> = {
  new: 'in_progress',
  in_progress: 'delivered',
  completed: null,
  delivered: null,
  cancelled: null
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0
  }).format(value)
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function previewItems(order: Order) {
  if (!order.items) return []
  return order.items.slice(0, previewLimit)
}

function deliveryBadgeClass(order: Order) {
  return order.delivery_type === 'delivery'
    ? 'bg-rose-100 text-rose-700'
    : 'bg-gray-100 text-gray-600'
}

function nextStatusLabel(status: Order['status'], deliveryType?: Order['delivery_type']) {
  if (status === 'new') return 'Собрано'
  if (status === 'in_progress') {
    return deliveryType === 'delivery' ? 'Доставлено' : 'Выдано'
  }
  return ''
}

function advanceButtonClass(order: Order) {
  if (order.status === 'new') return 'admin-link-button--primary'
  if (order.status === 'in_progress') return 'admin-link-button--success'
  return 'admin-link-button--muted'
}

function canAdvance(order: Order) {
  return nextStatusMap[order.status] !== null
}

async function advanceOrder(order: Order) {
  const nextStatus = nextStatusMap[order.status]
  if (!nextStatus) return

  // Для статуса "Собран" определяем финальный статус в зависимости от типа доставки
  if (order.status === 'in_progress') {
    await openPaymentModal(order)
    return
  }

  await crmStore.updateOrder(order.id, { status: nextStatus })
  markOrderSeen(order.id)
}

function viewOrder(id: string) {
  markOrderSeen(id)
  router.push(`/admin/crm/orders/${id}`)
}

function canDropTo(columnKey: string, order: Order) {
  if (columnKey === 'in_progress') return order.status === 'new'
  if (columnKey === 'delivered') return order.status === 'in_progress'
  return false
}

function onDragStart(order: Order) {
  dragOrder.value = order
}

function onDragEnd() {
  dragOrder.value = null
  activeDropColumn.value = null
}

function onDragOver(columnKey: string) {
  if (!dragOrder.value) return
  if (canDropTo(columnKey, dragOrder.value)) {
    activeDropColumn.value = columnKey
  }
}

function onDragLeave(columnKey: string) {
  if (activeDropColumn.value === columnKey) {
    activeDropColumn.value = null
  }
}

function onDrop(columnKey: string) {
  if (!dragOrder.value) return
  if (!canDropTo(columnKey, dragOrder.value)) {
    onDragEnd()
    return
  }

  const order = dragOrder.value
  onDragEnd()
  advanceOrder(order)
}

async function openPaymentModal(order: Order) {
  paymentOrder.value = order
  paymentAmount.value = order.final_amount
  paymentMethod.value = 'cash'
  paymentNotes.value = order.payment_notes || ''

  if (cashAccounts.value.length === 0) {
    await crmStore.fetchCashAccounts()
  }

  const defaultAccount =
    cashAccounts.value.find((account) => account.is_default === 1) || cashAccounts.value[0] || null
  selectedAccountId.value = defaultAccount ? defaultAccount.id : ''

  paymentModalOpen.value = true
}

function closePaymentModal() {
  if (isIssuing.value) return
  paymentModalOpen.value = false
  paymentOrder.value = null
  paymentNotes.value = ''
}

async function submitPayment() {
  if (!paymentOrder.value || !selectedAccountId.value || paymentAmount.value <= 0) return
  isIssuing.value = true
  try {
    // Определяем финальный статус в зависимости от типа доставки
    const finalStatus = paymentOrder.value.delivery_type === 'delivery' ? 'delivered' : 'completed'
    
    await crmStore.issueOrder(paymentOrder.value.id, {
      payment_type: paymentMethod.value,
      payment_account_id: selectedAccountId.value,
      amount: paymentAmount.value,
      payment_notes: paymentNotes.value || undefined
    })
    
    // Обновляем статус после оплаты
    await crmStore.updateOrder(paymentOrder.value.id, { status: finalStatus })
    
    paymentModalOpen.value = false
    paymentOrder.value = null
    paymentNotes.value = ''
    await refreshOrders({ skipNotify: true })
  } catch (error) {
    console.error('[CRM] Failed to issue order:', error)
  } finally {
    isIssuing.value = false
  }
}

async function refreshOrders(options: { skipNotify?: boolean } = {}) {
  if (isRefreshing.value) return
  isRefreshing.value = true

  const previousIds = new Set<string>(orders.value.map((order) => order.id))

  try {
    await crmStore.fetchOrders({ limit: 200 })
    lastUpdateAt.value = new Date()

    if (options.skipNotify) {
      return
    }

    const newOrders = orders.value.filter((order) => !previousIds.has(order.id) && order.status === 'new')
    if (newOrders.length > 0) {
      handleNewOrders(newOrders)
    }
  } catch (error) {
    console.error('[CRM] Failed to refresh orders:', error)
  } finally {
    isRefreshing.value = false
  }
}

function handleOrderCreated(order: Order) {
  showCreateModal.value = false
  handleNewOrders([order])
  void refreshOrders({ skipNotify: true })
}

onMounted(async () => {
  await refreshOrders({ skipNotify: true })
  if (cashAccounts.value.length === 0) {
    await crmStore.fetchCashAccounts()
  }
  scheduleAutoRefresh()
  if (!notificationsSupported || notificationPermissionDenied.value) {
    notificationsEnabled.value = false
  }
  if (notificationsEnabled.value) {
    void ensureNotificationPermission()
  }
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
  if (highlightTimer) {
    clearTimeout(highlightTimer)
    highlightTimer = null
  }
})

function scheduleAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
  if (!autoRefreshEnabled.value) return
  refreshTimer = setInterval(() => {
    void refreshOrders()
  }, refreshIntervalMs)
}

function markOrderSeen(orderId: string) {
  if (!unseenOrderIds.value.has(orderId)) return
  const updated = new Set(unseenOrderIds.value)
  updated.delete(orderId)
  unseenOrderIds.value = updated
}

function handleNewOrders(orderList: Order[]) {
  let added = false
  orderList.forEach((order) => {
    if (order.status === 'new' && !unseenOrderIds.value.has(order.id)) {
      unseenOrderIds.value.add(order.id)
      added = true
    }
  })
  if (added) {
    unseenOrderIds.value = new Set(unseenOrderIds.value)
  }

  if (highlightTimer) {
    clearTimeout(highlightTimer)
  }
  newOrderHighlight.value = true
  highlightTimer = setTimeout(() => {
    newOrderHighlight.value = false
  }, 4000)

  if (notificationsEnabled.value) {
    triggerBrowserNotification(orderList.length)
  }

  if (soundEnabled.value) {
    playNotificationSound()
  }
}

function triggerBrowserNotification(count: number) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  const title = count === 1 ? 'Новый заказ' : `Новых заказов: ${count}`
  const body = count === 1
    ? 'Появился новый заказ в колонке «Новые».'
    : 'На доске появились новые заказы. Проверьте колонку «Новые».'

  try {
    new Notification(title, {
      body,
      icon: '/favicon.ico'
    })
  } catch (error) {
    console.warn('[CRM] Browser notification failed:', error)
  }
}

function playNotificationSound() {
  if (typeof window === 'undefined') return
  try {
    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.type = 'triangle'
    oscillator.frequency.value = 880
    oscillator.connect(gain)
    gain.connect(ctx.destination)

    const now = ctx.currentTime
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1)

    oscillator.start(now)
    oscillator.stop(now + 1)

    setTimeout(() => ctx.close().catch(() => null), 1500)
  } catch (error) {
    console.warn('[CRM] Notification sound failed:', error)
  }
}

async function ensureNotificationPermission() {
  if (!notificationsSupported || typeof Notification === 'undefined') {
    notificationsEnabled.value = false
    return
  }

  if (Notification.permission === 'default') {
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        notificationsEnabled.value = false
      }
    } catch (error) {
      console.warn('[CRM] Notification permission request failed:', error)
      notificationsEnabled.value = false
    }
  } else if (Notification.permission === 'denied') {
    notificationsEnabled.value = false
  }
}

watch(autoRefreshEnabled, () => {
  scheduleAutoRefresh()
})

watch(notificationsEnabled, (enabled) => {
  if (!notificationsSupported) return
  if (enabled) {
    void ensureNotificationPermission()
  }
})

watch(
  orders,
  (current) => {
    const filtered = new Set<string>()
    current.forEach((order) => {
      if (order.status === 'new' && unseenOrderIds.value.has(order.id)) {
        filtered.add(order.id)
      }
    })
    if (filtered.size !== unseenOrderIds.value.size) {
      unseenOrderIds.value = filtered
    }
  },
  { deep: true }
)

function openDeliveredModal(preset: DeliveredFilter = deliveredFilter.value) {
  deliveredFilter.value = preset
  deliveredSearch.value = ''
  deliveredModalOpen.value = true
}

function closeDeliveredModal() {
  deliveredModalOpen.value = false
}

function orderStatusLabel(status: Order['status']) {
  switch (status) {
    case 'new':
      return 'Новый'
    case 'in_progress':
      return 'Собран'
    case 'delivered':
      return 'Доставлено'
    case 'completed':
      return 'Завершён'
    case 'cancelled':
      return 'Отменён'
    default:
      return status
  }
}

function contactClient(order: Order) {
  if (!order.telegram_username) return
  
  const message = generateOrderMessage(order)
  const encodedMessage = encodeURIComponent(message)
  const telegramUrl = `https://t.me/${order.telegram_username.replace('@', '')}?text=${encodedMessage}`
  
  window.open(telegramUrl, '_blank')
}

function generateOrderMessage(order: Order): string {
  // Базовый шаблон (можно вынести в настройки)
  let template = `Привет! Пишу по поводу заказа [order_number].

Состав заказа:
[items]

К оплате будет [total]`

  // Добавляем информацию о доставке если есть
  if (order.delivery_type === 'delivery') {
    if (order.delivery_phone) {
      template += `\n\nТелефон: [phone]`
    }
    if (order.delivery_address) {
      template += `\nАдрес доставки: [address]`
    }
  }

  // Заменяем переменные
  let message = template
  
  // [order_number]
  message = message.replace('[order_number]', `#${order.order_number}`)
  
  // [items] - формируем список товаров
  const itemsList = order.items
    ?.map((item, index) => `${index + 1}. ${item.product_title} × ${item.quantity}`)
    .join('\n') || 'Нет товаров'
  message = message.replace('[items]', itemsList)
  
  // [total]
  message = message.replace('[total]', formatCurrency(order.final_amount))
  
  // [phone]
  if (order.delivery_phone) {
    message = message.replace('[phone]', order.delivery_phone)
  }
  
  // [address]
  if (order.delivery_address) {
    message = message.replace('[address]', order.delivery_address)
  }
  
  return message
}
</script>
