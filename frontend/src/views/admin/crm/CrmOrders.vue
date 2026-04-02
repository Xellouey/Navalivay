<template>
  <div class="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
    <div class="mx-auto w-full max-w-7xl space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div
          class="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end"
        >
          <!-- Обновить -->
          <button
            @click="refreshOrders()"
            :disabled="isRefreshing"
            class="inline-flex items-center gap-2 rounded-xl border border-slate-200/40 bg-gradient-to-br from-slate-50/90 to-gray-50/60 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300/50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            <svg
              class="h-4 w-4 transition-transform duration-500"
              :class="{ 'animate-spin': isRefreshing }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span class="hidden sm:inline">{{ isRefreshing ? 'Обновляем...' : 'Обновить' }}</span>
          </button>

          <!-- Dropdown: Настройки -->
          <div class="relative" ref="settingsDropdownRef">
            <button
              @click="settingsDropdownOpen = !settingsDropdownOpen"
              class="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all duration-200"
              :class="
                hasActiveSettings
                  ? 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 shadow-sm'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300'
              "
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span class="hidden sm:inline">Настройки</span>
              <svg 
                class="h-3.5 w-3.5 transition-transform duration-200" 
                :class="{ 'rotate-180': settingsDropdownOpen }"
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <Transition
              enter-active-class="transition ease-out duration-150"
              enter-from-class="transform opacity-0 scale-95 -translate-y-1"
              enter-to-class="transform opacity-100 scale-100 translate-y-0"
              leave-active-class="transition ease-in duration-100"
              leave-from-class="transform opacity-100 scale-100 translate-y-0"
              leave-to-class="transform opacity-0 scale-95 -translate-y-1"
            >
              <div
                v-if="settingsDropdownOpen"
                class="absolute left-0 z-50 mt-2 w-80 origin-top-left rounded-2xl border border-slate-200/40 bg-white/95 p-3 shadow-2xl backdrop-blur-sm sm:left-auto sm:right-0 sm:origin-top-right"
              >
                <!-- Заголовок -->
                <div class="px-2 py-1.5 mb-2">
                  <h3 class="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">Уведомления</h3>
                </div>
                
                <!-- Автообновление -->
                <button
                  @click="crmStore.setAutoRefreshEnabled(!autoRefreshEnabled)"
                  class="flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 focus:outline-none"
                  :class="autoRefreshEnabled 
                    ? 'border-emerald-200/60 bg-gradient-to-br from-emerald-50/90 to-green-50/60 shadow-lg shadow-emerald-100/50' 
                    : 'border-slate-200/40 bg-gradient-to-br from-slate-50/90 to-gray-50/60 hover:border-slate-300/50 hover:shadow-md'"
                >
                  <div class="flex items-center gap-3">
                    <span 
                      class="flex h-9 w-9 items-center justify-center rounded-xl transition-all"
                      :class="autoRefreshEnabled ? 'bg-emerald-100/80 text-emerald-600 shadow-sm shadow-emerald-200/50' : 'bg-slate-100/80 text-slate-500'"
                    >
                      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </span>
                    <div>
                      <div class="text-sm font-semibold text-slate-800">Автообновление</div>
                      <div class="text-xs text-slate-400">Каждые 15 секунд</div>
                    </div>
                  </div>
                  <div
                    class="relative h-6 w-11 rounded-full transition-colors duration-200"
                    :class="autoRefreshEnabled ? 'bg-emerald-500' : 'bg-slate-300'"
                  >
                    <div
                      class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200"
                      :class="autoRefreshEnabled ? 'left-[22px]' : 'left-0.5'"
                    />
                  </div>
                </button>
                
                <!-- Уведомления -->
                <button
                  @click="crmStore.setNotificationsEnabled(!notificationsEnabled)"
                  :disabled="!notificationsSupported || notificationPermissionDenied"
                  class="mt-2 flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                  :class="notificationsEnabled 
                    ? 'border-sky-200/60 bg-gradient-to-br from-sky-50/90 to-blue-50/60 shadow-lg shadow-sky-100/50' 
                    : 'border-slate-200/40 bg-gradient-to-br from-slate-50/90 to-gray-50/60 hover:border-slate-300/50 hover:shadow-md'"
                >
                  <div class="flex items-center gap-3">
                    <span 
                      class="flex h-9 w-9 items-center justify-center rounded-xl transition-all"
                      :class="notificationsEnabled ? 'bg-sky-100/80 text-sky-600 shadow-sm shadow-sky-200/50' : 'bg-slate-100/80 text-slate-500'"
                    >
                      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </span>
                    <div>
                      <div class="text-sm font-semibold text-slate-800">Push-уведомления</div>
                      <div class="text-xs text-slate-400">Браузерные оповещения</div>
                    </div>
                  </div>
                  <div
                    class="relative h-6 w-11 rounded-full transition-colors duration-200"
                    :class="notificationsEnabled ? 'bg-sky-500' : 'bg-slate-300'"
                  >
                    <div
                      class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200"
                      :class="notificationsEnabled ? 'left-[22px]' : 'left-0.5'"
                    />
                  </div>
                </button>
                
                <!-- Звук -->
                <button
                  @click="crmStore.setSoundEnabled(!soundEnabled)"
                  class="mt-2 flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 focus:outline-none"
                  :class="soundEnabled 
                    ? 'border-purple-200/60 bg-gradient-to-br from-purple-50/90 to-violet-50/60 shadow-lg shadow-purple-100/50' 
                    : 'border-slate-200/40 bg-gradient-to-br from-slate-50/90 to-gray-50/60 hover:border-slate-300/50 hover:shadow-md'"
                >
                  <div class="flex items-center gap-3">
                    <span 
                      class="flex h-9 w-9 items-center justify-center rounded-xl transition-all"
                      :class="soundEnabled ? 'bg-purple-100/80 text-purple-600 shadow-sm shadow-purple-200/50' : 'bg-slate-100/80 text-slate-500'"
                    >
                      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                    </span>
                    <div>
                      <div class="text-sm font-semibold text-slate-800">Звук</div>
                      <div class="text-xs text-slate-400">При новом заказе</div>
                    </div>
                  </div>
                  <div
                    class="relative h-6 w-11 rounded-full transition-colors duration-200"
                    :class="soundEnabled ? 'bg-purple-500' : 'bg-slate-300'"
                  >
                    <div
                      class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200"
                      :class="soundEnabled ? 'left-[22px]' : 'left-0.5'"
                    />
                  </div>
                </button>
                
                <!-- Разрешить уведомления (если нужно) -->
                <template v-if="notificationPermissionStatus === 'default'">
                  <div class="my-3 border-t border-slate-100"></div>
                  <button
                    @click="requestNotificationPermission"
                    class="flex w-full items-center gap-3 rounded-xl border border-orange-200/60 bg-gradient-to-br from-orange-50/90 to-amber-50/60 px-3 py-2.5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none"
                  >
                    <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100/80 text-orange-500 shadow-sm shadow-orange-200/50">
                      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </span>
                    <div>
                      <div class="text-sm font-semibold text-orange-700">Разрешить уведомления</div>
                      <div class="text-xs text-orange-500/80">Требуется разрешение браузера</div>
                    </div>
                  </button>
                </template>
                
                <!-- Статус уведомлений если заблокированы -->
                <template v-if="notificationPermissionStatus === 'denied'">
                  <div class="my-3 border-t border-slate-100"></div>
                  <div class="flex items-center gap-3 rounded-xl border border-red-200/60 bg-gradient-to-br from-red-50/90 to-rose-50/60 px-3 py-2.5">
                    <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100/80 text-red-500">
                      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    </span>
                    <div class="text-xs font-medium text-red-600">
                      Уведомления заблокированы в браузере
                    </div>
                  </div>
                </template>
              </div>
            </Transition>
          </div>

          <!-- Dropdown: Ещё -->
          <div class="relative" ref="moreDropdownRef">
            <button
              @click="moreDropdownOpen = !moreDropdownOpen"
              class="inline-flex items-center gap-2 rounded-xl border border-slate-200/40 bg-gradient-to-br from-slate-50/90 to-gray-50/60 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300/50 hover:shadow-md"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
              <span class="hidden sm:inline">Ещё</span>
            </button>
            <Transition
              enter-active-class="transition ease-out duration-150"
              enter-from-class="transform opacity-0 scale-95 -translate-y-1"
              enter-to-class="transform opacity-100 scale-100 translate-y-0"
              leave-active-class="transition ease-in duration-100"
              leave-from-class="transform opacity-100 scale-100 translate-y-0"
              leave-to-class="transform opacity-0 scale-95 -translate-y-1"
            >
              <div
                v-if="moreDropdownOpen"
                class="absolute left-0 z-50 mt-2 w-72 origin-top-left rounded-2xl border border-slate-200/40 bg-white/95 p-3 shadow-2xl backdrop-blur-sm sm:left-auto sm:right-0 sm:origin-top-right"
              >
                <!-- Заголовок -->
                <div class="px-2 py-1.5 mb-2">
                  <h3 class="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">Дополнительно</h3>
                </div>
                
                <button
                  @click="$router.push('/admin/crm/message-templates'); moreDropdownOpen = false"
                  class="flex w-full items-center gap-3 rounded-xl border border-slate-200/40 bg-gradient-to-br from-slate-50/90 to-gray-50/60 px-3 py-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300/50 hover:shadow-md focus:outline-none"
                >
                  <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100/80 text-blue-500 shadow-sm shadow-blue-200/50">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </span>
                  <div>
                    <div class="text-sm font-semibold text-slate-800">Шаблоны сообщений</div>
                    <div class="text-xs text-slate-400">Готовые ответы клиентам</div>
                  </div>
                </button>
                
                <button
                  @click="$router.push('/admin/crm/orders/archive'); moreDropdownOpen = false"
                  class="mt-2 flex w-full items-center gap-3 rounded-xl border border-slate-200/40 bg-gradient-to-br from-slate-50/90 to-gray-50/60 px-3 py-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300/50 hover:shadow-md focus:outline-none"
                >
                  <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100/80 text-amber-500 shadow-sm shadow-amber-200/50">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                  </span>
                  <div>
                    <div class="text-sm font-semibold text-slate-800">Архив заказов</div>
                    <div class="text-xs text-slate-400">Старые и завершенные</div>
                  </div>
                </button>
              </div>
            </Transition>
          </div>

          <!-- Отмененные -->
          <button
            v-if="cancelledOrders.length"
            @click="cancelledModalOpen = true"
            class="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition-all duration-200 hover:from-red-100 hover:to-rose-100"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <span class="hidden sm:inline">Отмененные</span>
          </button>

          <!-- Выданные (запаролено) -->
          <button
            @click="profitUnlocked ? openDeliveredModal('today') : openPasswordModal()"
            class="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 px-4 py-2 text-sm font-medium text-emerald-600 shadow-sm transition-all duration-200 hover:from-emerald-100 hover:to-green-100"
          >
            <LockClosedIcon v-if="!profitUnlocked" class="h-4 w-4" />
            <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span class="hidden sm:inline">Выданные</span>
          </button>

          <!-- Создать заказ -->
          <button
            @click="showCreateModal = true"
            class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            <span class="hidden sm:inline">Создать заказ</span>
            <span class="sm:hidden">Заказ</span>
          </button>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center gap-4">
        <h1 class="text-2xl font-bold text-gray-900 sm:text-3xl shrink-0">Заказы</h1>
        <div class="relative flex-1">
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Поиск по номеру заказа, имени клиента или username..."
            class="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            @input="handleSearch"
          />
          <svg
            v-if="!searchQuery"
            class="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      <!-- Error banner -->
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div
          v-if="orderError"
          class="rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm"
        >
          <div class="flex items-start gap-3">
            <svg
              class="h-5 w-5 flex-shrink-0 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div class="flex-1">
              <p class="text-sm font-medium text-red-800">{{ orderError }}</p>
            </div>
            <button
              @click="dismissOrderError"
              class="inline-flex h-6 w-6 items-center justify-center rounded-full text-red-500 transition hover:bg-red-100"
            >
              <svg
                class="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </Transition>

      <div
        v-if="loadingOrders"
        class="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-blue-200 bg-white"
      >
        <div class="flex flex-col items-center gap-4">
          <div
            class="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-r-transparent"
          ></div>
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
                    <h2 class="text-lg font-semibold text-gray-900">
                      {{ column.label }}
                    </h2>
                  </div>
                  <p class="text-xs text-gray-500">{{ column.description }}</p>
                </div>
                <div class="flex items-center gap-2">
                  <span
                    :class="[
                      'rounded-full px-2 py-1 text-xs font-semibold',
                      column.badgeClass,
                    ]"
                  >
                    {{ column.orders.length }}
                  </span>
                  <span
                    v-if="column.key === 'new' && unseenOrdersCount > 0"
                    class="inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-700"
                  >
                    +{{ unseenOrdersCount }}
                  </span>
                  <span
                    v-if="column.key === 'action_required' && crmStore.actionRequiredCount > 0"
                    class="inline-flex items-center rounded-full bg-orange-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-orange-700"
                  >
                    +{{ crmStore.actionRequiredCount }}
                  </span>
                </div>
              </div>
            </header>
            <div
              class="flex-1 space-y-3 overflow-y-auto px-4 py-4 transition"
              :class="[
                activeDropColumn === column.key
                  ? 'bg-blue-50/60 ring-2 ring-blue-300 ring-offset-2'
                  : '',
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
                :class="[
                  order.delivery_type === 'delivery'
                    ? 'border-rose-200 ring-1 ring-rose-100'
                    : '',
                  unseenOrderIds.has(order.id)
                    ? 'ring-2 ring-amber-400 border-amber-300 bg-amber-50/50'
                    : '',
                  unseenOrderIds.has(order.id) && newOrderHighlight
                    ? 'animate-pulse'
                    : '',
                  order.needs_manager_action && order.manager_action_type === 'cancelled_by_customer'
                    ? 'ring-2 ring-red-400 border-red-300 bg-red-50/30'
                    : '',
                  order.needs_manager_action && order.manager_action_type === 'modified'
                    ? 'ring-2 ring-orange-400 border-orange-300 bg-orange-50/30'
                    : '',
                ]"
                :draggable="!order.needs_manager_action"
                @dragstart="onDragStart(order)"
                @dragend="onDragEnd"
              >
                <!-- Заголовок с номером и бейджами -->
                <div class="flex items-center justify-between">
                  <div
                    class="flex items-center gap-2 text-sm font-semibold text-gray-900"
                  >
                    <span>#{{ order.order_number }}</span>
                    <span
                      v-if="order.needs_manager_action && order.manager_action_type === 'modified'"
                      class="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700"
                    >Изменен покупателем</span>
                    <span
                      v-else-if="order.needs_manager_action && order.manager_action_type === 'cancelled_by_customer'"
                      class="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700"
                    >Отменен покупателем</span>
                  </div>
                  <!-- Кнопка отмены (не показываем для action_required) -->
                  <button
                    v-if="!order.needs_manager_action"
                    @click.stop="openCancelModal(order)"
                    class="group flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-gray-400 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                    title="Отменить заказ"
                  >
                    <svg class="h-4 w-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                <div class="mt-2 space-y-1 text-sm text-gray-700">
                  <div class="flex items-center justify-between">
                    <div class="font-medium">
                      {{ order.customer_name || "Без имени" }}
                    </div>
                    <button
                      v-if="order.telegram_username"
                      @click.stop="contactClient(order.id)"
                      :disabled="generatingMessageForOrder === order.id"
                      class="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <svg
                        v-if="generatingMessageForOrder === order.id"
                        class="h-3 w-3 animate-spin"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      <svg
                        v-else
                        class="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                      </svg>
                      <span>{{
                        generatingMessageForOrder === order.id
                          ? "Генерируем…"
                          : "Написать"
                      }}</span>
                    </button>
                  </div>
                  <div
                    v-if="
                      order.delivery_type === 'delivery' &&
                      order.delivery_address
                    "
                    class="flex items-start gap-1 text-xs font-medium text-rose-600"
                  >
                    <svg
                      class="mt-0.5 h-4 w-4 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 11c1.66 0 3-1.34 3-3S13.66 5 12 5s-3 1.34-3 3 1.34 3 3 3z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 22s8-4.438 8-11a8 8 0 10-16 0c0 6.562 8 11 8 11z"
                      />
                    </svg>
                    <span class="leading-snug">{{
                      order.delivery_address
                    }}</span>
                  </div>
                  <p v-if="order.notes" class="text-xs text-gray-500">
                    {{ order.notes }}
                  </p>
                </div>

                <ol
                  v-if="order.items?.length"
                  class="mt-3 space-y-1 text-xs text-gray-600"
                >
                  <li v-for="(item, index) in previewItems(order)" :key="item.id" class="flex gap-1.5">
                    <span class="flex-shrink-0 font-medium text-gray-400">{{ index + 1 }}.</span>
                    <div class="flex-1">
                      <div>
                        <span
                          v-if="item.group_name"
                          class="font-semibold text-blue-600"
                        >{{ item.group_name }}</span
                        >{{ item.group_name ? " - " : ""
                        }}{{ item.base_product_title || item.product_title
                        }}{{ item.variant_name ? " - " + item.variant_name : "" }}
                        <span class="font-medium text-gray-800">× {{ item.quantity }}</span>
                      </div>
                      <div v-if="item.product_description" class="text-[11px] text-gray-400 leading-tight">
                        {{ item.product_description }}
                      </div>
                    </div>
                  </li>
                  <li
                    v-if="
                      hiddenItemsCount(order) > 0 && !isOrderExpanded(order.id)
                    "
                  >
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                      @click.stop="toggleOrderExpanded(order.id)"
                    >
                      <svg
                        class="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                      и ещё {{ hiddenItemsCount(order) }}
                      {{ pluralizePositions(hiddenItemsCount(order)) }}
                    </button>
                  </li>
                  <li
                    v-if="
                      isOrderExpanded(order.id) &&
                      order.items.length > previewLimit
                    "
                  >
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 hover:underline transition-colors"
                      @click.stop="toggleOrderExpanded(order.id)"
                    >
                      <svg
                        class="h-3 w-3 rotate-180"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                      свернуть
                    </button>
                  </li>
                </ol>

                <div class="mt-4 space-y-3">
                  <!-- Примечание об изменениях (для action_required) -->
                  <div
                    v-if="order.needs_manager_action && order.manager_action_note"
                    class="rounded-xl bg-slate-50/90 px-3 py-2.5 ring-1 ring-inset ring-slate-100"
                  >
                    <ManagerActionSummary
                      :note="order.manager_action_note"
                      :items="order.items"
                      size="xs"
                    />
                  </div>
                  <!-- Сумма и скидка -->
                  <div>
                    <div
                      @click.stop="openDiscountModal(order)"
                      class="group inline-flex cursor-pointer items-center gap-1.5 text-base font-semibold text-gray-900 transition-colors hover:text-emerald-600"
                      title="Нажмите для скидки"
                    >
                      <span
                        v-if="getOrderTotalDiscount(order) > 0"
                        class="text-sm text-gray-400 line-through"
                      >{{ formatCurrency(order.total_amount) }}</span>
                      <span>{{ formatCurrency(order.final_amount) }}</span>
                      <svg class="h-3.5 w-3.5 flex-shrink-0 text-gray-400 group-hover:text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </div>
                    <div
                      v-if="getOrderTotalDiscount(order) > 0"
                      class="mt-1 space-y-0.5 text-xs"
                    >
                      <div
                        v-if="getOrderOrderLevelDiscount(order) > 0"
                        class="flex items-center gap-1 text-emerald-600"
                      >
                        <span class="text-gray-500">На заказ:</span>
                        <span class="font-medium">-{{ formatCurrency(getOrderOrderLevelDiscount(order)) }}</span>
                      </div>
                      <div
                        v-if="getOrderLoyaltyDiscount(order) > 0"
                        class="flex items-center gap-1 text-emerald-600"
                      >
                        <span class="text-gray-500">За покупки:</span>
                        <span class="font-medium">-{{ formatCurrency(getOrderLoyaltyDiscount(order)) }}</span>
                      </div>
                    </div>
                    <span
                      v-if="order.promo_code_text"
                      class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700"
                    >ПРОМО: {{ order.promo_code_text }}</span>
                    <span
                      v-if="order.promo_has_gift"
                      class="ml-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
                    >
                      Подарок по промокоду
                    </span>
                    <span
                      v-if="order.is_wholesale"
                      class="ml-1 inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700"
                    >
                      ОПТ{{ order.wholesale_tier_label ? `: ${order.wholesale_tier_label}` : '' }}
                    </span>
                    <p
                      v-if="order.promo_has_gift && order.promo_manager_description"
                      class="mt-1 text-[11px] text-amber-700"
                    >
                      {{ order.promo_manager_description }}
                    </p>
                    <p
                      v-if="order.is_wholesale && order.wholesale_min_amount"
                      class="mt-1 text-[11px] text-violet-700"
                    >
                      Минимальный заказ: {{ formatCurrency(order.wholesale_min_amount) }}
                    </p>
                    <div class="text-[11px] text-gray-400">
                      {{ formatDate(order.created_at) }}
                    </div>
                  </div>
                  <!-- Кнопки resolve для action_required -->
                  <div v-if="order.needs_manager_action" class="flex items-center justify-end gap-2">
                    <button
                      @click.stop="viewOrder(order.id)"
                      class="admin-link-button admin-link-button--compact admin-link-button--muted"
                    >
                      Подробнее
                    </button>
                    <button
                      v-if="order.manager_action_type === 'modified'"
                      @click.stop="handleResolveAction(order)"
                      :disabled="resolvingOrderId === order.id"
                      class="admin-link-button admin-link-button--compact bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60"
                    >
                      {{ resolvingOrderId === order.id ? 'Обработка...' : 'Принять изменения' }}
                    </button>
                    <button
                      v-else-if="order.manager_action_type === 'cancelled_by_customer'"
                      @click.stop="handleResolveAction(order)"
                      :disabled="resolvingOrderId === order.id"
                      class="admin-link-button admin-link-button--compact bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {{ resolvingOrderId === order.id ? 'Обработка...' : 'Разобрать' }}
                    </button>
                  </div>
                  <!-- Обычные кнопки -->
                  <div v-else class="flex items-center justify-end gap-2">
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
                      {{ nextStatusLabel(order.status) }}
                    </button>
                  </div>
                </div>
              </article>
            </div>
          </section>
        </div>
      </div>
    </div>

    <!-- Оплата и выдача -->
    <AdminModal
      :isOpen="paymentModalOpen && !!paymentOrder"
      :title="
        paymentOrder
          ? `Выдача заказа #${paymentOrder.order_number}`
          : 'Выдача заказа'
      "
      description="Выберите тип оплаты и кассу"
      size="md"
      :showActions="false"
      @close="closePaymentModal"
      @cancel="closePaymentModal"
    >
      <div class="grid gap-4">
        <div>
          <label class="text-sm font-medium text-gray-700"
            >Сумма к оплате</label
          >
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
          <div
            class="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
          >
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
            <option
              v-for="account in cashAccounts"
              :key="account.id"
              :value="account.id"
            >
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
          <svg
            v-if="isIssuing"
            class="h-4 w-4 animate-spin"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Подтвердить и выдать
        </button>
      </footer>
    </AdminModal>

    <AdminModal
      :isOpen="showPasswordModal"
      title="Подтверждение доступа"
      description="Введите лицензионный ключ"
      size="sm"
      :showActions="false"
      @close="closePasswordModal"
      @cancel="closePasswordModal"
    >
      <form class="space-y-4" @submit.prevent="submitPassword">
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700"
            >Ключ</label
          >
          <input
            v-model="passwordInput"
            type="password"
            class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            placeholder="XXX-XXX-XXX"
            :disabled="verifyingPassword"
          />
          <p v-if="passwordError" class="mt-2 text-sm text-red-600">
            {{ passwordError }}
          </p>
        </div>
        <div class="flex gap-3 pt-2">
          <button
            type="submit"
            class="flex-1 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
            :disabled="verifyingPassword"
          >
            {{ verifyingPassword ? "Проверяем…" : "Подтвердить" }}
          </button>
          <button
            type="button"
            class="flex-1 rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300"
            @click="closePasswordModal"
            :disabled="verifyingPassword"
          >
            Отмена
          </button>
        </div>
      </form>
    </AdminModal>

    <AdminModal
      :isOpen="deliveredModalOpen"
      title="Статистика заказов"
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
              :class="
                deliveredFilter === option.value
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              "
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

        <div class="grid gap-4 lg:grid-cols-2">
          <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div class="text-xs uppercase text-gray-500">Всего заказов</div>
            <div class="mt-2 text-2xl font-semibold text-gray-900">
              {{ deliveredSummary.totalCount }}
            </div>
            <p class="text-xs text-gray-500">{{ deliveredSummaryLabel }}</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div class="text-xs uppercase text-gray-500">Выручка</div>
            <div class="mt-2 text-2xl font-semibold text-emerald-700">
              {{ formatCurrency(deliveredSummary.totalAmount) }}
            </div>
            <p class="text-xs text-gray-500">{{ deliveredSummaryLabel }}</p>
          </div>
        </div>

        <div
          v-if="filteredDeliveredOrders.length"
          class="overflow-hidden rounded-lg border border-gray-200"
        >
          <table class="w-full text-sm">
            <thead
              class="bg-gray-50 text-xs font-semibold uppercase text-gray-500"
            >
              <tr>
                <th class="px-4 py-3 text-left">№</th>
                <th class="px-4 py-3 text-left">Клиент</th>
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
                <td class="px-4 py-3 font-semibold text-gray-900">
                  #{{ order.order_number }}
                </td>
                <td class="px-4 py-3 text-gray-700">
                  {{ order.customer_name || "Без имени" }}
                </td>
                <td class="px-4 py-3 font-medium text-gray-900">
                  {{ formatCurrency(order.final_amount) }}
                </td>
                <td class="px-4 py-3 text-gray-500">
                  {{ formatDate(orderCompletedAt(order) || order.created_at) }}
                </td>
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
        <!-- Загрузить ещё -->
        <div
          v-if="filteredDeliveredOrders.length && deliveredPagination && deliveredPagination.page < deliveredPagination.totalPages"
          class="flex justify-center pt-2"
        >
          <button
            :disabled="crmStore.loadingDelivered"
            class="rounded-lg border border-gray-200 bg-white px-6 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
            @click="loadMoreDelivered"
          >
            <span v-if="crmStore.loadingDelivered">Загрузка...</span>
            <span v-else>Загрузить ещё ({{ filteredDeliveredOrders.length }} из {{ deliveredPagination.total }})</span>
          </button>
        </div>
        <div
          v-else-if="!filteredDeliveredOrders.length"
          class="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500"
        >
          За выбранный период заказов не найдено.
        </div>
      </div>
    </AdminModal>

    <!-- Создание заказа -->
    <OrderCreateModal
      :is-open="showCreateModal"
      @close="showCreateModal = false"
      @created="handleOrderCreated"
    />

    <!-- Модалка скидки -->
    <AdminModal
      :isOpen="discountModalOpen && !!discountOrder"
      :title="discountOrder ? `Скидка на заказ #${discountOrder.order_number}` : 'Скидка'"
      description="Введите сумму скидки в рублях"
      size="sm"
      :showActions="false"
      @close="closeDiscountModal"
      @cancel="closeDiscountModal"
    >
      <div class="grid gap-4">
        <div>
          <label class="text-sm font-medium text-gray-700">Сумма заказа</label>
          <div class="mt-1 text-lg font-semibold text-gray-900">
            {{ discountOrder ? formatCurrency(discountOrder.total_amount) : '' }}
          </div>
        </div>
        <div>
          <label class="text-sm font-medium text-gray-700">Скидка (₽)</label>
          <input
            v-model.number="discountAmount"
            type="number"
            min="0"
            :max="discountOrder?.total_amount || 0"
            step="1"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            placeholder="0"
          />
        </div>
        <div v-if="discountAmount > 0" class="rounded-lg bg-emerald-50 p-3">
          <div class="text-sm text-gray-600">Итого со скидкой:</div>
          <div class="text-xl font-bold text-emerald-700">
            {{ discountOrder ? formatCurrency(discountOrder.total_amount - discountAmount) : '' }}
          </div>
        </div>
      </div>
      <footer class="mt-6 flex justify-between gap-3">
        <button
          v-if="discountOrder?.discount_amount && discountOrder.discount_amount > 0"
          @click="removeDiscount"
          class="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          :disabled="isApplyingDiscount"
        >
          Убрать скидку
        </button>
        <div class="flex-1"></div>
        <button
          @click="closeDiscountModal"
          class="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
          :disabled="isApplyingDiscount"
        >
          Отмена
        </button>
        <button
          @click="applyDiscount"
          class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
          :disabled="isApplyingDiscount || discountAmount < 0"
        >
          {{ isApplyingDiscount ? 'Сохранение...' : 'Применить' }}
        </button>
      </footer>
    </AdminModal>

    <!-- Модалка отмены заказа -->
    <AdminModal
      :isOpen="cancelModalOpen && !!cancelOrder"
      :title="cancelOrder ? `Отмена заказа #${cancelOrder.order_number}` : 'Отмена заказа'"
      description="Вы уверены, что хотите отменить этот заказ?"
      size="sm"
      :showActions="false"
      @close="closeCancelModal"
      @cancel="closeCancelModal"
    >
      <div class="rounded-lg bg-red-50 p-4 text-center">
        <div class="text-sm text-gray-600">Заказ на сумму</div>
        <div class="text-2xl font-bold text-gray-900">
          {{ cancelOrder ? formatCurrency(cancelOrder.final_amount) : '' }}
        </div>
        <div class="mt-2 text-sm text-red-600">
          Товары вернутся на склад
        </div>
      </div>
      <footer class="mt-6 flex justify-end gap-3">
        <button
          @click="closeCancelModal"
          class="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
          :disabled="isCancelling"
        >
          Нет, оставить
        </button>
        <button
          @click="confirmCancelOrder"
          class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
          :disabled="isCancelling"
        >
          {{ isCancelling ? 'Отмена...' : 'Да, отменить' }}
        </button>
      </footer>
    </AdminModal>

    <!-- Модалка списка отмененных заказов -->
    <AdminModal
      :isOpen="cancelledModalOpen"
      title="Отмененные заказы"
      :description="`Всего отменено: ${cancelledOrders.length}`"
      size="lg"
      :showActions="false"
      @close="cancelledModalOpen = false"
      @cancel="cancelledModalOpen = false"
    >
      <div v-if="cancelledOrders.length" class="space-y-3 max-h-96 overflow-y-auto">
        <article
          v-for="order in cancelledOrders"
          :key="order.id"
          class="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 transition hover:bg-gray-50"
        >
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-red-600">#{{ order.order_number }}</span>
              <span class="text-xs text-gray-400">{{ formatDate(order.created_at) }}</span>
            </div>
            <div class="mt-1 text-sm font-medium text-gray-800">
              {{ order.customer_name || "Без имени" }}
            </div>
            <div class="mt-0.5 text-xs text-gray-500">
              {{ order.notes || "Причина не указана" }}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-gray-600">{{ formatCurrency(order.final_amount) }}</span>
            <button
              @click="viewOrder(order.id); cancelledModalOpen = false"
              class="admin-link-button admin-link-button--compact admin-link-button--muted"
            >
              Открыть
            </button>
          </div>
        </article>
      </div>
      <div v-else class="py-8 text-center text-gray-500">
        Нет отмененных заказов
      </div>
    </AdminModal>
    
    <!-- In-app Toast Notification (Safari fallback) -->
    <Teleport to="body">
      <Transition name="toast-slide">
        <div
          v-if="crmStore.inAppToast.show"
          class="fixed top-4 right-4 z-[9999] flex items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-4 text-white shadow-2xl"
          style="min-width: 280px;"
        >
          <div class="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div class="flex-1">
            <div class="font-bold text-lg">{{ crmStore.inAppToast.message }}</div>
            <div class="text-sm text-white/80">Проверьте колонку «Новые»</div>
          </div>
          <button
            @click="crmStore.hideInAppToast()"
            class="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import type { Order } from "@/stores/crm";
