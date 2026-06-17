import { ref } from "vue";
import { withTelegramAuthHeaders } from "@/utils/telegramAuth";

export interface ReviewPrompt {
  show: boolean;
  reason?: string;
  order_id?: string;
  order_number?: number;
  group_id?: string;
  group_name?: string;
  purchased_variant_name?: string | null;
  pending_review_count?: number;
  lottery_hint_text?: string;
}

export interface OrderHistoryCategoryIcon {
  category_id: string | null;
  category_name: string | null;
  image: string | null;
}

export interface OrderHistoryItem {
  id: string;
  order_number: number;
  status: string;
  created_at: string;
  completed_at: string | null;
  final_amount: number;
  category_icons: OrderHistoryCategoryIcon[];
  category_icons_overflow: number;
  pending_review_count: number;
  has_reviews: boolean;
}

export interface OrderHistoryResponse {
  items: OrderHistoryItem[];
  next_cursor: string | null;
}

export interface ReviewEligibility {
  canReview: boolean;
  reason: string;
  cooldownEndsAt?: string;
  reviewId?: string;
  existingReview?: {
    id: string;
    status: string;
    rating: number;
    created_at: string;
  };
  orderId?: string;
  orderItemId?: string;
  purchasedVariantId?: string | null;
  purchasedVariantName?: string | null;
}

export interface ReviewableLineItem {
  id: string;
  product_id: string;
  product_title: string;
  base_product_title: string;
  variant_id: string | null;
  variant_name: string | null;
  quantity: number;
  total_price: number;
  image: string | null;
}

export interface ReviewableLine {
  group_id: string;
  group_name: string;
  category_id: string | null;
  category_name: string | null;
  category_cover_image: string | null;
  group_cover_image: string | null;
  review_category_key: string;
  order_item_id: string | null;
  purchased_variant_id: string | null;
  purchased_variant_name: string | null;
  items: ReviewableLineItem[];
  eligibility: ReviewEligibility;
  latest_review: {
    id: string;
    status: string;
    rating: number;
    created_at: string;
  } | null;
}

export interface OrderStatusTimelineEntry {
  previous_status: string | null;
  new_status: string;
  changed_at: string;
  note: string | null;
}

export interface OrderFulfillment {
  created_at: string;
  completed_at: string;
  duration_minutes: number;
}

export interface OrderDetail {
  id: string;
  order_number: number;
  status: string;
  delivery_type: string;
  delivery_address: string | null;
  phone: string | null;
  notes: string | null;
  total_amount: number;
  discount_amount: number;
  final_amount: number;
  promo_code_text: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  fulfillment: OrderFulfillment | null;
  status_timeline: OrderStatusTimelineEntry[];
  reviewable_lines: ReviewableLine[];
  lottery_hint_text: string;
}

export interface QuickTag {
  id: string;
  label: string;
  insert_text: string;
  sort_order: number;
}

export interface SubmitReviewPayload {
  order_id: string;
  group_id: string;
  order_item_id?: string | null;
  rating: number;
  body_text: string;
  quick_tag_ids?: string[];
  is_anonymous?: boolean;
}

export interface SubmitReviewResult {
  ok: boolean;
  review: {
    id: string;
    status: string;
    rating: number;
    body_text: string;
    is_anonymous: number;
    created_at: string;
  };
}

export interface ReviewPreferences {
  reviews_opt_out: boolean;
  reviews_prefer_anonymous: boolean;
}

export interface GroupReviewReviewer {
  display_name: string;
  photo_url: string | null;
  is_anonymous: boolean;
}

export interface GroupReviewItem {
  id: string;
  rating: number;
  body_text: string;
  purchased_variant_name: string | null;
  quick_tag_labels: string[];
  reviewer: GroupReviewReviewer;
  manager_reply: string | null;
  manager_replied_at: string | null;
  created_at: string;
  approved_at: string | null;
}

export interface GroupReviewsResponse {
  group_id: string;
  review_count: number;
  average_rating: number | null;
  items: GroupReviewItem[];
}

const reviewPrompt = ref<ReviewPrompt | null>(null);
const reviewPreferences = ref<ReviewPreferences>({
  reviews_opt_out: false,
  reviews_prefer_anonymous: false,
});

let inflightPrompt: Promise<ReviewPrompt> | null = null;

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (data as { message?: string }).message ||
      (data as { error?: string }).error ||
      "Не удалось выполнить запрос";
    throw new Error(message);
  }
  return data as T;
}

