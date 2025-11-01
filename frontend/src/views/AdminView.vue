<template>
  <div class="min-h-screen bg-gray-50 md:h-screen md:overflow-hidden">
    
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
<AdminLayout v-else v-model="layoutTab" :tabs="adminTabs" :main-active="!isCrmRoute" :crm-links="crmLinks" @logout="handleLogout">
        <template #default>
          <RouterView v-if="isCrmRoute" />
          <template v-else>
            <!-- Overview -->
            <template v-if="activeTab === 'dashboard'">
              <div v-if="!profitUnlocked" class="flex justify-center py-12">
                <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow">
                  <h3 class="text-lg font-semibold text-gray-900 text-center mb-3">Введите код доступа</h3>
                  <form class="space-y-4" @submit.prevent="submitOverviewAccess">
                    <input
                      v-model="profitPassword"
                      type="password"
                      class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark/20"
                      placeholder="Пароль"
                    />
                    <p v-if="profitError" class="text-sm text-red-600">{{ profitError }}</p>
                    <button
                      type="submit"
                      class="w-full rounded-lg bg-brand-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark/90 disabled:cursor-not-allowed disabled:bg-brand-dark/60"
                      :disabled="verifyingProfit"
                    >
                      {{ verifyingProfit ? 'Проверяем…' : 'Войти' }}
                    </button>
                  </form>
                </div>
              </div>
              <div v-else class="space-y-8">
            <section class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-dark via-red-600 to-brand-primary text-white shadow-xl">
              <div class="absolute inset-0">
                <div class="absolute -top-16 -left-24 h-64 w-64 rounded-full bg-white/15 blur-3xl"></div>
                <div class="absolute -bottom-20 right-0 h-72 w-72 rounded-full bg-white/10 blur-2xl"></div>
              </div>
              <Transition name="dash-fade" mode="out-in">
                <div :key="`${overviewPeriod}-${overviewOffset}-hero`" class="relative z-10 space-y-8 p-6 sm:p-8 lg:p-10">
                  <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div class="flex-1 min-w-0 space-y-6">
                    <div class="flex flex-wrap items-center gap-3">
                      <span class="relative inline-flex items-center gap-3 rounded-full border border-white/25 bg-white/10 px-5 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-sm">
                        <span class="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white">
                          <SparklesIcon class="h-4 w-4" />
                        </span>
                        <span class="tracking-[0.4em]">
                          Обзор · {{ activeOverviewLabel }}
                        </span>
                      </span>
                    </div>

                    <div v-if="overviewStats" class="grid w-full min-w-0 gap-3 sm:grid-cols-2 md:grid-cols-3">
                      <div class="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur">
                        <p class="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-white/70">Сделок</p>
                        <p class="mt-1 text-xl font-semibold">
                          <CountUp :value="overviewStats?.totalSales ?? 0" :key="`${overviewPeriod}-${overviewOffset}-sales`" />
                        </p>
                      </div>
                      <div class="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur">
                        <p class="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-white/70">Выручка</p>
                        <p class="mt-1 text-xl font-semibold">
                          <CountUpCurrency :value="overviewStats?.revenue ?? 0" :key="`${overviewPeriod}-${overviewOffset}-rev`" />
                        </p>
                      </div>
                      <div class="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur">
                        <p class="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-white/70">Средний чек</p>
                        <p class="mt-1 text-xl font-semibold">
                          <CountUpCurrency :value="overviewStats?.averageCheck ?? 0" :key="`${overviewPeriod}-${overviewOffset}-avg`" />
                        </p>
                      </div>
                    </div>

                    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
                      <div class="group relative overflow-hidden rounded-2xl bg-white/10 p-5 shadow-lg backdrop-blur-sm ring-1 ring-inset ring-white/15 transition hover:bg-white/15">
                        <div class="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div class="space-y-2">
                            <p class="text-xs font-semibold uppercase tracking-[0.25em] text-white/60">Продажи</p>
                            <p class="text-3xl font-semibold">
                              <CountUp :value="overviewStats?.totalSales ?? 0" :key="`${overviewPeriod}-${overviewOffset}-bigsales`" />
                            </p>
                          </div>
                          <span class="rounded-xl bg-white/20 p-2 text-white">
                            <ArrowTrendingUpIcon class="h-6 w-6" />
                          </span>
                        </div>
                        <p class="mt-3 text-xs text-white/70">Количество завершённых сделок за период</p>
                      </div>

                      <div class="group relative overflow-hidden rounded-2xl bg-white/10 p-5 shadow-lg backdrop-blur-sm ring-1 ring-inset ring-white/15 transition hover:bg-white/15">
                        <div class="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div class="space-y-2">
                            <p class="text-xs font-semibold uppercase tracking-[0.25em] text-white/60">Выручка</p>
                            <p class="text-3xl font-semibold">
                              <CountUpCurrency :value="overviewStats?.revenue ?? 0" :key="`${overviewPeriod}-${overviewOffset}-bigrev`" />
                            </p>
                          </div>
                          <span class="rounded-xl bg-white/20 p-2 text-white">
                            <CurrencyDollarIcon class="h-6 w-6" />
                          </span>
                        </div>
                        <p class="mt-3 text-xs text-white/70">Совокупный доход без учёта расходов</p>
                      </div>

                      <div class="group relative overflow-hidden rounded-2xl bg-white/10 p-5 shadow-lg backdrop-blur-sm ring-1 ring-inset ring-white/15 transition hover:bg-white/15 xl:col-span-2">
                        <div class="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div class="space-y-2">
                            <p class="text-xs font-semibold uppercase tracking-[0.25em] text-white/60">Средний чек</p>
                            <p class="text-3xl font-semibold">
                              <CountUpCurrency :value="overviewStats?.averageCheck ?? 0" :key="`${overviewPeriod}-${overviewOffset}-bigavg`" />
                            </p>
                          </div>
                          <span class="rounded-xl bg-white/20 p-2 text-white">
                            <ChartBarIcon class="h-6 w-6" />
                          </span>
                        </div>
                        <p class="mt-3 text-xs text-white/70">Средняя сумма заказа в выбранный период</p>
                      </div>
                    </div>
                  </div>

                  <div class="flex w-full flex-col gap-4 sm:max-w-md lg:max-w-sm lg:self-center lg:my-auto">
                    <div class="rounded-2xl border border-white/20 bg-white/10 p-5 shadow-lg backdrop-blur">
                      <p class="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">Витрина</p>
                      <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div class="space-y-1">
                          <p class="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-white/50">Товары</p>
                          <p class="text-xl font-semibold text-white">{{ stats.products }}</p>
                        </div>
                        <div class="space-y-1">
                          <p class="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-white/50">Категории</p>
                          <p class="text-xl font-semibold text-white">{{ stats.categories }}</p>
                        </div>
                        <div class="space-y-1">
                          <p class="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-white/50">Баннеры</p>
                          <p class="text-xl font-semibold text-white">{{ stats.banners }}</p>
                        </div>
                      </div>
                    </div>

                    <div class="rounded-2xl border border-white/15 bg-white/10 p-5 shadow-lg backdrop-blur-sm">
                      <div class="flex items-start justify-between gap-4">
                        <div class="space-y-3">
                          <p class="text-xs font-semibold uppercase tracking-[0.25em] text-white/60">Прибыль</p>
                          <div v-if="profitUnlocked" class="space-y-2">
                            <p class="text-2xl font-semibold text-white">
                              <CountUpCurrency :value="overviewStats?.profit ?? 0" :key="`${overviewPeriod}-${overviewOffset}-profit`" />
                            </p>
                            <p v-if="profitMargin !== null" class="text-xs text-white/70">Маржинальность {{ profitMargin }}%</p>
                          </div>
                          <div v-else class="space-y-4">
                            <div class="flex items-center gap-3 select-none">
                              <div
                                class="profit-mask-bar"
                                :aria-label="formatCurrency(overviewStats?.profit)"
                                role="img"
                              ></div>
                            </div>
                            <button
                              type="button"
                              class="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-6 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-white transition hover:border-white/35 hover:bg-white/25"
                              aria-label="Разблокировать"
                              @click="openProfitModal"
                            >
                              <LockOpenIcon class="h-4 w-4" />
                              <span>Открыть</span>
                            </button>
                          </div>
                        </div>
                        <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-white">
                          <BoltIcon class="h-6 w-6" />
                        </span>
                      </div>
                      <p v-if="!profitUnlocked" class="mt-4 text-xs text-white/70">Доступно после подтверждения паролем</p>
                    </div>
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <button
                    v-for="option in overviewPeriods"
                    :key="option.value"
                    type="button"
                    class="w-full rounded-full px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.2em] transition sm:w-auto sm:tracking-[0.3em]"
                    :class="overviewPeriod === option.value ? 'bg-white text-brand-dark shadow-lg' : 'bg-white/15 text-white/80 hover:bg-white/25'"
                    @click="overviewPeriod = option.value; overviewOffset = 0"
                  >
                    {{ option.label }}
                  </button>
                </div>

                <div class="mt-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-white/80">
                  <button @click="prevOverviewRange" class="rounded-md border border-white/20 px-2 py-1 hover:bg-white/10">&lt;</button>
                  <span>{{ overviewRangeLabel }}</span>
                  <button @click="nextOverviewRange" :disabled="isAtCurrentOverview" class="rounded-md border border-white/20 px-2 py-1 hover:bg-white/10 disabled:opacity-40">&gt;</button>
                </div>
                </div>
              </Transition>
            </section>

            <Transition name="dash-fade" mode="out-in">
              <div v-if="loadingDashboard" key="loading" class="flex items-center justify-center py-16">
                <div class="h-12 w-12 animate-spin rounded-full border-4 border-brand-dark border-t-transparent"></div>
              </div>
              <div v-else-if="dashboardStats" :key="`${overviewPeriod}-${overviewOffset}`" class="space-y-8">
                <section class="grid gap-6 xl:grid-cols-[1.6fr,1fr]">
                  <div class="card-base relative overflow-hidden rounded-3xl border border-red-100/60 bg-white p-6 shadow-lg">
                    <div class="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 class="text-lg font-semibold text-gray-900">Лучшие линейки</h3>
                        <p class="text-sm text-gray-500">Топ-{{ topGroups.length }} направлений по выручке</p>
                      </div>
                      <span v-if="topGroups.length" class="rounded-full bg-brand-primary/20 px-3 py-1 text-xs font-semibold text-brand-dark">
                        {{ topGroups.length }}
                      </span>
                    </div>
                    <div v-if="topGroups.length" class="mt-6 space-y-4">
                      <div
                        v-for="(group, index) in topGroups"
                        :key="group.group_id || index"
                        class="relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white/90 p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                      >
                        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p class="text-xs font-semibold uppercase tracking-[0.3em] text-brand-dark/70">№{{ index + 1 }}</p>
                            <p class="mt-1 text-base font-semibold text-gray-900">
                              {{ group.group_name || 'Без названия' }}
                            </p>
                            <p class="text-xs text-gray-500">Продано: {{ group.total_quantity }} шт</p>
                          </div>
                          <p class="text-lg font-semibold text-brand-dark">{{ formatCurrency(group.total_revenue) }}</p>
                        </div>
                        <div class="mt-4 h-2 w-full rounded-full bg-gray-100">
                          <div
                            class="h-full rounded-full bg-gradient-to-r from-brand-dark via-red-500 to-brand-primary"
                          :style="{ width: `${Math.min(100, Math.max(0, topGroupsMaxRevenue ? ((group.total_revenue ?? 0) / topGroupsMaxRevenue) * 100 : 0))}%` }"
                          ></div>
                        </div>
                      </div>
                    </div>
                    <div v-else class="mt-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-8 text-center text-sm text-gray-500">
                      Нет данных по продажам за выбранный период.
                    </div>
                  </div>

                  <div class="space-y-6">
                    <div class="card-base relative overflow-hidden rounded-3xl border border-red-100/60 bg-white p-6 shadow-lg">
                      <div class="mb-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                        <span class="rounded-xl bg-brand-primary/20 p-2 text-brand-dark">
                          <ClipboardDocumentCheckIcon class="h-6 w-6" />
                        </span>
                        <div>
                          <h3 class="text-lg font-semibold text-gray-900">Статусы заказов</h3>
                          <p class="text-sm text-gray-500">Баланс процессов от новых до доставленных заказов</p>
                        </div>
                      </div>
                      <div v-if="overviewStatuses.length" class="space-y-4">
                        <div v-for="status in overviewStatuses" :key="status.status" class="space-y-2">
                          <div class="flex w-full flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
                            <span>{{ status.label }}</span>
                            <span class="font-semibold text-gray-900">{{ status.count }}</span>
                          </div>
                          <div class="h-1.5 w-full rounded-full bg-gray-100">
                            <div
                              class="h-full rounded-full bg-gradient-to-r from-brand-dark via-red-500 to-brand-primary"
                          :style="{ width: `${status.count ? Math.min(100, Math.max(4, overviewStatusTotal ? (status.count / overviewStatusTotal) * 100 : 0)) : 0}%` }"
                            ></div>
                          </div>
                        </div>
                      </div>
                      <div v-else class="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-8 text-center text-sm text-gray-500">
                        Нет данных о статусах заказов.
                      </div>
                    </div>

                    <div class="card-base relative overflow-hidden rounded-3xl border border-red-100/60 bg-white p-6 shadow-lg">
                      <div class="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                        <span class="rounded-xl bg-brand-primary/20 p-2 text-brand-dark">
                          <TruckIcon class="h-6 w-6" />
                        </span>
                        <div>
                          <h3 class="text-lg font-semibold text-gray-900">Логистика и доставка</h3>
                          <p class="text-sm text-gray-500">Как быстро и эффективно вы доставляете заказы</p>
                        </div>
                      </div>
                      <div class="mt-6 space-y-4">
                        <div>
                          <p class="text-xs uppercase tracking-[0.3em] text-gray-500">Доставок</p>
                          <p class="mt-2 text-3xl font-semibold text-brand-dark">{{ overviewDeliveries.deliveries }}</p>
                        </div>
                        <div class="rounded-2xl bg-brand-primary/10 px-4 py-3 text-center text-sm text-brand-dark sm:text-left">
                          Прибыль с доставок: <strong>{{ formatCurrency(overviewDeliveries.profit) }}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
              <div v-else key="empty" class="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500 shadow-sm">
                Нет данных для выбранного периода.
              </div>
            </Transition>

          </div>

          </template>
          <template v-else-if="activeTab === 'banners'">
            <div class="space-y-6">
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
          </template>

          <template v-else-if="activeTab === 'categories'">
            <div class="space-y-6">
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
          </template>

          <template v-else-if="activeTab === 'products'">
            <div class="space-y-6">
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
          </template>

          <!-- Settings -->
          <template v-else-if="activeTab === 'settings'">
            <div class="space-y-6">
              <AdminSectionHero
                title="Настройки"
                :description="currentTabDescription"
                :icon="Cog6ToothIcon"
                tone="slate"
              />

              <div class="mx-auto w-full max-w-7xl space-y-6">
                <div class="grid gap-6 lg:grid-cols-2">
                <section class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div class="space-y-1">
                    <h3 class="text-lg font-semibold text-gray-900">Смена пароля администратора</h3>
                    <p class="text-sm text-gray-600">Для обновления пароля введите старый и подтвердите новый.</p>
                  </div>

                  <form @submit.prevent="handlePasswordChange" class="mt-6 space-y-4">
                    <div class="space-y-2">
                      <label class="text-sm font-medium text-gray-700">Текущий пароль</label>
                      <input
                        v-model="passwordForm.currentPassword"
                        type="password"
                        required
                        class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                      />
                    </div>
                    <div class="space-y-2">
                      <label class="text-sm font-medium text-gray-700">Новый пароль</label>
                      <input
                        v-model="passwordForm.newPassword"
                        type="password"
                        required
                        class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                      />
                    </div>
                    <div class="space-y-2">
                      <label class="text-sm font-medium text-gray-700">Подтверждение</label>
                      <input
                        v-model="passwordForm.confirmPassword"
                        type="password"
                        required
                        class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                      />
                    </div>
                    <button
                      type="submit"
                      :disabled="adminStore.isLoading"
                      class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-slate-800 hover:via-slate-700 hover:to-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {{ adminStore.isLoading ? 'Изменяем пароль...' : 'Обновить пароль' }}
                    </button>
                  </form>
                </section>

                <section class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div class="space-y-1">
                    <h3 class="text-lg font-semibold text-gray-900">Пароль для просмотра прибыли</h3>
                    <p class="text-sm text-gray-600">Настройте допуск к финансовым показателям.</p>
                  </div>

                  <form @submit.prevent="handleProfitPasswordUpdate" class="mt-6 space-y-4">
                    <div class="space-y-2">
                      <label class="text-sm font-medium text-gray-700">Текущий пароль</label>
                      <input
                        v-model="profitPasswordForm.current"
                        type="password"
                        required
                        class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                      />
                    </div>
                    <div class="space-y-2">
                      <label class="text-sm font-medium text-gray-700">Новый пароль</label>
                      <input
                        v-model="profitPasswordForm.next"
                        type="password"
                        required
                        class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                      />
                    </div>
                    <div class="space-y-2">
                      <label class="text-sm font-medium text-gray-700">Подтверждение</label>
                      <input
                        v-model="profitPasswordForm.confirm"
                        type="password"
                        required
                        class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                      />
                    </div>
                    <p
                      v-if="profitPasswordErrorMessage"
                      class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"
                    >
                      {{ profitPasswordErrorMessage }}
                    </p>
                    <p
                      v-else-if="profitPasswordSuccessMessage"
                      class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700"
                    >
                      {{ profitPasswordSuccessMessage }}
                    </p>
                    <button
                      type="submit"
                      class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-slate-800 hover:via-slate-700 hover:to-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60"
                      :disabled="profitPasswordSaving"
                    >
                      {{ profitPasswordSaving ? 'Сохраняем...' : 'Обновить пароль' }}
                    </button>
                  </form>
                </section>
              </div>

              <section class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div class="space-y-1">
                  <h3 class="text-lg font-semibold text-gray-900">Настройки менеджера</h3>
                </div>

                <form @submit.prevent="handleManagerSettingsUpdate" class="mt-6 space-y-4">
                  <div class="space-y-2">
                    <label class="text-sm font-medium text-gray-700">
                      Telegram username (без @)
                      <span class="mt-1 block text-xs font-normal text-gray-500">Используется для переадресации покупателей при оформлении заказов</span>
                    </label>
                    <input
                      v-model="managerForm.telegram"
                      type="text"
                      required
                      class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                      :placeholder="adminStore.settings.manager_telegram || 'innocentyy'"
                    />
                  </div>

                  <button
                    type="submit"
                    :disabled="adminStore.isLoading"
                    class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-slate-800 hover:via-slate-700 hover:to-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {{ adminStore.isLoading ? 'Сохранение...' : 'Сохранить настройки' }}
                  </button>
                </form>
              </section>
            </div>
          </div>
          </template>
          </template>
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
                    class="admin-link-button admin-link-button--danger"
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
        <div class="flex flex-col gap-3 mb-4">
          <div class="flex items-center justify-between">
            <p class="text-sm text-gray-600">Выбрано: <strong>{{ crossSellSelection.length }}</strong></p>
            <button
              class="px-4 py-2 text-sm font-semibold rounded-lg bg-brand-dark text-white hover:bg-brand-dark/90 disabled:opacity-50 flex-shrink-0"
              :disabled="crossSellSubmitting"
              @click="saveCrossSell"
            >
              {{ crossSellSubmitting ? 'Сохранение...' : 'Сохранить' }}
            </button>
          </div>
          <input
            v-model="crossSellSearch"
            type="text"
            placeholder="Поиск по названию"
            class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand-dark/40 focus:border-brand-dark/40 text-sm"
          />
          <div v-if="crossSellFilteredCount > 0" class="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <svg class="w-4 h-4 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
            </svg>
            <span class="text-blue-800">
              <strong>{{ crossSellFilteredCount }}</strong> {{ crossSellFilteredCount === 1 ? 'товар скрыт' : crossSellFilteredCount < 5 ? 'товара скрыто' : 'товаров скрыто' }} (уже добавлен{{ crossSellFilteredCount === 1 ? '' : 'ы' }} в категорию)
            </span>
          </div>
        </div>

        <div v-if="availableCrossSellProducts.length" class="space-y-2">
          <label
            v-for="product in availableCrossSellProducts"
            :key="product.id"
            class="flex items-center justify-between gap-3 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 cursor-pointer"
          >
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <input
                type="checkbox"
                class="w-4 h-4 text-brand-dark border-gray-300 rounded flex-shrink-0 cursor-pointer"
                :value="product.id"
                v-model="crossSellSelection"
              />
              <p class="text-sm font-semibold text-gray-900 truncate flex-1">{{ product.title || 'Без названия' }}</p>
            </div>
          </label>
        </div>
        <div v-else-if="crossSellFilteredCount > 0" class="py-8 text-center">
          <p class="text-sm text-gray-600">Все товары уже добавлены в эту категорию</p>
          <p class="text-xs text-gray-500 mt-1">Используйте функцию "Вдруг пригодится?" для товаров из других категорий</p>
        </div>
        <div v-else class="py-8 text-center text-sm text-gray-500">
          Товары не найдены
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
import { ref, onMounted, computed, watch, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ChevronUpIcon, ChevronDownIcon, PencilSquareIcon, TrashIcon, PlusIcon, ArrowTrendingUpIcon, CurrencyDollarIcon, ChartBarIcon, BoltIcon, TruckIcon, ClipboardDocumentCheckIcon, SparklesIcon, LockOpenIcon, Cog6ToothIcon } from '@heroicons/vue/24/outline'
import { useAdminStore, type Category, type CategoryGroup, type Product } from '@/stores/admin'
import { useCrmStore } from '@/stores/crm'
import AdminBannersList from '@/components/admin/AdminBannersList.vue'
import AdminCategoriesList from '@/components/admin/AdminCategoriesList.vue'
import AdminModal from '@/components/AdminModal.vue'
import AdminBannerForm from '@/components/admin/AdminBannerForm.vue'
import AdminCategoryForm from '@/components/admin/AdminCategoryForm.vue'
import AdminProductForm from '@/components/admin/AdminProductForm.vue'
import AdminLayout from '@/components/admin/layout/AdminLayout.vue'
import AdminSectionHero from '@/components/admin/layout/AdminSectionHero.vue'
import AdminProductsTable from '@/components/admin/AdminProductsTable.vue'
import AdminCategoryGroupForm from '@/components/admin/AdminCategoryGroupForm.vue'
import CountUp from '@/components/CountUp.vue'
import CountUpCurrency from '@/components/CountUpCurrency.vue'
import { adminTabs, crmLinks, adminTabOptions, type AdminTabId } from '@/constants/adminNavigation'