import { useCrmStore } from "@/stores/crm";
import OrderCreateModal from "@/components/crm/OrderCreateModal.vue";
import ManagerActionSummary from "@/components/crm/ManagerActionSummary.vue";
import AdminModal from "@/components/AdminModal.vue";
import { LockClosedIcon } from "@heroicons/vue/24/outline";

const crmStore = useCrmStore();
const {
  orders,
  loadingOrders,
  cashAccounts,
  profitUnlocked,
  verifyingProfitAccess,
  deliveredOrders: storeDeliveredOrders,
  deliveredStats,
  deliveredPagination,
} = storeToRefs(crmStore);

const router = useRouter();

const showCreateModal = ref(false);
const paymentModalOpen = ref(false);
const paymentOrder = ref<Order | null>(null);
const paymentMethod = ref<"cash">("cash");
const selectedAccountId = ref("");
const paymentAmount = ref(0);
const paymentNotes = ref("");
const isIssuing = ref(false);
const dragOrder = ref<Order | null>(null);
const activeDropColumn = ref<string | null>(null);

// Dropdown states
const settingsDropdownOpen = ref(false);
const moreDropdownOpen = ref(false);
const settingsDropdownRef = ref<HTMLElement | null>(null);
const moreDropdownRef = ref<HTMLElement | null>(null);

