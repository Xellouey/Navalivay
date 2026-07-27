<template>
  <div class="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
    <div class="mx-auto w-full max-w-7xl space-y-6">
      <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-slate-950 sm:text-3xl">Сотрудники и зарплаты</h1>
          <p class="mt-1 text-sm text-slate-600">
            Смены, действия и понятная история работы команды.
          </p>
        </div>
        <div v-if="hasStaffAccess" class="flex flex-wrap gap-2">
          <CrmButton variant="secondary" refresh-icon :loading="pageLoading" @click="loadCurrentView">
            Обновить
          </CrmButton>
        </div>
      </header>

      <StaffShiftBar ref="shiftBarRef" />

      <section
        v-if="!hasStaffAccess"
        class="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center shadow-sm sm:px-10"
      >
        <div class="mx-auto max-w-md">
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <LockClosedIcon class="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 class="mt-4 text-lg font-semibold text-slate-950">Откройте личную карточку</h2>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            Сотрудник увидит только свои данные. Руководителю откроются команда, зарплаты,
            отметки, задачи и история смен.
          </p>
          <div class="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <CrmButton variant="primary" @click="accessOpen = true">
              Ввести ПИН
            </CrmButton>
            <CrmButton variant="secondary" @click="openStaffSetup('bootstrap')">
              Первый запуск или восстановление
            </CrmButton>
          </div>
        </div>
      </section>

      <template v-else>
        <div v-if="isStaffManager" class="sm:hidden">
          <label for="staff-manager-section" class="mb-1 block text-sm font-medium text-slate-700">
            Раздел
          </label>
          <select
            id="staff-manager-section"
            v-model="activeTab"
            class="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option v-for="item in managerTabs" :key="item.id" :value="item.id">
              {{ item.label }}
            </option>
          </select>
        </div>

        <nav
          v-if="isStaffManager"
          class="hidden gap-2 overflow-x-auto border-b border-slate-200 pb-3 sm:flex"
          aria-label="Разделы сотрудников"
        >
          <CrmButton
            v-for="item in managerTabs"
            :key="item.id"
            variant="filter"
            :pressed="activeTab === item.id"
            @click="activeTab = item.id"
          >
            {{ item.label }}
          </CrmButton>
        </nav>

        <div
          v-if="pageMessage"
          class="rounded-xl border px-4 py-3 text-sm"
          :class="pageMessageKind === 'error'
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-blue-200 bg-blue-50 text-blue-800'"
          :role="pageMessageKind === 'error' ? 'alert' : 'status'"
          aria-live="polite"
        >
          {{ pageMessage }}
        </div>

        <section
          v-if="activeTab === 'card'"
          data-testid="staff-card-layout"
          class="grid gap-6"
          :class="isStaffManager ? 'lg:grid-cols-[260px_minmax(0,1fr)]' : 'grid-cols-1'"
        >
          <aside v-if="isStaffManager" class="hidden space-y-3 lg:block">
            <div class="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <label for="card-employee-search" class="sr-only">Найти сотрудника</label>
              <input
                id="card-employee-search"
                v-model="cardEmployeeSearch"
                type="search"
                class="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="Найти сотрудника"
              />
              <select
                v-model="cardEmployeeStatusFilter"
                class="mt-2 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                aria-label="Статус сотрудников в карточке"
              >
                <option value="all">Все сотрудники</option>
                <option value="active">Работают</option>
                <option value="inactive">Уволены</option>
              </select>
              <div v-if="staffEmployeesLoading" class="py-8 text-center text-sm text-slate-500">
                Загружаем…
              </div>
              <div v-else-if="staffEmployeesError" class="py-5 text-center">
                <p class="text-sm text-red-700">{{ staffEmployeesError }}</p>
                <button class="mt-2 min-h-[44px] text-sm font-semibold text-blue-700" @click="loadEmployees">
                  Повторить
                </button>
              </div>
              <div v-else-if="!cardEmployees.length" class="py-8 text-center text-sm text-slate-500">
                Сотрудники не найдены. Измените поиск или фильтр.
              </div>
              <div v-else class="mt-2 max-h-[540px] space-y-1 overflow-y-auto">
                <button
                  v-for="employee in cardEmployees"
                  :key="employee.id"
                  type="button"
                  class="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition"
                  :class="selectedEmployeeId === employee.id
                    ? 'bg-blue-50 text-blue-950'
                    : 'text-slate-700 hover:bg-slate-50'"
                  :aria-pressed="selectedEmployeeId === employee.id"
                  @click="selectedEmployeeId = employee.id"
                >
                  <span
                    class="h-2.5 w-2.5 shrink-0 rounded-full"
                    :style="{ backgroundColor: safeColor(employee.color) }"
                    aria-hidden="true"
                  />
                  <span class="min-w-0">
                    <span class="block truncate text-sm font-semibold">
                      {{ employee.first_name }} {{ employee.last_name }}
                    </span>
                    <span class="block truncate text-xs text-slate-500">
                      {{ employee.position || "Должность не указана" }}
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </aside>

          <div class="min-w-0 space-y-5">
            <div
              v-if="isStaffManager"
              class="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-[minmax(0,1fr)_170px] lg:hidden"
            >
              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-500">Сотрудник</span>
                <select
                  v-model="selectedEmployeeId"
                  class="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  aria-label="Сотрудник в карточке"
                >
                  <option v-for="employee in cardEmployees" :key="employee.id" :value="employee.id">
                    {{ employee.first_name }} {{ employee.last_name }}
                    {{ employeeActive(employee) ? "" : " · уволен" }}
                  </option>
                </select>
              </label>
              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-500">Показывать</span>
                <select
                  v-model="cardEmployeeStatusFilter"
                  class="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="all">Всех</option>
                  <option value="active">Работающих</option>
                  <option value="inactive">Уволенных</option>
                </select>
              </label>
            </div>

            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div v-if="selectedEmployee" class="flex min-w-0 items-center gap-3">
                <img
                  v-if="selectedEmployee.avatar_url"
                  :src="selectedEmployee.avatar_url"
                  alt=""
                  class="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-white"
                />
                <span
                  v-else
                  class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ring-2 ring-white"
                  :style="{ backgroundColor: safeColor(selectedEmployee.color) }"
                  aria-hidden="true"
                >
                  {{ selectedEmployee.first_name.slice(0, 1) }}
                </span>
                <div class="min-w-0">
                  <h2 class="truncate text-xl font-bold text-slate-950">
                    {{ selectedEmployee.first_name }} {{ selectedEmployee.last_name }}
                  </h2>
                  <p class="truncate text-sm text-slate-500">
                    {{ selectedEmployee.position || "Должность не указана" }}
                  </p>
                </div>
              </div>
              <div class="flex flex-wrap items-center justify-end gap-2 text-sm text-slate-600">
                <select
                  v-model="selectedPeriod"
                  class="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  aria-label="Период показателей"
                >
                  <option value="day">За день</option>
                  <option value="month">За месяц</option>
                  <option value="year">За год</option>
                  <option value="custom">Период</option>
                </select>
                <input
                  v-if="selectedPeriod === 'day'"
                  v-model="selectedDay"
                  type="date"
                  class="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  aria-label="День показателей"
                />
                <input
                  v-else-if="selectedPeriod === 'month'"
                  v-model="selectedMonth"
                  type="month"
                  class="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  aria-label="Месяц показателей"
                />
                <input
                  v-else-if="selectedPeriod === 'year'"
                  v-model="selectedYear"
                  type="number"
                  min="2000"
                  max="2200"
                  step="1"
                  class="min-h-[44px] w-28 rounded-xl border border-slate-300 bg-white px-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  aria-label="Год показателей"
                />
                <template v-else>
                  <input v-model="customPeriodFrom" type="date" class="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-slate-900" aria-label="Начало периода" />
                  <span>—</span>
                  <input v-model="customPeriodTo" type="date" class="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-slate-900" aria-label="Конец периода" />
                </template>
              </div>
            </div>

            <div v-if="periodError" class="rounded-2xl border border-red-200 bg-white py-12 text-center">
              <p class="text-sm text-red-700">{{ periodError }}</p>
            </div>
            <div v-else-if="staffAnalyticsLoading" class="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
              Загружаем показатели…
            </div>
            <div v-else-if="staffAnalyticsError" class="rounded-2xl border border-red-200 bg-white py-12 text-center">
              <p class="text-sm text-red-700">{{ staffAnalyticsError }}</p>
              <CrmButton class="mt-4" variant="secondary" @click="loadCard">Повторить</CrmButton>
            </div>
            <template v-else-if="staffAnalytics">
              <section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <article
                  v-for="metric in headlineMetrics"
                  :key="metric.label"
                  class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div class="text-xs font-medium text-slate-500">{{ metric.label }}</div>
                  <div class="mt-2 text-xl font-bold text-slate-950">{{ metric.value }}</div>
                </article>
              </section>

              <section class="grid gap-3 md:grid-cols-2">
                <article
                  v-for="group in metricGroups"
                  :key="group.title"
                  class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <h3 class="text-sm font-semibold text-slate-950">{{ group.title }}</h3>
                  <dl class="mt-3 grid grid-cols-2 gap-3">
                    <div v-for="metric in group.metrics" :key="metric.label" class="min-w-0">
                      <div class="text-xs font-medium text-slate-500">{{ metric.label }}</div>
                      <div class="mt-1 truncate text-base font-bold text-slate-950">{{ metric.value }}</div>
                    </div>
                  </dl>
                  <p v-if="group.hint" class="mt-3 text-[11px] leading-4 text-slate-500">
                    {{ group.hint }}
                  </p>
                </article>
              </section>

              <section
                v-if="selectedEmployee?.responsibilities"
                class="border-l-4 border-blue-500 bg-white px-5 py-4 text-sm leading-6 text-slate-700"
              >
                <h3 class="font-semibold text-slate-950">Зона ответственности</h3>
                <p class="mt-1 whitespace-pre-line">{{ responsibilityText(selectedEmployee.responsibilities) }}</p>
              </section>

              <section v-if="activityChartPoints.length" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 class="font-semibold text-slate-950">Динамика работы</h3>
                    <p class="mt-1 text-xs text-slate-500">
                      {{ activityChartGranularity === "month" ? "По месяцам" : "По дням" }} · нулевые периоды тоже показаны.
                      <span v-if="activityChartPoints.length > 12">График можно листать.</span>
                    </p>
                  </div>
                  <div class="flex flex-wrap gap-2" role="group" aria-label="Показатель графика">
                    <CrmButton
                      v-for="option in activityMetricOptions"
                      :key="option.value"
                      variant="filter"
                      size="sm"
                      :pressed="activityMetric === option.value"
                      @click="activityMetric = option.value"
                    >
                      {{ option.label }}
                    </CrmButton>
                  </div>
                </div>
                <div
                  class="mt-5 flex h-36 items-end gap-2 overflow-x-auto pb-1"
                  role="img"
                  :aria-label="activityChartLabel"
                >
                  <div
                    v-for="point in activityChartPoints"
                    :key="point.key"
                    class="group flex h-full min-w-9 flex-1 flex-col items-center justify-end"
                    :title="`${point.label}: ${activityMetricValueLabel(point.value)}`"
                  >
                    <span class="mb-1 text-[10px] font-semibold text-slate-600">
                      {{ activityMetricShortValue(point.value) }}
                    </span>
                    <div
                      v-if="point.value > 0"
                      class="w-full max-w-7 rounded-t bg-blue-500 transition-all duration-300 group-hover:bg-blue-700"
                      :style="{ height: `${activityHeight(point.value)}%` }"
                    />
                    <div v-else class="h-px w-full max-w-7 bg-slate-200" />
                    <span class="mt-1 text-[9px] text-slate-400">{{ point.shortLabel }}</span>
                  </div>
                </div>
              </section>

              <section
                class="rounded-2xl border border-slate-200 bg-white shadow-sm"
                data-testid="staff-activity-timeline"
              >
                <div class="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 class="font-semibold text-slate-950">Действия и отметки</h3>
                    <p class="mt-1 text-xs text-slate-500">Системные события и ручные пояснения руководителя.</p>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="whitespace-nowrap text-xs text-slate-500">
                      {{ filteredTimelineItems.length }} записей
                    </span>
                    <select
                      v-model="timelineFilter"
                      class="min-h-[40px] min-w-36 rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      aria-label="Тип действий"
                    >
                      <option
                        v-for="option in timelineFilterOptions"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </option>
                    </select>
                  </div>
                </div>
                <div v-if="staffMarksLoading" class="py-10 text-center text-sm text-slate-500">Загружаем…</div>
                <div v-else-if="!filteredTimelineItems.length" class="py-12 text-center text-sm text-slate-500">
                  По выбранному фильтру записей нет
                </div>
                <ol v-else class="divide-y divide-slate-200">
                  <li
                    v-for="item in visibleTimelineItems"
                    :key="item.key"
                    class="flex gap-4 px-5 py-4"
                    data-testid="staff-timeline-item"
                  >
                    <span
                      class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                      :class="timelineDotClass(item)"
                      :style="item.type === 'activity' ? { backgroundColor: safeColor(selectedEmployee?.color) } : undefined"
                      aria-hidden="true"
                    />
                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <h4 class="font-medium text-slate-900">{{ item.title }}</h4>
                        <span v-if="item.manual" class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                          вручную
                        </span>
                        <span v-if="item.voided" class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                          аннулировано
                        </span>
                      </div>
                      <p v-if="item.description" class="mt-1 whitespace-pre-line text-sm text-slate-600">
                        {{ item.description }}
                      </p>
                      <p v-if="item.voidReason" class="mt-1 text-xs text-slate-500">
                        Причина аннулирования: {{ item.voidReason }}
                      </p>
                      <time class="mt-1 block text-xs text-slate-400">{{ formatDateTime(item.at) }}</time>
                    </div>
                  </li>
                </ol>
                <div
                  v-if="filteredTimelineItems.length > timelinePageSize"
                  class="flex flex-wrap items-center justify-center gap-2 border-t border-slate-200 px-5 py-4"
                >
                  <CrmButton
                    v-if="timelineRemaining > 0"
                    variant="secondary"
                    size="sm"
                    data-testid="staff-timeline-more"
                    @click="timelineLimit += timelinePageSize"
                  >
                    Показать ещё {{ Math.min(timelinePageSize, timelineRemaining) }}
                  </CrmButton>
                  <button
                    v-if="timelineLimit > timelinePageSize"
                    type="button"
                    class="min-h-[36px] rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
                    @click="timelineLimit = timelinePageSize"
                  >
                    Свернуть
                  </button>
                </div>
              </section>
            </template>
            <div v-else class="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center text-sm text-slate-500">
              Для выбранного периода данных пока нет
            </div>
          </div>
        </section>

        <section v-else-if="activeTab === 'team'" class="space-y-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap">
              <input
                v-model="employeeSearch"
                type="search"
                class="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:max-w-xs"
                placeholder="Имя или должность"
                aria-label="Поиск сотрудников"
              />
              <select
                v-model="employeeStatusFilter"
                class="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                aria-label="Статус сотрудника"
              >
                <option value="active">Работают</option>
                <option value="inactive">Уволены</option>
                <option value="all">Все</option>
              </select>
              <select
                v-model="teamSort"
                class="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                aria-label="Сортировка сотрудников"
              >
                <option value="shift">Сначала на смене</option>
                <option value="hours">По часам</option>
                <option value="issued">По выдачам</option>
                <option value="tasks">По задачам</option>
                <option value="name">По имени</option>
              </select>
            </div>
            <div class="flex flex-wrap gap-2">
              <CrmButton variant="secondary" @click="tasksManagerOpen = true">Задачи команды</CrmButton>
              <CrmButton variant="primary" @click="openEmployeeEditor()">Добавить сотрудника</CrmButton>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 class="font-semibold text-slate-950">Показатели команды</h2>
                <p class="mt-1 text-sm text-slate-500">
                  Только фактические часы и действия, без общего искусственного балла.
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <select
                  v-model="selectedPeriod"
                  class="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  aria-label="Период показателей команды"
                >
                  <option value="day">За день</option>
                  <option value="month">За месяц</option>
                  <option value="year">За год</option>
                  <option value="custom">Период</option>
                </select>
                <input
                  v-if="selectedPeriod === 'day'"
                  v-model="selectedDay"
                  type="date"
                  class="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  aria-label="День показателей команды"
                />
                <input
                  v-else-if="selectedPeriod === 'month'"
                  v-model="selectedMonth"
                  type="month"
                  class="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  aria-label="Месяц показателей команды"
                />
                <input
                  v-else-if="selectedPeriod === 'year'"
                  v-model="selectedYear"
                  type="number"
                  min="2000"
                  max="2200"
                  class="min-h-[44px] w-28 rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  aria-label="Год показателей команды"
                />
                <template v-else>
                  <input
                    v-model="customPeriodFrom"
                    type="date"
                    class="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                    aria-label="Начало периода команды"
                  />
                  <input
                    v-model="customPeriodTo"
                    type="date"
                    class="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                    aria-label="Конец периода команды"
                  />
                </template>
              </div>
            </div>
            <p v-if="periodError" class="mt-3 text-sm text-red-700" role="alert">
              {{ periodError }}
            </p>
          </div>

          <div v-if="staffEmployeesLoading || staffTeamAnalyticsLoading" class="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
            Загружаем показатели команды…
          </div>
          <div v-else-if="staffEmployeesError || staffTeamAnalyticsError" class="rounded-2xl border border-red-200 bg-white py-12 text-center">
            <p class="text-sm text-red-700">{{ staffEmployeesError || staffTeamAnalyticsError }}</p>
            <CrmButton class="mt-4" variant="secondary" @click="loadCurrentView">Повторить</CrmButton>
          </div>
          <div v-else-if="!teamEmployees.length" class="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center text-sm text-slate-500">
            Сотрудники не найдены. Измените поиск или фильтр.
          </div>

          <template v-else>
            <section class="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <article
                v-for="metric in teamHeadlineMetrics"
                :key="metric.label"
                class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div class="text-xs font-medium text-slate-500">{{ metric.label }}</div>
                <div class="mt-2 text-xl font-bold text-slate-950">{{ metric.value }}</div>
              </article>
            </section>

            <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 class="font-semibold text-slate-950">Сравнение команды</h2>
                  <p class="mt-1 text-xs text-slate-500">Один показатель — без искусственного общего рейтинга.</p>
                </div>
                <select
                  v-model="teamChartMetric"
                  class="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  aria-label="Показатель сравнения команды"
                >
                  <option value="hours">Отработанные часы</option>
                  <option value="issued">Выданные заказы</option>
                  <option value="tasks">Завершённые задачи</option>
                </select>
              </div>
              <div class="mt-5 space-y-3" role="img" :aria-label="teamChartAriaLabel">
                <div
                  v-for="row in teamComparisonRows"
                  :key="row.id"
                  class="grid grid-cols-[minmax(90px,160px)_minmax(0,1fr)_auto] items-center gap-3"
                >
                  <div class="truncate text-sm font-medium text-slate-700">{{ row.name }}</div>
                  <div class="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      class="h-full rounded-full bg-blue-500 transition-all duration-300"
                      :style="{ width: `${row.percent}%` }"
                    />
                  </div>
                  <div class="min-w-12 text-right text-sm font-bold text-slate-950">{{ row.label }}</div>
                </div>
              </div>
            </section>

            <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div class="divide-y divide-slate-200">
              <article
                v-for="employee in teamEmployees"
                :key="employee.id"
                class="grid gap-4 p-4 xl:grid-cols-[minmax(210px,0.75fr)_minmax(0,2fr)_auto] xl:items-center"
              >
                <div class="flex min-w-0 items-center gap-3">
                  <span class="h-3 w-3 shrink-0 rounded-full" :style="{ backgroundColor: safeColor(employee.color) }" />
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <h3 class="font-semibold text-slate-950">{{ employee.first_name }} {{ employee.last_name }}</h3>
                      <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="employeeActive(employee) ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'">
                        {{ employeeActive(employee) ? "Работает" : "Уволен" }}
                      </span>
                      <span
                        v-if="employeeShiftOpen(employee)"
                        class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                      >
                        Сейчас на смене
                      </span>
                    </div>
                    <p class="mt-1 text-sm text-slate-500">
                      {{ employee.position || "Должность не указана" }} ·
                      {{ employee.role === "manager" ? "Руководитель" : "Сотрудник" }}
                    </p>
                  </div>
                </div>
                <dl class="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-5">
                  <div class="rounded-xl bg-slate-50 px-3 py-2">
                    <dt class="text-[11px] text-slate-500">Отработано / смен</dt>
                    <dd class="mt-0.5 text-sm font-semibold text-slate-900">
                      {{ formatMinutes(Number(teamSummary(employee).worked_minutes || 0)) }} ·
                      {{ Number(teamSummary(employee).shifts_count || 0) }}
                    </dd>
                  </div>
                  <div class="rounded-xl bg-slate-50 px-3 py-2">
                    <dt class="text-[11px] text-slate-500">Задач</dt>
                    <dd class="mt-0.5 text-sm font-semibold text-slate-900">
                      {{ Number(teamSummary(employee).tasks_completed || 0) }}
                    </dd>
                  </div>
                  <div class="rounded-xl bg-slate-50 px-3 py-2">
                    <dt class="text-[11px] text-slate-500">Собрано / выдано</dt>
                    <dd class="mt-0.5 text-sm font-semibold text-slate-900">
                      {{ Number(teamSummary(employee).orders_assembled || 0) }} /
                      {{ Number(teamSummary(employee).orders_issued || 0) }}
                    </dd>
                  </div>
                  <div class="rounded-xl bg-slate-50 px-3 py-2">
                    <dt class="text-[11px] text-slate-500">Выручка / прибыль</dt>
                    <dd class="mt-0.5 text-sm font-semibold text-slate-900">
                      {{ formatMoney(Number(teamSummary(employee).orders_amount || 0)) }} /
                      {{ formatMoney(Number(teamSummary(employee).issued_profit || 0)) }}
                    </dd>
                  </div>
                  <div class="rounded-xl bg-slate-50 px-3 py-2">
                    <dt class="text-[11px] text-slate-500">Поставки созд. / прин.</dt>
                    <dd class="mt-0.5 text-sm font-semibold text-slate-900">
                      {{ Number(teamSummary(employee).procurements_created || 0) }} /
                      {{ Number(teamSummary(employee).procurements_completed || 0) }}
                    </dd>
                  </div>
                  <div class="rounded-xl bg-slate-50 px-3 py-2">
                    <dt class="text-[11px] text-slate-500">Перемещения созд. / прин.</dt>
                    <dd class="mt-0.5 text-sm font-semibold text-slate-900">
                      {{ Number(teamSummary(employee).transfers_created || 0) }} /
                      {{ Number(teamSummary(employee).transfers_completed || 0) }}
                    </dd>
                  </div>
                  <div class="rounded-xl bg-slate-50 px-3 py-2">
                    <dt class="text-[11px] text-slate-500">Плюсы / минусы</dt>
                    <dd class="mt-0.5 text-sm font-semibold text-slate-900">
                      {{ Number(teamSummary(employee).mark_counts?.positive || 0) }} /
                      {{ Number(teamSummary(employee).mark_counts?.negative || 0) }}
                    </dd>
                  </div>
                </dl>
                <div class="flex flex-wrap items-start gap-2 xl:max-w-[250px] xl:justify-end">
                  <CrmButton variant="primary" size="sm" @click="openEmployeeCard(employee)">Открыть</CrmButton>
                  <details class="group relative">
                    <summary class="flex min-h-[36px] cursor-pointer list-none items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      Действия
                    </summary>
                    <div class="mt-2 flex min-w-[170px] flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                      <CrmButton variant="secondary" size="sm" @click="openEmployeeEditor(employee)">Изменить</CrmButton>
                      <CrmButton
                        v-if="canResetEmployeePin(employee)"
                        variant="secondary"
                        size="sm"
                        @click="openPinReset(employee)"
                      >
                        Сбросить ПИН
                      </CrmButton>
                      <CrmButton
                        :variant="employeeActive(employee) ? 'danger' : 'soft'"
                        size="sm"
                        @click="toggleEmployeeActive(employee)"
                      >
                        {{ employeeActive(employee) ? "Уволить" : "Восстановить" }}
                      </CrmButton>
                    </div>
                  </details>
                </div>
              </article>
            </div>
          </div>
          </template>
        </section>

        <section v-else-if="activeTab === 'salaries'" class="space-y-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="text-lg font-semibold text-slate-950">Ожидаемая зарплата</h2>
              <p class="mt-1 text-sm text-slate-500">
                Плановая сумма за месяц. Фактические выплаты здесь не ведутся.
              </p>
            </div>
            <input
              v-model="selectedMonth"
              type="month"
              class="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              aria-label="Месяц зарплаты"
            />
          </div>
          <div class="grid grid-cols-2 gap-3 sm:max-w-xl">
            <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div class="text-xs font-medium text-slate-500">Заполнено</div>
              <div class="mt-2 text-xl font-bold text-slate-950">
                {{ salaryAssignedCount }} из {{ salaryRows.length }}
              </div>
            </article>
            <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div class="text-xs font-medium text-slate-500">Всего ожидается</div>
              <div class="mt-2 text-xl font-bold text-slate-950">{{ formatMoney(salaryExpectedTotal) }}</div>
            </article>
          </div>
          <div v-if="staffSalariesLoading" class="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
            Загружаем зарплаты…
          </div>
          <div v-else-if="staffSalariesError" class="rounded-2xl border border-red-200 bg-white py-12 text-center">
            <p class="text-sm text-red-700">{{ staffSalariesError }}</p>
            <CrmButton class="mt-4" variant="secondary" @click="loadSalaries">Повторить</CrmButton>
          </div>
          <div v-else-if="!salaryRows.length" class="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
            <p class="text-sm text-slate-600">
              Нет сотрудников. Добавьте сотрудника во вкладке «Команда».
            </p>
          </div>
          <template v-else>
            <div class="space-y-3 sm:hidden">
              <article
                v-for="salary in salaryRows"
                :key="`${salary.employee_id}:${salary.month}`"
                class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <h3 class="font-semibold text-slate-950">{{ salaryEmployeeName(salary) }}</h3>
                    <p class="mt-1 text-xs text-slate-500">{{ salaryUpdatedLabel(salary) }}</p>
                  </div>
                  <div class="text-right">
                    <div
                      class="font-bold"
                      :class="salary.id ? 'text-slate-950' : 'text-amber-700'"
                    >
                      {{ salary.id ? formatMoney(salaryAmount(salary)) : "Не указана" }}
                    </div>
                  </div>
                </div>
                <p v-if="salary.note" class="mt-3 text-sm text-slate-600">{{ salary.note }}</p>
                <div class="mt-4 flex flex-wrap gap-2">
                  <CrmButton v-if="salary.id" variant="soft" size="sm" @click="openSalaryHistory(salary)">История</CrmButton>
                  <CrmButton variant="secondary" size="sm" @click="openSalaryEditor(salary)">
                    {{ salary.id ? "Изменить" : "Указать сумму" }}
                  </CrmButton>
                </div>
              </article>
            </div>

            <div class="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:block">
              <table class="w-full text-left text-sm">
                <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th class="px-5 py-3">Сотрудник</th>
                    <th class="px-5 py-3">Ожидается</th>
                    <th class="px-5 py-3">Обновлено</th>
                    <th class="px-5 py-3">Комментарий</th>
                    <th class="px-5 py-3 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200">
                  <tr v-for="salary in salaryRows" :key="`${salary.employee_id}:${salary.month}`">
                    <td class="px-5 py-4 font-medium text-slate-900">{{ salaryEmployeeName(salary) }}</td>
                    <td class="px-5 py-4 font-semibold" :class="salary.id ? 'text-slate-950' : 'text-amber-700'">
                      {{ salary.id ? formatMoney(salaryAmount(salary)) : "Не указана" }}
                    </td>
                    <td class="px-5 py-4 text-slate-500">{{ salaryUpdatedLabel(salary) }}</td>
                    <td class="max-w-xs truncate px-5 py-4 text-slate-500">{{ salary.note || "—" }}</td>
                    <td class="px-5 py-4 text-right">
                      <div class="flex justify-end gap-2">
                        <CrmButton v-if="salary.id" variant="soft" size="sm" @click="openSalaryHistory(salary)">История</CrmButton>
                        <CrmButton variant="secondary" size="sm" @click="openSalaryEditor(salary)">
                          {{ salary.id ? "Изменить" : "Указать" }}
                        </CrmButton>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </section>

        <section v-else-if="activeTab === 'marks'" class="space-y-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="text-lg font-semibold text-slate-950">Ручные отметки</h2>
              <p class="mt-1 text-sm text-slate-500">Пояснение обязательно остаётся в истории.</p>
            </div>
            <div class="flex flex-col gap-2 sm:flex-row">
              <input
                v-model="selectedMonth"
                type="month"
                aria-label="Месяц отметок"
                class="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
              />
              <select
                v-model="marksEmployeeId"
                class="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                aria-label="Сотрудник для отметок"
              >
                <option v-for="employee in staffEmployees" :key="employee.id" :value="employee.id">
                  {{ employee.first_name }} {{ employee.last_name }}
                </option>
              </select>
              <CrmButton
                variant="primary"
                :disabled="!marksEmployeeId"
                @click="openMarkEditor()"
              >
                Добавить отметку
              </CrmButton>
            </div>
          </div>
          <div v-if="staffMarksLoading" class="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
            Загружаем отметки…
          </div>
          <div v-else-if="staffMarksError" class="rounded-2xl border border-red-200 bg-white py-12 text-center">
            <p class="text-sm text-red-700">{{ staffMarksError }}</p>
            <CrmButton class="mt-4" variant="secondary" @click="loadMarks">Повторить</CrmButton>
          </div>
          <div v-else-if="!staffMarks.length" class="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center text-sm text-slate-500">
            За выбранный месяц ручных отметок нет
          </div>
          <div v-else class="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <article v-for="mark in staffMarks" :key="mark.id" class="flex flex-col gap-4 p-5 sm:flex-row sm:justify-between">
              <div class="flex gap-3">
                <span class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" :class="mark.kind === 'positive' ? 'bg-blue-500' : 'bg-red-500'" />
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <h3 class="font-semibold text-slate-950">{{ mark.title }}</h3>
                    <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">вручную</span>
                    <span v-if="mark.voided_at" class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">аннулировано</span>
                  </div>
                  <p v-if="mark.description" class="mt-1 whitespace-pre-line text-sm text-slate-600">{{ mark.description }}</p>
                  <p v-if="mark.void_reason" class="mt-1 text-xs text-slate-500">Причина: {{ mark.void_reason }}</p>
                  <time class="mt-1 block text-xs text-slate-400">{{ formatDateTime(mark.occurred_at) }}</time>
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                <CrmButton variant="soft" size="sm" @click="openMarkHistory(mark)">История</CrmButton>
                <CrmButton v-if="!mark.voided_at" variant="secondary" size="sm" @click="openMarkEditor(mark)">Изменить</CrmButton>
                <CrmButton v-if="!mark.voided_at" variant="danger" size="sm" @click="openVoidMark(mark)">Аннулировать</CrmButton>
              </div>
            </article>
          </div>
        </section>

        <section v-else-if="activeTab === 'shifts'" class="space-y-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="text-lg font-semibold text-slate-950">История смен</h2>
              <p class="mt-1 text-sm text-slate-500">Исправления сохраняются вместе с причиной.</p>
            </div>
            <div class="flex flex-col gap-2 sm:flex-row">
              <select
                v-model="shiftsEmployeeId"
                class="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                aria-label="Сотрудник для истории смен"
              >
                <option value="">Вся команда</option>
                <option v-for="employee in staffEmployees" :key="employee.id" :value="employee.id">
                  {{ employee.first_name }} {{ employee.last_name }}
                </option>
              </select>
              <input
                v-model="selectedMonth"
                type="month"
                class="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3"
                aria-label="Месяц истории смен"
              />
            </div>
          </div>
          <div v-if="staffShiftHistoryLoading" class="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
            Загружаем смены…
          </div>
          <div v-else-if="staffShiftHistoryError" class="rounded-2xl border border-red-200 bg-white py-12 text-center">
            <p class="text-sm text-red-700">{{ staffShiftHistoryError }}</p>
            <CrmButton class="mt-4" variant="secondary" @click="loadShifts">Повторить</CrmButton>
          </div>
          <div v-else-if="!staffShiftHistory.length" class="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center text-sm text-slate-500">
            За выбранный период смен нет
          </div>
          <template v-else>
            <section class="grid grid-cols-3 gap-3">
              <article
                v-for="metric in shiftOverviewMetrics"
                :key="metric.label"
                class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div class="text-xs font-medium text-slate-500">{{ metric.label }}</div>
                <div class="mt-2 text-lg font-bold text-slate-950">{{ metric.value }}</div>
              </article>
            </section>

            <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <h3 class="font-semibold text-slate-950">Календарь смен</h3>
                <p class="mt-1 text-xs text-slate-500">
                  Чем насыщеннее ячейка, тем больше часов отработано в этот день.
                </p>
              </div>
              <div class="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-slate-400">
                <span v-for="day in ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']" :key="day">{{ day }}</span>
              </div>
              <div class="mt-1 grid grid-cols-7 gap-1">
                <div
                  v-for="cell in shiftCalendarCells"
                  :key="cell.key"
                  class="aspect-square rounded-lg border p-1.5 text-xs"
                  :class="cell.empty ? 'border-transparent' : 'border-slate-200'"
                  :style="cell.empty ? undefined : { backgroundColor: shiftHeatColor(cell.minutes) }"
                  :title="cell.empty
                    ? ''
                    : `${cell.label}: ${formatMinutes(cell.minutes)}, смен: ${cell.count}`"
                >
                  <template v-if="!cell.empty">
                    <div class="font-semibold text-slate-700">{{ cell.day }}</div>
                    <div v-if="cell.minutes" class="mt-1 text-[10px] text-slate-600">
                      {{ formatDecimal(cell.minutes / 60) }} ч
                    </div>
                    <div class="mt-1 flex gap-1">
                      <span v-if="cell.active" class="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span v-if="cell.corrected" class="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    </div>
                  </template>
                </div>
              </div>
              <div class="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                <span class="inline-flex items-center gap-1.5">
                  <span class="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                  Смена ещё идёт
                </span>
                <span class="inline-flex items-center gap-1.5">
                  <span class="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
                  Время смены исправляли
                </span>
              </div>
            </section>

            <section class="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h3 class="font-semibold text-slate-950">Последние смены</h3>
                  <p class="mt-1 text-xs text-slate-500">
                    Сначала новые · всего {{ staffShiftHistory.length }}
                  </p>
                </div>
              </div>
              <div class="divide-y divide-slate-200">
              <article
                v-for="shift in visibleShiftHistory"
                :key="shift.id"
                class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                data-testid="staff-shift-history-item"
              >
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <h3 class="font-semibold text-slate-950">{{ shiftEmployeeLabel(shift) }}</h3>
                    <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="shiftActive(shift) ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'">
                      {{ shiftActive(shift) ? "Идёт" : "Закрыта" }}
                    </span>
                    <span v-if="shift.corrected_at" class="text-xs text-slate-500">исправлена</span>
                  </div>
                  <p class="mt-1 text-sm text-slate-600">
                    {{ formatDateTime(shiftStart(shift)) }} →
                    {{ shiftEnd(shift) ? formatDateTime(shiftEnd(shift)!) : "сейчас" }}
                  </p>
                  <p v-if="shift.correction_reason" class="mt-1 text-xs text-slate-500">
                    Причина: {{ shift.correction_reason }}
                  </p>
                </div>
                <CrmButton variant="secondary" size="sm" @click="openShiftCorrection(shift)">
                  {{ shiftActive(shift) ? "Закрыть с причиной" : "Исправить" }}
                </CrmButton>
              </article>
              </div>
              <div
                v-if="staffShiftHistory.length > shiftHistoryPageSize"
                class="flex flex-wrap items-center justify-center gap-2 border-t border-slate-200 px-5 py-4"
              >
                <CrmButton
                  v-if="shiftHistoryRemaining > 0"
                  variant="secondary"
                  size="sm"
                  data-testid="staff-shift-history-more"
                  @click="shiftHistoryLimit += shiftHistoryPageSize"
                >
                  Показать ещё {{ Math.min(shiftHistoryPageSize, shiftHistoryRemaining) }}
                </CrmButton>
                <button
                  v-if="shiftHistoryLimit > shiftHistoryPageSize"
                  type="button"
                  class="min-h-[36px] rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  @click="shiftHistoryLimit = shiftHistoryPageSize"
                >
                  Свернуть
                </button>
              </div>
            </section>
          </template>
        </section>

        <section v-else-if="activeTab === 'settings'" class="space-y-5">
          <div>
            <h2 class="text-lg font-semibold text-slate-950">Настройки учёта</h2>
            <p class="mt-1 text-sm text-slate-500">
              Сначала включите общий учёт. Ограничение заказов включается отдельно после проверки сотрудников и ПИНов.
            </p>
          </div>

          <div v-if="staffSettingsError" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {{ staffSettingsError }}
          </div>

          <div class="grid gap-3 sm:grid-cols-3">
            <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div class="text-xs text-slate-500">Действующих сотрудников</div>
              <div class="mt-1 font-bold text-slate-950">{{ activeStaffCount }}</div>
            </div>
            <div
              class="rounded-xl border px-4 py-3"
              :class="orderRestrictionReady
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-amber-200 bg-amber-50'"
            >
              <div class="text-xs" :class="orderRestrictionReady ? 'text-emerald-700' : 'text-amber-700'">
                ПИНы настроены
              </div>
              <div class="mt-1 font-bold text-slate-950">
                {{ pinReadyStaffCount }} из {{ activeStaffCount }}
              </div>
            </div>
            <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div class="text-xs text-slate-500">Готовность смены</div>
              <div class="mt-1 text-sm font-semibold text-slate-950">{{ currentShiftReadinessLabel }}</div>
            </div>
          </div>

          <div class="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 class="font-semibold text-slate-950">Общий учёт сотрудников</h3>
                <p class="mt-1 text-sm text-slate-500">Включает смены, действия, задачи, отметки и аналитику.</p>
              </div>
              <CrmButton
                :variant="staffTrackingEnabled ? 'secondary' : 'primary'"
                :loading="staffSettingsLoading"
                @click="toggleTracking"
              >
                {{ staffTrackingEnabled ? "Выключить" : "Включить" }}
              </CrmButton>
            </div>
            <div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 class="font-semibold text-slate-950">Запрет изменений заказов без смены</h3>
                <p class="mt-1 text-sm text-slate-500">
                  Просмотр останется доступен. Создание, сборка, выдача и любое другое изменение потребуют открытую смену.
                </p>
              </div>
              <CrmButton
                :variant="staffOrderShiftRestrictionEnabled ? 'danger' : 'primary'"
                :loading="staffSettingsLoading"
                :disabled="!staffTrackingEnabled || (!staffOrderShiftRestrictionEnabled && !orderRestrictionReady)"
                @click="toggleOrderShiftRestriction"
              >
                {{ staffOrderShiftRestrictionEnabled ? "Выключить ограничение" : "Включить ограничение" }}
              </CrmButton>
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-3 border-l-4 border-slate-300 bg-white px-5 py-4">
            <div>
              <h3 class="font-semibold text-slate-950">ПИН руководителя</h3>
              <p class="mt-1 text-sm text-slate-500">Восстановление требует повторного ввода основного пароля CRM.</p>
            </div>
            <CrmButton variant="secondary" @click="openStaffSetup('recovery')">Восстановить ПИН</CrmButton>
          </div>
        </section>

        <section v-else-if="activeTab === 'notifications'" class="space-y-5">
          <div>
            <h2 class="text-lg font-semibold text-slate-950">Уведомления руководителю</h2>
            <p class="mt-1 text-sm text-slate-500">
              Настройте, кому Telegram отправляет документы, задачи и напоминания о зарплате.
            </p>
          </div>

          <div v-if="staffNotificationsLoading" class="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
            Загружаем настройки…
          </div>
          <div v-else-if="staffNotificationsError" class="rounded-2xl border border-red-200 bg-white py-12 text-center">
            <p class="text-sm text-red-700">{{ staffNotificationsError }}</p>
            <CrmButton class="mt-4" variant="secondary" @click="loadNotifications">Повторить</CrmButton>
          </div>
          <template v-else>
            <div class="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <label
                v-for="setting in notificationSettings"
                :key="String(setting.event_group)"
                class="flex min-h-[64px] items-center justify-between gap-4 px-5 py-3"
              >
                <span>
                  <span class="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                    {{ notificationGroupLabel(String(setting.event_group)) }}
                    <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                      {{ notificationRecipientCount(String(setting.event_group)) }}
                      {{ recipientWord(notificationRecipientCount(String(setting.event_group))) }}
                    </span>
                  </span>
                  <span
                    class="block text-xs"
                    :class="Boolean(setting.enabled) && notificationRecipientCount(String(setting.event_group)) === 0
                      ? 'font-medium text-amber-700'
                      : 'text-slate-500'"
                  >
                    {{ Boolean(setting.enabled) && notificationRecipientCount(String(setting.event_group)) === 0
                      ? "Включено, но отправлять пока некому"
                      : "Отправлять события этой группы активным получателям" }}
                  </span>
                </span>
                <input
                  :checked="Boolean(setting.enabled)"
                  type="checkbox"
                  class="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  :disabled="notificationSaving"
                  @change="toggleNotificationSetting(String(setting.event_group), ($event.target as HTMLInputElement).checked)"
                />
              </label>
            </div>
            <p
              v-if="notificationSettingError"
              class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {{ notificationSettingError }}
            </p>

            <div class="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
              <form class="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" @submit.prevent="resolvedRecipient ? addNotificationRecipient() : resolveNotificationRecipient()">
                <div>
                  <h3 class="font-semibold text-slate-950">Добавить получателя</h3>
                  <p class="mt-1 text-xs text-slate-500">Сначала найдём точный Telegram-профиль, затем вы подтвердите добавление.</p>
                </div>
                <label class="block">
                  <span class="mb-1 block text-sm font-medium text-slate-700">Тип сообщений</span>
                  <select v-model="recipientForm.event_group" class="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3">
                    <option value="documents">Поставки и перемещения</option>
                    <option value="tasks">Задачи</option>
                    <option value="salary">Зарплата</option>
                  </select>
                </label>
                <label class="block">
                  <span class="mb-1 block text-sm font-medium text-slate-700">Имя пользователя Telegram</span>
                  <input v-model.trim="recipientForm.username" required placeholder="@username" class="min-h-[44px] w-full rounded-xl border border-slate-300 px-3" />
                </label>
                <div v-if="resolvedRecipient" class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
                  <div class="font-semibold">{{ resolvedRecipient.display_name }}</div>
                  <div class="mt-1 text-xs">@{{ resolvedRecipient.telegram_username }}</div>
                </div>
                <p v-if="notificationFormError" class="text-sm text-red-700" role="alert">{{ notificationFormError }}</p>
                <div class="flex justify-end gap-2">
                  <CrmButton v-if="resolvedRecipient" type="button" variant="secondary" :disabled="notificationSaving" @click="resolvedRecipient = null">
                    Найти заново
                  </CrmButton>
                  <CrmButton type="submit" variant="primary" :loading="notificationSaving">
                    {{ resolvedRecipient ? "Подтвердить и добавить" : "Найти" }}
                  </CrmButton>
                </div>
              </form>

              <div class="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div class="border-b border-slate-200 px-5 py-4">
                  <h3 class="font-semibold text-slate-950">Получатели</h3>
                </div>
                <div v-if="!notificationRecipients.length" class="py-12 text-center text-sm text-slate-500">
                  Получатели ещё не добавлены
                </div>
                <div v-else class="divide-y divide-slate-200">
                  <div v-for="recipient in notificationRecipients" :key="String(recipient.id)" class="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div class="font-medium text-slate-900">{{ recipient.display_name || `@${recipient.telegram_username}` }}</div>
                      <div class="mt-1 text-xs text-slate-500">{{ notificationGroupLabel(String(recipient.event_group)) }} · @{{ recipient.telegram_username }}</div>
                    </div>
                    <CrmButton variant="danger" size="sm" :disabled="notificationSaving" @click="removeNotificationRecipient(recipient)">
                      Удалить
                    </CrmButton>
                  </div>
                </div>
              </div>
            </div>

            <div class="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div class="border-b border-slate-200 px-5 py-4">
                <h3 class="font-semibold text-slate-950">Последние отправки</h3>
                <p class="mt-1 text-xs text-slate-500">Это журнал доставки, а не входящие сообщения.</p>
              </div>
              <div v-if="!notificationOutbox.length" class="py-12 text-center text-sm text-slate-500">Отправок пока нет</div>
              <div v-else class="divide-y divide-slate-200">
                <div v-for="item in notificationOutbox.slice(0, 20)" :key="String(item.id)" class="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div class="min-w-0">
                    <div class="font-medium text-slate-900">
                      {{ notificationEventLabel(String(item.event_type || "")) }}
                    </div>
                    <div class="mt-1 text-xs text-slate-500">
                      {{ notificationGroupLabel(notificationOutboxGroup(item)) }}
                      · {{ notificationStatusLabel(String(item.status)) }}
                      · попыток: {{ Number(item.attempts || 0) }}
                      · {{ formatDateTime(String(item.created_at || "")) }}
                    </div>
                    <div class="mt-1 break-all text-xs text-slate-500">
                      Получатель: {{ notificationRecipientLabel(item) }}
                    </div>
                    <p v-if="notificationPayloadSummary(item)" class="mt-2 text-sm text-slate-700">
                      {{ notificationPayloadSummary(item) }}
                    </p>
                    <p v-if="item.status === 'failed'" class="mt-1 text-xs text-red-700">
                      Не удалось доставить уведомление. Проверьте получателя.
                    </p>
                    <p v-else-if="item.status === 'unknown'" class="mt-1 text-xs text-amber-700">
                      Telegram не подтвердил доставку. Перед повтором проверьте сообщения получателя.
                    </p>
                  </div>
                  <CrmButton v-if="item.status === 'unknown'" variant="secondary" size="sm" :disabled="notificationSaving" @click="resumeNotification(item)">
                    Разрешить повтор
                  </CrmButton>
                </div>
              </div>
            </div>
          </template>
        </section>
      </template>
    </div>

    <StaffAccessModal :open="accessOpen" @close="accessOpen = false" @success="handleAccessSuccess" />
    <StaffTasksModal
      :open="tasksManagerOpen"
      @close="tasksManagerOpen = false"
      @shift-required="handleShiftRequired"
    />

    <AdminModal
      :is-open="staffSetupOpen"
      title="Доступ руководителя"
      description="Основной пароль нужен только для этой проверки и нигде не сохраняется."
      size="md"
      :show-actions="false"
      :persistent="staffSetupSaving"
      :is-loading="staffSetupSaving"
      @close="closeStaffSetup"
      @cancel="closeStaffSetup"
    >
      <div class="mb-5 flex gap-2 border-b border-slate-200 pb-3">
        <CrmButton
          variant="filter"
          :pressed="staffSetupMode === 'bootstrap'"
          :disabled="staffSetupSaving"
          @click="selectStaffSetupMode('bootstrap')"
        >
          Первый руководитель
        </CrmButton>
        <CrmButton
          variant="filter"
          :pressed="staffSetupMode === 'recovery'"
          :disabled="staffSetupSaving"
          @click="selectStaffSetupMode('recovery')"
        >
          Восстановить ПИН
        </CrmButton>
      </div>

      <form v-if="staffSetupMode === 'bootstrap'" class="grid gap-4 sm:grid-cols-2" @submit.prevent="bootstrapManager">
        <label class="block sm:col-span-2">
          <span class="mb-1 block text-sm font-medium text-slate-700">Основной пароль CRM</span>
          <input v-model="staffSetupForm.admin_password" type="password" autocomplete="current-password" required class="min-h-[44px] w-full rounded-xl border border-slate-300 px-3" />
        </label>
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Имя</span>
          <input v-model.trim="staffSetupForm.first_name" required class="min-h-[44px] w-full rounded-xl border border-slate-300 px-3" />
        </label>
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Фамилия</span>
          <input v-model.trim="staffSetupForm.last_name" class="min-h-[44px] w-full rounded-xl border border-slate-300 px-3" />
        </label>
        <label class="block sm:col-span-2">
          <span class="mb-1 block text-sm font-medium text-slate-700">Должность</span>
          <input v-model.trim="staffSetupForm.position" class="min-h-[44px] w-full rounded-xl border border-slate-300 px-3" />
        </label>
        <label class="block sm:col-span-2">
          <span class="mb-1 block text-sm font-medium text-slate-700">Новый ПИН руководителя</span>
          <input v-model="staffSetupForm.new_pin" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" autocomplete="new-password" required class="min-h-[52px] w-full rounded-xl border border-slate-300 px-3 text-center text-xl tracking-[0.45em]" @input="sanitizeSetupPin" />
        </label>
        <label class="flex min-h-[44px] items-center gap-3 sm:col-span-2">
          <input v-model="staffSetupForm.enable_tracking" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-blue-600" />
          <span class="text-sm text-slate-700">Сразу включить общий учёт сотрудников</span>
        </label>
        <p v-if="staffSetupError" class="text-sm text-red-700 sm:col-span-2" role="alert">{{ staffSetupError }}</p>
        <div class="flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row sm:justify-end">
          <CrmButton type="button" variant="secondary" :disabled="staffSetupSaving" @click="closeStaffSetup">Отмена</CrmButton>
          <CrmButton type="submit" variant="primary" :loading="staffSetupSaving" :disabled="staffSetupForm.new_pin.length !== 4">
            Создать руководителя
          </CrmButton>
        </div>
      </form>

      <form v-else class="space-y-4" @submit.prevent="recoverManager">
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Основной пароль CRM</span>
          <input v-model="staffSetupForm.admin_password" type="password" autocomplete="current-password" required class="min-h-[44px] w-full rounded-xl border border-slate-300 px-3" />
        </label>
        <div v-if="!recoveryCandidatesLoaded" class="flex justify-end">
          <CrmButton type="button" variant="primary" :loading="staffSetupSaving" @click="loadRecoveryCandidates">
            Проверить пароль
          </CrmButton>
        </div>
        <template v-else>
          <label class="block">
            <span class="mb-1 block text-sm font-medium text-slate-700">Руководитель</span>
            <select v-model="staffSetupForm.employee_id" required class="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3">
              <option value="" disabled>Выберите руководителя</option>
              <option v-for="employee in recoveryCandidates" :key="employee.id" :value="employee.id">
                {{ employee.first_name }} {{ employee.last_name }}
              </option>
            </select>
          </label>
          <label class="block">
            <span class="mb-1 block text-sm font-medium text-slate-700">Новый ПИН</span>
            <input v-model="staffSetupForm.new_pin" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" autocomplete="new-password" required class="min-h-[52px] w-full rounded-xl border border-slate-300 px-3 text-center text-xl tracking-[0.45em]" @input="sanitizeSetupPin" />
          </label>
        </template>
        <p v-if="staffSetupError" class="text-sm text-red-700" role="alert">{{ staffSetupError }}</p>
        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <CrmButton type="button" variant="secondary" :disabled="staffSetupSaving" @click="closeStaffSetup">Отмена</CrmButton>
          <CrmButton v-if="recoveryCandidatesLoaded" type="submit" variant="primary" :loading="staffSetupSaving" :disabled="!staffSetupForm.employee_id || staffSetupForm.new_pin.length !== 4">
            Сохранить новый ПИН
          </CrmButton>
        </div>
      </form>
    </AdminModal>

    <AdminModal
      :is-open="employeeEditorOpen"
      :title="editingEmployee ? 'Изменить сотрудника' : 'Добавить сотрудника'"
      description="ПИН состоит ровно из четырёх цифр."
      size="md"
      :show-actions="false"
      :persistent="formSaving || avatarUploading"
      :is-loading="formSaving || avatarUploading"
      @close="closeEmployeeEditor"
      @cancel="closeEmployeeEditor"
    >
      <form class="grid gap-4 sm:grid-cols-2" @submit.prevent="saveEmployee">
        <div class="flex items-center gap-4 sm:col-span-2">
          <img
            v-if="employeeForm.avatar_url"
            :src="employeeForm.avatar_url"
            alt="Фото сотрудника"
            class="h-16 w-16 rounded-full object-cover ring-1 ring-slate-200"
          />
          <div
            v-else
            class="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold text-slate-500"
            aria-label="Фото не загружено"
          >
            {{ employeeForm.first_name.slice(0, 1) || "?" }}
          </div>
          <div class="min-w-0 flex-1">
            <label class="inline-flex min-h-[44px] cursor-pointer items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              {{ avatarUploading ? "Загружаем…" : "Загрузить фото" }}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                class="sr-only"
                :disabled="avatarUploading || formSaving"
                @change="uploadEmployeeAvatar"
              />
            </label>
            <p v-if="avatarError" class="mt-1 text-xs text-red-700" role="alert">{{ avatarError }}</p>
            <p v-else class="mt-1 text-xs text-slate-500">JPG, PNG или WebP.</p>
          </div>
        </div>
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Имя</span>
          <input v-model.trim="employeeForm.first_name" required class="min-h-[44px] w-full rounded-xl border border-slate-300 px-3" />
        </label>
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Фамилия</span>
          <input v-model.trim="employeeForm.last_name" required class="min-h-[44px] w-full rounded-xl border border-slate-300 px-3" />
        </label>
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Должность</span>
          <input v-model.trim="employeeForm.position" class="min-h-[44px] w-full rounded-xl border border-slate-300 px-3" />
        </label>
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Роль</span>
          <select v-model="employeeForm.role" class="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3">
            <option value="employee">Сотрудник</option>
            <option value="manager">Руководитель</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Цвет метки</span>
          <input v-model="employeeForm.color" type="color" class="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white p-1" />
        </label>
        <label v-if="!editingEmployee" class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">ПИН</span>
          <input
            v-model="employeeForm.pin"
            type="password"
            inputmode="numeric"
            maxlength="4"
            pattern="[0-9]{4}"
            autocomplete="new-password"
            required
            class="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-center tracking-[0.4em]"
            @input="sanitizeEmployeePin"
          />
        </label>
        <label class="block sm:col-span-2">
          <span class="mb-1 block text-sm font-medium text-slate-700">Зона ответственности</span>
          <textarea v-model.trim="employeeForm.responsibilities" rows="4" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <p v-if="formError" class="sm:col-span-2 text-sm text-red-700" role="alert">{{ formError }}</p>
        <div class="flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row sm:justify-end">
          <CrmButton variant="secondary" type="button" :disabled="formSaving || avatarUploading" @click="closeEmployeeEditor">Отмена</CrmButton>
          <CrmButton variant="primary" type="submit" :loading="formSaving" :disabled="avatarUploading">
            {{ editingEmployee ? "Сохранить изменения" : "Добавить сотрудника" }}
          </CrmButton>
        </div>
      </form>
    </AdminModal>

    <AdminModal
      :is-open="pinResetOpen"
      title="Сбросить ПИН"
      :description="pinResetEmployee ? `${pinResetEmployee.first_name} ${pinResetEmployee.last_name}` : ''"
      size="sm"
      :show-actions="false"
      :persistent="formSaving"
      :is-loading="formSaving"
      @close="closePinReset"
      @cancel="closePinReset"
    >
      <form class="space-y-4" @submit.prevent="savePinReset">
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Новый ПИН</span>
          <input v-model="newPin" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" autocomplete="new-password" required class="min-h-[52px] w-full rounded-xl border border-slate-300 px-3 text-center text-xl tracking-[0.45em]" @input="sanitizeResetPin" />
        </label>
        <p v-if="formError" class="text-sm text-red-700" role="alert">{{ formError }}</p>
        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <CrmButton variant="secondary" type="button" :disabled="formSaving" @click="closePinReset">Отмена</CrmButton>
          <CrmButton variant="primary" type="submit" :loading="formSaving" :disabled="newPin.length !== 4">Сохранить новый ПИН</CrmButton>
        </div>
      </form>
    </AdminModal>

    <AdminModal
      :is-open="salaryEditorOpen"
      title="Ожидаемая зарплата"
      description="Сумма задаётся вручную, сразу видна сотруднику и не означает факт выплаты."
      size="sm"
      :show-actions="false"
      :persistent="formSaving"
      :is-loading="formSaving"
      @close="closeSalaryEditor"
      @cancel="closeSalaryEditor"
    >
      <form class="space-y-4" @submit.prevent="saveSalary">
        <dl class="space-y-1 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <div class="flex items-start justify-between gap-4">
            <dt class="text-blue-700">Период</dt>
            <dd class="text-right font-semibold">{{ formatMonthLabel(selectedMonth) }}</dd>
          </div>
          <div class="flex items-start justify-between gap-4">
            <dt class="text-blue-700">Текущая сумма</dt>
            <dd class="text-right font-semibold">
              {{ salaryContextRecord ? formatMoney(salaryContextAmount) : "Не указана" }}
            </dd>
          </div>
        </dl>
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Сотрудник</span>
          <select v-model="salaryForm.employee_id" required class="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3">
            <option value="" disabled>Выберите сотрудника</option>
            <option v-for="employee in staffEmployees" :key="employee.id" :value="employee.id">{{ employee.first_name }} {{ employee.last_name }}</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Ожидаемая зарплата, BYN</span>
          <input v-model.number="salaryForm.final_amount" type="number" inputmode="decimal" min="0" step="0.01" required class="min-h-[44px] w-full rounded-xl border border-slate-300 px-3" />
        </label>
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Комментарий</span>
          <textarea v-model.trim="salaryForm.note" rows="3" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <p v-if="formError" class="text-sm text-red-700" role="alert">{{ formError }}</p>
        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <CrmButton variant="secondary" type="button" :disabled="formSaving" @click="closeSalaryEditor">Отмена</CrmButton>
          <CrmButton variant="primary" type="submit" :loading="formSaving">Сохранить сумму</CrmButton>
        </div>
      </form>
    </AdminModal>

    <AdminModal
      :is-open="markEditorOpen"
      :title="editingMark ? 'Изменить отметку' : 'Добавить отметку'"
      description="Отметка будет видна сотруднику вместе с пояснением."
      size="sm"
      :show-actions="false"
      :persistent="formSaving"
      :is-loading="formSaving"
      @close="closeMarkEditor"
      @cancel="closeMarkEditor"
    >
      <form class="space-y-4" @submit.prevent="saveMark">
        <dl class="space-y-1 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <div class="flex items-start justify-between gap-4">
            <dt class="text-blue-700">Сотрудник</dt>
            <dd class="text-right font-semibold">{{ selectedEmployeeLabel }}</dd>
          </div>
          <div v-if="editingMark" class="flex items-start justify-between gap-4">
            <dt class="text-blue-700">Текущая отметка</dt>
            <dd class="max-w-[65%] text-right font-semibold">
              {{ markKindLabel(editingMark.kind) }} · {{ editingMark.title }}
            </dd>
          </div>
        </dl>
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Тип</span>
          <select v-model="markForm.kind" class="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3">
            <option value="positive">Положительная</option>
            <option value="negative">Отрицательная</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Короткое название</span>
          <input v-model.trim="markForm.title" required class="min-h-[44px] w-full rounded-xl border border-slate-300 px-3" />
        </label>
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Пояснение</span>
          <textarea v-model.trim="markForm.description" rows="4" required class="w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Дата</span>
          <input v-model="markForm.occurred_at" type="datetime-local" required class="min-h-[44px] w-full rounded-xl border border-slate-300 px-3" />
        </label>
        <p v-if="formError" class="text-sm text-red-700" role="alert">{{ formError }}</p>
        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <CrmButton variant="secondary" type="button" :disabled="formSaving" @click="closeMarkEditor">Отмена</CrmButton>
          <CrmButton variant="primary" type="submit" :loading="formSaving">
            {{ editingMark ? "Сохранить изменения" : "Добавить отметку" }}
          </CrmButton>
        </div>
      </form>
    </AdminModal>

    <AdminModal
      :is-open="voidMarkOpen"
      title="Аннулировать отметку"
      description="Запись останется в истории, рядом будет указана причина."
      size="sm"
      :show-actions="false"
      :persistent="formSaving"
      :is-loading="formSaving"
      @close="voidMarkOpen = false"
      @cancel="voidMarkOpen = false"
    >
      <form class="space-y-4" @submit.prevent="voidMark">
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Причина</span>
          <textarea v-model.trim="voidReason" rows="4" required class="w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <p v-if="formError" class="text-sm text-red-700" role="alert">{{ formError }}</p>
        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <CrmButton variant="secondary" type="button" :disabled="formSaving" @click="voidMarkOpen = false">Отмена</CrmButton>
          <CrmButton variant="danger" type="submit" :loading="formSaving">Аннулировать отметку</CrmButton>
        </div>
      </form>
    </AdminModal>

    <AdminModal
      :is-open="historyOpen"
      :title="historyTitle"
      description="Версии сохраняются сервером и не перезаписываются."
      size="md"
      :show-actions="false"
      @close="historyOpen = false"
      @cancel="historyOpen = false"
    >
      <div v-if="historyLoading" class="py-12 text-center text-sm text-slate-500">
        Загружаем историю…
      </div>
      <div v-else-if="historyError" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
        {{ historyError }}
      </div>
      <div v-else-if="!historyVersions.length" class="py-12 text-center text-sm text-slate-500">
        Версий пока нет
      </div>
      <div v-else class="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
        <article
          v-for="version in historyVersions"
          :key="version.id || version.version"
          class="rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <strong class="text-sm text-slate-950">Версия {{ version.version }}</strong>
            <time class="text-xs text-slate-500">{{ formatDateTime(version.created_at || "") }}</time>
          </div>
          <p class="mt-2 text-sm font-medium text-slate-800">{{ historyVersionSummary(version) }}</p>
          <p v-if="version.description || version.note" class="mt-1 whitespace-pre-line text-sm text-slate-600">
            {{ version.description || version.note }}
          </p>
          <p class="mt-2 text-xs text-slate-500">
            {{ version.changed_by_name_snapshot || "Система" }}
            <template v-if="version.reason"> · Причина: {{ version.reason }}</template>
          </p>
        </article>
      </div>
    </AdminModal>

    <AdminModal
      :is-open="shiftCorrectionOpen"
      :title="editingShift && shiftActive(editingShift) ? 'Принудительно закрыть смену' : 'Исправить смену'"
      description="Причина обязательна и сохраняется в истории."
      size="sm"
      :show-actions="false"
      :persistent="formSaving"
      :is-loading="formSaving"
      @close="shiftCorrectionOpen = false"
      @cancel="shiftCorrectionOpen = false"
    >
      <form class="space-y-4" @submit.prevent="saveShiftCorrection">
        <dl
          v-if="editingShift"
          class="space-y-1 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950"
        >
          <div class="flex items-start justify-between gap-4">
            <dt class="text-blue-700">Сотрудник</dt>
            <dd class="text-right font-semibold">{{ shiftEmployeeLabel(editingShift) }}</dd>
          </div>
          <div class="flex items-start justify-between gap-4">
            <dt class="text-blue-700">Текущее время</dt>
            <dd class="max-w-[68%] text-right font-semibold">
              {{ formatDateTime(shiftStart(editingShift)) }} →
              {{ shiftEnd(editingShift) ? formatDateTime(shiftEnd(editingShift)!) : "сейчас" }}
            </dd>
          </div>
        </dl>
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Начало</span>
          <input v-model="shiftCorrectionForm.started_at" type="datetime-local" required class="min-h-[44px] w-full rounded-xl border border-slate-300 px-3" />
        </label>
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Окончание</span>
          <input v-model="shiftCorrectionForm.ended_at" type="datetime-local" required class="min-h-[44px] w-full rounded-xl border border-slate-300 px-3" />
        </label>
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Причина</span>
          <textarea v-model.trim="shiftCorrectionForm.reason" rows="4" required class="w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <p v-if="formError" class="text-sm text-red-700" role="alert">{{ formError }}</p>
        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <CrmButton variant="secondary" type="button" :disabled="formSaving" @click="shiftCorrectionOpen = false">Отмена</CrmButton>
          <CrmButton variant="primary" type="submit" :loading="formSaving">Сохранить исправление</CrmButton>
        </div>
      </form>
    </AdminModal>

    <AdminModal
      :is-open="Boolean(confirmationAction)"
      :title="confirmationAction?.title || 'Подтвердить действие'"
      :description="confirmationAction?.description || ''"
      size="sm"
      :show-actions="false"
      :persistent="confirmationSaving"
      :is-loading="confirmationSaving"
      @close="closeConfirmation"
      @cancel="closeConfirmation"
    >
      <div class="space-y-4">
        <div
          v-if="confirmationAction?.context"
          class="whitespace-pre-line rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800"
        >
          {{ confirmationAction.context }}
        </div>
        <label v-if="confirmationAction?.requireReason" class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">
            {{ confirmationAction.reasonLabel || "Причина" }}
          </span>
          <textarea
            v-model.trim="confirmationReason"
            rows="4"
            required
            class="w-full rounded-xl border border-slate-300 px-3 py-2"
          />
        </label>
        <label v-if="confirmationAction?.requirePin" class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">
            {{ confirmationAction.pinLabel || "Новый ПИН сотрудника" }}
          </span>
          <input
            v-model="confirmationPin"
            type="password"
            inputmode="numeric"
            autocomplete="new-password"
            maxlength="4"
            placeholder="4 цифры"
            aria-label="Новый ПИН сотрудника"
            class="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 tracking-[0.35em]"
            @input="sanitizeConfirmationPin"
          />
        </label>
        <label v-if="confirmationAction?.requireAdminPassword" class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">
            Основной пароль CRM
          </span>
          <input
            v-model="confirmationAdminPassword"
            type="password"
            autocomplete="current-password"
            aria-label="Основной пароль CRM"
            class="min-h-[44px] w-full rounded-xl border border-slate-300 px-3"
          />
        </label>
        <p v-if="confirmationError" class="text-sm text-red-700" role="alert">
          {{ confirmationError }}
        </p>
        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <CrmButton
            variant="secondary"
            type="button"
            :disabled="confirmationSaving"
            @click="closeConfirmation"
          >
            Отмена
          </CrmButton>
          <CrmButton
            :variant="confirmationAction?.variant || 'primary'"
            type="button"
            :loading="confirmationSaving"
            :disabled="
              (Boolean(confirmationAction?.requireReason) && !confirmationReason) ||
              (Boolean(confirmationAction?.requirePin) && !/^\d{4}$/.test(confirmationPin)) ||
              (Boolean(confirmationAction?.requireAdminPassword) && !confirmationAdminPassword)
            "
            @click="confirmRequestedAction"
          >
            {{ confirmationAction?.confirmLabel || "Подтвердить" }}
          </CrmButton>
        </div>
      </div>
    </AdminModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { LockClosedIcon } from "@heroicons/vue/24/outline";
