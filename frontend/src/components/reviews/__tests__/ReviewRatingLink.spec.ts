import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ReviewRatingLink from "@/components/reviews/ReviewRatingLink.vue";

describe("ReviewRatingLink", () => {
  it("renders rating and separate view-reviews action", () => {
    const wrapper = mount(ReviewRatingLink, {
      props: { count: 12, averageRating: 4.83 },
    });

    expect(wrapper.text()).toContain("4.8");
    expect(wrapper.text()).toContain("(12)");
    expect(wrapper.text()).toContain("посмотреть отзывы");
  });

  it("shows empty state when there are no reviews", () => {
    const wrapper = mount(ReviewRatingLink, {
      props: { count: 0, averageRating: null },
    });

    expect(wrapper.text()).toContain("нет отзывов");
    expect(wrapper.find(".review-rating-row__action").exists()).toBe(false);
  });

  it("hides row until review summary is ready", () => {
    const wrapper = mount(ReviewRatingLink, {
      props: { count: 0, averageRating: null, ready: false },
    });

    expect(wrapper.find(".review-rating-row").exists()).toBe(false);
  });

  it("emits click from view-reviews action", async () => {
    const wrapper = mount(ReviewRatingLink, {
      props: { count: 3, averageRating: 5 },
    });

    await wrapper.find(".review-rating-row__action").trigger("click");
    expect(wrapper.emitted("click")).toHaveLength(1);
  });
});