# Category Groups (Линейки) Display Logic

## Overview

Category groups (линейки) are product lines within categories. For example:
- Category: "Жидкости" (Liquids)
- Groups: "PODONKI LAST HAP [60MG]", "ANNIMA LOVE [70MG]", etc.

## Architecture

### Database Structure

```sql
-- Categories (top-level)
categories (id, slug, name, order, cover_image, hide_empty, display_mode)

-- Category Groups (product lines within categories)
category_groups (id, categoryId, slug, name, cover_image, order, hide_empty, parent_group_id)

-- Products belong to a category AND optionally a group
products (id, categoryId, groupId, title, stock, has_variants, ...)
```

### Hierarchical Groups

Groups can have parent-child relationships via `parent_group_id`:
```
PODONKI (parent)
├── PODONKI LAST HAP [60MG]
├── PODONKI SOUR [60MG]
└── PODONKI CRITICAL [70MG]
```

## API Endpoints

### GET /api/categories

Returns categories with their groups and product counts.

**Response structure:**
```json
{
  "id": "c_liquids_salt",
  "name": "Жидкости",
  "productCount": 204,
  "groups": [
    {
      "id": "cg_ecrv2q",
      "name": "PODONKI LAST HAP [60MG]",
      "productCount": 14,        // Products directly in this group (in stock)
      "totalProductCount": 14,   // Including child groups
      "parentId": "cg_eb5o0w"
    }
  ]
}
```

**Important:** `productCount` only includes products with `stock > 0`.

### GET /api/products

Returns products with pagination.

**Parameters:**
- `category` - filter by category slug
- `group` - filter by group slug
- `limit` - max items (default 50, max 1000)
- `offset` - pagination offset
- `sort` - sorting option

**Stock filter:** Products with `stock = 0` are automatically excluded.

## Frontend Implementation

### Catalog Store (`stores/catalog.ts`)

Two product arrays:
```typescript
products: ref<Product[]>([])      // Paginated, filtered by active category/group
allProducts: ref<Product[]>([])   // Full list (up to 1000), for building trees
```

**Initialization:**
```typescript
async function initialize() {
  await Promise.all([
    fetchCategories(),
    fetchBanners(),
    fetchProducts(),
    fetchAllProducts()  // Loads up to 1000 products
  ])
}
```

### HomeView.vue - Building Group Trees

**CRITICAL:** Use `allProducts`, not `products` for building group trees!

```typescript
// ✅ CORRECT
const groupCards = computed<GroupCardNode[]>(() => {
  const productsPool = catalogStore.allProducts.length 
    ? catalogStore.allProducts 
    : catalogStore.products
  const categoryProducts = productsPool.filter(p => p.categoryId === selectedCategory.value!.id)
  // ... build tree
})

// ❌ WRONG - will show empty groups
const groupCards = computed<GroupCardNode[]>(() => {
  const categoryProducts = catalogStore.products.filter(...)  // Only 20 items!
})
```

### Display Modes

Categories have `displayMode`:
- `default` - standard grid layout
- `liquid` - special layout for liquids with expandable groups
- `visual` - visual showcase mode

```typescript
function resolveCategoryDisplayMode(category: Category): 'default' | 'liquid' | 'visual' {
  if (category.displayMode === 'liquid' || category.displayMode === 'visual') {
    return category.displayMode
  }
  // Auto-detect liquid categories by slug/name
  if (slug.includes('liquid') || name.includes('жидк')) {
    return 'liquid'
  }
  return 'default'
}
```

### Group Expansion State

```typescript
const groupExpansionState = ref<Record<string, boolean>>({})

function isGroupExpanded(groupId: string): boolean {
  return groupExpansionState.value[groupId] ?? false
}

function toggleGroupExpansion(groupId: string) {
  groupExpansionState.value = {
    ...groupExpansionState.value,
    [groupId]: !isGroupExpanded(groupId)
  }
}
```

## Common Issues

### Issue: Groups show but are empty when expanded

**Symptoms:**
- Category groups (линейки) are visible
- Clicking to expand shows no products
- Products exist in admin panel

**Causes:**
1. **Stock = 0** - Products are out of stock (expected behavior)
2. **Using wrong store property** - `products` instead of `allProducts`
3. **API limit too low** - Not all products loaded

**Debugging:**
```bash
# Check stock
sqlite3 server/data/navalivay.db "SELECT title, stock FROM products WHERE groupId = 'cg_xxx' LIMIT 10"

# Check API response
curl -s "http://localhost:8082/api/products?limit=1000" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Total: {d[\"total\"]}, Returned: {len(d[\"products\"])}')"
```

### Issue: Some groups missing entirely

**Cause:** Groups with `totalProductCount = 0` are filtered out.

**Check in API response:**
```bash
curl -s "http://localhost:8082/api/categories" | python3 -c "
import sys,json
cats = json.load(sys.stdin)
for cat in cats:
  print(f'{cat[\"name\"]}: {len(cat[\"groups\"])} groups')
  for g in cat['groups'][:5]:
    print(f'  - {g[\"name\"]}: {g[\"productCount\"]} products')
"
```

### Issue: Parent groups show 0 products but have children

**Expected behavior:** Parent groups aggregate `totalProductCount` from children.

```json
{
  "name": "PODONKI",
  "productCount": 0,        // No products directly in parent
  "totalProductCount": 64   // Sum of all child groups
}
```

## Performance Considerations

### API Limits

```javascript
// server/routes/public.js
const limit = Math.min(Math.max(parseInt(req.query.limit ?? '50', 10) || 50, 1), 1000);
```

- Default: 50 items
- Maximum: 1000 items
- Frontend `fetchAllProducts()` requests 1000

### Response Size

Products API does NOT include:
- Category cover images (loaded separately)
- Group cover images (loaded separately)
- Base64 encoded images

This keeps response size manageable (~50-100 KB for 300+ products).

## Files Reference

| File | Purpose |
|------|---------|
| `server/routes/public.js` | API endpoints, stock filtering, pagination |
| `frontend/src/stores/catalog.ts` | Products/allProducts state, fetchAllProducts() |
| `frontend/src/views/HomeView.vue` | Group tree building, expansion state |
| `frontend/src/components/product/GroupLineItem.vue` | Single group row component |
| `frontend/src/components/product/liquid/LiquidLineTree.vue` | Liquid mode tree |

## Changelog

### January 9, 2026
- Fixed: Groups showing empty when expanded
- Changed: `HomeView.vue` now uses `allProducts` for group trees
- Changed: API max limit increased from 100 to 1000
