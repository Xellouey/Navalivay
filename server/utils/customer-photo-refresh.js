import {
  resolveCustomerPhotoRefresh,
  shouldRefreshCustomerPhoto,
} from './customer-photo.js';

export async function refreshCustomerPhotoIfStale(
  customer,
  { token, fetchTelegramChat, db, forceRefresh = false },
) {
  if (!customer?.id) {
    return null;
  }

  let photoUrl = customer.photo_url || null;
  if (
    !customer.telegram_id
    || !token
    || !fetchTelegramChat
    || (
      !forceRefresh
      && !shouldRefreshCustomerPhoto({
        photoUrl,
        photoUpdatedAt: customer.photo_updated_at,
      })
    )
  ) {
    return photoUrl;
  }

  try {
    const chat = await fetchTelegramChat(customer.telegram_id);
    let fileData = null;

    if (chat?.photo?.big_file_id) {
      const fileResp = await fetch(
        `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(chat.photo.big_file_id)}`,
      );
      fileData = await fileResp.json();
    }

    const refresh = resolveCustomerPhotoRefresh({
      cachedPhotoUrl: photoUrl,
      chat,
      fileData,
      token,
    });
    photoUrl = refresh.photoUrl;

    if (refresh.shouldPersist) {
      db.prepare(`
        UPDATE customers
        SET photo_url = ?,
            photo_updated_at = DATETIME('now'),
            updated_at = DATETIME('now')
        WHERE id = ?
      `).run(photoUrl, customer.id);
    }
  } catch (error) {
    console.warn('[customer-photo] Failed to refresh Telegram photo:', error.message);
  }

  return photoUrl;
}

export async function fetchCustomerPhotoBytes(photoUrl) {
  if (!photoUrl) {
    return null;
  }

  const response = await fetch(photoUrl);
  if (!response.ok) {
    return null;
  }

  return {
    body: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') || 'image/jpeg',
  };
}