const router = useRouter()
const route = useRoute()
const adminStore = useAdminStore()
const crmStore = useCrmStore()
const { dashboardStats, loadingDashboard, profitUnlocked, verifyingProfitAccess } = storeToRefs(crmStore)
const isCrmRoute = computed(() => route.path.startsWith('/admin/crm'))

const overviewPeriods = [
  { value: 'today', label: 'Сегодня' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' }
] as const
type OverviewPeriod = typeof overviewPeriods[number]['value']
const overviewPeriod = ref<OverviewPeriod>('today')
const overviewOffset = ref(0)
const activeOverviewLabel = computed(() => overviewPeriods.find(option => option.value === overviewPeriod.value)?.label || '')

const isAtCurrentOverview = computed(() => overviewOffset.value >= 0)
const overviewRangeLabel = computed(() => {
  const now = new Date()
  const off = overviewOffset.value
  if (overviewPeriod.value === 'today') {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() + off)
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
  }
  if (overviewPeriod.value === 'week') {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const day = d.getUTCDay() || 7
    const monday = new Date(d.getTime() - (day - 1) * 86400000 + off * 7 * 86400000)
    const sunday = new Date(monday.getTime() + 6 * 86400000)
    return `${monday.toLocaleDateString('ru-RU')} — ${sunday.toLocaleDateString('ru-RU')}`
  }
  if (overviewPeriod.value === 'month') {
    const y = now.getUTCFullYear(); const m = now.getUTCMonth() + off
    const d = new Date(Date.UTC(y, m, 1))
    return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
  }
  if (overviewPeriod.value === 'year') {
    const y = now.getUTCFullYear() + off
    return `${y}`
  }
  return ''
})

