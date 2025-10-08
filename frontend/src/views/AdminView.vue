<template>
  <div class="min-h-screen bg-gray-50">
    
    <!-- Login -->
    <div v-if="!adminStore.isAuthenticated" class="login-container">
      <div class="login-form-wrapper">
        <div class="card-base p-6 sm:p-8">
          <div class="text-center mb-6">
            <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-primary/30 text-brand-dark mb-3">
              <svg class="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l2 4 4 .6-3 3 .7 4.4L12 14l-3.7 2.9.7-4.4-3-3L10 8l2-4z"/></svg>
            </div>
            <h1 class="font-accent text-2xl font-bold text-brand-dark uppercase tracking-wider">НАВАЛИВАЙ Admin</h1>
            <p class="body-mobile text-gray-600 mt-1">Войдите чтобы управлять контентом</p>
          </div>

          <form @submit.prevent="handleLogin" class="login-form space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Логин</label>
              <input v-model="loginForm.username" type="text" required class="login-input px-3 py-3 sm:px-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-dark focus:border-transparent text-base" placeholder="admin" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Пароль</label>
              <input v-model="loginForm.password" type="password" required class="login-input px-3 py-3 sm:px-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-dark focus:border-transparent text-base" placeholder="••••••••" />
            </div>
            <button type="submit" :disabled="adminStore.isLoading" class="login-button py-3 px-4 bg-brand-primary text-brand-dark font-semibold rounded-xl hover:bg-brand-primary/90 focus:ring-2 focus:ring-brand-dark focus:ring-offset-2 disabled:opacity-50 transition-all duration-200 text-base">
              {{ adminStore.isLoading ? 'Вход...' : 'Войти' }}
            </button>
            <div v-if="adminStore.error" class="p-3 bg-red-100 border border-red-300 rounded-xl text-red-700 text-sm">{{ adminStore.error }}</div>
          </form>
        </div>
      </div>
    </div>

    <!-- Authenticated layout -->
