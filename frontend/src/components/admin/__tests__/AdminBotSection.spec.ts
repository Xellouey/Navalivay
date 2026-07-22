import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import AdminBotSection from "@/components/admin/AdminBotSection.vue";

function jsonResponse(data: unknown) {
  return {
    ok: true,
    json: async () => data,
  };
}

describe("AdminBotSection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("explains that status templates use only the short customer order number", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/status")) {
        return jsonResponse({
          auto_replies_enabled: false,
          bot_token_configured: false,
          bot_token_live: false,
          bot_token_error: null,
          bot_process_online: false,
          active_connection: null,
          connections: [],
          userbot_connected: false,
          delivery_ready: false,
          quick_reply_count: 0,
          quick_reply_active_count: 0,
          status_templates: [{
            id: 1,
            event: "order_accepted",
            title: "Заказ принят",
            body: "Заказ {order_number}",
            is_active: 1,
          }],
          recent_log_count: 0,
        });
      }
      return jsonResponse({ items: [] });
    }));

    const wrapper = mount(AdminBotSection, {
      global: {
        stubs: { AdminModal: true },
      },
    });
    await flushPromises();

    const statusTab = wrapper.findAll("button").find((button) =>
      button.text().includes("Шаблоны статусов"),
    );
    expect(statusTab).toBeTruthy();
    await statusTab!.trigger("click");

    expect(wrapper.text()).toContain("{order_number}");
    expect(wrapper.text()).toContain("{pickup_cell_number}");
    expect(wrapper.text()).toContain("короткий активный номер для клиента");
    expect(wrapper.text()).toContain(
      "Длинный внутренний номер в клиентские статусные шаблоны не подставляется",
    );
  });
});