export function useCustomerOrders() {
  async function fetchReviewPrompt(): Promise<ReviewPrompt> {
    if (inflightPrompt) return inflightPrompt;

    inflightPrompt = (async () => {
      const response = await fetch("/api/reviews/prompt", {
        headers: withTelegramAuthHeaders(),
      });
      const data = await parseJsonResponse<ReviewPrompt>(response);
      reviewPrompt.value = data;

      if (data.reason === "opt_out") {
        reviewPreferences.value = {
          ...reviewPreferences.value,
          reviews_opt_out: true,
        };
      }

      return data;
    })().finally(() => {
      inflightPrompt = null;
    });

    return inflightPrompt;
  }

  async function fetchOrderHistory(options: {
    cursor?: string | null;
    limit?: number;
  } = {}): Promise<OrderHistoryResponse> {
    const params = new URLSearchParams();
    if (options.cursor) params.set("cursor", options.cursor);
    if (options.limit) params.set("limit", String(options.limit));

    const query = params.toString();
    const response = await fetch(
      `/api/orders/my-history${query ? `?${query}` : ""}`,
      { headers: withTelegramAuthHeaders() },
    );
    return parseJsonResponse<OrderHistoryResponse>(response);
  }

  async function fetchOrderDetail(orderId: string): Promise<OrderDetail> {
    const response = await fetch(
      `/api/orders/${encodeURIComponent(orderId)}/detail`,
      { headers: withTelegramAuthHeaders() },
    );
    return parseJsonResponse<OrderDetail>(response);
  }

  async function fetchQuickTags(
    categoryKey: string,
    starRating: number,
  ): Promise<QuickTag[]> {
    const params = new URLSearchParams({
      category_key: categoryKey,
      star_rating: String(starRating),
    });
    const response = await fetch(`/api/reviews/quick-tags?${params}`, {
      headers: withTelegramAuthHeaders(),
    });
    const data = await parseJsonResponse<{ items: QuickTag[] }>(response);
    return data.items || [];
  }

  async function submitReview(
    payload: SubmitReviewPayload,
  ): Promise<SubmitReviewResult> {
    const response = await fetch("/api/reviews", {
      method: "POST",
      headers: withTelegramAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(payload),
    });
    const result = await parseJsonResponse<SubmitReviewResult>(response);

    // Refresh prompt after successful submission.
    void fetchReviewPrompt().catch(() => undefined);

    return result;
  }

  async function updateReviewPreferences(
    prefs: Partial<ReviewPreferences>,
  ): Promise<ReviewPreferences> {
    const response = await fetch("/api/profile/review-preferences", {
      method: "PATCH",
      headers: withTelegramAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(prefs),
    });
    const data = await parseJsonResponse<{
      ok: boolean;
      reviews_opt_out: boolean;
      reviews_prefer_anonymous: boolean;
    }>(response);

    reviewPreferences.value = {
      reviews_opt_out: Boolean(data.reviews_opt_out),
      reviews_prefer_anonymous: Boolean(data.reviews_prefer_anonymous),
    };

    if (reviewPreferences.value.reviews_opt_out) {
      reviewPrompt.value = { show: false, reason: "opt_out" };
    } else {
      void fetchReviewPrompt().catch(() => undefined);
    }

    return reviewPreferences.value;
  }

  async function fetchGroupReviews(
    groupId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<GroupReviewsResponse> {
    const params = new URLSearchParams();
    if (options.limit) params.set("limit", String(options.limit));
    if (options.offset) params.set("offset", String(options.offset));

    const query = params.toString();
    const response = await fetch(
      `/api/groups/${encodeURIComponent(groupId)}/reviews${query ? `?${query}` : ""}`,
    );
    return parseJsonResponse<GroupReviewsResponse>(response);
  }

  async function fetchGroupReviewSummary(
    groupId: string,
  ): Promise<Pick<GroupReviewsResponse, "review_count" | "average_rating">> {
    const data = await fetchGroupReviews(groupId, { limit: 1, offset: 0 });
    return {
      review_count: data.review_count,
      average_rating: data.average_rating,
    };
  }

  return {
    reviewPrompt,
    reviewPreferences,
    fetchReviewPrompt,
    fetchOrderHistory,
    fetchOrderDetail,
    fetchQuickTags,
    submitReview,
    updateReviewPreferences,
    fetchGroupReviews,
    fetchGroupReviewSummary,
  };
}

export function formatOrderStatus(status: string): string {
  const map: Record<string, string> = {
    new: "Новый",
    in_progress: "Готов к выдаче",
    delivered: "Доставлен",
    completed: "Завершён",
    cancelled: "Отменён",
  };
  return map[status] || status;
}

export function formatOrderDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatOrderDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours} ч`;
  return `${hours} ч ${rest} мин`;
}