export const PHOTO_CACHE_MS = 24 * 60 * 60 * 1000;
export const PHOTO_RETRY_WHEN_NULL_MS = 60 * 60 * 1000;

export function shouldRefreshCustomerPhoto({
  photoUrl,
  photoUpdatedAt,
  now = Date.now(),
}) {
  const photoAge = photoUpdatedAt
    ? now - new Date(photoUpdatedAt).getTime()
    : Infinity;
  const cacheMs = photoUrl ? PHOTO_CACHE_MS : PHOTO_RETRY_WHEN_NULL_MS;
  return photoAge > cacheMs;
}

export function buildTelegramPhotoUrl(token, filePath) {
  if (!token || !filePath) {
    return null;
  }
  return `https://api.telegram.org/file/bot${token}/${filePath}`;
}

/**
 * Decide whether to persist a refreshed avatar URL after Bot API calls.
 * Keeps the cached URL when Telegram returns an ambiguous or failed refresh.
 */
export function resolveCustomerPhotoRefresh({
  cachedPhotoUrl,
  chat,
  fileData,
  token,
}) {
  if (fileData?.ok && fileData.result?.file_path) {
    return {
      photoUrl: buildTelegramPhotoUrl(token, fileData.result.file_path),
      shouldPersist: true,
    };
  }

  if (chat?.photo?.big_file_id) {
    return {
      photoUrl: cachedPhotoUrl || null,
      shouldPersist: false,
    };
  }

  if (chat && !cachedPhotoUrl && !chat.photo) {
    return {
      photoUrl: null,
      shouldPersist: true,
    };
  }

  return {
    photoUrl: cachedPhotoUrl || null,
    shouldPersist: false,
  };
}