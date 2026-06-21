import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useCatalogStore } from "@/stores/catalog";

describe("catalog group images", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  it("updates category group coverImage after fetchGroupImage succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ image: "data:image/png;base64,abc" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const store = useCatalogStore();
    store.categories = [
      {
        id: "cat-1",
        slug: "snus",
        name: "Снюс",
        order: 0,
        productCount: 1,
        groups: [
          {
            id: "leaf-1",
            slug: "leaf-1",
            name: "Снюс ICEBERG 150MG",
            order: 0,
            productCount: 1,
            parentId: "brand-1",
            hasCoverImage: true,
            coverImage: null,
          },
        ],
      },
    ];

    const image = await store.fetchGroupImage("leaf-1");

    expect(image).toBe("data:image/png;base64,abc");
    expect(store.getGroupImage("leaf-1")).toBe("data:image/png;base64,abc");
    expect(store.categories[0].groups[0].coverImage).toBe("data:image/png;base64,abc");
    expect(fetchMock).toHaveBeenCalledWith("/api/category-groups/leaf-1/image");
  });

  it("loadGroupImages fetches nested groups that are not root-level", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ image: "data:image/png;base64,xyz" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const store = useCatalogStore();
    store.categories = [
      {
        id: "cat-1",
        slug: "snus",
        name: "Снюс",
        order: 0,
        productCount: 1,
        groups: [
          {
            id: "leaf-1",
            slug: "leaf-1",
            name: "Снюс DRYMOST 200MG",
            order: 0,
            productCount: 2,
            parentId: "brand-1",
            hasCoverImage: true,
            coverImage: null,
          },
          {
            id: "leaf-2",
            slug: "leaf-2",
            name: "Снюс GLITCH 200MG",
            order: 1,
            productCount: 1,
            parentId: "brand-2",
            hasCoverImage: true,
            coverImage: null,
          },
        ],
      },
    ];

    await store.loadGroupImages(["leaf-1", "leaf-2"]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(store.categories[0].groups[0].coverImage).toBe("data:image/png;base64,xyz");
    expect(store.categories[0].groups[1].coverImage).toBe("data:image/png;base64,xyz");
  });
});