<AdminLayout v-else v-model="activeTab" :tabs="adminTabs" @logout="handleLogout">
        <template #default>
          <!-- Overview -->
          <div v-if="activeTab === 'dashboard'" class="space-y-6">
            <section class="card-base p-4 sm:p-6 space-y-5">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 class="text-lg font-semibold text-gray-900">Ключевые показатели</h2>
                  <p class="text-sm text-gray-500">Выберите период для отображения данных</p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <button
                    v-for="option in overviewPeriods"
                    :key="option.value"
                    type="button"
                    class="rounded-full px-3 py-1 text-xs font-semibold transition"
                    :class="overviewPeriod === option.value ? 'bg-brand-dark text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
                    @click="overviewPeriod = option.value"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>

              <div v-if="loadingDashboard" class="flex items-center justify-center py-10">
                <div class="h-10 w-10 animate-spin rounded-full border-4 border-brand-dark border-r-transparent"></div>
              </div>
              <div v-else-if="dashboardStats" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p class="text-sm text-gray-600">Продаж</p>
                  <p class="mt-2 text-2xl font-semibold text-gray-900">{{ overviewStats?.totalSales ?? 0 }}</p>
                </div>
                <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p class="text-sm text-gray-600">Выручка</p>
                  <p class="mt-2 text-2xl font-semibold text-emerald-600">{{ formatCurrency(overviewStats?.revenue) }}</p>
                </div>
                <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p class="text-sm text-gray-600">Прибыль</p>
                  <div class="mt-2">
                    <p v-if="profitUnlocked" class="text-2xl font-semibold text-blue-600">
                      {{ formatCurrency(overviewStats?.profit) }}
                    </p>
                    <div v-else class="relative">
                      <p class="text-2xl font-semibold text-blue-600 select-none blur-sm">
                        {{ formatCurrency(overviewStats?.profit) }}
                      </p>
                      <button
                        type="button"
                        class="absolute inset-0 flex items-center justify-center text-xs font-semibold text-blue-600 transition hover:text-blue-800"
                        @click="openProfitModal"
                      >
                        Показать
                      </button>
                    </div>
                  </div>
                </div>
                <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p class="text-sm text-gray-600">Средний чек</p>
                  <p class="mt-2 text-2xl font-semibold text-purple-600">{{ formatCurrency(overviewStats?.averageCheck) }}</p>
                </div>
              </div>
              <div v-else class="py-6 text-sm text-gray-500">Нет данных для выбранного периода.</div>
            </section>

            <section class="card-base p-4 sm:p-6">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h3 class="text-lg font-semibold text-gray-900">Топ линеек</h3>
                  <p class="text-sm text-gray-500">На основе фактических продаж</p>
                </div>
                <span v-if="topGroups.length" class="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">{{ topGroups.length }}</span>
              </div>
              <div v-if="topGroups.length" class="mt-4 space-y-3">
                <div
                  v-for="(group, index) in topGroups"
                  :key="group.group_id || index"
                  class="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-3"
                >
                  <div>
                    <p class="font-medium text-gray-900">{{ group.group_name || 'Без названия' }}</p>
                    <p class="text-xs text-gray-500">Продано: {{ group.total_quantity }} шт</p>
                  </div>
                  <p class="text-sm font-semibold text-gray-900">{{ formatCurrency(group.total_revenue) }}</p>
                </div>
              </div>
              <div v-else class="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                Нет данных по продажам за выбранный период.
              </div>
            </section>

            <section class="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div class="card-base p-4 sm:p-6">
                <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Доставки</h3>
                <p class="mt-3 text-2xl font-semibold text-gray-900">{{ overviewDeliveries.deliveries }}</p>
                <p class="text-sm text-gray-500">Количество доставок за период</p>
                <p class="mt-3 text-sm font-semibold text-emerald-600">{{ formatCurrency(overviewDeliveries.revenue) }}</p>
              </div>
              <div class="card-base p-4 sm:p-6">
                <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Статусы заказов</h3>
                <ul class="mt-3 space-y-2 text-sm text-gray-600">
                  <li v-for="status in overviewStatuses" :key="status.status" class="flex items-center justify-between">
                    <span>{{ status.label }}</span>
                    <span class="font-semibold text-gray-900">{{ status.count }}</span>
                  </li>
                </ul>
              </div>
            </section>

            <section class="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <button
                @click="handleOverviewClick('products')"
                class="card-base flex items-center gap-3 p-4 transition hover:shadow-lg"
              >
                <span class="rounded-lg bg-brand-primary/20 p-2"><CubeIcon class="h-6 w-6 text-brand-dark" /></span>
                <div class="text-left">
                  <p class="text-sm text-gray-500">Товары</p>
                  <p class="text-xl font-semibold text-gray-900">{{ stats.products }}</p>
                </div>
                <svg class="ml-auto h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                @click="handleOverviewClick('categories')"
                class="card-base flex items-center gap-3 p-4 transition hover:shadow-lg"
              >
                <span class="rounded-lg bg-brand-primary/20 p-2"><TagIcon class="h-6 w-6 text-brand-dark" /></span>
                <div class="text-left">
                  <p class="text-sm text-gray-500">Категории</p>
                  <p class="text-xl font-semibold text-gray-900">{{ stats.categories }}</p>
                </div>
                <svg class="ml-auto h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                @click="handleOverviewClick('banners')"
                class="card-base flex items-center gap-3 p-4 transition hover:shadow-lg"
              >
                <span class="rounded-lg bg-brand-primary/20 p-2"><PhotoIcon class="h-6 w-6 text-brand-dark" /></span>
                <div class="text-left">
                  <p class="text-sm text-gray-500">Баннеры</p>
                  <p class="text-xl font-semibold text-gray-900">{{ stats.banners }}</p>
                </div>
                <svg class="ml-auto h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </section>
          </div>

          <!-- Banners -->
          <div v-else-if="activeTab === 'banners'" class="space-y-6">
            <AdminBannersList
              :banners="adminStore.banners"
              :isLoading="adminStore.isLoading"
              @create="handleCreateBanner"
              @edit="handleEditBanner"
              @delete="handleDeleteBanner"
              @batchDelete="handleBatchDeleteBanners"
              @batchToggle="handleBatchToggleBannerStatus"
              @reorder="handleReorderBanners"
              @toggleStatus="handleToggleBannerStatus"
            />
          </div>

          <!-- Categories -->
          <div v-else-if="activeTab === 'categories'" class="space-y-6">
            <AdminCategoriesList
              :categories="adminStore.categories"
              :isLoading="adminStore.isLoading"
            :group-counts="groupCounts"
            :cross-sell-counts="crossSellCounts"
              @create="handleCreateCategory"
              @edit="handleEditCategory"
              @delete="handleDeleteCategory"
              @reorder="handleReorderCategories"
            @manage-groups="handleManageGroups"
            @manage-cross-sell="handleManageCrossSell"
            />
          </div>

          <!-- Products -->
          <div v-else-if="activeTab === 'products'" class="space-y-6">
            <AdminProductsTable
              :products="adminStore.products || []"
              :categories="adminStore.categories || []"
              :pagination="adminStore.productsPagination"
              :isLoading="adminStore.isLoading"
              @create="handleCreateProduct"
              @edit="handleEditProduct"
              @delete="handleDeleteProduct"
              @changePage="handleProductsPageChange"
              @changePageSize="handleProductsPageSizeChange"
              @filters="handleProductsFilters"
              @batchDelete="handleBatchDeleteProducts"
              @batchChangeCategory="handleBatchChangeProductCategory"
              @batchChangeGroup="handleBatchChangeProductGroup"
              @createCategory="handleCreateCategoryFromProducts"
              @createGroup="handleCreateGroupFromProducts"
            />
          </div>

          <!-- CRM -->
          <div v-else-if="activeTab === 'crm'" class="space-y-6">
            <div class="card-base p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">CRM Система</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <router-link to="/admin/crm/dashboard" class="block p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-brand-dark hover:shadow-md transition-all">
                  <h4 class="font-bold text-gray-900 mb-2">📊 Дашборд</h4>
                  <p class="text-sm text-gray-600">Статистика и аналитика</p>
                </router-link>
                <router-link to="/admin/crm/customers" class="block p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-brand-dark hover:shadow-md transition-all">
                  <h4 class="font-bold text-gray-900 mb-2">👥 Клиенты</h4>
                  <p class="text-sm text-gray-600">База клиентов</p>
                </router-link>
                <router-link to="/admin/crm/procurements" class="block p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-brand-dark hover:shadow-md transition-all">
                  <h4 class="font-bold text-gray-900 mb-2">📥 Закупки</h4>
                  <p class="text-sm text-gray-600">Поставки товаров</p>
                </router-link>
                <router-link to="/admin/crm/finances" class="block p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-brand-dark hover:shadow-md transition-all">
                  <h4 class="font-bold text-gray-900 mb-2">💰 Финансы</h4>
                  <p class="text-sm text-gray-600">Счета и транзакции</p>
                </router-link>
                <router-link to="/admin/crm/employees" class="block p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-brand-dark hover:shadow-md transition-all">
                  <h4 class="font-bold text-gray-900 mb-2">👨‍💼 Сотрудники</h4>
                  <p class="text-sm text-gray-600">Управление командой</p>
                </router-link>
                <router-link to="/admin/crm/write-offs" class="block p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-brand-dark hover:shadow-md transition-all">
                  <h4 class="font-bold text-gray-900 mb-2">🗑️ Списания</h4>
                  <p class="text-sm text-gray-600">Учёт списаний товаров</p>
                </router-link>
              </div>
            </div>
          </div>

          <!-- Settings -->
          <div v-else class="space-y-6">
            <!-- Manager Settings -->
            <div class="card-base p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Настройки менеджера</h3>
              <form @submit.prevent="handleManagerSettingsUpdate" class="space-y-4 max-w-md">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Telegram username (без @)
                    <span class="block text-xs text-gray-500 font-normal mt-1">
                      Используется для переадресации покупателей при оформлении заказов
                    </span>
                  </label>
                  <input 
                    v-model="managerForm.telegram" 
                    type="text" 
                    required 
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-dark focus:border-transparent" 
                    :placeholder="adminStore.settings.manager_telegram || 'innocentyy'"
                  />
                </div>
                <button type="submit" :disabled="adminStore.isLoading" class="w-full px-4 py-2 text-sm font-medium rounded-lg bg-brand-dark text-white shadow-md hover:bg-brand-dark/90 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-opacity-50 active:bg-brand-dark/95 transition-all duration-200 inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-brand-dark">
                  {{ adminStore.isLoading ? 'Сохранение...' : 'Сохранить настройки' }}
                </button>
              </form>
            </div>
            
            <!-- Profit Password Settings -->
            <div class="card-base p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Пароль для просмотра прибыли</h3>
              <p class="text-sm text-gray-600 mb-4">
                Настройте отдельный пароль для доступа к финансовым показателям. По умолчанию используется значение <code class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">costpassword</code>.
              </p>
              <form @submit.prevent="handleProfitPasswordUpdate" class="space-y-4 max-w-md">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Текущий пароль</label>
                  <input
                    v-model="profitPasswordForm.current"
                    type="password"
                    required
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-dark focus:border-transparent"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Новый пароль</label>
                  <input
                    v-model="profitPasswordForm.next"
                    type="password"
                    required
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-dark focus:border-transparent"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Подтверждение</label>
                  <input
                    v-model="profitPasswordForm.confirm"
                    type="password"
                    required
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-dark focus:border-transparent"
                  />
                </div>
                <p v-if="profitPasswordErrorMessage" class="text-sm text-red-600">{{ profitPasswordErrorMessage }}</p>
                <p v-else-if="profitPasswordSuccessMessage" class="text-sm text-emerald-600">{{ profitPasswordSuccessMessage }}</p>
                <button
                  type="submit"
                  class="w-full px-4 py-2 text-sm font-medium rounded-lg bg-brand-dark text-white shadow-md hover:bg-brand-dark/90 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-opacity-50 active:bg-brand-dark/95 transition-all duration-200 inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-brand-dark"
                  :disabled="profitPasswordSaving"
                >
                  {{ profitPasswordSaving ? 'Сохраняем...' : 'Обновить пароль' }}
                </button>
              </form>
            </div>

            <!-- Password Settings -->
            <div class="card-base p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Смена пароля</h3>
              <form @submit.prevent="handlePasswordChange" class="space-y-4 max-w-md">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Текущий пароль</label>
                  <input v-model="passwordForm.currentPassword" type="password" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-dark focus:border-transparent" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Новый пароль</label>
                  <input v-model="passwordForm.newPassword" type="password" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-dark focus:border-transparent" />
                </div>
                <button type="submit" :disabled="adminStore.isLoading" class="w-full px-4 py-2 text-sm font-medium rounded-lg bg-brand-dark text-white shadow-md hover:bg-brand-dark/90 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-opacity-50 active:bg-brand-dark/95 transition-all duration-200 inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-brand-dark">
                  {{ adminStore.isLoading ? 'Изменяем пароль...' : 'Сменить пароль' }}
                </button>
              </form>
            </div>
          </div>
        </template>
      </AdminLayout>

    <!-- Banner Modal - УЛУЧШЕННОЕ -->
    <AdminModal 
      :isOpen="showBannerModal" 
      :title="modalTitle" 
      size="lg"
      :showActions="false"
      @cancel="showBannerModal = false" 
      @close="showBannerModal = false"
    >
      <AdminBannerForm :banner="editingBanner" @submit="handleBannerFormSubmit" @cancel="showBannerModal = false" />
    </AdminModal>

    <!-- Category Modal - УЛУЧШЕННОЕ -->
    <AdminModal 
      :isOpen="showCategoryModal" 
      :title="modalTitle" 
      size="md"
      :showActions="false"
      @cancel="showCategoryModal = false" 
      @close="showCategoryModal = false"
    >
      <AdminCategoryForm :category="editingCategory" @submit="handleCategoryFormSubmit" @cancel="showCategoryModal = false" />
    </AdminModal>

    <!-- Product Modal - УЛУЧШЕННОЕ -->
    <AdminModal 
      :isOpen="showProductModal" 
      :title="modalTitle" 
      size="xl"
      :showActions="false"
      @cancel="showProductModal = false" 
      @close="showProductModal = false"
    >
      <AdminProductForm :product="editingProduct" :categories="adminStore.categories" @submit="handleProductFormSubmit" @cancel="showProductModal = false" />
