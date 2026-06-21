import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ReviewRatingLink from "@/components/reviews/ReviewRatingLink.vue";

describe("ReviewRatingLink", () => {
  it("renders decimal average and count", () => {
    const wrapper = mount(ReviewRatingLink, {
      props: { count: 12, averageRating: 4.83 },
    });

    expect(wrapper.text()).toContain("4.8");
    expect(wrapper.text()).toContain("(12)");
  });

  it("hides when count is zero", () => {
    const wrapper = mount(ReviewRatingLink, {
      props: { count: 0, averageRating: null },
    });

    expect(wrapper.find(".review-rating-link").exists()).toBe(false);
  });

  it("emits click", async () => {
    const wrapper = mount(ReviewRatingLink, {
      props: { count: 3, averageRating: 5 },
    });

    await wrapper.find("button").trigger("click");
    expect(wrapper.emitted("click")).toHaveLength(1);
  });
});