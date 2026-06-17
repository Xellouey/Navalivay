import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import ReviewForm from "@/components/reviews/ReviewForm.vue";

const quickTags = [
  { id: "tag1", label: "Вкусно", insert_text: "Вкусно" },
  { id: "tag2", label: "Быстрая доставка", insert_text: "Быстрая доставка" },
];

describe("ReviewForm", () => {
  it("keeps submit disabled until rating and 20-char body are set", async () => {
    const wrapper = mount(ReviewForm, {
      props: { quickTags },
    });

    expect(wrapper.find(".review-form__submit").attributes("disabled")).toBeDefined();

    const stars = wrapper.findAll(".review-form__star");
    await stars[4].trigger("click");
    await wrapper.find(".review-form__textarea").setValue("Коротко");
    expect(wrapper.find(".review-form__submit").attributes("disabled")).toBeDefined();

    await wrapper.find(".review-form__textarea").setValue("Достаточно длинный текст отзыва");
    expect(wrapper.find(".review-form__submit").attributes("disabled")).toBeUndefined();
    expect(wrapper.find(".review-form__counter--ok").exists()).toBe(true);

    wrapper.unmount();
  });

  it("appends quick tag text and marks chip as used", async () => {
    const wrapper = mount(ReviewForm, {
      props: { initialRating: 5, quickTags },
    });

    await wrapper.findAll(".review-form__tag")[0].trigger("click");

    expect(wrapper.find(".review-form__textarea").element).toHaveProperty(
      "value",
      "Вкусно",
    );
    expect(wrapper.find(".review-form__tag--used").exists()).toBe(true);

    wrapper.unmount();
  });

  it("emits submit payload with trimmed body and selected tags", async () => {
    const wrapper = mount(ReviewForm, {
      props: { initialRating: 4, quickTags },
    });

    await wrapper.find(".review-form__textarea").setValue("  Достаточно длинный текст отзыва  ");
    await wrapper.findAll(".review-form__tag")[0].trigger("click");
    await wrapper.find(".review-form__anonymous-input").setValue(true);
    await wrapper.find("form").trigger("submit.prevent");

    expect(wrapper.emitted("submit")).toEqual([
      [
        {
          rating: 4,
          body_text: "Достаточно длинный текст отзыва Вкусно",
          quick_tag_ids: ["tag1"],
          is_anonymous: true,
        },
      ],
    ]);

    wrapper.unmount();
  });

  it("does not submit when disabled or already submitting", async () => {
    const wrapper = mount(ReviewForm, {
      props: {
        initialRating: 5,
        initialBodyText: "Достаточно длинный текст отзыва",
        disabled: true,
      },
    });

    await wrapper.find("form").trigger("submit.prevent");
    expect(wrapper.emitted("submit")).toBeUndefined();

    await wrapper.setProps({ disabled: false, submitting: true });
    await wrapper.find("form").trigger("submit.prevent");
    expect(wrapper.emitted("submit")).toBeUndefined();

    wrapper.unmount();
  });

  it("shows server error message when provided", () => {
    const wrapper = mount(ReviewForm, {
      props: {
        initialRating: 5,
        initialBodyText: "Достаточно длинный текст отзыва",
        errorMessage: "Отзыв уже на модерации",
      },
    });

    expect(wrapper.find(".review-form__error").text()).toBe("Отзыв уже на модерации");

    wrapper.unmount();
  });
});