// Computed for settings indicator
const hasActiveSettings = computed(() => 
  autoRefreshEnabled.value || notificationsEnabled.value || soundEnabled.value
);

const searchQuery = ref("");
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// Use store for notification settings (global)
const { 
  notificationsEnabled, 
  soundEnabled, 
  autoRefreshEnabled,
  unseenOrderIds: storeUnseenOrderIds,
  newOrdersCount
} = storeToRefs(crmStore);

const lastUpdateAt = ref<Date | null>(null);
const isRefreshing = ref(false);
const newOrderHighlight = ref(false);
// Local unseenOrderIds synced with store
const unseenOrderIds = computed(() => storeUnseenOrderIds.value);

const notificationsSupported =
  typeof window !== "undefined" && "Notification" in window;

const refreshIntervalMs = 15000;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let highlightTimer: ReturnType<typeof setTimeout> | null = null;

const previewLimit = 4;
const expandedOrders = ref<Set<string>>(new Set());

// Error handling for order operations
const orderError = ref<string | null>(null);
const orderErrorTimeout = ref<ReturnType<typeof setTimeout> | null>(null);

function showOrderError(message: string) {
  orderError.value = message;
  if (orderErrorTimeout.value) {
    clearTimeout(orderErrorTimeout.value);
  }
  orderErrorTimeout.value = setTimeout(() => {
    orderError.value = null;
  }, 8000);
}