</AdminModal>

    <!-- Category Groups Modal -->
    <AdminModal
      :isOpen="showGroupModal"
      :title="activeGroupCategory ? `Подгруппы: ${activeGroupCategory.name}` : 'Подгруппы'"
      size="lg"
      :showActions="false"
      @cancel="closeGroupModal"
      @close="closeGroupModal"
    >
      <div v-if="activeGroupCategory">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <p class="text-sm text-gray-600">Категория</p>
            <p class="text-lg font-semibold text-gray-900">{{ activeGroupCategory.name }}</p>
          </div>
            <button
            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-brand-dark text-white hover:bg-brand-dark/90 transition-colors"
            @click="openGroupForm(undefined, activeGroupCategory)"
          >
            <PlusIcon class="w-4 h-4" />
            Добавить подгруппу
          </button>
        </div>

        <p v-if="groupModalLoading" class="text-xs text-gray-500 mb-3">Синхронизация…</p>

        <div v-if="editableGroups.length" class="space-y-3 max-h-[70vh] overflow-y-auto pr-1 sm:pr-2">
          <div
            v-for="(group, index) in editableGroups"
            :key="group.id"
            class="border border-gray-200 rounded-lg p-4 bg-white shadow-sm"
          >
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-3">
            <div class="space-y-2" :style="{ paddingLeft: `${(group.depth ?? 0) * 12}px` }">
                <p class="text-base font-semibold text-gray-900">{{ group.name }}</p>
                <p class="text-xs text-gray-500 font-mono">{{ group.slug }}</p>
              <p v-if="group.parentId" class="text-xs text-gray-500">Внутри: {{ groupNameById[group.parentId] || '—' }}</p>
                <div class="mt-2 text-xs text-gray-500 space-x-2">
                  <span>Порядок: <strong>{{ index + 1 }}</strong></span>
                  <span>Прямо в линейке: <strong>{{ group.productCount ?? 0 }}</strong></span>
                  <span>Всего с вложенными: <strong>{{ group.totalProductCount ?? group.productCount ?? 0 }}</strong></span>
                  <span v-if="group.hideEmpty" class="inline-flex items-center gap-1 text-orange-600">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-5.25h1.5v1.5h-1.5v-1.5zm0-6h1.5v4.5h-1.5v-4.5z"/></svg>
                    Скрывать пустую
                  </span>
                </div>
              </div>
              <div class="flex flex-col gap-2 sm:items-end">
                <div class="flex items-center justify-center sm:justify-end gap-1 flex-wrap">
                  <button
                    class="p-1 rounded-md border border-gray-200 hover:bg-gray-100 disabled:opacity-40"
                    :disabled="index === 0 || groupModalLoading"
                    @click="moveGroupUp(index)"
                  >
                    <ChevronUpIcon class="w-4 h-4" />
                  </button>
                  <button
                    class="p-1 rounded-md border border-gray-200 hover:bg-gray-100 disabled:opacity-40"
                    :disabled="index === editableGroups.length - 1 || groupModalLoading"
                    @click="moveGroupDown(index)"
                  >
                    <ChevronDownIcon class="w-4 h-4" />
                  </button>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    class="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md"
                    :disabled="groupModalLoading"
                    @click="openGroupForm(group, activeGroupCategory)"
                  >
                    <PencilSquareIcon class="w-4 h-4" />
                    Редактировать
                  </button>
                  <button
                    class="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-md"
                    :disabled="groupModalLoading"
                    @click="deleteGroup(group)"
                  >
                    <TrashIcon class="w-4 h-4" />
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p v-else class="text-sm text-gray-500">Линеек пока нет. Создайте первую.</p>
      </div>
    </AdminModal>

    <!-- Category Group Form Modal -->
    <AdminModal
      :isOpen="showGroupFormModal"
      :title="editingGroup ? 'Редактировать подгруппу' : 'Добавить подгруппу'"
      size="md"
      :showActions="false"
      @cancel="closeGroupForm"
      @close="closeGroupForm"
    >
      <AdminCategoryGroupForm
        :editing-group="editingGroup || undefined"
        :is-submitting="groupFormSubmitting"
        :available-groups="groupFormOptions"
        @submit="handleGroupFormSubmit"
        @cancel="closeGroupForm"
      />
    </AdminModal>

    <!-- Cross-sell Modal -->
    <AdminModal
      :isOpen="showCrossSellModal"
      :title="activeCrossSellCategory ? `Cross-sell: ${activeCrossSellCategory.name}` : 'Cross-sell'"
      size="lg"
      :showActions="false"
      @cancel="closeCrossSellModal"
      @close="closeCrossSellModal"
    >
      <div v-if="activeCrossSellCategory">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <p class="text-sm text-gray-600">Выбрано товаров: <strong>{{ crossSellSelection.length }}</strong></p>
            <p class="text-xs text-gray-500">Отобразятся в блоке «А вдруг пригодится?»</p>
          </div>
          <div class="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <input
              v-model="crossSellSearch"
              type="text"
              placeholder="Поиск по названию"
              class="w-full sm:w-64 px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand-dark/40 focus:border-brand-dark/40 text-sm"
            />
            <button
              class="px-4 py-2 text-sm font-semibold rounded-lg bg-brand-dark text-white hover:bg-brand-dark/90 disabled:opacity-50"
              :disabled="crossSellSubmitting"
              @click="saveCrossSell"
            >
              {{ crossSellSubmitting ? 'Сохранение...' : 'Сохранить' }}
            </button>
          </div>
        </div>

        <div class="space-y-2 max-h-[70vh] overflow-y-auto pr-1 sm:pr-2">
          <label
            v-for="product in availableCrossSellProducts"
            :key="product.id"
            class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50"
          >
            <div class="flex items-center gap-3">
              <input
                type="checkbox"
                class="w-4 h-4 text-brand-dark border-gray-300 rounded"
                :value="product.id"
                v-model="crossSellSelection"
              />
              <div>
                <p class="text-sm font-semibold text-gray-900">{{ product.title || 'Без названия' }}</p>
                <p class="text-xs text-gray-500">ID: {{ product.id }}</p>
              </div>
            </div>
            <p class="text-sm font-semibold text-gray-800 sm:text-right">{{ formatPrice(product.priceRub) }} ₽</p>
          </label>
        </div>
      </div>
    </AdminModal>

    <AdminModal
      :isOpen="showProfitModal"
      title="Подтверждение доступа"
      description="Введите пароль администратора, чтобы увидеть показатели прибыли."
      size="sm"
      :showActions="false"
      @close="closeProfitModal"
      @cancel="closeProfitModal"
    >
      <form class="space-y-4" @submit.prevent="submitProfitPassword">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
          <input
            v-model="profitPassword"
            type="password"
            class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark/20"
            placeholder="Введите пароль"
          />
          <p v-if="profitError" class="mt-2 text-sm text-red-600">{{ profitError }}</p>
        </div>
        <div class="flex gap-3 pt-2">
          <button
            type="submit"
            class="flex-1 rounded-md bg-brand-dark px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark/90 disabled:cursor-not-allowed disabled:bg-brand-dark/60"
            :disabled="verifyingProfit"
          >
            {{ verifyingProfit ? 'Проверяем…' : 'Показать' }}
          </button>
          <button
            type="button"
            class="flex-1 rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300"
            @click="closeProfitModal"
          >
            Отмена
          </button>
        </div>
      </form>
    </AdminModal>

    <!-- Global Toast for Admin actions -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="toast.visible"
        :class="[
          'fixed bottom-4 left-1/2 transform -translate-x-1/2 px-5 py-4 rounded-lg shadow-2xl z-[10000] text-base font-semibold text-white border-2 border-white/20 max-w-sm mx-auto text-center',
          toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'
        ]"
      >
        {{ toast.message }}
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { TagIcon, CubeIcon, PhotoIcon, HomeIcon, Cog6ToothIcon, ChevronUpIcon, ChevronDownIcon, PencilSquareIcon, TrashIcon, PlusIcon } from '@heroicons/vue/24/outline'
import { useAdminStore, type Category, type CategoryGroup, type Product } from '@/stores/admin'
import { useCrmStore } from '@/stores/crm'
import AdminBannersList from '@/components/admin/AdminBannersList.vue'
import AdminCategoriesList from '@/components/admin/AdminCategoriesList.vue'
import AdminModal from '@/components/AdminModal.vue'
import AdminBannerForm from '@/components/admin/AdminBannerForm.vue'
import AdminCategoryForm from '@/components/admin/AdminCategoryForm.vue'
import AdminProductForm from '@/components/admin/AdminProductForm.vue'
import AdminLayout from '@/components/admin/layout/AdminLayout.vue'
import AdminProductsTable from '@/components/admin/AdminProductsTable.vue'
import AdminCategoryGroupForm from '@/components/admin/AdminCategoryGroupForm.vue'