import AdminModal from "@/components/AdminModal.vue";
import CrmButton from "@/components/admin/crm/CrmButton.vue";
import StaffAccessModal from "@/components/admin/staff/StaffAccessModal.vue";
import StaffShiftBar from "@/components/admin/staff/StaffShiftBar.vue";
import StaffTasksModal from "@/components/admin/staff/StaffTasksModal.vue";
import {
  useCrmStore,
  type Employee,
  type StaffAnalytics,
  type StaffHistoryVersion,
  type StaffMark,
  type StaffSalary,
  type StaffShift,
} from "@/stores/crm";
import { useAdminStore } from "@/stores/admin";
import { formatBynCurrency } from "@/utils/currency";
import {
  BUSINESS_TIME_ZONE,
  businessDateTimeInputToIso,
  formatBusinessDateTimeInput,
  getBusinessDateParts,
  getBusinessMonthValue,
} from "@/utils/businessTime";

type ManagerTab =
  | "card"
  | "team"
  | "salaries"
  | "marks"
  | "shifts"
  | "settings"
  | "notifications";
type ShiftBarExpose = {
  requestShiftRequired: (label: string, retry: () => unknown | Promise<unknown>) => Promise<void>;
};

const crmStore = useCrmStore();
const adminStore = useAdminStore();
const {
  hasStaffAccess,
  staffIdentity,
  isStaffManager,
  staffEmployees,
  staffEmployeesLoading,
  staffEmployeesError,
  staffAnalytics,
  staffAnalyticsLoading,
  staffAnalyticsError,
  staffTeamAnalytics,
  staffTeamAnalyticsLoading,
  staffTeamAnalyticsError,
  staffSalaries,
  staffSalariesLoading,
  staffSalariesError,
  staffMarks,
  staffMarksLoading,
  staffMarksError,
  staffShiftHistory,
  staffShiftHistoryLoading,
  staffShiftHistoryError,
  currentStaffShift,
  staffNotifications,
  staffNotificationsLoading,
  staffNotificationsError,
  staffTrackingEnabled,
  staffOrderShiftRestrictionEnabled,
  staffSettingsLoading,
  staffSettingsError,
} = storeToRefs(crmStore);