function dismissOrderError() {
  orderError.value = null;
  if (orderErrorTimeout.value) {
    clearTimeout(orderErrorTimeout.value);
    orderErrorTimeout.value = null;
  }
}

function getOrderLoyaltyDiscount(order: Order) {
  return (order.items || []).reduce(
    (sum, item) => sum + Number(item.loyalty_discount_amount || 0),
    0,
  );
}

function getOrderOrderLevelDiscount(order: Order) {
  return Math.max(0, getOrderTotalDiscount(order) - getOrderLoyaltyDiscount(order));
}

function getOrderTotalDiscount(order: Order) {
  return Math.max(
    0,
    Number(order.total_amount || 0) - Number(order.final_amount || 0),
  );
}

function handleNewOrders(newOrders: Order[]) {
  if (!newOrders.length) return;
  newOrderHighlight.value = true;
  if (highlightTimer) {
    clearTimeout(highlightTimer);
  }
  highlightTimer = setTimeout(() => {
    newOrderHighlight.value = false;
  }, 2600);
}

const deliveredModalOpen = ref(false);
const deliveredFilter = ref<DeliveredFilter>("today");
const deliveredSearch = ref("");
const deliveredFilterOptions: Array<{ value: DeliveredFilter; label: string }> =
  [
    { value: "today", label: "Сегодня" },
    { value: "week", label: "7 дней" },
    { value: "month", label: "30 дней" },
    { value: "all", label: "За всё время" },
  ];