const router = useRouter()
const route = useRoute()
const adminStore = useAdminStore()
const crmStore = useCrmStore()
const { dashboardStats, loadingDashboard } = storeToRefs(crmStore)

const overviewPeriods = [
  { value: 'today', label: 'Сегодня' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' }
] as const
type OverviewPeriod = typeof overviewPeriods[number]['value']
const overviewPeriod = ref<OverviewPeriod>('today')
const profitUnlocked = ref(false)
const showProfitModal = ref(false)
const profitPassword = ref('')
const profitError = ref('')
const verifyingProfit = ref(false)

type CategoryGroupNode = CategoryGroup & { children: CategoryGroupNode[] }

// Forms and modals
const showBannerModal = ref(false)
const showCategoryModal = ref(false)
const showProductModal = ref(false)
const editingBanner = ref<any>(null)
const editingCategory = ref<any>(null)
const editingProduct = ref<any>(null)
const modalTitle = ref('')

const showGroupModal = ref(false)
const showGroupFormModal = ref(false)
const groupFormSubmitting = ref(false)
const groupModalLoading = ref(false)
const activeGroupCategory = ref<Category | null>(null)
const groupFormCategoryId = ref<string | null>(null)
type CategoryGroupWithDepth = CategoryGroup & { depth: number }

const editingGroup = ref<CategoryGroup | null>(null)
const editableGroups = ref<CategoryGroupWithDepth[]>([])

const showCrossSellModal = ref(false)
const crossSellSubmitting = ref(false)
const activeCrossSellCategory = ref<Category | null>(null)
const crossSellSelection = ref<string[]>([])
const crossSellSearch = ref('')

// Simple global toast state for admin actions
const toast = ref<{ visible: boolean; message: string; type: 'success' | 'error'; timer: number | null }>({
  visible: false,
  message: '',
  type: 'success',
  timer: null
})

function showToast(message: string, type: 'success' | 'error' = 'success', timeout = 2500) {
  // Clear previous timer if any
  if (toast.value.timer) {
    clearTimeout(toast.value.timer)
    toast.value.timer = null
  }
  toast.value.message = message
  toast.value.type = type
  toast.value.visible = true
  toast.value.timer = window.setTimeout(() => {
    toast.value.visible = false
    toast.value.message = ''
    toast.value.timer = null
  }, timeout)
}

function buildGroupTreeForCategory(categoryId: string): CategoryGroupNode[] {
  const groups = (adminStore.categoryGroups || []).filter(group => group.categoryId === categoryId)
  const map = new Map<string, CategoryGroupNode>()

  groups.forEach(group => {
    map.set(group.id, { ...group, children: [] })
  })

  const roots: CategoryGroupNode[] = []

  map.forEach(node => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  const sortNodes = (nodes: CategoryGroupNode[]) => {
    nodes.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    nodes.forEach(child => sortNodes(child.children))
  }

  sortNodes(roots)
  return roots
}

function flattenGroupTree(nodes: CategoryGroupNode[], depth = 0): CategoryGroupWithDepth[] {
  const list: CategoryGroupWithDepth[] = []
  nodes.forEach(node => {
    const { children, ...rest } = node
    list.push({ ...(rest as CategoryGroup), depth })
    if (children.length) {
      list.push(...flattenGroupTree(children, depth + 1))
    }
  })
  return list
}

// Читаем параметр tab из URL сразу при инициализации
const getInitialTab = (): 'dashboard' | 'banners' | 'categories' | 'products' | 'crm' | 'settings' => {
  const tabParam = route.query.tab as string | undefined
  if (tabParam && ['dashboard', 'banners', 'categories', 'products', 'crm', 'settings'].includes(tabParam)) {
    return tabParam as 'dashboard' | 'banners' | 'categories' | 'products' | 'crm' | 'settings'
  }
  return 'dashboard'
}

const activeTab = ref<'dashboard' | 'banners' | 'categories' | 'products' | 'crm' | 'settings'>(getInitialTab())

const loginForm = ref({ username: '', password: '' })
const passwordForm = ref({ currentPassword: '', newPassword: '' })
const managerForm = ref({ telegram: '' })
const profitPasswordForm = ref<{ current: string; next: string; confirm: string }>({
  current: '',
  next: '',
  confirm: ''
})
const profitPasswordErrorMessage = ref('')
const profitPasswordSuccessMessage = ref('')
const profitPasswordSaving = ref(false)

// Computed stats from store data
const stats = computed(() => ({
  categories: adminStore.categories?.length || 0,
  products: adminStore.productsPagination?.total || 0,
  banners: adminStore.banners?.length || 0
}))

const overviewStats = computed(() => dashboardStats.value?.stats ?? null)
const overviewDeliveries = computed(() => ({
  deliveries: dashboardStats.value?.deliveryStats?.deliveries ?? 0,
  revenue: dashboardStats.value?.deliveryStats?.revenue ?? 0
}))
const overviewStatuses = computed(() => {
  const mapping: Record<string, string> = {
    new: 'Новые',
    in_progress: 'В работе',
    completed: 'Завершены',
    delivered: 'Выданы',
    cancelled: 'Отменены'
  }
  const baseCounts: Record<string, number> = {
    new: 0,
    in_progress: 0,
    completed: 0,
    delivered: 0,
    cancelled: 0
  }
  for (const item of dashboardStats.value?.ordersByStatus ?? []) {
    if (item && typeof baseCounts[item.status] === 'number') {
      baseCounts[item.status] = item.count
    }
  }
  return Object.entries(baseCounts).map(([status, count]) => ({
    status,
    count,
    label: mapping[status] ?? status
  }))
})
const topGroups = computed(() => (dashboardStats.value?.topProducts ?? []).slice(0, 6))

const adminTabs = [
  { id: 'dashboard', name: 'Обзор', icon: HomeIcon },
  { id: 'products', name: 'Товары', icon: CubeIcon },
  { id: 'categories', name: 'Категории', icon: TagIcon },
  { id: 'banners', name: 'Баннеры', icon: PhotoIcon },
  { id: 'crm', name: 'CRM', icon: CubeIcon },
  { id: 'settings', name: 'Настройки', icon: Cog6ToothIcon }
]

const groupCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {}
  ;(adminStore.categoryGroups || []).forEach(group => {
    counts[group.categoryId] = (counts[group.categoryId] || 0) + 1
  })
  return counts
})

