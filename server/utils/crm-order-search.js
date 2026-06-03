export function isNumericCrmOrderSearch(searchTerm) {
  return /^\d+$/.test(String(searchTerm || '').trim());
}

export function escapeSqlLike(value) {
  return String(value).replace(/[\\%_]/g, (match) => `\\${match}`);
}

export function buildCrmOrdersSearch({ searchTerm }) {
  const term = String(searchTerm || '').trim();

  if (!term) {
    return {
      whereClause: '',
      params: [],
      orderBy: 'o.created_at DESC',
      orderByParams: [],
      mode: 'none',
    };
  }

  if (isNumericCrmOrderSearch(term)) {
    return {
      whereClause: `o.order_number_search LIKE ? ESCAPE '\\'`,
      params: [`${escapeSqlLike(term)}%`],
      orderBy: `CASE WHEN o.order_number_search = ? THEN 0 ELSE 1 END, o.created_at DESC`,
      orderByParams: [term],
      mode: 'order_number_prefix',
    };
  }

  const likePattern = `%${term}%`;
  return {
    whereClause: `(CAST(o.order_number AS TEXT) LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.telegram_username LIKE ? OR o.telegram_username LIKE ?)`,
    params: [likePattern, likePattern, likePattern, likePattern, likePattern],
    orderBy: 'o.created_at DESC',
    orderByParams: [],
    mode: 'legacy',
  };
}