const pendingDeliveredPreset = ref<DeliveredFilter | null>(null);
const showPasswordModal = ref(false);
const passwordInput = ref("");
const passwordError = ref("");
const verifyingPassword = computed(() => verifyingProfitAccess.value);
const generatingMessageForOrder = ref<string | null>(null);

// Discount modal state
const discountModalOpen = ref(false);
const discountOrder = ref<Order | null>(null);
const discountAmount = ref(0);
const isApplyingDiscount = ref(false);

// Cancel order modal state
const cancelModalOpen = ref(false);
const cancelOrder = ref<Order | null>(null);
const isCancelling = ref(false);

// Resolve manager action
const resolvingOrderId = ref<string | null>(null);

async function handleResolveAction(order: Order) {
  resolvingOrderId.value = order.id;
  try {
    await crmStore.resolveManagerAction(order.id);
    await crmStore.fetchOrders();
  } catch (error) {
    console.error("[CRM] Resolve action failed:", error);
  } finally {
    resolvingOrderId.value = null;
  }
}

// Cancelled orders modal
const cancelledModalOpen = ref(false);

type KanbanColumnConfig = {
  key: "action_required" | "new" | "in_progress";
  label: string;
  description: string;
  filter: (order: Order) => boolean;
  badgeClass: string;
};