const crossSellCounts = computed<Record<string, number>>(() => {
  const result: Record<string, number> = {}
  const records = adminStore.categoryCrossSells || {}
  for (const key in records) {
    result[key] = records[key]?.length || 0
  }
  return result
})

const groupNameById = computed<Record<string, string>>(() => {
  const mapping: Record<string, string> = {}
  ;(adminStore.categoryGroups || []).forEach(group => {
    mapping[group.id] = group.name
  })
  return mapping
})

const availableCrossSellProducts = computed<Product[]>(() => {
  const query = crossSellSearch.value.trim().toLowerCase()
  return (adminStore.products || []).filter(product => {
    const title = (product.title || '').toLowerCase()
    return !query || title.includes(query)
  })
})

const groupFormOptions = computed(() => {
  const categoryId = groupFormCategoryId.value || activeGroupCategory.value?.id || null
  if (!categoryId) {
    return []
  }
  return flattenGroupTree(buildGroupTreeForCategory(categoryId))
})

const currentTabName = computed(() => adminTabs.find(t => t.id === activeTab.value)?.name || 'Админ-панель')

// Products table state for client-side filters (mock store)
const productsFilters = ref({ search: '', category: '', group: '' })

// Auth
async function handleLogin() {
  try {
    await adminStore.login(loginForm.value)
    // Load data after successful login
    if (adminStore.isAuthenticated) {
      await Promise.all([
        adminStore.fetchBanners(),
        adminStore.fetchCategories(),
        adminStore.fetchProducts({ page: 1, limit: 10 }),
        adminStore.fetchCategoryGroups(),
      ])
    }
  } catch (error) {
    console.error('Login failed:', error)
  }
}

function handleLogout() {
  adminStore.logout()
  router.push('/')
}

// Overview navigation
function handleOverviewClick(tabId: 'banners' | 'categories' | 'products' | 'settings') {
  activeTab.value = tabId
}

function openProfitModal() {
  profitPassword.value = ''
  profitError.value = ''
  showProfitModal.value = true
}

function closeProfitModal() {
  showProfitModal.value = false
  profitPassword.value = ''
  profitError.value = ''
}

async function submitProfitPassword() {
  if (!profitPassword.value.trim()) {
    profitError.value = 'Введите пароль'
    return
  }
  verifyingProfit.value = true
  profitError.value = ''
  try {
    await crmStore.verifyProfitPassword(profitPassword.value.trim())
    profitUnlocked.value = true
    closeProfitModal()
  } catch (error) {
    profitError.value = 'Неверный пароль'
  } finally {
    verifyingProfit.value = false
  }
}

async function handleProfitPasswordUpdate() {
  profitPasswordErrorMessage.value = ''
  profitPasswordSuccessMessage.value = ''
  adminStore.clearError()

  const current = profitPasswordForm.value.current.trim()
  const next = profitPasswordForm.value.next.trim()
  const confirm = profitPasswordForm.value.confirm.trim()

  if (!current) {
    profitPasswordErrorMessage.value = 'Введите текущий пароль'
    return
  }

  if (!next) {
    profitPasswordErrorMessage.value = 'Введите новый пароль'
    return
  }

  if (next.length < 4) {
    profitPasswordErrorMessage.value = 'Пароль должен содержать не менее 4 символов'
    return
  }

  if (next !== confirm) {
    profitPasswordErrorMessage.value = 'Пароли не совпадают'
    return
  }

  try {
    profitPasswordSaving.value = true
    await adminStore.updateProfitPassword({
      currentPassword: current,
      newPassword: next
    })
    profitUnlocked.value = false
    profitPasswordForm.value.current = ''
    profitPasswordForm.value.next = ''
    profitPasswordForm.value.confirm = ''
    profitPasswordSuccessMessage.value = 'Пароль успешно обновлён'
    showToast('Пароль для просмотра прибыли обновлён', 'success')
  } catch (error: any) {
    profitPasswordErrorMessage.value = adminStore.error || error?.data?.message || 'Не удалось обновить пароль'
  } finally {
    profitPasswordSaving.value = false
  }
}

function formatCurrency(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '—'
  }
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(value)
}

