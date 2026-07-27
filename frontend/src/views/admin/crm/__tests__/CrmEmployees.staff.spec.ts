import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import CrmEmployees from "@/views/admin/crm/CrmEmployees.vue";
import { useCrmStore, type StaffAnalytics } from "@/stores/crm";

const manager = {
  id: "manager-1",
  first_name: "Константин",
  last_name: "Жмурков",
  position: "Руководитель",
  role: "manager" as const,
  active: true,
};
const employee = {
  id: "employee-1",
  first_name: "Павел",
  last_name: "Сергеевич",
  position: "Продавец",
  role: "employee" as const,
  active: true,
};

const modalStub = {
  props: ["isOpen", "title", "description"],
  template: `
    <section v-if="isOpen" :data-modal-title="title">
      <h2>{{ title }}</h2>
      <p v-if="description">{{ description }}</p>
      <slot />
    </section>
  `,
};

function mountEmployees() {
  return mount(CrmEmployees, {
    global: {
      stubs: {
        StaffShiftBar: { template: "<div />" },
        StaffAccessModal: { template: "<div />" },
        StaffTasksModal: { template: "<div />" },
        AdminModal: modalStub,
      },
    },
  });
}

describe("CrmEmployees: вход сотрудника", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("сам загружает личные показатели после появления допуска", async () => {
    const store = useCrmStore();
    store.$patch({ staffTrackingEnabled: true });
    vi.spyOn(store, "fetchStaffSettings").mockResolvedValue({
      trackingEnabled: true,
      orderShiftRestrictionEnabled: false,
    });
    const analytics: StaffAnalytics = {
      employee: {
        id: "employee-1",
        first_name: "Павел",
        last_name: "Сергеевич",
        position: "Продавец",
        responsibilities: ["Заказы и поставки"],
        active: true,
      },
      worked_minutes: 240,
      shifts_count: 1,
      estimated_salary: 1450.5,
      mark_counts: { positive: 1, negative: 0 },
    };
    const fetchAnalytics = vi
      .spyOn(store, "fetchStaffAnalytics")
      .mockImplementation(async () => {
        store.$patch({ staffAnalytics: analytics });
        return analytics;
      });
    vi.spyOn(store, "fetchStaffMarks").mockResolvedValue([]);

    const wrapper = mount(CrmEmployees, {
      global: {
        stubs: {
          StaffShiftBar: { template: "<div />" },
          StaffAccessModal: { template: "<div />" },
          StaffTasksModal: { template: "<div />" },
          AdminModal: { template: "<div />" },
        },
      },
    });
    await flushPromises();

    store.$patch({
      staffToken: "employee-token",
      staffIdentity: {
        role: "employee",
        employee: {
          id: "employee-1",
          first_name: "Павел",
          last_name: "Сергеевич",
          position: "Продавец",
          active: true,
        },
      },
    });
    await nextTick();
    await flushPromises();

    expect(fetchAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: "employee-1", period: "month" }),
    );
    expect(wrapper.text()).toContain("Павел Сергеевич");
    expect(wrapper.text().replace(/\s/g, " ")).toContain("1 450,5 BYN");
  });

  it("явно показывает, что ожидаемая зарплата ещё не указана, и даёт текстовое описание графика", async () => {
    const store = useCrmStore();
    store.$patch({
      staffTrackingEnabled: true,
      staffToken: "employee-token",
      staffIdentity: { role: "employee", employee },
    });
    vi.spyOn(store, "fetchStaffSettings").mockResolvedValue({
      trackingEnabled: true,
      orderShiftRestrictionEnabled: false,
    });
    const analytics: StaffAnalytics = {
      employee,
      worked_minutes: 60,
      estimated_salary: null,
      daily_activity: [
        { date: "2026-07-01T00:00:00.000Z", count: 1 },
        { date: "2026-07-02T00:00:00.000Z", count: 3 },
      ],
    };
    vi.spyOn(store, "fetchStaffAnalytics").mockImplementation(async () => {
      store.$patch({ staffAnalytics: analytics });
      return analytics;
    });
    vi.spyOn(store, "fetchStaffMarks").mockResolvedValue([]);

    const wrapper = mountEmployees();
    await flushPromises();

    expect(wrapper.text()).toContain("Ожидаемая зарплата");
    expect(wrapper.text()).toContain("Не указана");
    expect(wrapper.text()).toContain("не означает факт выплаты");
    expect(wrapper.get('[role="img"]').attributes("aria-label")).toContain(
      "1 июля — 1 действие",
    );
    expect(wrapper.get('[role="img"]').attributes("aria-label")).toContain(
      "2 июля — 3 действия",
    );
  });

  it("показывает руководителю цель и текущие значения в денежных, ручных и сменных формах", async () => {
    const store = useCrmStore();
    const salary = {
      id: "salary-1",
      employee_id: employee.id,
      employee_name: "Павел Сергеевич",
      month: "2026-07",
      final_amount: 1450.5,
      status: "published",
      note: "Ожидаемая сумма",
    };
    const mark = {
      id: "mark-1",
      employee_id: employee.id,
      kind: "positive" as const,
      title: "Аккуратно принял поставку",
      description: "Без расхождений",
      occurred_at: "2026-07-25T06:55:00.000Z",
      current_version: 1,
    };
    const shift = {
      id: "shift-1",
      employee_id: employee.id,
      employee,
      status: "closed",
      started_at: "2026-07-24T07:00:00.000Z",
      ended_at: "2026-07-24T15:00:00.000Z",
      version: 1,
    };
    store.$patch({
      staffTrackingEnabled: true,
      staffOrderShiftRestrictionEnabled: true,
      staffToken: "manager-token",
      staffIdentity: { role: "manager", employee: manager },
      staffEmployees: [manager, employee],
      staffSalaries: [salary],
      staffMarks: [mark],
      staffShiftHistory: [shift],
    });
    vi.spyOn(store, "fetchStaffSettings").mockResolvedValue({
      trackingEnabled: true,
      orderShiftRestrictionEnabled: true,
    });
    vi.spyOn(store, "fetchStaffEmployees").mockResolvedValue([manager, employee]);
    vi.spyOn(store, "fetchStaffAnalytics").mockImplementation(async () => {
      const analytics: StaffAnalytics = { employee: manager };
      store.$patch({ staffAnalytics: analytics });
      return analytics;
    });
    vi.spyOn(store, "fetchStaffMarks").mockResolvedValue([mark]);
    vi.spyOn(store, "fetchStaffSalaries").mockResolvedValue([salary]);
    vi.spyOn(store, "fetchStaffShiftHistory").mockResolvedValue([shift]);

    const wrapper = mountEmployees();
    await flushPromises();

    const sectionSelect = wrapper.get("#staff-manager-section");
    expect(sectionSelect.findAll("option")).toHaveLength(7);

    await sectionSelect.setValue("salaries");
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Изменить")!
      .trigger("click");
    const salaryModal = wrapper.get('[data-modal-title="Ожидаемая зарплата"]');
    expect(salaryModal.text()).toContain("Павел Сергеевич");
    expect(salaryModal.text().toLocaleLowerCase("ru")).toContain("июль");
    expect(salaryModal.text()).toContain("2026");
    expect(salaryModal.text().replace(/\s/g, " ")).toContain("1 450,5 BYN");
    expect(salaryModal.text()).toContain("Ожидаемая зарплата, BYN");
    await salaryModal
      .findAll("button")
      .find((button) => button.text() === "Отмена")!
      .trigger("click");

    await sectionSelect.setValue("marks");
    await flushPromises();
    const marksEmployeeSelect = wrapper.get(
      '[aria-label="Сотрудник для отметок"]',
    );
    await marksEmployeeSelect.setValue(employee.id);
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Изменить")!
      .trigger("click");
    const markModal = wrapper.get('[data-modal-title="Изменить отметку"]');
    expect(markModal.text()).toContain("Павел Сергеевич");
    expect(markModal.text()).toContain(
      "Положительная · Аккуратно принял поставку",
    );
    await markModal
      .findAll("button")
      .find((button) => button.text() === "Отмена")!
      .trigger("click");

    await sectionSelect.setValue("shifts");
    await flushPromises();
    await wrapper
      .get('[aria-label="Сотрудник для истории смен"]')
      .setValue(employee.id);
    await flushPromises();
    expect(wrapper.get('[aria-label="Месяц истории смен"]').exists()).toBe(true);
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Исправить")!
      .trigger("click");
    const shiftModal = wrapper.get('[data-modal-title="Исправить смену"]');
    expect(shiftModal.text()).toContain("Павел Сергеевич");
    expect(shiftModal.text()).toContain("Текущее время");
  });

  it("полностью объясняет последствия отключения учёта и отдельно подтверждает снятие ограничения", async () => {
    const store = useCrmStore();
    store.$patch({
      staffTrackingEnabled: true,
      staffOrderShiftRestrictionEnabled: true,
      staffToken: "manager-token",
      staffIdentity: { role: "manager", employee: manager },
      staffEmployees: [manager],
    });
    vi.spyOn(store, "fetchStaffSettings").mockResolvedValue({
      trackingEnabled: true,
      orderShiftRestrictionEnabled: true,
    });
    vi.spyOn(store, "fetchStaffEmployees").mockResolvedValue([manager]);
    vi.spyOn(store, "fetchStaffAnalytics").mockImplementation(async () => {
      const analytics: StaffAnalytics = { employee: manager };
      store.$patch({ staffAnalytics: analytics });
      return analytics;
    });
    vi.spyOn(store, "fetchStaffMarks").mockResolvedValue([]);
    const updateTracking = vi.spyOn(store, "updateStaffTracking");
    const updateRestriction = vi.spyOn(
      store,
      "updateStaffOrderShiftRestriction",
    );
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    const wrapper = mountEmployees();
    await flushPromises();
    await wrapper.get("#staff-manager-section").setValue("settings");
    await flushPromises();

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Выключить")!
      .trigger("click");
    expect(confirm).toHaveBeenLastCalledWith(
      expect.stringContaining("Открытая смена закроется"),
    );
    expect(confirm).toHaveBeenLastCalledWith(
      expect.stringContaining(
        "запрет изменений заказов без смены отключится",
      ),
    );
    expect(updateTracking).not.toHaveBeenCalled();

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Выключить ограничение")!
      .trigger("click");
    expect(confirm).toHaveBeenLastCalledWith(
      expect.stringContaining(
        "заказы снова можно будет изменять без открытой смены",
      ),
    );
    expect(updateRestriction).not.toHaveBeenCalled();
  });

  it("показывает руководителю сравнимые показатели всей команды за период", async () => {
    const store = useCrmStore();
    store.$patch({
      staffTrackingEnabled: true,
      staffOrderShiftRestrictionEnabled: true,
      staffToken: "manager-token",
      staffIdentity: { role: "manager", employee: manager },
      staffEmployees: [manager, employee],
    });
    vi.spyOn(store, "fetchStaffSettings").mockResolvedValue({
      trackingEnabled: true,
      orderShiftRestrictionEnabled: true,
    });
    vi.spyOn(store, "fetchStaffEmployees").mockResolvedValue([manager, employee]);
    vi.spyOn(store, "fetchStaffAnalytics").mockImplementation(async () => {
      const analytics: StaffAnalytics = { employee: manager };
      store.$patch({ staffAnalytics: analytics });
      return analytics;
    });
    vi.spyOn(store, "fetchStaffMarks").mockResolvedValue([]);
    const team = [
      { employee: manager, worked_minutes: 60, shifts_count: 1 },
      {
        employee,
        worked_minutes: 240,
        shifts_count: 3,
        tasks_completed: 2,
        orders_assembled: 5,
        orders_issued: 4,
        orders_amount: 640,
        issued_profit: 220,
        procurements_created: 1,
        procurements_completed: 2,
        transfers_created: 3,
        transfers_completed: 1,
        mark_counts: { positive: 6, negative: 1 },
      },
    ] satisfies StaffAnalytics[];
    const fetchTeam = vi
      .spyOn(store, "fetchStaffTeamAnalytics")
      .mockImplementation(async () => {
        store.$patch({ staffTeamAnalytics: team });
        return team;
      });

    const wrapper = mountEmployees();
    await flushPromises();
    await wrapper.get("#staff-manager-section").setValue("team");
    await flushPromises();

    expect(fetchTeam).toHaveBeenCalledWith(
      expect.objectContaining({ period: "month" }),
    );
    expect(wrapper.text()).toContain("без общего искусственного балла");
    const employeeRow = wrapper
      .findAll("article")
      .find((article) => article.text().includes("Павел Сергеевич"));
    expect(employeeRow).toBeTruthy();
    expect(employeeRow!.text()).toContain("4 ч 0 мин · 3");
    expect(employeeRow!.text()).toContain("5 / 4");
    expect(employeeRow!.text().replace(/\s/g, " ")).toContain("640 BYN / 220 BYN");
    expect(employeeRow!.text()).toContain("6 / 1");
  });
});