type DeliveredFilter = "today" | "week" | "month" | "all";

const deliveredStatuses: Array<Order["status"]> = ["delivered", "completed"];

const kanbanConfig: KanbanColumnConfig[] = [
  {
    key: "action_required",
    label: "Требует действий",
    description: "Измененные или отмененные покупателем",
    filter: (order) => order.needs_manager_action === 1,
    badgeClass: "bg-orange-100 text-orange-700",
  },
  {
    key: "new",
    label: "Новые",
    description: "Необходимо собрать заказ",
    filter: (order) => order.status === "new" && !order.needs_manager_action,
    badgeClass: "bg-amber-100 text-amber-700",
  },
  {
    key: "in_progress",
    label: "Собран",
    description: "Ожидает выдачи клиенту",
    filter: (order) => order.status === "in_progress" && !order.needs_manager_action,
    badgeClass: "bg-blue-100 text-blue-700",
  },
];

const kanbanColumns = computed(() =>
  kanbanConfig.map((column) => ({
    ...column,
    orders: orders.value.filter(column.filter),
  })),
);

function orderCompletedAt(order: Order): string | null {
  return (
    order.completed_at ||
    order.paid_at ||
    order.updated_at ||
    order.created_at ||
    null
  );
}

function isDeliveredInRange(order: Order, filter: DeliveredFilter) {
  if (filter === "all") return true;
  const source = orderCompletedAt(order);
  if (!source) return false;
  const date = new Date(source);
  const now = new Date();
  if (filter === "today") {
    return date.toDateString() === now.toDateString();
  }
  const diff = now.getTime() - date.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (filter === "week") {
    return diff <= 7 * dayMs;
  }
  if (filter === "month") {
    return diff <= 30 * dayMs;
  }
  return true;
}

const filteredDeliveredOrders = computed(() => {
  return storeDeliveredOrders.value
    .sort((a, b) => {
      const dateB = orderCompletedAt(b);
      const dateA = orderCompletedAt(a);
      return (
        (dateB ? new Date(dateB).getTime() : 0) -
        (dateA ? new Date(dateA).getTime() : 0)
      );
    });
});

const deliveredSummary = computed(() => {
  const s = deliveredStats.value;
  if (s) return s;
  return {
    totalCount: 0,
    totalAmount: 0,
    deliveryCount: 0,
    deliveryAmount: 0,
    pickupCount: 0,
    pickupAmount: 0,
  };
});

const deliveredSummaryLabel = computed(() => {
  switch (deliveredFilter.value) {
    case "today":
      return "сегодня";
    case "week":
      return "за 7 дней";
    case "month":
      return "за 30 дней";
    default:
      return "за всё время";
  }
});

const cancelledOrders = computed(() =>
  orders.value.filter((order) => order.status === "cancelled"),
);

const unseenOrdersCount = computed(() => unseenOrderIds.value.size);

const lastUpdateLabel = computed(() => {
  if (!lastUpdateAt.value) return "—";
  return lastUpdateAt.value.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
});

const notificationPermissionDenied = computed(() => {
  if (!notificationsSupported || typeof Notification === "undefined")
    return false;
  return Notification.permission === "denied";
});

const notificationPermissionStatus = computed(() => {
  if (!notificationsSupported || typeof Notification === "undefined")
    return "not supported";
  return Notification.permission;
});

// Request notification permission (used in settings dropdown)
async function requestNotificationPermission() {
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch (e) {
      console.error("Failed to request notification permission:", e);
    }
  }
}

const nextStatusMap: Record<
  Order["status"],
  "in_progress" | "delivered" | null