// Banners
function handleCreateBanner() {
  editingBanner.value = null
  modalTitle.value = 'Добавить баннер'
  showBannerModal.value = true
}
function handleEditBanner(banner: any) {
  editingBanner.value = banner
  modalTitle.value = 'Редактировать баннер'
  showBannerModal.value = true
}
async function handleDeleteBanner(bannerId: string) {
  if (confirm('Удалить баннер?')) {
    await adminStore.deleteBanner(bannerId)
  }
}
async function handleReorderBanners(reorderedBanners: any[]) {
  await adminStore.reorderBanners(reorderedBanners)
}
async function handleToggleBannerStatus(bannerId: string) {
  await adminStore.toggleBannerStatus(bannerId)
}
async function handleBannerFormSubmit(formData: any) {
  if (editingBanner.value) await adminStore.updateBanner(editingBanner.value.id, formData)
  else await adminStore.createBanner(formData)
  showBannerModal.value = false
}

// Массовые операции с баннерами
async function handleBatchDeleteBanners(bannerIds: string[]) {
  try {
    await Promise.all(bannerIds.map(id => adminStore.deleteBanner(id)))
  } catch (error) {
    console.error('Batch delete banners failed:', error)
  }
}

async function handleBatchToggleBannerStatus(bannerIds: string[], active: boolean) {
  try {
    await Promise.all(bannerIds.map(id => adminStore.updateBanner(id, { active: active ? 1 : 0 })))
  } catch (error) {
    console.error('Batch toggle banner status failed:', error)
  }
}

// Products
function handleCreateProduct() {
  editingProduct.value = null
  modalTitle.value = 'Создать товар'
  showProductModal.value = true
}
function handleEditProduct(p: any) {
  editingProduct.value = p
  modalTitle.value = 'Редактировать товар'
  showProductModal.value = true
}
async function handleDeleteProduct(product: any) {
  if (confirm(`Удалить товар "${product.title || product.id}"?`)) {
    await adminStore.deleteProduct(product.id)
  }
}
async function handleProductFormSubmit(formData: any) {
  if (editingProduct.value) {
    // Редактирование существующего товара
    await adminStore.updateProduct(editingProduct.value.id, formData)
    if (Array.isArray(formData.images)) {
      // @ts-ignore - метод присутствует и в mock, и в реальном сторе
      await adminStore.reorderProductImages(editingProduct.value.id, formData.images)
    }
  } else {
    // Создание нового товара
    await adminStore.createProduct(formData)
  }
  showProductModal.value = false
  
  // Обновляем список товаров
  await adminStore.fetchProducts({ 
    page: adminStore.productsPagination?.page || 1, 
    limit: adminStore.productsPagination?.limit || 10 
  })
  
  // Обновляем счётчики в линейках если товар был назначен в линейку
  if (formData.categoryId) {
    await adminStore.fetchCategoryGroups(formData.categoryId)
  }
}

// Pagination & filters for products (works with mock store; server can use same events)
function handleProductsPageChange(page: number) {
  adminStore.fetchProducts({ page, limit: adminStore.productsPagination?.limit || 10 })
}
function handleProductsPageSizeChange(limit: number) {
  adminStore.fetchProducts({ page: 1, limit })
}
function handleProductsFilters(v: { search: string; category: string; group: string }) {
  productsFilters.value = v
  // For real API you might call: adminStore.fetchProducts({ page: 1, limit: adminStore.productsPagination?.limit || 10, search: v.search, category: v.category })
}

// Массовые операции с товарами
async function handleBatchDeleteProducts(productIds: string[]) {
  try {
    // Используем новый batch метод
    await adminStore.batchDeleteProducts(productIds)
    
    // Обновляем список для синхронизации
    await adminStore.fetchProducts({ 
      page: adminStore.productsPagination?.page || 1, 
      limit: adminStore.productsPagination?.limit || 10 
    })
  } catch (error) {
    console.error('Batch delete products failed:', error)
  }
}

async function handleBatchChangeProductCategory(productIds: string[], categoryId: string) {
  try {
    // Используем batch update метод
    const updates = productIds.map(id => ({ id, data: { categoryId } }))
    await adminStore.batchUpdateProducts(updates)
    
    // Обновляем список для синхронизации
    await adminStore.fetchProducts({ 
      page: adminStore.productsPagination?.page || 1, 
      limit: adminStore.productsPagination?.limit || 10 
    })
    
    // Обновляем счётчики в линейках для категории
    await adminStore.fetchCategoryGroups(categoryId)
  } catch (error) {
    console.error('Batch change product category failed:', error)
  }
}

async function handleBatchChangeProductGroup(productIds: string[], payload: { categoryId: string; groupId: string | null }) {
  try {
    const updates = productIds.map(id => ({
      id,
      data: {
        categoryId: payload.categoryId,
        groupId: payload.groupId
      }
    }))

    await adminStore.batchUpdateProducts(updates)

    await adminStore.fetchProducts({
      page: adminStore.productsPagination?.page || 1,
      limit: adminStore.productsPagination?.limit || 10
    })
    
    // Обновляем счётчики в линейках для категории
    if (payload.categoryId) {
      await adminStore.fetchCategoryGroups(payload.categoryId)
    }
  } catch (error) {
    console.error('Batch change product group failed:', error)
  }
}

function handleCreateCategoryFromProducts() {
  handleCreateCategory()
}

async function handleCreateGroupFromProducts(payload: { categoryId: string | null }) {
  const categoryId = payload?.categoryId || ''
  const targetCategory = categoryId ? adminStore.categories.find((cat) => cat.id === categoryId) || null : null
  if (!targetCategory) {
    showToast('Сначала выберите категорию в фильтре', 'error')
    return
  }
  try {
    await adminStore.fetchCategoryGroups(targetCategory.id)
  } catch (error) {
    console.error('[AdminView] Failed to preload groups:', error)
  }
  void openGroupForm(null, targetCategory)
}


// Categories
function handleCreateCategory() {
  editingCategory.value = null
  modalTitle.value = 'Добавить категорию'
  showCategoryModal.value = true
}
function handleEditCategory(category: any) {
  editingCategory.value = category
  modalTitle.value = 'Редактировать категорию'
  showCategoryModal.value = true
}
async function handleDeleteCategory(categoryId: string) {
  if (confirm('Удалить категорию?')) {
    await adminStore.deleteCategory(categoryId)
  }
}
async function handleReorderCategories(reorderedCategories: any[]) {
  await adminStore.reorderCategories(reorderedCategories)
}
async function handleCategoryFormSubmit(formData: any) {
  try {
    const categoryData = {
      name: formData.name,
      hide_empty: formData.hideEmpty || false,
      cover_image: formData.coverImage ?? null
    }

    if (editingCategory.value) {
      await adminStore.updateCategory(editingCategory.value.id, categoryData)
      showToast('Категория обновлена', 'success')
    } else {
      await adminStore.createCategory({
        name: formData.name,
        hideEmpty: formData.hideEmpty || false,
        coverImage: formData.coverImage ?? null
      })
      showToast('Категория создана', 'success')
    }

    showCategoryModal.value = false
    await adminStore.fetchCategories()
  } catch (error: any) {
    console.error('[AdminView] Category form submission failed:', error)
    // Явная обработка дубликатов категорий
    const msg = (typeof error?.message === 'string' ? error.message : '')
    if (/Категория\s+с\s+(таким|похожим)\s+названием\s+уже\s+существует/i.test(msg)) {
      showToast(msg, 'error', 3500)
    } else {
      showToast('Не удалось сохранить категорию. Попробуйте ещё раз', 'error')
    }
    // Модал остается открытым при ошибке
  }
}

