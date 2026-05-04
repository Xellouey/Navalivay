/**
 * Unit-тест для крайне важного инварианта:
 * fetchAPI при 401 НЕ должна делать window.location reload, а:
 *   1. Сбрасывать adminStore.isAuthenticated → false (реактивно)
 *   2. Бросать UnauthorizedError (типизированный маркер)
 *
 * Регрессия (которую этот тест ловит) — давний баг с бесконечным reload-циклом
 * при заходе незалогиненного пользователя на /admin: window.location.href = "/admin"
 * → новый mount CashierLockScreen → новый 401 → новый reload → ...
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useAdminStore } from "@/stores/admin";
import { useCrmStore, UnauthorizedError } from "@/stores/crm";

describe("crm.fetchAPI — обработка 401", () => {
  // Сохраняем оригинальный дескриптор window.location, чтобы восстанавливать
  // его после каждого теста, который мог его подменить (vi.unstubAllGlobals
  // не снимает прямой Object.defineProperty).
  const originalLocationDescriptor = Object.getOwnPropertyDescriptor(
    window,
    "location",
  );

  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (originalLocationDescriptor) {
      Object.defineProperty(window, "location", originalLocationDescriptor);
    }
  });

  it("при 401 сбрасывает admin auth-state и бросает UnauthorizedError", async () => {
    const adminStore = useAdminStore();
    adminStore.isAuthenticated = true;
    adminStore.token = "stub-token";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 401 })),
    );

    const crmStore = useCrmStore();
    await expect(crmStore.fetchEmployees()).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(adminStore.isAuthenticated).toBe(false);
    expect(adminStore.token).toBe("");
  });

  it("при 401 не делает window.location reload (защита от бесконечного цикла)", async () => {
    const reloadSpy = vi.fn();
    const hrefSetter = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        get href() {
          return "http://localhost/admin";
        },
        set href(value: string) {
          hrefSetter(value);
        },
        reload: reloadSpy,
        pathname: "/admin",
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 401 })),
    );

    const crmStore = useCrmStore();
    await expect(crmStore.fetchEmployees()).rejects.toBeInstanceOf(
      UnauthorizedError,
    );

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(hrefSetter).not.toHaveBeenCalled();
  });

  it("повторные параллельные 401 идемпотентны (не падают, logout вызывается единожды)", async () => {
    const adminStore = useAdminStore();
    adminStore.isAuthenticated = true;
    const logoutSpy = vi.spyOn(adminStore, "logout");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 401 })),
    );

    const crmStore = useCrmStore();
    const results = await Promise.allSettled([
      crmStore.fetchEmployees(),
      crmStore.fetchEmployees(),
      crmStore.fetchEmployees(),
    ]);

    // Все три должны зафейлиться UnauthorizedError-ом, ни одна — другим типом
    for (const r of results) {
      expect(r.status).toBe("rejected");
      if (r.status === "rejected") {
        expect(r.reason).toBeInstanceOf(UnauthorizedError);
      }
    }
    // Гард `if (adminStore.isAuthenticated)` гарантирует ровно один logout:
    // первый 401 переключает isAuthenticated → false, остальные пропускают вызов.
    // Строгое равенство ловит обе регрессии — и «вызвалось дважды», и «не вызвалось вообще».
    expect(logoutSpy).toHaveBeenCalledTimes(1);
  });

  it("успешный ответ не трогает auth-state", async () => {
    const adminStore = useAdminStore();
    adminStore.isAuthenticated = true;

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    const crmStore = useCrmStore();
    await crmStore.fetchEmployees();
    expect(adminStore.isAuthenticated).toBe(true);
  });
});