> = {
  new: "in_progress",
  in_progress: "delivered",
  completed: null,
  delivered: null,
  cancelled: null,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateString: string) {
  // SQLite хранит время в UTC, добавляем 'Z' для корректной интерпретации
  const isoString =
    dateString.includes("Z") || dateString.includes("+")
      ? dateString
      : dateString.replace(" ", "T") + "Z";
  return new Date(isoString).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function previewItems(order: Order) {
  if (!order.items) return [];
  if (expandedOrders.value.has(order.id)) {
    return order.items;
  }
  return order.items.slice(0, previewLimit);
}

function toggleOrderExpanded(orderId: string) {
  if (expandedOrders.value.has(orderId)) {
    expandedOrders.value.delete(orderId);
  } else {
    expandedOrders.value.add(orderId);
  }
}

function isOrderExpanded(orderId: string) {
  return expandedOrders.value.has(orderId);
}

function hiddenItemsCount(order: Order) {
  if (!order.items) return 0;
  return Math.max(0, order.items.length - previewLimit);
}

function pluralizePositions(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "позиция";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
    return "позиции";
  return "позиций";
}

function deliveryBadgeClass(order: Order) {
  return order.delivery_type === "delivery"
    ? "bg-rose-100 text-rose-700"
    : "bg-gray-100 text-gray-600";
}

function nextStatusLabel(status: Order["status"]) {
  if (status === "new") return "Собрано";
  if (status === "in_progress") return "Выдать";
  return "";
}

function advanceButtonClass(order: Order) {
  if (order.status === "new") return "admin-link-button--primary";
  if (order.status === "in_progress") return "admin-link-button--success";
  return "admin-link-button--muted";
}

function canAdvance(order: Order) {
  return nextStatusMap[order.status] !== null;
}

async function advanceOrder(order: Order) {
  const nextStatus = nextStatusMap[order.status];
  if (!nextStatus) return;

  if (nextStatus === "delivered") {
    await openPaymentModal(order);
    return;
  }

  try {
    await crmStore.updateOrder(order.id, { status: nextStatus });
    markOrderSeen(order.id);
  } catch (error: any) {
    const errorMessage = error?.message || "Не удалось изменить статус заказа";
    showOrderError(`Заказ #${order.order_number}: ${errorMessage}`);
  }
}

function viewOrder(id: string) {
  markOrderSeen(id);
  router.push(`/admin/crm/orders/${id}`);
}

function canDropTo(columnKey: string, order: Order) {
  // Нельзя перетаскивать заказы, требующие действий менеджера
  if (order.needs_manager_action) return false;
  // Из "Новые" в "Собран"
  if (columnKey === "in_progress") return order.status === "new";
  return false;
}

function onDragStart(order: Order) {
  dragOrder.value = order;
}

function onDragEnd() {
  dragOrder.value = null;
  activeDropColumn.value = null;
}

function onDragOver(columnKey: string) {
  if (!dragOrder.value) return;
  if (canDropTo(columnKey, dragOrder.value)) {
    activeDropColumn.value = columnKey;
  }
}

function onDragLeave(columnKey: string) {
  if (activeDropColumn.value === columnKey) {
    activeDropColumn.value = null;
  }
}

function onDrop(columnKey: string) {
  if (!dragOrder.value) return;
  if (!canDropTo(columnKey, dragOrder.value)) {
    onDragEnd();
    return;
  }

  const order = dragOrder.value;
  onDragEnd();
  advanceOrder(order);
}

async function openPaymentModal(order: Order) {
  paymentOrder.value = order;
  paymentAmount.value = order.final_amount;
  paymentMethod.value = "cash";
  paymentNotes.value = order.payment_notes || "";

  if (cashAccounts.value.length === 0) {
    await crmStore.fetchCashAccounts();
  }

  const defaultAccount =
    cashAccounts.value.find((account) => account.is_default === 1) ||
    cashAccounts.value[0] ||
    null;
  selectedAccountId.value = defaultAccount ? defaultAccount.id : "";

  paymentModalOpen.value = true;
}

function closePaymentModal() {
  if (isIssuing.value) return;
  paymentModalOpen.value = false;
  paymentOrder.value = null;
  paymentNotes.value = "";
}

async function submitPayment() {
  if (
    !paymentOrder.value ||
    !selectedAccountId.value ||
    paymentAmount.value <= 0
  )
    return;
  isIssuing.value = true;
  try {
    await crmStore.issueOrder(paymentOrder.value.id, {
      payment_type: paymentMethod.value,
      payment_account_id: selectedAccountId.value,
      amount: paymentAmount.value,
      payment_notes: paymentNotes.value || undefined,
    });
    paymentModalOpen.value = false;
    paymentOrder.value = null;
    paymentNotes.value = "";
    await refreshOrders({ skipNotify: true });
  } catch (error) {
    console.error("[CRM] Failed to issue order:", error);
  } finally {
    isIssuing.value = false;
  }
}

function openPasswordModal() {
  if (verifyingPassword.value) return;
  passwordInput.value = "";
  passwordError.value = "";
  showPasswordModal.value = true;
}

function closePasswordModal() {
  if (verifyingPassword.value) return;
  showPasswordModal.value = false;
  passwordInput.value = "";
  passwordError.value = "";
}

async function submitPassword() {
  if (!passwordInput.value.trim()) {
    passwordError.value = "Введите ключ";
    return;
  }

  passwordError.value = "";
  try {
    await crmStore.verifyProfitPassword(passwordInput.value.trim());
    showPasswordModal.value = false;
    passwordInput.value = "";
    passwordError.value = "";
  } catch (error) {
    passwordError.value = "Неверный ключ";
  }
}

function handleSearch() {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }
  searchDebounceTimer = setTimeout(() => {
    void refreshOrders({ skipNotify: true });
  }, 400);
}