function syncEditableGroups(categoryId: string) {
  editableGroups.value = flattenGroupTree(buildGroupTreeForCategory(categoryId))
}

function getGroupBlockRange(list: CategoryGroupWithDepth[], startIndex: number) {
  const startDepth = list[startIndex]?.depth ?? 0
  let endIndex = startIndex + 1
  while (endIndex < list.length && (list[endIndex].depth ?? 0) > startDepth) {
    endIndex += 1
  }
  return { start: startIndex, end: endIndex }
}

function findPreviousSiblingIndex(list: CategoryGroupWithDepth[], startIndex: number) {
  const targetDepth = list[startIndex]?.depth ?? 0
  for (let i = startIndex - 1; i >= 0; i -= 1) {
    const depth = list[i]?.depth ?? 0
    if (depth === targetDepth) {
      return i
    }
    if (depth < targetDepth) {
      break
    }
  }
  return -1
}

function findNextSiblingIndex(list: CategoryGroupWithDepth[], startIndex: number) {
  const targetDepth = list[startIndex]?.depth ?? 0
  const currentRange = getGroupBlockRange(list, startIndex)
  let i = currentRange.end
  while (i < list.length) {
    const depth = list[i]?.depth ?? 0
    if (depth === targetDepth) {
      return i
    }
    if (depth < targetDepth) {
      break
    }
    const nextRange = getGroupBlockRange(list, i)
    i = nextRange.end
  }
  return -1
}

function handleManageGroups(category: Category) {
  void openManageGroups(category)
}

async function openManageGroups(category: Category) {
  activeGroupCategory.value = category
  groupFormCategoryId.value = category.id
  try {
    await adminStore.fetchCategoryGroups(category.id)
  } catch (error) {
    console.error('Failed to load groups:', error)
    showToast('Не удалось загрузить подгруппы', 'error')
  }
  syncEditableGroups(category.id)
  showGroupModal.value = true
}

function closeGroupModal() {
  showGroupModal.value = false
  if (!showGroupFormModal.value) {
    activeGroupCategory.value = null
    editableGroups.value = []
    groupFormCategoryId.value = null
  }
}
function openGroupForm(group?: (CategoryGroup & { depth?: number }) | null, category?: Category | null) {
  const targetCategory = category ?? activeGroupCategory.value ?? null
  if (targetCategory) {
    activeGroupCategory.value = targetCategory
    groupFormCategoryId.value = targetCategory.id
  }
  showGroupModal.value = false
  editingGroup.value = group || null
  showGroupFormModal.value = true
}

function closeGroupForm() {
  showGroupFormModal.value = false
  editingGroup.value = null
  groupFormCategoryId.value = null
  if (activeGroupCategory.value) {
    showGroupModal.value = true
  }
}

async function handleGroupFormSubmit(payload: { name: string; slug?: string; coverImage?: string | null; hideEmpty?: boolean; parentId?: string | null }) {
  const categoryId = groupFormCategoryId.value || activeGroupCategory.value?.id || null
  if (!categoryId) {
    showToast('Сначала выберите категорию', 'error')
    return
  }

  if (!activeGroupCategory.value || activeGroupCategory.value.id !== categoryId) {
    const resolvedCategory = adminStore.categories.find((cat) => cat.id === categoryId) || null
    if (resolvedCategory) {
      activeGroupCategory.value = resolvedCategory
    }
  }

  groupFormSubmitting.value = true
  try {
    if (editingGroup.value) {
      await adminStore.updateCategoryGroup(editingGroup.value.id!, {
        name: payload.name,
        slug: payload.slug,
        coverImage: payload.coverImage ?? null,
        hideEmpty: payload.hideEmpty,
        parentId: payload.parentId ?? null
      })
      showToast('Подгруппа обновлена', 'success')
    } else {
      await adminStore.createCategoryGroup({
        categoryId,
        name: payload.name,
        slug: payload.slug,
        coverImage: payload.coverImage ?? null,
        hideEmpty: payload.hideEmpty,
        parentId: payload.parentId ?? null
      })
      showToast('Подгруппа создана', 'success')
    }
    await adminStore.fetchCategoryGroups(categoryId)
    syncEditableGroups(categoryId)
    showGroupFormModal.value = false
    groupFormCategoryId.value = null
    showGroupModal.value = true
  } catch (error) {
    console.error('Failed to save group:', error)
    showToast('Не удалось сохранить подгруппу', 'error')
  } finally {
    groupFormSubmitting.value = false
  }
}

async function reorderGroups(newOrder: CategoryGroupWithDepth[]) {
  if (!activeGroupCategory.value) return
  groupModalLoading.value = true
  try {
    const payload = newOrder.map((group, idx) => ({ id: group.id!, order: idx + 1 }))
    await adminStore.reorderCategoryGroups(payload)
    await adminStore.fetchCategoryGroups(activeGroupCategory.value.id)
    syncEditableGroups(activeGroupCategory.value.id)
  } catch (error) {
    console.error('Failed to reorder groups:', error)
    showToast('Не удалось изменить порядок линеек', 'error')
  } finally {
    groupModalLoading.value = false
  }
}

function moveGroupUp(index: number) {
  const list = editableGroups.value
  if (!list[index]) return
  const prevIndex = findPreviousSiblingIndex(list, index)
  if (prevIndex === -1) return
  const currentRange = getGroupBlockRange(list, index)
  const prevRange = getGroupBlockRange(list, prevIndex)
  const block = list.slice(currentRange.start, currentRange.end)
  const remaining = [...list]
  remaining.splice(currentRange.start, currentRange.end - currentRange.start)
  const insertIndex = prevRange.start
  remaining.splice(insertIndex, 0, ...block)
  editableGroups.value = remaining
  void reorderGroups(remaining)
}

function moveGroupDown(index: number) {
  const list = editableGroups.value
  if (!list[index]) return
  const nextIndex = findNextSiblingIndex(list, index)
  if (nextIndex === -1) return
  const currentRange = getGroupBlockRange(list, index)
  const nextRange = getGroupBlockRange(list, nextIndex)
  const block = list.slice(currentRange.start, currentRange.end)
  const remaining = [...list]
  remaining.splice(currentRange.start, currentRange.end - currentRange.start)
  const adjust = currentRange.end - currentRange.start
  const insertIndex = nextRange.end - adjust
  remaining.splice(insertIndex, 0, ...block)
  editableGroups.value = remaining
  void reorderGroups(remaining)
}

async function deleteGroup(group: CategoryGroupWithDepth) {
  if (!activeGroupCategory.value || !group.id) return
  if (!confirm(`Удалить подгруппу "${group.name}"?`)) return
  groupModalLoading.value = true
  try {
    await adminStore.deleteCategoryGroup(group.id)
    await adminStore.fetchCategoryGroups(activeGroupCategory.value.id)
    syncEditableGroups(activeGroupCategory.value.id)
    showToast('Подгруппа удалена', 'success')
  } catch (error) {
    console.error('Failed to delete group:', error)
    showToast('Не удалось удалить подгруппу', 'error')
  } finally {
    groupModalLoading.value = false
  }
}

watch(
  () => adminStore.categoryGroups,
  () => {
    if (activeGroupCategory.value) {
      syncEditableGroups(activeGroupCategory.value.id)
    }
  }
)

