import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCustomerOrders } from "@/composables/useCustomerOrders";

function createJsonResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => data,
  };
}

describe("useCustomerOrders", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (window as any).Telegram = {
      WebApp: {
        initData: "signed_init_data",
      },
    };
  });

  it("fetchReviewPrompt stores prompt and opt-out preference", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/reviews/prompt") {
        return createJsonResponse({
          show: false,
          reason: "opt_out",
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { fetchReviewPrompt, reviewPrompt, reviewPreferences } = useCustomerOrders();
    const result = await fetchReviewPrompt();

    expect(result.reason).toBe("opt_out");
    expect(reviewPrompt.value?.reason).toBe("opt_out");
    expect(reviewPreferences.value.reviews_opt_out).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/reviews/prompt",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Telegram-Init-Data": "signed_init_data",
        }),
      }),
    );
  });

  it("fetchOrderHistory returns paginated cards", async () => {
    const fetchMock = vi.fn(async () =>
      createJsonResponse({
        items: [
          {
            id: "ord1",
            order_number: 1001,
            status: "delivered",
            created_at: "2026-06-01T10:00:00.000Z",
            completed_at: "2026-06-01T12:00:00.000Z",
            final_amount: 42,
            category_icons: [],
            category_icons_overflow: 0,
            pending_review_count: 1,
            has_reviews: false,
          },
        ],
        next_cursor: "2026-06-01T10:00:00.000Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { fetchOrderHistory } = useCustomerOrders();
    const data = await fetchOrderHistory({ limit: 20 });

    expect(data.items).toHaveLength(1);
    expect(data.items[0].order_number).toBe(1001);
    expect(data.next_cursor).toBe("2026-06-01T10:00:00.000Z");
  });

  it("submitReview posts payload with telegram auth headers", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          ok: true,
          review: {
            id: "rev1",
            status: "pending",
            rating: 5,
            body_text: "Отличный товар, всем рекомендую",
            is_anonymous: 1,
            created_at: "2026-06-01T12:00:00.000Z",
          },
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          show: false,
          reason: "nothing_to_review",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { submitReview } = useCustomerOrders();
    const result = await submitReview({
      order_id: "ord1",
      group_id: "grp1",
      order_item_id: "oi1",
      rating: 5,
      body_text: "Отличный товар, всем рекомендую",
      quick_tag_ids: [],
      is_anonymous: true,
    });

    expect(result.review.status).toBe("pending");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/reviews",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Telegram-Init-Data": "signed_init_data",
        }),
        body: JSON.stringify({
          order_id: "ord1",
          group_id: "grp1",
          order_item_id: "oi1",
          rating: 5,
          body_text: "Отличный товар, всем рекомендую",
          quick_tag_ids: [],
          is_anonymous: true,
        }),
      }),
    );
  });

  it("fetchOrderDetail returns reviewable lines", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/orders/ord1/detail") {
        return createJsonResponse({
          id: "ord1",
          order_number: 1001,
          status: "delivered",
          created_at: "2026-06-01T10:00:00.000Z",
          completed_at: "2026-06-01T12:00:00.000Z",
          final_amount: 42,
          fulfillment: null,
          status_timeline: [],
          lottery_hint_text: null,
          reviewable_lines: [
            {
              group_id: "grp1",
              group_name: "Подонки",
              eligibility: { canReview: true, reason: null, cooldownEndsAt: null },
            },
          ],
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { fetchOrderDetail } = useCustomerOrders();
    const detail = await fetchOrderDetail("ord1");

    expect(detail.order_number).toBe(1001);
    expect(detail.reviewable_lines).toHaveLength(1);
  });

  it("fetchGroupReviews returns public approved items only shape", async () => {
    const fetchMock = vi.fn(async () =>
      createJsonResponse({
        group_id: "grp1",
        review_count: 1,
        average_rating: 5,
        items: [
          {
            id: "rev1",
            rating: 5,
            body_text: "Отличный вкус",
            purchased_variant_name: "Ананас",
            quick_tag_labels: ["Вкусно"],
            created_at: "2026-06-01T10:00:00.000Z",
            manager_reply: null,
            reviewer: {
              display_name: "Покупатель",
              photo_url: null,
              is_anonymous: false,
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { fetchGroupReviews } = useCustomerOrders();
    const data = await fetchGroupReviews("grp1", { limit: 10 });

    expect(data.review_count).toBe(1);
    expect(data.items[0].reviewer.display_name).toBe("Покупатель");
    expect(fetchMock).toHaveBeenCalledWith("/api/groups/grp1/reviews?limit=10");
  });

  it("updateReviewPreferences syncs local state", async () => {
    const fetchMock = vi.fn(async () =>
      createJsonResponse({
        ok: true,
        reviews_opt_out: true,
        reviews_prefer_anonymous: true,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { updateReviewPreferences, reviewPreferences } = useCustomerOrders();
    await updateReviewPreferences({
      reviews_opt_out: true,
      reviews_prefer_anonymous: true,
    });

    expect(reviewPreferences.value.reviews_opt_out).toBe(true);
    expect(reviewPreferences.value.reviews_prefer_anonymous).toBe(true);
  });
});