async function refreshOrders(options: { skipNotify?: boolean } = {}) {
  if (isRefreshing.value) return;
  isRefreshing.value = true;

  const previousIds = new Set<string>(orders.value.map((order) => order.id));

  // #region agent log
  fetch('http://127.0.0.1:7375/ingest/770bfcdb-ad04-41b5-8064-47b780108bbc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bc40da'},body:JSON.stringify({sessionId:'bc40da',location:'CrmOrders.vue:refreshOrders',message:'before fetch',data:{totalOrders:orders.value.length,deliveredCount:orders.value.filter(o=>['delivered','completed'].includes(o.status)).length},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  try {
    const searchParam = searchQuery.value.trim() || undefined;
    await crmStore.fetchOrders({ limit: 200, search: searchParam });
    lastUpdateAt.value = new Date();

    // #region agent log
    fetch('http://127.0.0.1:7375/ingest/770bfcdb-ad04-41b5-8064-47b780108bbc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bc40da'},body:JSON.stringify({sessionId:'bc40da',location:'CrmOrders.vue:refreshOrders:afterFetch',message:'after fetch',data:{totalOrders:orders.value.length,deliveredCount:orders.value.filter(o=>['delivered','completed'].includes(o.status)).length,statusBreakdown:orders.value.reduce((acc,o)=>{acc[o.status]=(acc[o.status]||0)+1;return acc},{} as Partial<Record<Order["status"], number>>)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    if (options.skipNotify) {
      return;
    }

    const newOrders = orders.value.filter(
      (order) => !previousIds.has(order.id) && order.status === "new",
    );
    if (newOrders.length > 0) {
      handleNewOrders(newOrders);
    }
  } catch (error) {
    console.error("[CRM] Failed to refresh orders:", error);
  } finally {
    isRefreshing.value = false;
  }
}

function handleOrderCreated(order: Order) {
  showCreateModal.value = false;
  handleNewOrders([order]);
  void refreshOrders({ skipNotify: true });
}

async function contactClient(orderId: string) {
  if (generatingMessageForOrder.value) return;

  generatingMessageForOrder.value = orderId;

  try {
    const data = await crmStore.generateOrderMessage(orderId);
    const { message, telegramUsername } = data;

    if (telegramUsername) {
      const encodedMessage = encodeURIComponent(message);
      const telegramUrl = `https://t.me/${telegramUsername}?text=${encodedMessage}`;
      window.open(telegramUrl, "_blank");
    } else {
      console.warn("[CRM] No telegram username for order:", orderId);
    }
  } catch (error: any) {
    console.error("[CRM] Generate message error:", error);
  } finally {
    generatingMessageForOrder.value = null;
  }
}

onMounted(async () => {
  await refreshOrders({ skipNotify: true });
  if (cashAccounts.value.length === 0) {
    await crmStore.fetchCashAccounts();
  }
  scheduleAutoRefresh();
  // Don't auto-mark as seen - user should interact with orders to mark them seen
  
  // Unlock AudioContext on first user interaction (required for Safari)
  const unlockOnInteraction = () => {
    crmStore.unlockAudioContext();
    document.removeEventListener('click', unlockOnInteraction);
    document.removeEventListener('touchstart', unlockOnInteraction);
  };
  document.addEventListener('click', unlockOnInteraction, { once: true });
  document.addEventListener('touchstart', unlockOnInteraction, { once: true });
  
  // Close dropdowns on click outside
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  if (highlightTimer) {
    clearTimeout(highlightTimer);
    highlightTimer = null;
  }
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
  }
  document.removeEventListener('click', handleClickOutside);
});

function handleClickOutside(event: MouseEvent) {
  const target = event.target as Node;
  if (settingsDropdownRef.value && !settingsDropdownRef.value.contains(target)) {
    settingsDropdownOpen.value = false;
  }
  if (moreDropdownRef.value && !moreDropdownRef.value.contains(target)) {
    moreDropdownOpen.value = false;
  }
}

function scheduleAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  if (!autoRefreshEnabled.value) return;
  refreshTimer = setInterval(() => {
    void refreshOrders();
  }, refreshIntervalMs);
}

function markOrderSeen(orderId: string) {
  crmStore.markOrderAsSeen(orderId);
}

// handleNewOrders, triggerBrowserNotification, playNotificationSound, ensureNotificationPermission
// moved to crm.ts store for global notifications

watch(profitUnlocked, (unlocked) => {
  if (!unlocked) {
    deliveredModalOpen.value = false;
    showPasswordModal.value = false;
    passwordInput.value = "";
    passwordError.value = "";
  }
});

// Серверная фильтрация доставленных заказов
let deliveredSearchTimer: ReturnType<typeof setTimeout> | null = null;

watch(() => deliveredFilter.value, (newFilter) => {
  if (deliveredModalOpen.value) {
    void crmStore.fetchDeliveredOrders({ limit: 30, period: newFilter, search: deliveredSearch.value.trim() || undefined });
  }
});

watch(() => deliveredSearch.value, () => {
  if (deliveredSearchTimer) clearTimeout(deliveredSearchTimer);
  deliveredSearchTimer = setTimeout(() => {
    if (deliveredModalOpen.value) {
      void crmStore.fetchDeliveredOrders({ limit: 30, period: deliveredFilter.value, search: deliveredSearch.value.trim() || undefined });
    }
  }, 400);
});

watch(autoRefreshEnabled, () => {
  scheduleAutoRefresh();
});

function openDeliveredModal(preset: DeliveredFilter = "all") {
  if (!profitUnlocked.value) {
    openPasswordModal();
    return;
  }
  deliveredFilter.value = preset;
  deliveredSearch.value = "";
  deliveredModalOpen.value = true;
  void crmStore.fetchDeliveredOrders({ limit: 30, period: preset });
}

function closeDeliveredModal() {
  deliveredModalOpen.value = false;
}

function loadMoreDelivered() {
  const p = deliveredPagination.value;
  if (!p || p.page >= p.totalPages) return;
  void crmStore.fetchDeliveredOrders({
    page: p.page + 1,
    limit: p.limit,
    period: deliveredFilter.value,
    search: deliveredSearch.value.trim() || undefined,
  });
}

function orderStatusLabel(
  status: Order["status"],
  deliveryType?: "pickup" | "delivery",
) {
  switch (status) {
    case "new":
      return "Новый";
    case "in_progress":
      return "Собран";
    case "delivered":
    case "completed":
      // Условные статусы: доставка → доставлена, самовывоз → выдан
      return deliveryType === "delivery" ? "Доставлена" : "Выдан";
    case "cancelled":
      return "Отменён";
    default:
      return status;
  }
}

// Discount modal functions
function openDiscountModal(order: Order) {
  discountOrder.value = order;
  discountAmount.value = order.discount_amount || 0;
  discountModalOpen.value = true;
}

function closeDiscountModal() {
  if (isApplyingDiscount.value) return;
  discountModalOpen.value = false;
  discountOrder.value = null;
  discountAmount.value = 0;
}

async function applyDiscount() {
  if (!discountOrder.value) return;
  const activeOrder = discountOrder.value;
  isApplyingDiscount.value = true;
  try {
    await crmStore.updateOrder(activeOrder.id, {
      discount_amount: discountAmount.value,
      discount_percent: 0,
    });
    // Закрываем модалку напрямую
    discountModalOpen.value = false;
    discountOrder.value = null;
    discountAmount.value = 0;
    await refreshOrders({ skipNotify: true });
  } catch (error: any) {
    const errorMessage = error?.message || "Не удалось применить скидку";
    showOrderError(`Заказ #${activeOrder.order_number}: ${errorMessage}`);
  } finally {
    isApplyingDiscount.value = false;
  }
}

async function removeDiscount() {
  if (!discountOrder.value) return;
  const activeOrder = discountOrder.value;
  isApplyingDiscount.value = true;
  try {
    await crmStore.updateOrder(activeOrder.id, {
      discount_amount: 0,
      discount_percent: 0,
    });
    // Закрываем модалку напрямую
    discountModalOpen.value = false;
    discountOrder.value = null;
    discountAmount.value = 0;
    await refreshOrders({ skipNotify: true });
  } catch (error: any) {
    const errorMessage = error?.message || "Не удалось убрать скидку";
    showOrderError(`Заказ #${activeOrder.order_number}: ${errorMessage}`);
  } finally {
    isApplyingDiscount.value = false;
  }
}

// Cancel order modal functions
function openCancelModal(order: Order) {
  cancelOrder.value = order;
  cancelModalOpen.value = true;
}

function closeCancelModal() {
  if (isCancelling.value) return;
  cancelModalOpen.value = false;
  cancelOrder.value = null;
}

async function confirmCancelOrder() {
  if (!cancelOrder.value) return;
  const activeOrder = cancelOrder.value;
  isCancelling.value = true;
  try {
    await crmStore.updateOrder(activeOrder.id, { status: "cancelled" });
    // Закрываем модалку напрямую
    cancelModalOpen.value = false;
    cancelOrder.value = null;
    await refreshOrders({ skipNotify: true });
  } catch (error: any) {
    const errorMessage = error?.message || "Не удалось отменить заказ";
    showOrderError(`Заказ #${activeOrder.order_number}: ${errorMessage}`);
  } finally {
    isCancelling.value = false;
  }
}
</script>

<style scoped>
/* Toast notification animation */
.toast-slide-enter-active {
  animation: toast-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.toast-slide-leave-active {
  animation: toast-out 0.3s cubic-bezier(0.4, 0, 1, 1);
}

@keyframes toast-in {
  0% {
    opacity: 0;
    transform: translateX(100%) scale(0.8);
  }
  100% {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes toast-out {
  0% {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateX(100%) scale(0.8);
  }
}
</style>