const managerTabs: Array<{ id: ManagerTab; label: string }> = [
  { id: "card", label: "Карточка" },
  { id: "team", label: "Команда" },
  { id: "salaries", label: "Зарплаты" },
  { id: "marks", label: "Отметки" },
  { id: "shifts", label: "Смены" },
  { id: "settings", label: "Настройки" },
  { id: "notifications", label: "Уведомления" },
];
const activeTab = ref<ManagerTab>("card");
const accessOpen = ref(false);
const tasksManagerOpen = ref(false);
const shiftBarRef = ref<ShiftBarExpose | null>(null);
const selectedPeriod = ref<"day" | "month" | "year" | "custom">("month");
const selectedMonth = ref(currentMonth());
const selectedDay = ref(currentBusinessDay());
const selectedYear = ref(String(getBusinessDateParts().year));
const customPeriodFrom = ref(currentBusinessDay());
const customPeriodTo = ref(currentBusinessDay());
const selectedEmployeeId = ref("");
const marksEmployeeId = ref("");
const shiftsEmployeeId = ref("");
let syncedStaffAccessKey = "";
const employeeSearch = ref("");
const employeeStatusFilter = ref<"active" | "inactive" | "all">("active");
const cardEmployeeSearch = ref("");
const cardEmployeeStatusFilter = ref<"active" | "inactive" | "all">("all");
const teamSort = ref<"shift" | "hours" | "issued" | "tasks" | "name">("shift");
const teamChartMetric = ref<"hours" | "issued" | "tasks">("hours");
const activityMetric = ref<"actions" | "hours" | "issued" | "tasks">("actions");
type TimelineFilter = "all" | "orders" | "warehouse" | "tasks" | "marks";
const timelineFilter = ref<TimelineFilter>("all");
const timelinePageSize = 12;
const timelineLimit = ref(timelinePageSize);
const shiftHistoryPageSize = 20;
const shiftHistoryLimit = ref(shiftHistoryPageSize);
const pageMessage = ref("");
const pageMessageKind = ref<"info" | "error">("info");
const periodError = ref("");
const formError = ref("");
const formSaving = ref(false);
const avatarUploading = ref(false);
const avatarError = ref("");
const staffSetupOpen = ref(false);
const staffSetupMode = ref<"bootstrap" | "recovery">("bootstrap");
const staffSetupSaving = ref(false);
const staffSetupError = ref("");
const recoveryCandidates = ref<Employee[]>([]);
const recoveryCandidatesLoaded = ref(false);
const staffSetupForm = reactive({
  admin_password: "",
  first_name: "",
  last_name: "",
  position: "",
  employee_id: "",
  new_pin: "",
  enable_tracking: true,
});