function prevOverviewRange() { overviewOffset.value = overviewOffset.value - 1 }
function nextOverviewRange() { if (isAtCurrentOverview.value) return; overviewOffset.value = overviewOffset.value + 1 }
const showProfitModal = ref(false)
const profitPassword = ref('')
const profitError = ref('')
const verifyingProfit = computed(() => verifyingProfitAccess.value)

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

function resetLoadedState() {
  ;(Object.keys(dataLoaded) as DataSliceKey[]).forEach((key) => {
    dataLoaded[key] = false
  })
}

async function runDataLoaders(loaders: Array<{ key: DataSliceKey; loader: () => Promise<unknown> }>) {
  if (!loaders.length) {
    return true
  }

  const results = await Promise.allSettled(loaders.map((item) => item.loader()))
  let hadError = false

  results.forEach((result, index) => {
    const { key } = loaders[index]
    if (result.status === 'fulfilled') {
      dataLoaded[key] = true
    } else {
      hadError = true
      console.error(`[AdminView] Failed to load data chunk "${key}"`, result.reason)
    }
  })

  return !hadError
}

async function ensureTabData(tab: AdminTabId) {
  if (!adminStore.isAuthenticated) {
    return
  }

  if (tab === 'dashboard') {
    if (dataLoaded.dashboard || !profitUnlocked.value) {
      return
    }

    const success = await runDataLoaders([{
      key: 'dashboard',
      loader: () => crmStore.fetchDashboard(overviewPeriod.value, overviewOffset.value)
    }])

    if (!success) {
      showToast('Не удалось обновить показатели дашборда. Попробуйте ещё раз.', 'error', 4000)
    }
    return
  }

  const loaders: Array<{ key: DataSliceKey; loader: () => Promise<unknown> }> = []

  if (tab === 'banners' && !dataLoaded.banners) {
    loaders.push({ key: 'banners', loader: () => adminStore.fetchBanners() })
  }

  if (tab === 'categories') {
    if (!dataLoaded.categories) {
      loaders.push({ key: 'categories', loader: () => adminStore.fetchCategories() })
    }
    if (!dataLoaded.categoryGroups) {
      loaders.push({ key: 'categoryGroups', loader: () => adminStore.fetchCategoryGroups() })
    }
  }

  if (tab === 'products') {
    if (!dataLoaded.products) {
      const page = adminStore.productsPagination?.page ?? 1
      const limit = adminStore.productsPagination?.limit ?? 10
      loaders.push({ key: 'products', loader: () => adminStore.fetchProducts({ page, limit }) })
    }
    if (!dataLoaded.categories) {
      loaders.push({ key: 'categories', loader: () => adminStore.fetchCategories() })
    }
    if (!dataLoaded.categoryGroups) {
      loaders.push({ key: 'categoryGroups', loader: () => adminStore.fetchCategoryGroups() })
    }
  }

  if (tab === 'settings' && !dataLoaded.settings) {
    loaders.push({ key: 'settings', loader: () => adminStore.fetchSettings() })
  }

  const success = await runDataLoaders(loaders)
  if (!success) {
    showToast('Не удалось загрузить данные раздела. Попробуйте обновить страницу.', 'error', 5000)
  }
}

