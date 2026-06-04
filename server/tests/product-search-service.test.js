import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "navalivay-product-search-service-"));
const tempDbPath = path.join(tempDir, "test.db");

process.env.DATABASE_FILE = tempDbPath;
process.env.BOT_TOKEN = "";

const { initDb, db } = await import("../db.js");
const {
  searchProductsForAdmin,
  searchProductsForCrm,
  syncProductSearchIndex,
} = await import("../services/product-search-service.js");

initDb();

db.exec(`
  DELETE FROM product_images;
  DELETE FROM product_links;
  DELETE FROM product_variants;
  DELETE FROM products;
  DELETE FROM category_groups;
  DELETE FROM categories;
`);

function seedBaseCatalog() {
  db.prepare(`
    INSERT INTO categories (id, slug, name, [order], hide_empty, display_mode)
    VALUES
      ('cat_hookah', 'kalyanka', 'Кальянка', 1, 0, 'default'),
      ('cat_other', 'other', 'Другая', 2, 0, 'default')
  `).run();

  db.prepare(`
    INSERT INTO category_groups (id, categoryId, slug, name, [order], hide_empty, cover_image)
    VALUES
      ('group_catswill', 'cat_hookah', 'catswill', 'CATSWILL', 1, 0, ?),
      ('group_lit', 'cat_hookah', 'lit-energy', 'Lit Energy', 2, 0, NULL)
  `).run(`data:image/png;base64,${"a".repeat(2048)}`);

  db.prepare(`
    INSERT INTO products (
      id, categoryId, groupId, title, priceRub, description, stock, cost_price, min_stock, has_variants, createdAt
    )
    VALUES
      ('prod_green', 'cat_hookah', 'group_catswill', 'Зеленое яблоко', 10, '', 4, 1, 0, 0, DATETIME('now')),
      ('prod_peach', 'cat_hookah', NULL, 'Персик нектарин', 10, '', 0, 1, 0, 0, DATETIME('now')),
      ('prod_lit', 'cat_hookah', 'group_lit', 'Манго лед', 10, '', 1, 1, 0, 0, DATETIME('now')),
      ('prod_variant', 'cat_hookah', 'group_catswill', 'Сменный картридж', 10, '', 1, 1, 0, 1, DATETIME('now')),
      ('prod_other_peach', 'cat_other', NULL, 'Персик чужой', 10, '', 1, 1, 0, 0, DATETIME('now'))
  `).run();

  db.prepare(`
    INSERT INTO product_variants (id, product_id, name, color_code, color_display_mode, price_rub, stock, position)
    VALUES ('var_mint', 'prod_variant', 'Мята', '#00aa00', 'color', 12, 3, 0)
  `).run();
}

try {
  seedBaseCatalog();
  syncProductSearchIndex();

  const broad = searchProductsForCrm({ search: "catswil zene", limit: 10 });
  assert.ok(broad.some((product) => product.id === "prod_green"));
  assert.ok(broad.some((product) => String(product.image || "").startsWith("data:image")));

  const cyrillic = searchProductsForAdmin({
    search: "персик",
    categoryId: "cat_hookah",
    limit: 10,
  });
  assert.deepEqual(cyrillic.products.map((product) => product.id), ["prod_peach"]);

  const group = searchProductsForAdmin({ search: "  Lit   Energy ", limit: 10 });
  assert.deepEqual(group.products.map((product) => product.id), ["prod_lit"]);

  const variants = searchProductsForCrm({ search: "мята", limit: 10 });
  assert.equal(variants[0].id, "var_mint");
  assert.equal(variants[0].is_variant, true);

  db.prepare("UPDATE products SET groupId = NULL WHERE groupId = 'group_lit'").run();
  db.prepare("DELETE FROM category_groups WHERE id = 'group_lit'").run();
  syncProductSearchIndex();

  const staleGroup = searchProductsForAdmin({ search: "Lit Energy", limit: 10 });
  assert.equal(staleGroup.pagination.total, 0);

  const stillByTitle = searchProductsForAdmin({ search: "манго", limit: 10 });
  assert.deepEqual(stillByTitle.products.map((product) => product.id), ["prod_lit"]);

  console.log("product-search-service tests passed");
} finally {
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
}