async function handleManagerSettingsUpdate() {
  if (!managerForm.value.telegram || !managerForm.value.telegram.trim()) {
    showToast('Укажите Telegram username', 'error')
    return
  }
  
  try {
    await adminStore.updateSettings({
      manager_telegram: managerForm.value.telegram.trim()
    })
    showToast('Настройки менеджера успешно сохранены!', 'success')
  } catch (error) {
    console.error('Failed to update manager settings:', error)
    showToast('Ошибка при сохранении настроек', 'error')
  }
}

async function handlePasswordChange() {
  if (!passwordForm.value.currentPassword || !passwordForm.value.newPassword) {
    showToast('Заполните все поля', 'error')
    return
  }

  if (passwordForm.value.newPassword.length < 6) {
    showToast('Новый пароль должен содержать не менее 6 символов', 'error')
    return
  }

  try {
    await adminStore.changePassword(
      passwordForm.value.currentPassword,
      passwordForm.value.newPassword
    )
    
    // Очищаем форму
    passwordForm.value.currentPassword = ''
    passwordForm.value.newPassword = ''
    
    showToast('Пароль успешно изменён!', 'success')
  } catch (error: any) {
    console.error('Password change failed:', error)
    
    // Показываем конкретную ошибку из стора
    const errorMessage = adminStore.error || 'Не удалось изменить пароль'
    showToast(errorMessage, 'error', 4000)
  }
}

// Init
onMounted(async () => {
  // @ts-ignore - checkAuth method exists in adminStore
  await adminStore.checkAuth()
  if (adminStore.isAuthenticated) {
    await Promise.all([
      adminStore.fetchBanners(),
      adminStore.fetchCategories(),
      adminStore.fetchProducts({ page: 1, limit: 10 }),
      adminStore.fetchCategoryGroups(),
      adminStore.fetchSettings(),
      crmStore.fetchDashboard(overviewPeriod.value)
    ])
    
    // Заполняем форму настроек менеджера
    updateManagerForm()
  }
})

watch(() => adminStore.isAuthenticated, async (loggedIn) => {
  if (loggedIn) {
    await crmStore.fetchDashboard(overviewPeriod.value)
  } else {
    profitUnlocked.value = false
  }
})

watch(overviewPeriod, async (period) => {
  if (adminStore.isAuthenticated) {
    await crmStore.fetchDashboard(period)
  }
})

watch(
  () => [profitPasswordForm.value.current, profitPasswordForm.value.next, profitPasswordForm.value.confirm],
  () => {
    if (profitPasswordErrorMessage.value) {
      profitPasswordErrorMessage.value = ''
    }
    if (profitPasswordSuccessMessage.value) {
      profitPasswordSuccessMessage.value = ''
    }
    if (adminStore.error) {
      adminStore.clearError()
    }
  }
)

// Отслеживаем изменения параметра tab в URL
watch(
  () => route.query.tab,
  (newTab) => {
    if (newTab && ['dashboard', 'banners', 'categories', 'products', 'crm', 'settings'].includes(newTab as string)) {
      activeTab.value = newTab as 'dashboard' | 'banners' | 'categories' | 'products' | 'crm' | 'settings'
    }
  }
)

// Отслеживаем изменения настроек для обновления формы
watch(() => adminStore.settings.manager_telegram, () => {
  updateManagerForm()
})

function updateManagerForm() {
  const currentValue = adminStore.settings.manager_telegram || 'innocentyy'
  managerForm.value.telegram = currentValue
}

function closeCrossSellModal() {
  showCrossSellModal.value = false
  activeCrossSellCategory.value = null
  crossSellSelection.value = []
  crossSellSearch.value = ''
}

function handleManageCrossSell(category: Category) {
  void openCrossSellModal(category)
}

async function openCrossSellModal(category: Category) {
  activeCrossSellCategory.value = category
  crossSellSearch.value = ''
  try {
    await adminStore.fetchCategoryCrossSells(category.id)
    if (!adminStore.products.length) {
      await adminStore.fetchProducts({ page: 1, limit: 200 })
    }
    const existing = adminStore.categoryCrossSells?.[category.id] || []
    crossSellSelection.value = existing.map(product => product.id)
    showCrossSellModal.value = true
  } catch (error) {
    console.error('Failed to load cross-sell:', error)
    showToast('Не удалось загрузить cross-sell для категории', 'error')
  }
}

async function saveCrossSell() {
  if (!activeCrossSellCategory.value) return
  crossSellSubmitting.value = true
  try {
    await adminStore.updateCategoryCrossSells(activeCrossSellCategory.value.id, [...crossSellSelection.value])
    showToast('Cross-sell обновлён', 'success')
    closeCrossSellModal()
  } catch (error) {
    console.error('Failed to save cross-sell:', error)
    showToast('Не удалось сохранить cross-sell', 'error')
  } finally {
    crossSellSubmitting.value = false
  }
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value)
}
</script>

<style scoped>
/* РАДИКАЛЬНОЕ переопределение всех стилей */
* {
  box-sizing: border-box !important;
}

.login-container {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 20px !important;
  background: #f9fafb !important;
}

.login-form-wrapper {
  width: 100% !important;
  max-width: 400px !important;
  margin: 0 !important;
  padding: 0 !important;
}

.login-form-wrapper .card-base {
  width: 100% !important;
  margin: 0 !important;
  padding: 32px !important;
}

.login-form {
  width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
}

.login-form > div {
  width: 100% !important;
  margin: 0 0 16px 0 !important;
  padding: 0 !important;
}

.login-form label {
  display: block !important;
  width: 100% !important;
  margin: 0 0 8px 0 !important;
  text-align: left !important;
}

.login-input {
  width: 100% !important;
  display: block !important;
  margin: 0 !important;
  padding: 12px 16px !important;
  border: 1px solid #d1d5db !important;
  border-radius: 12px !important;
  background: white !important;
  font-size: 16px !important;
  line-height: 1.5 !important;
  outline: none !important;
}

.login-input:focus {
  border-color: var(--navalivay-red) !important;
  box-shadow: 0 0 0 3px rgba(211, 47, 47, 0.3), 0 0 20px rgba(211, 47, 47, 0.5) !important;
}

.login-button {
  width: 100% !important;
  display: block !important;
  margin: 20px 0 0 0 !important;
  padding: 16px 24px !important;
  background: var(--navalivay-black) !important;
  color: var(--navalivay-white) !important;
  border: none !important;
  border-radius: 0 !important;
  font-size: 16px !important;
  font-weight: 900 !important;
  text-align: center !important;
  cursor: pointer !important;
  transition: all 0.3s !important;
  text-transform: uppercase !important;
  letter-spacing: 0.15em !important;
  box-shadow: 8px 8px 0 rgba(26, 26, 26, 0.3) !important;
  font-family: 'Bebas Neue', 'Impact', sans-serif !important;
}

.login-button:hover {
  background: var(--navalivay-red) !important;
  box-shadow: 12px 12px 0 rgba(211, 47, 47, 0.4) !important;
  transform: translate(-2px, -2px) !important;
}

.login-button:disabled {
  opacity: 0.5 !important;
  cursor: not-allowed !important;
}
</style>