async function loadInitialAdminData() {
  const loaders: Array<{ key: DataSliceKey; loader: () => Promise<unknown> }> = [
    { key: 'banners', loader: () => adminStore.fetchBanners() },
    { key: 'categories', loader: () => adminStore.fetchCategories() },
    { key: 'categoryGroups', loader: () => adminStore.fetchCategoryGroups() },
    { key: 'products', loader: () => adminStore.fetchProducts({ page: 1, limit: 10 }) },
    { key: 'settings', loader: () => adminStore.fetchSettings() }
  ]

  if (profitUnlocked.value) {
    loaders.push({
      key: 'dashboard',
      loader: () => crmStore.fetchDashboard(overviewPeriod.value, overviewOffset.value)
    })
  }

  const success = await runDataLoaders(loaders)
  if (!success) {
    showToast('Не удалось загрузить часть данных админки. Откройте нужный раздел повторно.', 'error', 5000)
  }
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

const tabOptions = adminTabOptions

type DataSliceKey = 'banners' | 'categories' | 'categoryGroups' | 'products' | 'settings' | 'dashboard'
const dataLoaded = reactive<Record<DataSliceKey, boolean>>({
  banners: false,
  categories: false,
  categoryGroups: false,
  products: false,
  settings: false,
  dashboard: false
})

const getInitialTab = (): AdminTabId => {
  const tabParam = route.query.tab as string | undefined
  if (tabParam && tabOptions.includes(tabParam as AdminTabId)) {
    return tabParam as AdminTabId
  }
  return 'dashboard'
}

const activeTab = ref<AdminTabId>(getInitialTab())
const layoutTab = computed<AdminTabId>({
  get: () => activeTab.value,
  set: (value: AdminTabId) => {
    activeTab.value = value
    const query = value === 'dashboard' ? {} : { tab: value }
    router.push({ path: '/admin', query }).catch(() => {})
  }
})

watch(activeTab, (tab) => {
  void ensureTabData(tab)
})

const loginForm = ref({ username: '', password: '' })
const passwordForm = ref({ currentPassword: '', newPassword: '', confirmPassword: '' })
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
const profitMargin = computed(() => {
  const revenue = overviewStats.value?.revenue ?? 0
  const profit = overviewStats.value?.profit ?? 0
  if (!revenue) return null
  const percentage = (profit / revenue) * 100
  const precision = percentage % 1 === 0 ? 0 : 1
  return percentage.toFixed(precision)
})
const overviewDeliveries = computed(() => ({
  deliveries: dashboardStats.value?.deliveryStats?.deliveries ?? 0,
  profit: dashboardStats.value?.deliveryStats?.profit ?? 0
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
const overviewStatusTotal = computed(() => overviewStatuses.value.reduce((sum, status) => sum + (status.count ?? 0), 0))
const topGroupsMaxRevenue = computed(() => {
  const revenues = topGroups.value.map(group => group.total_revenue ?? 0)
  return revenues.length ? Math.max(...revenues) : 0
})

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
  if (!activeCrossSellCategory.value) return []
  
  const categoryId = activeCrossSellCategory.value.id
  const query = crossSellSearch.value.trim().toLowerCase()
  
  // Получаем ID товаров, которые уже есть в категории как обычные товары
  const regularProductIds = new Set(
    (adminStore.products || [])
      .filter(p => p.categoryId === categoryId)
      .map(p => p.id)
  )
  
  return (adminStore.products || []).filter(product => {
    // Исключаем товары, которые уже есть в категории
    if (regularProductIds.has(product.id)) return false
    
    const title = (product.title || '').toLowerCase()
    return !query || title.includes(query)
  })
})

const crossSellFilteredCount = computed(() => {
  if (!activeCrossSellCategory.value) return 0
  
  const categoryId = activeCrossSellCategory.value.id
  const allProducts = adminStore.products || []
  
  // Считаем сколько товаров отфильтровано (уже в категории)
  return allProducts.filter(p => p.categoryId === categoryId).length
})

const groupFormOptions = computed(() => {
  const categoryId = groupFormCategoryId.value || activeGroupCategory.value?.id || null
  if (!categoryId) {
    return []
  }
  return flattenGroupTree(buildGroupTreeForCategory(categoryId))
})

const currentTabName = computed(() => adminTabs.find(t => t.id === activeTab.value)?.name || 'Админ-панель')
const currentTabDescription = computed(() => adminTabs.find(t => t.id === activeTab.value)?.description || '')

// Products table state for client-side filters (mock store)
const productsFilters = ref({ search: '', category: '', group: '' })

// Auth
async function handleLogin() {
  try {
    await adminStore.login(loginForm.value)
    // Load data after successful login
    if (adminStore.isAuthenticated) {
      resetLoadedState()
      await loadInitialAdminData()
      updateManagerForm()
    }
  } catch (error) {
    console.error('Login failed:', error)
  }
}

function handleLogout() {
  adminStore.logout()
  resetLoadedState()
  crmStore.lockProfitAccess()
  router.push('/')
}

// Overview navigation
function handleOverviewClick(tabId: 'banners' | 'categories' | 'products' | 'settings') {
  activeTab.value = tabId
}

watch([overviewPeriod, overviewOffset, profitUnlocked], async ([p, off, unlocked]) => {
  if (!adminStore.isAuthenticated) {
    return
  }
  if (!unlocked) {
    dataLoaded.dashboard = false
    return
  }
  try {
    await crmStore.fetchDashboard(p as any, off as number)
    dataLoaded.dashboard = true
  } catch (error) {
    console.error('Failed to update dashboard stats:', error)
    showToast('Не удалось обновить показатели дашборда', 'error', 4000)
  }
})

onMounted(() => {
  if (profitUnlocked.value && adminStore.isAuthenticated) {
    void (async () => {
      try {
        await crmStore.fetchDashboard(overviewPeriod.value, overviewOffset.value)
        dataLoaded.dashboard = true
      } catch (error) {
        console.error('Failed to fetch dashboard stats on init:', error)
      }
    })()
  }
})

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
  profitError.value = ''
  try {
    await crmStore.verifyProfitPassword(profitPassword.value.trim())
    closeProfitModal()
    await crmStore.fetchDashboard(overviewPeriod.value, overviewOffset.value)
    dataLoaded.dashboard = true
  } catch (error) {
    profitError.value = 'Неверный пароль'
  }
}

async function submitOverviewAccess() {
  if (!profitPassword.value.trim()) {
    profitError.value = 'Введите пароль'
    return
  }
  profitError.value = ''
  try {
    await crmStore.verifyProfitPassword(profitPassword.value.trim())
    await crmStore.fetchDashboard(overviewPeriod.value, overviewOffset.value)
    dataLoaded.dashboard = true
  } catch (error) {
    profitError.value = 'Неверный пароль'
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
    crmStore.lockProfitAccess()
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
  if (!passwordForm.value.currentPassword || !passwordForm.value.newPassword || !passwordForm.value.confirmPassword) {
    showToast('Заполните все поля', 'error')
    return
  }

  if (passwordForm.value.newPassword.length < 6) {
    showToast('Новый пароль должен содержать не менее 6 символов', 'error')
    return
  }

  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    showToast('Пароли не совпадают', 'error')
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
    
    passwordForm.value.confirmPassword = ''
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
  resetLoadedState()
  // @ts-ignore - checkAuth method exists in adminStore
  await adminStore.checkAuth()
  if (adminStore.isAuthenticated) {
    await loadInitialAdminData()
    updateManagerForm()
  }
})

watch(() => adminStore.isAuthenticated, (loggedIn) => {
  if (!loggedIn) {
    crmStore.lockProfitAccess()
    resetLoadedState()
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
    if (typeof newTab === 'string' && tabOptions.includes(newTab as AdminTabId)) {
      activeTab.value = newTab as AdminTabId
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
.dash-fade-enter-active, .dash-fade-leave-active {
  transition: opacity 320ms ease, transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
}
.dash-fade-enter-from {
  opacity: 0;
  transform: translateY(14px) scale(0.99);
}
.dash-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.995);
}
</style>

<style scoped>
/* РАДИКАЛЬНОЕ переопределение всех стилей */
* {
  box-sizing: border-box !important;
}

.profit-mask-bar {
  position: relative;
  width: 8.5rem;
  height: 2.25rem;
  border-radius: 9999px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.04));
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.profit-mask-bar::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.32) 0px,
    rgba(255, 255, 255, 0.32) 6px,
    transparent 6px,
    transparent 12px
  );
  opacity: 0.4;
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