const employeeEditorOpen = ref(false);
const editingEmployee = ref<Employee | null>(null);
const employeeForm = reactive({
  first_name: "",
  last_name: "",
  position: "",
  responsibilities: "",
  color: "#2563eb",
  avatar_url: "",
  role: "employee" as "employee" | "manager",
  pin: "",
});
const pinResetOpen = ref(false);
const pinResetEmployee = ref<Employee | null>(null);
const newPin = ref("");
const salaryEditorOpen = ref(false);
const salaryForm = reactive({
  employee_id: "",
  final_amount: 0,
  note: "",
});
const historyOpen = ref(false);
const historyLoading = ref(false);
const historyError = ref("");
const historyTitle = ref("История");
const historyKind = ref<"salary" | "mark">("mark");
const historyVersions = ref<StaffHistoryVersion[]>([]);
let historyRequestSequence = 0;
const markEditorOpen = ref(false);
const editingMark = ref<StaffMark | null>(null);
const markForm = reactive({
  kind: "positive" as "positive" | "negative",
  title: "",
  description: "",
  occurred_at: formatBusinessDateTimeInput(new Date()),
});
const voidMarkOpen = ref(false);
const voidingMark = ref<StaffMark | null>(null);
const voidReason = ref("");
const shiftCorrectionOpen = ref(false);
const editingShift = ref<StaffShift | null>(null);
const shiftCorrectionForm = reactive({ started_at: "", ended_at: "", reason: "" });
const notificationSaving = ref(false);
const notificationFormError = ref("");
const notificationSettingError = ref("");
const recipientForm = reactive({ event_group: "documents", username: "" });
const resolvedRecipient = ref<{
  telegram_id: string;
  telegram_username: string;
  display_name: string;
} | null>(null);

