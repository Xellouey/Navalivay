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
          <CrmButton variant="ghost" @click="crmStore.lockStaffAccess()">Выйти из карточки</CrmButton>
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

        <section v-if="activeTab === 'card'" class="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside v-if="isStaffManager" class="space-y-3">
            <div class="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <label for="card-employee-search" class="sr-only">Найти сотрудника</label>
              <input
                id="card-employee-search"
                v-model="employeeSearch"
                type="search"
                class="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="Найти сотрудника"
              />
              <div v-if="staffEmployeesLoading" class="py-8 text-center text-sm text-slate-500">
                Загружаем…
              </div>
              <div v-else-if="staffEmployeesError" class="py-5 text-center">
                <p class="text-sm text-red-700">{{ staffEmployeesError }}</p>
                <button class="mt-2 min-h-[44px] text-sm font-semibold text-blue-700" @click="loadEmployees">
                  Повторить
                </button>
              </div>
              <div v-else-if="!filteredEmployees.length" class="py-8 text-center text-sm text-slate-500">
                Никого не найдено
              </div>
              <div v-else class="mt-2 max-h-[540px] space-y-1 overflow-y-auto">
                <button
                  v-for="employee in filteredEmployees"
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
              <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div class="grid grid-cols-2 divide-x divide-y divide-slate-200 sm:grid-cols-3 lg:grid-cols-3">
                  <div v-for="metric in metrics" :key="metric.label" class="min-h-[96px] p-4">
                    <div class="text-xs font-medium text-slate-500">{{ metric.label }}</div>
                    <div class="mt-2 text-xl font-bold text-slate-950">{{ metric.value }}</div>
                    <p v-if="metric.hint" class="mt-1 text-[11px] leading-4 text-slate-500">
                      {{ metric.hint }}
                    </p>
                  </div>
                </div>
              </section>

              <section
                v-if="selectedEmployee?.responsibilities"
                class="border-l-4 border-blue-500 bg-white px-5 py-4 text-sm leading-6 text-slate-700"
              >
                <h3 class="font-semibold text-slate-950">Зона ответственности</h3>
                <p class="mt-1 whitespace-pre-line">{{ responsibilityText(selectedEmployee.responsibilities) }}</p>
              </section>

              <section v-if="dailyActivity.length" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <h3 class="font-semibold text-slate-950">Активность по дням</h3>
                    <p class="mt-1 text-xs text-slate-500">Высота показывает количество зафиксированных действий.</p>
                  </div>
                </div>
                <div
                  class="mt-5 flex h-28 items-end gap-1 overflow-x-auto pb-1"
                  role="img"
                  :aria-label="activityChartLabel"
                >
                  <div
                    v-for="day in dailyActivity"
                    :key="day.date"
                    class="group flex min-w-5 flex-1 flex-col items-center justify-end"
                    :title="`${formatDay(day.date)}: ${day.count || 0}`"
                  >
                    <div
                      class="w-full max-w-5 rounded-t bg-blue-500 transition-all duration-300 group-hover:bg-blue-700"
                      :style="{ height: `${activityHeight(day.count || 0)}%` }"
                    />
                    <span class="mt-1 text-[9px] text-slate-400">{{ dayNumber(day.date) }}</span>
                  </div>
                </div>
              </section>

              <section class="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <div>
                    <h3 class="font-semibold text-slate-950">Действия и отметки</h3>
                    <p class="mt-1 text-xs text-slate-500">Системные события и ручные пояснения руководителя.</p>
                  </div>
                </div>
                <div v-if="staffMarksLoading" class="py-10 text-center text-sm text-slate-500">Загружаем…</div>
                <div v-else-if="!timelineItems.length" class="py-12 text-center text-sm text-slate-500">
                  За этот месяц действий пока нет
                </div>
                <ol v-else class="divide-y divide-slate-200">
                  <li v-for="item in timelineItems" :key="item.key" class="flex gap-4 px-5 py-4">
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
              </section>
            </template>
            <div v-else class="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center text-sm text-slate-500">
              Для выбранного периода данных пока нет
            </div>
          </div>
        </section>

        <section v-else-if="activeTab === 'team'" class="space-y-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex flex-1 flex-col gap-3 sm:flex-row">
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
          <div v-else-if="!filteredEmployees.length" class="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center text-sm text-slate-500">
            Сотрудников по этому фильтру нет
          </div>
          <div v-else class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div class="divide-y divide-slate-200">
              <article
                v-for="employee in filteredEmployees"
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
                <div class="flex flex-wrap gap-2 xl:max-w-[250px] xl:justify-end">
                  <CrmButton variant="primary" size="sm" @click="openEmployeeCard(employee)">Карточка</CrmButton>
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
              </article>
            </div>
          </div>
        </section>

        <section v-else-if="activeTab === 'salaries'" class="space-y-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="text-lg font-semibold text-slate-950">Зарплаты</h2>
              <p class="mt-1 text-sm text-slate-500">Суммы задаются руководителем вручную.</p>
            </div>
            <input
              v-model="selectedMonth"
              type="month"
              class="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              aria-label="Месяц зарплаты"
            />
          </div>
          <div v-if="staffSalariesLoading" class="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
            Загружаем зарплаты…
          </div>
          <div v-else-if="staffSalariesError" class="rounded-2xl border border-red-200 bg-white py-12 text-center">
            <p class="text-sm text-red-700">{{ staffSalariesError }}</p>
            <CrmButton class="mt-4" variant="secondary" @click="loadSalaries">Повторить</CrmButton>
          </div>
          <div v-else-if="!salaryRows.length" class="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
            <p class="text-sm text-slate-600">За этот месяц суммы ещё не указаны</p>
            <CrmButton class="mt-4" variant="primary" @click="openSalaryEditor()">Указать зарплату</CrmButton>
          </div>
          <div v-else class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table class="w-full min-w-[680px] text-left text-sm">
              <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th class="px-5 py-3">Сотрудник</th>
                  <th class="px-5 py-3">Сумма</th>
                  <th class="px-5 py-3">Статус</th>
                  <th class="px-5 py-3">Комментарий</th>
                  <th class="px-5 py-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                <tr v-for="salary in salaryRows" :key="`${salary.employee_id}:${salary.month}`">
                  <td class="px-5 py-4 font-medium text-slate-900">{{ salaryEmployeeName(salary) }}</td>
                  <td class="px-5 py-4 font-semibold text-slate-950">{{ formatMoney(salary.final_amount ?? salary.estimated_amount ?? 0) }}</td>
                  <td class="px-5 py-4">{{ salaryStatusLabel(salary.status) }}</td>
                  <td class="max-w-xs truncate px-5 py-4 text-slate-500">{{ salary.note || "—" }}</td>
                  <td class="px-5 py-4 text-right">
                    <div class="flex justify-end gap-2">
                      <CrmButton v-if="salary.id" variant="soft" size="sm" @click="openSalaryHistory(salary)">История</CrmButton>
                      <CrmButton variant="secondary" size="sm" @click="openSalaryEditor(salary)">Изменить</CrmButton>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <CrmButton v-if="salaryRows.length" variant="primary" @click="openSalaryEditor()">Добавить сумму</CrmButton>
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
                v-model="selectedEmployeeId"
                class="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                aria-label="Сотрудник для отметок"
              >
                <option v-for="employee in staffEmployees" :key="employee.id" :value="employee.id">
                  {{ employee.first_name }} {{ employee.last_name }}
                </option>
              </select>
              <CrmButton variant="primary" @click="openMarkEditor()">Добавить отметку</CrmButton>
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
                v-model="selectedEmployeeId"
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
          <div v-else class="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <article v-for="shift in staffShiftHistory" :key="shift.id" class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
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
                :disabled="!staffTrackingEnabled"
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
                  <span class="block font-medium text-slate-900">{{ notificationGroupLabel(String(setting.event_group)) }}</span>
                  <span class="block text-xs text-slate-500">Отправлять события этой группы активным получателям</span>
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
                  <div class="mt-1 text-xs">@{{ resolvedRecipient.telegram_username }} · {{ resolvedRecipient.telegram_id }}</div>
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
                    <p v-if="item.telegram_message_id" class="mt-1 text-xs text-emerald-700">
                      Telegram message ID: {{ item.telegram_message_id }}
                    </p>
                    <p v-if="item.last_error" class="mt-1 break-words text-xs text-red-700">
                      Ошибка: {{ item.last_error }}
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
          <CrmButton variant="primary" type="submit" :loading="formSaving" :disabled="avatarUploading">Сохранить</CrmButton>
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
          <CrmButton variant="primary" type="submit" :loading="formSaving">Сохранить</CrmButton>
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
          <CrmButton variant="primary" type="submit" :loading="formSaving">Сохранить</CrmButton>
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
          <CrmButton variant="danger" type="submit" :loading="formSaving">Аннулировать</CrmButton>
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
let syncedStaffAccessKey = "";
const employeeSearch = ref("");
const employeeStatusFilter = ref<"active" | "inactive" | "all">("active");
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
const recipientForm = reactive({ event_group: "documents", username: "" });
const resolvedRecipient = ref<{
  telegram_id: string;
  telegram_username: string;
  display_name: string;
} | null>(null);

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
const metrics = computed<Array<{
  label: string;
  value: string | number;
  hint?: string;
}>>(() => [
  { label: "Отработано", value: formatMinutes(Number(analyticsSummary.value.worked_minutes || 0)) },
  { label: "Смен", value: Number(analyticsSummary.value.shifts_count || 0) },
  { label: "Задач", value: Number(analyticsSummary.value.tasks_completed || 0) },
  { label: "Собрано", value: Number(analyticsSummary.value.orders_assembled || 0) },
  { label: "Выдано", value: Number(analyticsSummary.value.orders_issued || 0) },
  {
    label: "Выручка выданных",
    value: formatMoney(Number(analyticsSummary.value.orders_amount || 0)),
  },
  {
    label: "Прибыль выданных",
    value: formatMoney(Number(analyticsSummary.value.issued_profit || 0)),
  },
  {
    label: "Положительные / отрицательные",
    value: `${Number(analyticsSummary.value.mark_counts?.positive || 0)} / ${Number(analyticsSummary.value.mark_counts?.negative || 0)}`,
  },
  {
    label: "Поставки: создано / принято",
    value: `${Number(analyticsSummary.value.procurements_created || 0)} / ${Number(analyticsSummary.value.procurements_completed || 0)}`,
  },
  {
    label: "Перемещения: создано / принято",
    value: `${Number(analyticsSummary.value.transfers_created || 0)} / ${Number(analyticsSummary.value.transfers_completed || 0)}`,
  },
  {
    label: "Ожидаемая зарплата",
    value:
      analyticsSummary.value.estimated_salary == null
        ? "Не указана"
        : formatMoney(Number(analyticsSummary.value.estimated_salary)),
    hint: "Задаётся руководителем вручную и не означает факт выплаты.",
  },
]);
const dailyActivity = computed(
  () =>
    ((staffAnalytics.value as any)?.daily_activity ||
      (staffAnalytics.value as any)?.days ||
      []) as Array<{ date: string; count?: number }>,
);
const timelineItems = computed(() => {
  const activities = (
    ((staffAnalytics.value as any)?.activities ||
      (staffAnalytics.value as any)?.events ||
      []) as Array<Record<string, any>>
  ).map((item) => ({
    key: `activity:${item.id}`,
    type: "activity" as const,
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
const salaryRows = computed(() => staffSalaries.value);
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
    salaryRows.value.find(
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
    (item) => item.id === selectedEmployeeId.value,
  );
  return employee
    ? `${employee.first_name} ${employee.last_name}`.trim()
    : "Сотрудник не выбран";
});
const activityChartLabel = computed(() => {
  if (!dailyActivity.value.length) return "Активность по дням: данных нет";
  const details = dailyActivity.value
    .map((day) => {
      const count = Number(day.count || 0);
      return `${formatDay(day.date)} — ${count} ${activityWord(count)}`;
    })
    .join("; ");
  return `Активность по дням: ${details}`;
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
function formatMinutes(value: number) {
  const minutes = Math.max(0, Math.round(value));
  return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
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
  }).format(new Date(value));
}
function dayNumber(value: string) {
  return getBusinessDateParts(new Date(value)).day;
}
function activityHeight(count: number) {
  const max = Math.max(1, ...dailyActivity.value.map((item) => Number(item.count || 0)));
  return Math.max(8, Math.round((count / max) * 100));
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
function salaryStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    draft: "Черновик",
    approved: "Подтверждена",
    paid: "Выплачена",
    published: "Опубликована",
  };
  return labels[status || "published"] || status || "Опубликована";
}
function historyVersionSummary(version: StaffHistoryVersion) {
  if (historyKind.value === "salary") {
    return `${formatMoney(Number(version.amount_minor || 0) / 100)} · ${salaryStatusLabel(version.status)}`;
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
  return labels[group] || group;
}
function notificationStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Ожидает отправки",
    sending: "Отправляется",
    sent: "Отправлено",
    failed: "Ошибка",
    unknown: "Исход неизвестен",
  };
  return labels[status] || status;
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
  return labels[type] || type || "Внутреннее уведомление";
}
function notificationRecipientLabel(item: Record<string, any>) {
  const username = String(item.recipient_username || "").replace(/^@+/, "");
  const telegramId = String(item.recipient_telegram_id || "");
  return [
    username ? `@${username}` : "",
    telegramId ? `ID ${telegramId}` : "",
  ].filter(Boolean).join(" · ") || "не указан";
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
  if (!employeeId) return;
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
  if (!selectedEmployeeId.value) return;
  try {
    await crmStore.fetchStaffMarks({
      month: selectedMonth.value,
      employeeId: selectedEmployeeId.value,
    });
  } catch {
    // Store owns the visible error.
  }
}
async function loadShifts() {
  try {
    await crmStore.fetchStaffShiftHistory({
      month: selectedMonth.value,
      employeeId: selectedEmployeeId.value || undefined,
    });
  } catch {
    // Store owns the visible error.
  }
}
async function loadNotifications() {
  try {
    await crmStore.fetchStaffNotifications();
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

async function toggleTracking() {
  if (staffSettingsLoading.value) return;
  const next = !staffTrackingEnabled.value;
  if (
    !next &&
    !window.confirm(
      "Выключить общий учёт сотрудников? Открытая смена закроется, запрет изменений заказов без смены отключится, а новые действия перестанут учитываться. История сохранится.",
    )
  ) return;
  pageMessage.value = "";
  try {
    await crmStore.updateStaffTracking(next);
    if (!next && staffOrderShiftRestrictionEnabled.value) {
      await crmStore.updateStaffOrderShiftRestriction(false);
    }
    pageMessageKind.value = "info";
    pageMessage.value = next ? "Общий учёт включён" : "Общий учёт выключен";
  } catch (error: any) {
    pageMessageKind.value = "error";
    pageMessage.value = error?.message || "Не удалось изменить настройку";
  }
}
async function toggleOrderShiftRestriction() {
  if (staffSettingsLoading.value || !staffTrackingEnabled.value) return;
  const next = !staffOrderShiftRestrictionEnabled.value;
  const confirmation = next
    ? "Включить запрет? После этого любое изменение заказа потребует открытую смену."
    : "Выключить запрет? После этого заказы снова можно будет изменять без открытой смены, и сотрудник для таких действий не будет определён.";
  if (!window.confirm(confirmation)) return;
  pageMessage.value = "";
  try {
    await crmStore.updateStaffOrderShiftRestriction(next);
    pageMessageKind.value = "info";
    pageMessage.value = next
      ? "Ограничение заказов включено"
      : "Ограничение заказов выключено";
  } catch (error: any) {
    pageMessageKind.value = "error";
    pageMessage.value = error?.message || "Не удалось изменить ограничение";
  }
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
  if (activating) {
    if (!window.confirm("Восстановить сотрудника?")) return;
  }
  const reason = activating
    ? ""
    : window.prompt("Укажите причину увольнения. История сотрудника сохранится.")?.trim();
  if (!activating && !reason) return;
  try {
    if (activating) await crmStore.restoreStaffEmployee(employee.id);
    else await crmStore.deactivateStaffEmployee(employee.id, reason!);
    pageMessageKind.value = "info";
    pageMessage.value = activating ? "Сотрудник восстановлен" : "Сотрудник деактивирован";
  } catch (error: any) {
    pageMessageKind.value = "error";
    pageMessage.value = error?.message || "Не удалось изменить статус";
  }
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
  if (!selectedEmployeeId.value || formSaving.value) return;
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
      await crmStore.createStaffMark({ employee_id: selectedEmployeeId.value, ...payload });
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
  notificationFormError.value = "";
  try {
    await crmStore.updateStaffNotificationSettings([
      { event_group: group, enabled },
    ]);
  } catch (error: any) {
    notificationFormError.value =
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
  if (!window.confirm(`Удалить @${recipient.telegram_username} из получателей?`)) return;
  notificationSaving.value = true;
  notificationFormError.value = "";
  try {
    await crmStore.removeStaffNotificationRecipient(recipient.id, {
      telegram_id: String(recipient.telegram_id),
      telegram_username: String(recipient.telegram_username),
    });
  } catch (error: any) {
    notificationFormError.value =
      error?.message || "Не удалось удалить получателя";
  } finally {
    notificationSaving.value = false;
  }
}

async function resumeNotification(item: Record<string, any>) {
  if (notificationSaving.value) return;
  const reason = window.prompt(
    "Почему отправку можно повторить? Сначала убедитесь, что сообщение не дошло.",
  )?.trim();
  if (!reason) return;
  notificationSaving.value = true;
  notificationFormError.value = "";
  try {
    await crmStore.resumeStaffNotification(item.id, reason);
  } catch (error: any) {
    notificationFormError.value =
      error?.message || "Не удалось разрешить повтор";
  } finally {
    notificationSaving.value = false;
  }
}

function handleShiftRequired(payload: { label: string; retry: () => Promise<unknown> }) {
  tasksManagerOpen.value = false;
  void shiftBarRef.value?.requestShiftRequired(payload.label, payload.retry);
}

watch(activeTab, () => void loadCurrentView());
watch(
  [
    selectedMonth,
    selectedEmployeeId,
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
  if (isStaffManager.value) await loadEmployees();
  if (isStaffManager.value && staffTrackingEnabled.value === false) {
    activeTab.value = "settings";
    return;
  }
  await loadCard();
});
</script>