type ConfirmationVariant = "primary" | "danger" | "success";
type ConfirmationAction = {
  title: string;
  description: string;
  context?: string;
  confirmLabel: string;
  variant?: ConfirmationVariant;
  requireReason?: boolean;
  reasonLabel?: string;
  requirePin?: boolean;
  pinLabel?: string;
  requireAdminPassword?: boolean;
  run: (
    reason: string,
    pin: string,
    adminPassword: string,
  ) => Promise<void>;
};
const confirmationAction = ref<ConfirmationAction | null>(null);
const confirmationReason = ref("");
const confirmationPin = ref("");
const confirmationAdminPassword = ref("");
const confirmationSaving = ref(false);
const confirmationError = ref("");

const pageLoading = computed(
  () =>
    staffEmployeesLoading.value ||
    staffAnalyticsLoading.value ||
    staffTeamAnalyticsLoading.value ||
    staffSalariesLoading.value ||
    staffMarksLoading.value ||
    staffShiftHistoryLoading.value ||
    staffNotificationsLoading.value ||
    staffSettingsLoading.value,
);
const selectedEmployee = computed(() => {
  if (!isStaffManager.value) return staffIdentity.value?.employee || null;
  return (
    staffEmployees.value.find((employee) => employee.id === selectedEmployeeId.value) ||
    null
  );
});
const filteredEmployees = computed(() => {
  const query = employeeSearch.value.trim().toLocaleLowerCase("ru");
  return staffEmployees.value.filter((employee) => {
    const matchesStatus =
      employeeStatusFilter.value === "all" ||
      (employeeStatusFilter.value === "active"
        ? employeeActive(employee)
        : !employeeActive(employee));
    if (!matchesStatus) return false;
    if (!query) return true;
    return `${employee.first_name} ${employee.last_name} ${employee.position || ""}`
      .toLocaleLowerCase("ru")
      .includes(query);
  });
});
const cardEmployees = computed(() => {
  const query = cardEmployeeSearch.value.trim().toLocaleLowerCase("ru");
  return staffEmployees.value.filter((employee) => {
    const matchesStatus =
      cardEmployeeStatusFilter.value === "all" ||
      (cardEmployeeStatusFilter.value === "active"
        ? employeeActive(employee)
        : !employeeActive(employee));
    if (!matchesStatus) return false;
    if (!query) return true;
    return `${employee.first_name} ${employee.last_name} ${employee.position || ""}`
      .toLocaleLowerCase("ru")
      .includes(query);
  });
});
const teamEmployees = computed(() => {
  const rows = [...filteredEmployees.value];
  const name = (employee: Employee) =>
    `${employee.first_name} ${employee.last_name}`.trim();
  const metric = (employee: Employee) => {
    const summary = teamSummary(employee);
    if (teamSort.value === "hours") return Number(summary.worked_minutes || 0);
    if (teamSort.value === "issued") return Number(summary.orders_issued || 0);
    if (teamSort.value === "tasks") return Number(summary.tasks_completed || 0);
    return 0;
  };
  return rows.sort((left, right) => {
    if (teamSort.value === "shift") {
      const shiftDelta =
        Number(employeeShiftOpen(right)) - Number(employeeShiftOpen(left));
      if (shiftDelta) return shiftDelta;
      const hoursDelta =
        Number(teamSummary(right).worked_minutes || 0) -
        Number(teamSummary(left).worked_minutes || 0);
      if (hoursDelta) return hoursDelta;
    } else if (teamSort.value !== "name") {
      const delta = metric(right) - metric(left);
      if (delta) return delta;
    }
    return name(left).localeCompare(name(right), "ru");
  });
});
const teamAnalyticsByEmployee = computed(
  () =>
    new Map(
      staffTeamAnalytics.value
        .filter((analytics) => analytics.employee?.id)
        .map((analytics) => [analytics.employee!.id, analytics]),
    ),
);
const analyticsSummary = computed<Record<string, any>>(
  () => ((staffAnalytics.value as any)?.summary || staffAnalytics.value || {}),
);
type MetricItem = { label: string; value: string | number };
const headlineMetrics = computed<MetricItem[]>(() => [
  { label: "Отработано", value: formatMinutes(Number(analyticsSummary.value.worked_minutes || 0)) },
  { label: "Смен", value: Number(analyticsSummary.value.shifts_count || 0) },
  { label: "Задач", value: Number(analyticsSummary.value.tasks_completed || 0) },
  { label: "Выдано", value: Number(analyticsSummary.value.orders_issued || 0) },
]);
const metricGroups = computed<Array<{
  title: string;
  metrics: MetricItem[];
  hint?: string;
}>>(() => [
  {
    title: "Заказы",
    metrics: [
      { label: "Собрано", value: Number(analyticsSummary.value.orders_assembled || 0) },
      { label: "Выдано", value: Number(analyticsSummary.value.orders_issued || 0) },
      {
        label: "Выручка",
        value: formatMoney(Number(analyticsSummary.value.orders_amount || 0)),
      },
      {
        label: "Прибыль",
        value: formatMoney(Number(analyticsSummary.value.issued_profit || 0)),
      },
    ],
  },
  {
    title: "Склад",
    metrics: [
      {
        label: "Поставки создано",
        value: Number(analyticsSummary.value.procurements_created || 0),
      },
      {
        label: "Поставки принято",
        value: Number(analyticsSummary.value.procurements_completed || 0),
      },
      {
        label: "Перемещения создано",
        value: Number(analyticsSummary.value.transfers_created || 0),
      },
      {
        label: "Перемещения принято",
        value: Number(analyticsSummary.value.transfers_completed || 0),
      },
    ],
  },
  {
    title: "Отметки",
    metrics: [
      {
        label: "Положительные",
        value: Number(analyticsSummary.value.mark_counts?.positive || 0),
      },
      {
        label: "Отрицательные",
        value: Number(analyticsSummary.value.mark_counts?.negative || 0),
      },
    ],
  },
  {
    title: "Ожидаемая зарплата",
    metrics: [
      {
        label: "За месяц",
        value:
          analyticsSummary.value.estimated_salary == null
            ? "Не указана"
            : formatMoney(Number(analyticsSummary.value.estimated_salary)),
      },
    ],
    hint: "Задаётся руководителем вручную и не означает факт выплаты.",
  },
]);
type ActivityDay = {
  date: string;
  count?: number;
  worked_minutes?: number;
  events?: Record<string, number>;
};
type ActivityChartPoint = {
  key: string;
  label: string;
  shortLabel: string;
  value: number;
};
const activityMetricOptions = [
  { value: "actions" as const, label: "Действия" },
  { value: "hours" as const, label: "Часы" },
  { value: "issued" as const, label: "Выдано" },
  { value: "tasks" as const, label: "Задачи" },
];
const timelineFilterOptions: Array<{
  value: TimelineFilter;
  label: string;
}> = [
  { value: "all", label: "Все типы" },
  { value: "orders", label: "Заказы" },
  { value: "warehouse", label: "Склад" },
  { value: "tasks", label: "Задачи" },
  { value: "marks", label: "Отметки" },
];
const dailyActivity = computed<ActivityDay[]>(
  () => (
    ((staffAnalytics.value as any)?.daily_activity ||
      (staffAnalytics.value as any)?.days ||
      []) as ActivityDay[]
  ).map((day) => ({
    ...day,
    date: String(day.date || "").slice(0, 10),
  })),
);
const filledDailyActivity = computed<ActivityDay[]>(() => {
  const [start, end] = activityDateBounds();
  if (!start || !end) return [];
  const source = new Map(dailyActivity.value.map((day) => [day.date, day]));
  const result: ActivityDay[] = [];
  const cursor = new Date(`${start}T12:00:00Z`);
  const limit = new Date(`${end}T12:00:00Z`);
  while (cursor <= limit && result.length < 367) {
    const date = cursor.toISOString().slice(0, 10);
    result.push(
      source.get(date) || {
        date,
        count: 0,
        worked_minutes: 0,
        events: {},
      },
    );
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
});
const activityChartGranularity = computed<"day" | "month">(() =>
  filledDailyActivity.value.length > 62 ? "month" : "day",
);
const activityChartPoints = computed<ActivityChartPoint[]>(() => {
  if (activityChartGranularity.value === "day") {
    return filledDailyActivity.value.map((day) => ({
      key: day.date,
      label: formatDay(day.date),
      shortLabel: String(Number(day.date.slice(8, 10))),
      value: activityValue(day),
    }));
  }
  const buckets = new Map<string, number>();
  for (const day of filledDailyActivity.value) {
    const month = day.date.slice(0, 7);
    buckets.set(month, Number(buckets.get(month) || 0) + activityValue(day));
  }
  return [...buckets].map(([month, value]) => ({
    key: month,
    label: formatMonthLabel(month),
    shortLabel: formatMonthShort(month),
    value,
  }));
});
const timelineItems = computed(() => {
  const activities = (
    ((staffAnalytics.value as any)?.activities ||
      (staffAnalytics.value as any)?.events ||
      []) as Array<Record<string, any>>
  ).map((item) => ({
    key: `activity:${item.id}`,
    type: "activity" as const,
    eventType: String(item.type || item.event_type || ""),
    title: item.title || item.type || "Действие",
    description: item.description || "",
    at: item.occurred_at || item.created_at,
    manual: item.source === "manual",
    kind: item.tone,
    voided: false,
    voidReason: "",
  }));
  const marks = staffMarks.value.map((mark) => ({
    key: `mark:${mark.id}`,
    type: "mark" as const,
    eventType: "manual_mark",
    title: mark.title,
    description: mark.description || "",
    at: mark.occurred_at,
    manual: true,
    kind: mark.kind,
    voided: Boolean(mark.voided_at),
    voidReason: mark.void_reason || "",
  }));
  return [...activities, ...marks].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
});
const filteredTimelineItems = computed(() => {
  if (timelineFilter.value === "all") return timelineItems.value;
  return timelineItems.value.filter((item) => {
    if (timelineFilter.value === "marks") return item.type === "mark";
    if (item.type !== "activity") return false;
    if (timelineFilter.value === "orders") {
      return item.eventType.startsWith("order");
    }
    if (timelineFilter.value === "warehouse") {
      return (
        item.eventType.startsWith("procurement") ||
        item.eventType.startsWith("transfer")
      );
    }
    return item.eventType.startsWith("task");
  });
});
const visibleTimelineItems = computed(() =>
  filteredTimelineItems.value.slice(0, timelineLimit.value),
);
const timelineRemaining = computed(() =>
  Math.max(0, filteredTimelineItems.value.length - timelineLimit.value),
);
type SalaryRow = StaffSalary & { missing?: boolean };
const salaryRows = computed<SalaryRow[]>(() => {
  const saved = new Map(
    staffSalaries.value.map((salary) => [salary.employee_id, salary]),
  );
  const activeRows = staffEmployees.value
    .filter(employeeActive)
    .map((employee) =>
      saved.get(employee.id) || {
        employee_id: employee.id,
        employee_name: `${employee.first_name} ${employee.last_name}`.trim(),
        month: selectedMonth.value,
        missing: true,
      },
    );
  const activeIds = new Set(activeRows.map((salary) => salary.employee_id));
  return [
    ...activeRows,
    ...staffSalaries.value.filter(
      (salary) => !activeIds.has(salary.employee_id),
    ),
  ];
});
const salaryAssignedCount = computed(
  () => salaryRows.value.filter((salary) => Boolean(salary.id)).length,
);
const salaryExpectedTotal = computed(() =>
  salaryRows.value.reduce(
    (sum, salary) => sum + (salary.id ? salaryAmount(salary) : 0),
    0,
  ),
);
const teamHeadlineMetrics = computed<MetricItem[]>(() => {
  const summaries = teamEmployees.value.map(teamSummary);
  return [
    {
      label: "Сейчас на смене",
      value: teamEmployees.value.filter(employeeShiftOpen).length,
    },
    {
      label: "Отработано",
      value: formatMinutes(
        summaries.reduce(
          (sum, summary) => sum + Number(summary.worked_minutes || 0),
          0,
        ),
      ),
    },
    {
      label: "Выдано",
      value: summaries.reduce(
        (sum, summary) => sum + Number(summary.orders_issued || 0),
        0,
      ),
    },
    {
      label: "Задач",
      value: summaries.reduce(
        (sum, summary) => sum + Number(summary.tasks_completed || 0),
        0,
      ),
    },
    {
      label: "Выручка",
      value: formatMoney(
        summaries.reduce(
          (sum, summary) => sum + Number(summary.orders_amount || 0),
          0,
        ),
      ),
    },
  ];
});
const teamComparisonRows = computed(() => {
  const rows = teamEmployees.value.map((employee) => {
    const summary = teamSummary(employee);
    const value =
      teamChartMetric.value === "hours"
        ? Number(summary.worked_minutes || 0) / 60
        : teamChartMetric.value === "issued"
          ? Number(summary.orders_issued || 0)
          : Number(summary.tasks_completed || 0);
    return {
      id: employee.id,
      name: `${employee.first_name} ${employee.last_name}`.trim(),
      value,
    };
  }).sort((left, right) => right.value - left.value);
  const max = Math.max(1, ...rows.map((row) => row.value));
  return rows.map((row) => ({
    ...row,
    percent: row.value > 0 ? Math.max(3, Math.round((row.value / max) * 100)) : 0,
    label:
      teamChartMetric.value === "hours"
        ? `${formatDecimal(row.value)} ч`
        : String(row.value),
  }));
});
const teamChartAriaLabel = computed(
  () =>
    `Сравнение команды: ${teamComparisonRows.value
      .map((row) => `${row.name} — ${row.label}`)
      .join("; ")}`,
);
const activeStaffCount = computed(
  () => staffEmployees.value.filter(employeeActive).length,
);
const pinReadyStaffCount = computed(
  () =>
    staffEmployees.value.filter(
      (employee) => employeeActive(employee) && employee.pin_configured,
    ).length,
);
const orderRestrictionReady = computed(
  () =>
    activeStaffCount.value > 0 &&
    pinReadyStaffCount.value === activeStaffCount.value,
);
const currentShiftReadinessLabel = computed(() => {
  const shift = currentStaffShift.value;
  if (
    !shift ||
    !["active", "open"].includes(String(shift.status || "")) ||
    shift.ended_at ||
    shift.closed_at
  ) {
    return "Смена сейчас не открыта";
  }
  return `Текущая смена: ${shift.employee_name || shift.employee?.first_name || "сотрудник"}`;
});
type ShiftCalendarCell = {
  key: string;
  empty: boolean;
  day: number;
  label: string;
  minutes: number;
  count: number;
  active: boolean;
  corrected: boolean;
};
const shiftOverviewMetrics = computed<MetricItem[]>(() => {
  const minutes = staffShiftHistory.value.reduce(
    (sum, shift) => sum + shiftDurationMinutes(shift),
    0,
  );
  return [
    { label: "Смен", value: staffShiftHistory.value.length },
    { label: "Отработано", value: formatMinutes(minutes) },
    {
      label: "Исправлено",
      value: staffShiftHistory.value.filter(
        (shift) => Boolean(shift.corrected_at || shift.correction_reason),
      ).length,
    },
  ];
});
const visibleShiftHistory = computed(() =>
  staffShiftHistory.value.slice(0, shiftHistoryLimit.value),
);
const shiftHistoryRemaining = computed(() =>
  Math.max(0, staffShiftHistory.value.length - shiftHistoryLimit.value),
);
const shiftCalendarCells = computed<ShiftCalendarCell[]>(() => {
  const match = /^(\d{4})-(\d{2})$/.exec(selectedMonth.value);
  if (!match) return [];
  const year = Number(match[1]);
  const month = Number(match[2]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const byDate = new Map<string, Omit<ShiftCalendarCell, "key" | "empty" | "day" | "label">>();
  for (const shift of staffShiftHistory.value) {
    const date =
      shift.business_date ||
      getBusinessDateKey(shiftStart(shift));
    if (!date?.startsWith(selectedMonth.value)) continue;
    const existing = byDate.get(date) || {
      minutes: 0,
      count: 0,
      active: false,
      corrected: false,
    };
    existing.minutes += shiftDurationMinutes(shift);
    existing.count += 1;
    existing.active ||= shiftActive(shift);
    existing.corrected ||=
      Boolean(shift.corrected_at || shift.correction_reason);
    byDate.set(date, existing);
  }
  const cells: ShiftCalendarCell[] = Array.from(
    { length: firstWeekday },
    (_, index) => ({
      key: `empty-${index}`,
      empty: true,
      day: 0,
      label: "",
      minutes: 0,
      count: 0,
      active: false,
      corrected: false,
    }),
  );
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${selectedMonth.value}-${String(day).padStart(2, "0")}`;
    const summary = byDate.get(date) || {
      minutes: 0,
      count: 0,
      active: false,
      corrected: false,
    };
    cells.push({
      key: date,
      empty: false,
      day,
      label: formatDay(date),
      ...summary,
    });
  }
  return cells;
});
const notificationSettings = computed(
  () => (staffNotifications.value?.settings || []) as Array<Record<string, any>>,
);
const notificationRecipients = computed(
  () => (staffNotifications.value?.recipients || []) as Array<Record<string, any>>,
);
const notificationOutbox = computed(
  () => (staffNotifications.value?.outbox || []) as Array<Record<string, any>>,
);
const salaryContextRecord = computed(
  () =>
    staffSalaries.value.find(
      (salary) =>
        salary.employee_id === salaryForm.employee_id &&
        salary.month === selectedMonth.value,
    ) || null,
);
const salaryContextAmount = computed(
  () =>
    Number(
      salaryContextRecord.value?.final_amount ??
        salaryContextRecord.value?.estimated_amount ??
        0,
    ),
);
const selectedEmployeeLabel = computed(() => {
  const employee = staffEmployees.value.find(
    (item) => item.id === marksEmployeeId.value,
  );
  return employee
    ? `${employee.first_name} ${employee.last_name}`.trim()
    : "Сотрудник не выбран";
});
const activityChartLabel = computed(() => {
  if (!activityChartPoints.value.length) return "Динамика работы: данных нет";
  const details = activityChartPoints.value
    .map((point) => `${point.label} — ${activityMetricValueLabel(point.value)}`)
    .join("; ");
  return `Динамика работы: ${details}`;
});

function currentMonth() {
  return getBusinessMonthValue();
}
function currentBusinessDay() {
  const { year, month, day } = getBusinessDateParts();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function safeColor(color?: string | null) {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : "#2563eb";
}
function responsibilityText(value?: string | string[] | null) {
  return Array.isArray(value) ? value.join("\n") : value || "";
}
function employeeActive(employee: Employee) {
  return Boolean(Number(employee.active));
}
function teamSummary(employee: Employee): StaffAnalytics {
  return teamAnalyticsByEmployee.value.get(employee.id) || { employee };
}
function employeeShiftOpen(employee: Employee) {
  return Boolean(
    teamSummary(employee).shifts?.some(
      (shift) =>
        ["active", "open"].includes(String(shift.status || "")) &&
        !(shift.ended_at || shift.closed_at),
    ),
  );
}
function openEmployeeCard(employee: Employee) {
  selectedEmployeeId.value = employee.id;
  activeTab.value = "card";
}
function canResetEmployeePin(employee: Employee) {
  return (
    employee.role !== "manager" &&
    employee.id !== staffIdentity.value?.employee.id
  );
}
function formatMoney(value: number) {
  return formatBynCurrency(value);
}
function formatMonthLabel(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value || "Месяц не выбран";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(date);
}
function formatMonthShort(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    month: "short",
    timeZone: BUSINESS_TIME_ZONE,
  })
    .format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)))
    .replace(".", "");
}
function formatMinutes(value: number) {
  const minutes = Math.max(0, Math.round(value));
  return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
}
function formatDecimal(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 1,
  }).format(value);
}
function formatDateTime(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: BUSINESS_TIME_ZONE,
      }).format(date);
}
function formatDay(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(new Date(`${value}T12:00:00Z`));
}
function activityDateBounds(): [string, string] {
  if (selectedPeriod.value === "day") {
    return [selectedDay.value, selectedDay.value];
  }
  if (selectedPeriod.value === "month") {
    const match = /^(\d{4})-(\d{2})$/.exec(selectedMonth.value);
    if (!match) return ["", ""];
    const year = Number(match[1]);
    const month = Number(match[2]);
    const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    return [`${selectedMonth.value}-01`, end];
  }
  if (selectedPeriod.value === "year") {
    return [`${selectedYear.value}-01-01`, `${selectedYear.value}-12-31`];
  }
  return [customPeriodFrom.value, customPeriodTo.value];
}
function activityValue(day: ActivityDay) {
  if (activityMetric.value === "hours") {
    return Number(day.worked_minutes || 0) / 60;
  }
  if (activityMetric.value === "issued") {
    return Number(day.events?.order_issued || 0);
  }
  if (activityMetric.value === "tasks") {
    return Number(day.events?.task_approved || 0);
  }
  return Number(day.count || 0);
}
function activityHeight(value: number) {
  const max = Math.max(
    1,
    ...activityChartPoints.value.map((point) => Number(point.value || 0)),
  );
  return Math.max(4, Math.round((value / max) * 100));
}
function activityMetricShortValue(value: number) {
  return activityMetric.value === "hours"
    ? formatDecimal(value)
    : String(Math.round(value));
}
function activityMetricValueLabel(value: number) {
  if (activityMetric.value === "hours") return `${formatDecimal(value)} ч`;
  if (activityMetric.value === "issued") return `${Math.round(value)} выдано`;
  if (activityMetric.value === "tasks") return `${Math.round(value)} задач`;
  const count = Math.round(value);
  return `${count} ${activityWord(count)}`;
}
function activityWord(count: number) {
  const value = Math.abs(count) % 100;
  const last = value % 10;
  if (value > 10 && value < 20) return "действий";
  if (last === 1) return "действие";
  if (last >= 2 && last <= 4) return "действия";
  return "действий";
}
function markKindLabel(kind?: string) {
  return kind === "negative" ? "Отрицательная" : "Положительная";
}
function timelineDotClass(item: { type: string; kind?: string }) {
  if (item.type === "activity") return "";
  return item.kind === "positive" ? "bg-blue-500" : "bg-red-500";
}
function salaryEmployeeName(salary: StaffSalary) {
  return (
    salary.employee_name ||
    (() => {
      const employee = staffEmployees.value.find((item) => item.id === salary.employee_id);
      return employee ? `${employee.first_name} ${employee.last_name}` : salary.employee_id;
    })()
  );
}
function salaryAmount(salary: StaffSalary) {
  return Number(
    salary.final_amount ??
      salary.estimated_amount ??
      salary.amount ??
      (salary.amount_minor != null ? salary.amount_minor / 100 : 0),
  );
}
function salaryUpdatedLabel(salary: StaffSalary) {
  if (!salary.id) return "Сумма ещё не указана";
  return salary.updated_at || salary.created_at
    ? formatDateTime(salary.updated_at || salary.created_at || "")
    : "Сохранено";
}
function historyVersionSummary(version: StaffHistoryVersion) {
  if (historyKind.value === "salary") {
    return `${formatMoney(Number(version.amount_minor || 0) / 100)} · сумма сохранена`;
  }
  const actions: Record<string, string> = {
    create: "Создана",
    update: "Изменена",
    void: "Аннулирована",
  };
  return `${actions[version.action || ""] || version.action || "Изменение"}: ${version.title || "отметка"}`;
}
function notificationGroupLabel(group: string) {
  const labels: Record<string, string> = {
    documents: "Поставки и перемещения",
    tasks: "Задачи",
    salary: "Зарплата",
  };
  return labels[group] || "Служебные сообщения";
}
function notificationRecipientCount(group: string) {
  return notificationRecipients.value.filter(
    (recipient) => String(recipient.event_group) === group,
  ).length;
}
function recipientWord(count: number) {
  const value = Math.abs(count) % 100;
  const last = value % 10;
  if (value > 10 && value < 20) return "получателей";
  if (last === 1) return "получатель";
  if (last >= 2 && last <= 4) return "получателя";
  return "получателей";
}
function notificationStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Ожидает отправки",
    sending: "Отправляется",
    sent: "Отправлено",
    failed: "Не доставлено",
    unknown: "Доставка не подтверждена",
  };
  return labels[status] || "Статус не определён";
}
function notificationOutboxGroup(item: Record<string, any>) {
  const type = String(item.event_type || "");
  if (type.startsWith("task")) return "tasks";
  if (type.startsWith("salary")) return "salary";
  return "documents";
}
function notificationEventLabel(type: string) {
  const labels: Record<string, string> = {
    "procurement.created": "Создан документ закупки",
    "procurement.accepted": "Закупка принята",
    "transfer.created": "Создано перемещение",
    "transfer.accepted": "Перемещение принято",
    task_created: "Создана задача",
    task_review_requested: "Задача отправлена на проверку",
    salary_assignment_reminder: "Напоминание о зарплатах",
  };
  return labels[type] || "Внутреннее уведомление";
}
function notificationRecipientLabel(item: Record<string, any>) {
  const username = String(item.recipient_username || "").replace(/^@+/, "");
  return username ? `@${username}` : "не указан";
}
function notificationPayloadSummary(item: Record<string, any>) {
  let payload: Record<string, any> = {};
  try {
    payload = JSON.parse(String(item.payload_json || "{}"));
  } catch {
    return "";
  }
  const parts = [
    payload.document_number ? `№${payload.document_number}` : "",
    payload.title ? String(payload.title) : "",
    payload.employee_name ? `сотрудник: ${payload.employee_name}` : "",
    payload.from_location ? `откуда: ${payload.from_location}` : "",
    payload.to_location ? `куда: ${payload.to_location}` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}
function shiftStart(shift: StaffShift) {
  return shift.started_at || shift.opened_at || "";
}
function shiftEnd(shift: StaffShift) {
  return shift.ended_at || shift.closed_at || null;
}
function shiftDurationMinutes(shift: StaffShift) {
  const start = new Date(shiftStart(shift)).getTime();
  const end = new Date(shiftEnd(shift) || Date.now()).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return Number(shift.worked_minutes || 0);
  }
  return Math.round((end - start) / 60_000);
}
function getBusinessDateKey(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = getBusinessDateParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}
function shiftHeatColor(minutes: number) {
  if (!minutes) return "rgba(37, 99, 235, 0.025)";
  const max = Math.max(
    1,
    ...shiftCalendarCells.value
      .filter((cell) => !cell.empty)
      .map((cell) => cell.minutes),
  );
  const alpha = 0.08 + (Math.min(minutes / max, 1) * 0.24);
  return `rgba(37, 99, 235, ${alpha.toFixed(3)})`;
}
function shiftActive(shift: StaffShift) {
  return ["active", "open"].includes(shift.status) && !shiftEnd(shift);
}
function shiftEmployeeLabel(shift: StaffShift) {
  return (
    shift.employee_name ||
    [shift.employee?.first_name, shift.employee?.last_name].filter(Boolean).join(" ") ||
    shift.employee_id
  );
}

async function loadEmployees() {
  try {
    await crmStore.fetchStaffEmployees({ includeInactive: true });
    if (!selectedEmployeeId.value && staffEmployees.value.length) {
      selectedEmployeeId.value = staffEmployees.value[0].id;
    }
    if (!marksEmployeeId.value && staffEmployees.value.length) {
      marksEmployeeId.value =
        staffEmployees.value.find(employeeActive)?.id ||
        staffEmployees.value[0].id;
    }
  } catch {
    // Store owns the visible error.
  }
}

function analyticsPeriodParams() {
  periodError.value = "";
  if (
    selectedPeriod.value === "year" &&
    (!/^\d{4}$/.test(selectedYear.value) ||
      Number(selectedYear.value) < 2000 ||
      Number(selectedYear.value) > 2200)
  ) {
    periodError.value = "Укажите год от 2000 до 2200";
    return null;
  }
  if (selectedPeriod.value === "custom") {
    if (
      !customPeriodFrom.value ||
      !customPeriodTo.value ||
      customPeriodFrom.value > customPeriodTo.value
    ) {
      periodError.value = "Укажите корректные даты периода";
      return null;
    }
    const days =
      Math.floor(
        (Date.parse(`${customPeriodTo.value}T00:00:00Z`) -
          Date.parse(`${customPeriodFrom.value}T00:00:00Z`)) /
          86_400_000,
      ) + 1;
    if (days > 366) {
      periodError.value = "Произвольный период не может быть длиннее 366 дней";
      return null;
    }
  }
  return {
    period: selectedPeriod.value,
    month: selectedPeriod.value === "month" ? selectedMonth.value : undefined,
    date: selectedPeriod.value === "day" ? selectedDay.value : undefined,
    year: selectedPeriod.value === "year" ? selectedYear.value : undefined,
    from: selectedPeriod.value === "custom" ? customPeriodFrom.value : undefined,
    to: selectedPeriod.value === "custom" ? customPeriodTo.value : undefined,
  };
}

async function loadCard() {
  const employeeId = isStaffManager.value
    ? selectedEmployeeId.value
    : staffIdentity.value?.employee.id;
  if (!employeeId) {
    staffAnalytics.value = null;
    return;
  }
  const period = analyticsPeriodParams();
  if (!period) return;
  const analytics = await crmStore.fetchStaffAnalytics({
    ...period,
    employeeId,
  }).catch(() => null);
  if (!analytics) return;
  if (selectedPeriod.value === "month") {
    await crmStore.fetchStaffMarks({
      month: selectedMonth.value,
      employeeId,
    }).catch(() => undefined);
  } else {
    staffMarks.value = ((analytics.marks || []) as unknown as StaffMark[]);
  }
}
async function loadTeamAnalytics() {
  const period = analyticsPeriodParams();
  if (!period) return;
  await crmStore.fetchStaffTeamAnalytics(period).catch(() => undefined);
}
async function loadSalaries() {
  try {
    await crmStore.fetchStaffSalaries({ month: selectedMonth.value });
  } catch {
    // Store owns the visible error.
  }
}
async function loadMarks() {
  if (!marksEmployeeId.value) {
    staffMarks.value = [];
    return;
  }
  try {
    await crmStore.fetchStaffMarks({
      month: selectedMonth.value,
      employeeId: marksEmployeeId.value,
    });
  } catch {
    // Store owns the visible error.
  }
}
async function loadShifts() {
  try {
    await crmStore.fetchStaffShiftHistory({
      month: selectedMonth.value,
      employeeId: shiftsEmployeeId.value || undefined,
    });
  } catch {
    // Store owns the visible error.
  }
}
async function loadNotifications() {
  try {
    await crmStore.fetchStaffNotifications();
    notificationSettingError.value = "";
  } catch {
    // Store owns the visible error.
  }
}
async function loadCurrentView() {
  pageMessage.value = "";
  if (isStaffManager.value && !staffEmployees.value.length) await loadEmployees();
  if (activeTab.value === "card") await loadCard();
  if (activeTab.value === "team") {
    await loadEmployees();
    await loadTeamAnalytics();
  }
  if (activeTab.value === "salaries") await loadSalaries();
  if (activeTab.value === "marks") await loadMarks();
  if (activeTab.value === "shifts") await loadShifts();
  if (activeTab.value === "settings") await crmStore.fetchStaffSettings();
  if (activeTab.value === "notifications") await loadNotifications();
}
function staffAccessKey() {
  if (!hasStaffAccess.value || !staffIdentity.value?.employee.id) return "";
  return `${staffIdentity.value.role}:${staffIdentity.value.employee.id}`;
}
async function syncStaffAccessWorkspace() {
  const key = staffAccessKey();
  if (!key || syncedStaffAccessKey === key) return;
  syncedStaffAccessKey = key;
  activeTab.value = "card";
  selectedEmployeeId.value = staffIdentity.value?.employee.id || "";
  marksEmployeeId.value = staffIdentity.value?.employee.id || "";
  shiftsEmployeeId.value = "";
  if (isStaffManager.value) await loadEmployees();
  if (staffAccessKey() !== key) return;
  await crmStore.fetchStaffSettings().catch(() => undefined);
  if (staffAccessKey() !== key) return;
  if (isStaffManager.value && staffTrackingEnabled.value === false) {
    activeTab.value = "settings";
    return;
  }
  await loadCard();
}
async function handleAccessSuccess() {
  accessOpen.value = false;
  await syncStaffAccessWorkspace();
}

function resetStaffSetup() {
  Object.assign(staffSetupForm, {
    admin_password: "",
    first_name: "",
    last_name: "",
    position: "",
    employee_id: "",
    new_pin: "",
    enable_tracking: true,
  });
  recoveryCandidates.value = [];
  recoveryCandidatesLoaded.value = false;
  staffSetupError.value = "";
}
function openStaffSetup(mode: "bootstrap" | "recovery") {
  resetStaffSetup();
  staffSetupMode.value = mode;
  staffSetupOpen.value = true;
}
function closeStaffSetup() {
  if (staffSetupSaving.value) return;
  staffSetupOpen.value = false;
  resetStaffSetup();
}
function selectStaffSetupMode(mode: "bootstrap" | "recovery") {
  if (staffSetupSaving.value || staffSetupMode.value === mode) return;
  resetStaffSetup();
  staffSetupMode.value = mode;
}
function sanitizeSetupPin(event: Event) {
  staffSetupForm.new_pin = (event.target as HTMLInputElement).value
    .replace(/\D/g, "")
    .slice(0, 4);
}
async function bootstrapManager() {
  if (
    staffSetupSaving.value ||
    !staffSetupForm.admin_password ||
    !staffSetupForm.first_name ||
    !/^\d{4}$/.test(staffSetupForm.new_pin)
  ) return;
  staffSetupSaving.value = true;
  staffSetupError.value = "";
  const pin = staffSetupForm.new_pin;
  try {
    await crmStore.bootstrapStaffManager({
      admin_password: staffSetupForm.admin_password,
      first_name: staffSetupForm.first_name,
      last_name: staffSetupForm.last_name || undefined,
      position: staffSetupForm.position || undefined,
      new_pin: pin,
      enable_tracking: staffSetupForm.enable_tracking,
    });
    await crmStore.accessStaff(pin);
    staffSetupOpen.value = false;
    resetStaffSetup();
    await handleAccessSuccess();
    pageMessageKind.value = "info";
    pageMessage.value = "Руководитель настроен. Ограничение заказов пока включается отдельно.";
  } catch (error: any) {
    staffSetupError.value = error?.message || "Не удалось создать руководителя";
  } finally {
    staffSetupSaving.value = false;
  }
}
async function loadRecoveryCandidates() {
  if (staffSetupSaving.value || !staffSetupForm.admin_password) return;
  staffSetupSaving.value = true;
  staffSetupError.value = "";
  try {
    recoveryCandidates.value =
      await crmStore.fetchStaffRecoveryManagerCandidates(
        staffSetupForm.admin_password,
      );
    recoveryCandidatesLoaded.value = true;
    staffSetupForm.employee_id = recoveryCandidates.value[0]?.id || "";
    if (!recoveryCandidates.value.length) {
      staffSetupError.value = "Активные руководители не найдены";
    }
  } catch (error: any) {
    staffSetupError.value =
      error?.message || "Не удалось проверить основной пароль";
  } finally {
    staffSetupSaving.value = false;
  }
}
async function recoverManager() {
  if (
    staffSetupSaving.value ||
    !staffSetupForm.admin_password ||
    !staffSetupForm.employee_id ||
    !/^\d{4}$/.test(staffSetupForm.new_pin)
  ) return;
  staffSetupSaving.value = true;
  staffSetupError.value = "";
  const pin = staffSetupForm.new_pin;
  try {
    await crmStore.recoverStaffManager({
      admin_password: staffSetupForm.admin_password,
      employee_id: staffSetupForm.employee_id,
      new_pin: pin,
    });
    crmStore.lockStaffAccess();
    await crmStore.accessStaff(pin);
    staffSetupOpen.value = false;
    resetStaffSetup();
    await handleAccessSuccess();
    pageMessageKind.value = "info";
    pageMessage.value = "ПИН руководителя обновлён";
  } catch (error: any) {
    staffSetupError.value =
      error?.message || "Не удалось восстановить ПИН руководителя";
  } finally {
    staffSetupSaving.value = false;
  }
}

function requestConfirmation(action: ConfirmationAction) {
  confirmationAction.value = action;
  confirmationReason.value = "";
  confirmationPin.value = "";
  confirmationAdminPassword.value = "";
  confirmationError.value = "";
}
function closeConfirmation() {
  if (confirmationSaving.value) return;
  confirmationAction.value = null;
  confirmationReason.value = "";
  confirmationPin.value = "";
  confirmationAdminPassword.value = "";
  confirmationError.value = "";
}
function sanitizeConfirmationPin() {
  confirmationPin.value = confirmationPin.value.replace(/\D/g, "").slice(0, 4);
}
async function confirmRequestedAction() {
  const action = confirmationAction.value;
  if (
    !action ||
    confirmationSaving.value ||
    (action.requireReason && !confirmationReason.value.trim()) ||
    (action.requirePin && !/^\d{4}$/.test(confirmationPin.value)) ||
    (action.requireAdminPassword && !confirmationAdminPassword.value)
  ) return;
  confirmationSaving.value = true;
  confirmationError.value = "";
  try {
    await action.run(
      confirmationReason.value.trim(),
      confirmationPin.value,
      confirmationAdminPassword.value,
    );
    confirmationAction.value = null;
    confirmationReason.value = "";
    confirmationPin.value = "";
    confirmationAdminPassword.value = "";
  } catch (error: any) {
    confirmationError.value =
      error?.message || "Не удалось выполнить действие";
  } finally {
    confirmationSaving.value = false;
  }
}

async function updateTracking(next: boolean) {
  await crmStore.updateStaffTracking(next);
  pageMessageKind.value = "info";
  pageMessage.value = next ? "Общий учёт включён" : "Общий учёт выключен";
}
async function toggleTracking() {
  if (staffSettingsLoading.value) return;
  const next = !staffTrackingEnabled.value;
  pageMessage.value = "";
  if (!next) {
    requestConfirmation({
      title: "Выключить общий учёт?",
      description:
        "Открытая смена закроется, ограничение заказов отключится. История сохранится.",
      context: `${currentShiftReadinessLabel.value}\nНовые действия перестанут попадать в показатели сотрудников.`,
      confirmLabel: "Выключить учёт",
      variant: "danger",
      run: async () => updateTracking(false),
    });
    return;
  }
  try {
    await updateTracking(true);
  } catch (error: any) {
    pageMessageKind.value = "error";
    pageMessage.value = error?.message || "Не удалось изменить настройку";
  }
}
async function toggleOrderShiftRestriction() {
  if (staffSettingsLoading.value || !staffTrackingEnabled.value) return;
  const next = !staffOrderShiftRestrictionEnabled.value;
  if (next && !orderRestrictionReady.value) {
    pageMessageKind.value = "error";
    pageMessage.value =
      "Сначала задайте ПИН каждому действующему сотруднику";
    return;
  }
  pageMessage.value = "";
  requestConfirmation({
    title: next
      ? "Включить обязательную смену?"
      : "Выключить обязательную смену?",
    description: next
      ? "После подтверждения любое изменение заказа потребует открытую смену."
      : "Заказы снова можно будет изменять без смены, и автор таких действий не определится.",
    context: `${activeStaffCount.value} сотрудников · ПИНы ${pinReadyStaffCount.value} из ${activeStaffCount.value}\n${currentShiftReadinessLabel.value}`,
    confirmLabel: next ? "Включить ограничение" : "Выключить ограничение",
    variant: next ? "primary" : "danger",
    run: async () => {
      await crmStore.updateStaffOrderShiftRestriction(next);
      pageMessageKind.value = "info";
      pageMessage.value = next
        ? "Ограничение заказов включено"
        : "Ограничение заказов выключено";
    },
  });
}

function resetEmployeeForm() {
  Object.assign(employeeForm, {
    first_name: "",
    last_name: "",
    position: "",
    responsibilities: "",
    color: "#2563eb",
    avatar_url: "",
    role: "employee",
    pin: "",
  });
}
function openEmployeeEditor(employee?: Employee) {
  editingEmployee.value = employee || null;
  formError.value = "";
  avatarError.value = "";
  if (employee) {
    Object.assign(employeeForm, {
      first_name: employee.first_name,
      last_name: employee.last_name || "",
      position: employee.position || "",
      responsibilities: responsibilityText(employee.responsibilities),
      color: safeColor(employee.color),
      avatar_url: employee.avatar_url || "",
      role: employee.role || "employee",
      pin: "",
    });
  } else resetEmployeeForm();
  employeeEditorOpen.value = true;
}
function closeEmployeeEditor() {
  if (formSaving.value || avatarUploading.value) return;
  employeeEditorOpen.value = false;
  editingEmployee.value = null;
  resetEmployeeForm();
}
function sanitizeEmployeePin(event: Event) {
  employeeForm.pin = (event.target as HTMLInputElement).value.replace(/\D/g, "").slice(0, 4);
}
async function uploadEmployeeAvatar(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || avatarUploading.value) return;
  avatarUploading.value = true;
  avatarError.value = "";
  try {
    const urls = await adminStore.uploadFiles([file], "staff");
    if (!urls?.[0]) throw new Error("Сервер не вернул адрес фото");
    employeeForm.avatar_url = urls[0];
  } catch (error: any) {
    avatarError.value = error?.message || "Не удалось загрузить фото";
  } finally {
    avatarUploading.value = false;
    input.value = "";
  }
}
async function saveEmployee() {
  if (formSaving.value || avatarUploading.value) return;
  if (!editingEmployee.value && !/^\d{4}$/.test(employeeForm.pin)) {
    formError.value = "Введите ПИН из четырёх цифр";
    return;
  }
  formSaving.value = true;
  formError.value = "";
  try {
    const payload = {
      first_name: employeeForm.first_name,
      last_name: employeeForm.last_name,
      position: employeeForm.position || null,
      responsibilities: employeeForm.responsibilities || null,
      color: employeeForm.color,
      avatar_url: employeeForm.avatar_url || null,
      role: employeeForm.role,
    };
    if (editingEmployee.value) {
      await crmStore.updateStaffEmployee(editingEmployee.value.id, payload);
    } else {
      await crmStore.createStaffEmployee({ ...payload, pin: employeeForm.pin });
    }
    employeeEditorOpen.value = false;
    editingEmployee.value = null;
    resetEmployeeForm();
    pageMessageKind.value = "info";
    pageMessage.value = "Данные сотрудника сохранены";
  } catch (error: any) {
    formError.value = error?.message || "Не удалось сохранить сотрудника";
  } finally {
    formSaving.value = false;
  }
}
async function toggleEmployeeActive(employee: Employee) {
  const activating = !employeeActive(employee);
  const needsPin = activating && !employee.pin_configured;
  const needsAdminPassword = needsPin && employee.role === "manager";
  const employeeName = `${employee.first_name} ${employee.last_name}`.trim();
  requestConfirmation({
    title: activating ? "Восстановить сотрудника?" : "Уволить сотрудника?",
    description: activating
      ? needsPin
        ? "Сотрудник снова появится в рабочих списках. Сразу задайте ему новый ПИН."
        : "Сотрудник снова появится в рабочих списках."
      : "Доступ и активные допуски закроются, вся история останется.",
    context: `${employeeName}\n${employee.position || "Должность не указана"}`,
    confirmLabel: activating ? "Восстановить" : "Уволить",
    variant: activating ? "success" : "danger",
    requireReason: !activating,
    reasonLabel: "Причина увольнения",
    requirePin: needsPin,
    requireAdminPassword: needsAdminPassword,
    run: async (reason, pin, adminPassword) => {
      if (activating) {
        await crmStore.restoreStaffEmployee(employee.id, {
          newPin: pin || undefined,
          adminPassword: adminPassword || undefined,
        });
      }
      else await crmStore.deactivateStaffEmployee(employee.id, reason);
      pageMessageKind.value = "info";
      pageMessage.value = activating
        ? "Сотрудник восстановлен"
        : "Сотрудник уволен";
    },
  });
}
function openPinReset(employee: Employee) {
  pinResetEmployee.value = employee;
  newPin.value = "";
  formError.value = "";
  pinResetOpen.value = true;
}
function closePinReset() {
  if (formSaving.value) return;
  pinResetOpen.value = false;
  pinResetEmployee.value = null;
  newPin.value = "";
}
function sanitizeResetPin(event: Event) {
  newPin.value = (event.target as HTMLInputElement).value.replace(/\D/g, "").slice(0, 4);
}
async function savePinReset() {
  if (!pinResetEmployee.value || !/^\d{4}$/.test(newPin.value)) return;
  formSaving.value = true;
  formError.value = "";
  try {
    await crmStore.resetStaffEmployeePin(pinResetEmployee.value.id, newPin.value);
    pinResetOpen.value = false;
    pinResetEmployee.value = null;
    newPin.value = "";
    pageMessageKind.value = "info";
    pageMessage.value = "ПИН обновлён";
  } catch (error: any) {
    formError.value = error?.message || "Не удалось обновить ПИН";
  } finally {
    formSaving.value = false;
  }
}

function openSalaryEditor(salary?: StaffSalary) {
  formError.value = "";
  Object.assign(salaryForm, {
    employee_id: salary?.employee_id || selectedEmployeeId.value || staffEmployees.value[0]?.id || "",
    final_amount: Number(salary?.final_amount ?? salary?.estimated_amount ?? 0),
    note: salary?.note || "",
  });
  salaryEditorOpen.value = true;
}
function closeSalaryEditor() {
  if (formSaving.value) return;
  salaryEditorOpen.value = false;
}
async function openSalaryHistory(salary: StaffSalary) {
  if (!salary.id) return;
  const requestSequence = ++historyRequestSequence;
  historyKind.value = "salary";
  historyTitle.value = `История зарплаты · ${salaryEmployeeName(salary)}`;
  historyVersions.value = [];
  historyError.value = "";
  historyLoading.value = true;
  historyOpen.value = true;
  try {
    const response = await crmStore.fetchStaffSalaryHistory(salary.id);
    if (requestSequence === historyRequestSequence) {
      historyVersions.value = response.versions;
    }
  } catch (error: any) {
    if (requestSequence === historyRequestSequence) {
      historyError.value = error?.message || "Не удалось загрузить историю зарплаты";
    }
  } finally {
    if (requestSequence === historyRequestSequence) historyLoading.value = false;
  }
}
async function saveSalary() {
  if (!salaryForm.employee_id || formSaving.value) return;
  formSaving.value = true;
  formError.value = "";
  try {
    await crmStore.saveStaffSalary({
      employee_id: salaryForm.employee_id,
      month: selectedMonth.value,
      final_amount: Number(salaryForm.final_amount),
      note: salaryForm.note || null,
    });
    salaryEditorOpen.value = false;
    pageMessageKind.value = "info";
    pageMessage.value = "Зарплата сохранена";
  } catch (error: any) {
    formError.value = error?.message || "Не удалось сохранить зарплату";
  } finally {
    formSaving.value = false;
  }
}

function openMarkEditor(mark?: StaffMark) {
  editingMark.value = mark || null;
  formError.value = "";
  Object.assign(markForm, {
    kind: mark?.kind || "positive",
    title: mark?.title || "",
    description: mark?.description || "",
    occurred_at: formatBusinessDateTimeInput(
      mark?.occurred_at || new Date(),
    ),
  });
  markEditorOpen.value = true;
}
async function openMarkHistory(mark: StaffMark) {
  const requestSequence = ++historyRequestSequence;
  historyKind.value = "mark";
  historyTitle.value = `История отметки · ${mark.title}`;
  historyVersions.value = [];
  historyError.value = "";
  historyLoading.value = true;
  historyOpen.value = true;
  try {
    const response = await crmStore.fetchStaffMarkHistory(mark.id);
    if (requestSequence === historyRequestSequence) {
      historyVersions.value = response.versions;
    }
  } catch (error: any) {
    if (requestSequence === historyRequestSequence) {
      historyError.value = error?.message || "Не удалось загрузить историю отметки";
    }
  } finally {
    if (requestSequence === historyRequestSequence) historyLoading.value = false;
  }
}
function closeMarkEditor() {
  if (formSaving.value) return;
  markEditorOpen.value = false;
  editingMark.value = null;
}
async function saveMark() {
  if (!marksEmployeeId.value || formSaving.value) return;
  formSaving.value = true;
  formError.value = "";
  try {
    const payload = {
      kind: markForm.kind,
      title: markForm.title,
      description: markForm.description,
      occurred_at: businessDateTimeInputToIso(markForm.occurred_at),
    };
    if (editingMark.value) {
      await crmStore.updateStaffMark(editingMark.value.id, {
        ...payload,
        expected_version: editingMark.value.current_version,
      });
    } else {
      await crmStore.createStaffMark({ employee_id: marksEmployeeId.value, ...payload });
    }
    markEditorOpen.value = false;
    editingMark.value = null;
    pageMessageKind.value = "info";
    pageMessage.value = "Отметка сохранена";
  } catch (error: any) {
    formError.value = error?.message || "Не удалось сохранить отметку";
  } finally {
    formSaving.value = false;
  }
}
function openVoidMark(mark: StaffMark) {
  voidingMark.value = mark;
  voidReason.value = "";
  formError.value = "";
  voidMarkOpen.value = true;
}
async function voidMark() {
  if (!voidingMark.value || !voidReason.value || formSaving.value) return;
  formSaving.value = true;
  formError.value = "";
  try {
    await crmStore.updateStaffMark(voidingMark.value.id, {
      voided: true,
      void_reason: voidReason.value,
      expected_version: voidingMark.value.current_version,
    });
    voidMarkOpen.value = false;
    voidingMark.value = null;
    pageMessageKind.value = "info";
    pageMessage.value = "Отметка аннулирована, история сохранена";
  } catch (error: any) {
    formError.value = error?.message || "Не удалось аннулировать отметку";
  } finally {
    formSaving.value = false;
  }
}

function openShiftCorrection(shift: StaffShift) {
  editingShift.value = shift;
  formError.value = "";
  Object.assign(shiftCorrectionForm, {
    started_at: formatBusinessDateTimeInput(shiftStart(shift)),
    ended_at: formatBusinessDateTimeInput(shiftEnd(shift) || new Date()),
    reason: "",
  });
  shiftCorrectionOpen.value = true;
}
async function saveShiftCorrection() {
  if (!editingShift.value || !shiftCorrectionForm.reason || formSaving.value) return;
  formSaving.value = true;
  formError.value = "";
  try {
    await crmStore.correctStaffShift({
      shift_id: editingShift.value.id,
      expected_version: editingShift.value.version,
      started_at: businessDateTimeInputToIso(shiftCorrectionForm.started_at),
      ended_at: businessDateTimeInputToIso(shiftCorrectionForm.ended_at),
      reason: shiftCorrectionForm.reason,
      force: shiftActive(editingShift.value),
    });
    shiftCorrectionOpen.value = false;
    pageMessageKind.value = "info";
    pageMessage.value = "Смена исправлена, причина сохранена";
  } catch (error: any) {
    formError.value = error?.message || "Не удалось исправить смену";
  } finally {
    formSaving.value = false;
  }
}

async function toggleNotificationSetting(group: string, enabled: boolean) {
  if (notificationSaving.value) return;
  notificationSaving.value = true;
  notificationSettingError.value = "";
  try {
    await crmStore.updateStaffNotificationSettings([
      { event_group: group, enabled },
    ]);
  } catch (error: any) {
    notificationSettingError.value =
      error?.message || "Не удалось сохранить настройку";
    await loadNotifications();
  } finally {
    notificationSaving.value = false;
  }
}

async function resolveNotificationRecipient() {
  if (!recipientForm.username || notificationSaving.value) return;
  notificationSaving.value = true;
  notificationFormError.value = "";
  try {
    resolvedRecipient.value =
      await crmStore.resolveStaffNotificationRecipient(recipientForm.username);
  } catch (error: any) {
    resolvedRecipient.value = null;
    notificationFormError.value =
      error?.message || "Пользователь Telegram не найден";
  } finally {
    notificationSaving.value = false;
  }
}

async function addNotificationRecipient() {
  if (!resolvedRecipient.value || notificationSaving.value) return;
  notificationSaving.value = true;
  notificationFormError.value = "";
  try {
    await crmStore.addStaffNotificationRecipient({
      event_group: recipientForm.event_group,
      telegram_id: resolvedRecipient.value.telegram_id,
      telegram_username: resolvedRecipient.value.telegram_username,
    });
    recipientForm.username = "";
    resolvedRecipient.value = null;
  } catch (error: any) {
    notificationFormError.value =
      error?.message || "Не удалось добавить получателя";
  } finally {
    notificationSaving.value = false;
  }
}

async function removeNotificationRecipient(recipient: Record<string, any>) {
  if (notificationSaving.value) return;
  requestConfirmation({
    title: "Удалить получателя?",
    description: "Новые внутренние уведомления этой группы ему больше не придут.",
    context: `@${recipient.telegram_username}\n${notificationGroupLabel(String(recipient.event_group))}`,
    confirmLabel: "Удалить",
    variant: "danger",
    run: async () => {
      notificationSaving.value = true;
      notificationFormError.value = "";
      try {
        await crmStore.removeStaffNotificationRecipient(recipient.id, {
          telegram_id: String(recipient.telegram_id),
          telegram_username: String(recipient.telegram_username),
        });
      } finally {
        notificationSaving.value = false;
      }
    },
  });
}

async function resumeNotification(item: Record<string, any>) {
  if (notificationSaving.value) return;
  requestConfirmation({
    title: "Разрешить повторную отправку?",
    description:
      "Сначала убедитесь, что сообщение не дошло. Повтор может создать дубликат у получателя.",
    context: `${notificationEventLabel(String(item.event_type || ""))}\n${notificationRecipientLabel(item)}`,
    confirmLabel: "Разрешить повтор",
    variant: "danger",
    requireReason: true,
    reasonLabel: "Почему повтор безопасен",
    run: async (reason) => {
      notificationSaving.value = true;
      notificationFormError.value = "";
      try {
        await crmStore.resumeStaffNotification(item.id, reason);
      } finally {
        notificationSaving.value = false;
      }
    },
  });
}

function handleShiftRequired(payload: { label: string; retry: () => Promise<unknown> }) {
  tasksManagerOpen.value = false;
  void shiftBarRef.value?.requestShiftRequired(payload.label, payload.retry);
}

function ensureEmployeeSelections() {
  if (!isStaffManager.value) {
    const ownId = staffIdentity.value?.employee.id || "";
    selectedEmployeeId.value = ownId;
    marksEmployeeId.value = ownId;
    return;
  }
  if (
    !staffEmployees.value.some(
      (employee) => employee.id === selectedEmployeeId.value,
    )
  ) {
    selectedEmployeeId.value =
      staffEmployees.value.find(employeeActive)?.id ||
      staffEmployees.value[0]?.id ||
      "";
  }
  if (
    !staffEmployees.value.some(
      (employee) => employee.id === marksEmployeeId.value,
    )
  ) {
    marksEmployeeId.value =
      staffEmployees.value.find(employeeActive)?.id ||
      staffEmployees.value[0]?.id ||
      "";
  }
}

watch(activeTab, () => {
  ensureEmployeeSelections();
  void loadCurrentView();
});
watch(
  [
    timelineFilter,
    selectedEmployeeId,
    selectedPeriod,
    selectedMonth,
    selectedDay,
    selectedYear,
    customPeriodFrom,
    customPeriodTo,
  ],
  () => {
    timelineLimit.value = timelinePageSize;
  },
);
watch([shiftsEmployeeId, selectedMonth], () => {
  shiftHistoryLimit.value = shiftHistoryPageSize;
});
watch(
  [
    selectedMonth,
    selectedEmployeeId,
    marksEmployeeId,
    shiftsEmployeeId,
    selectedPeriod,
    selectedDay,
    selectedYear,
    customPeriodFrom,
    customPeriodTo,
  ],
  () => {
    if (!hasStaffAccess.value) return;
    if (activeTab.value === "card") void loadCard();
    if (activeTab.value === "team") void loadTeamAnalytics();
    if (activeTab.value === "salaries") void loadSalaries();
    if (activeTab.value === "marks") void loadMarks();
    if (activeTab.value === "shifts") void loadShifts();
    if (activeTab.value === "notifications") void loadNotifications();
  },
);
watch(cardEmployees, (employees) => {
  if (
    isStaffManager.value &&
    !employees.some((employee) => employee.id === selectedEmployeeId.value)
  ) {
    selectedEmployeeId.value = employees[0]?.id || "";
  }
});
watch(
  () => [recipientForm.username, recipientForm.event_group],
  () => {
    resolvedRecipient.value = null;
    notificationFormError.value = "";
  },
);
watch(isStaffManager, (manager) => {
  if (!manager) {
    activeTab.value = "card";
    selectedEmployeeId.value = staffIdentity.value?.employee.id || "";
    marksEmployeeId.value = staffIdentity.value?.employee.id || "";
    shiftsEmployeeId.value = "";
  }
});
watch(
  () => staffAccessKey(),
  (key) => {
    if (!key) {
      syncedStaffAccessKey = "";
      return;
    }
    void syncStaffAccessWorkspace();
  },
);

onMounted(async () => {
  await crmStore.fetchStaffSettings().catch(() => undefined);
  if (!hasStaffAccess.value) return;
  selectedEmployeeId.value = staffIdentity.value?.employee.id || "";
  marksEmployeeId.value = staffIdentity.value?.employee.id || "";
  shiftsEmployeeId.value = "";
  if (isStaffManager.value) await loadEmployees();
  if (isStaffManager.value && staffTrackingEnabled.value === false) {
    activeTab.value = "settings";
    return;
  }
  await loadCard();
});
</script>
