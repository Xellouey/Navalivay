import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { db } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseUploads = path.resolve(process.env.UPLOADS_DIR || path.resolve(__dirname, '../../uploads'));
const thumbnailDir = path.resolve(baseUploads, 'thumbnails', 'search');
const thumbnailUrlPrefix = '/uploads/thumbnails/search';
const failedThumbnailSources = new Set();

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sourceHash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function parseBase64Image(value) {
  const match = String(value).match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  return match ? Buffer.from(match[1], 'base64') : null;
}

function uploadsPathFromUrl(value) {
  const source = String(value || '');
  if (!source.startsWith('/uploads/')) return null;
  const rel = source.slice('/uploads/'.length).replace(/\\/g, '/');
  const resolved = path.resolve(baseUploads, rel);
  return resolved.startsWith(baseUploads) ? resolved : null;
}

async function sourceToBuffer(source) {
  if (!source) return null;
  if (String(source).startsWith('data:image/')) {
    return parseBase64Image(source);
  }
  const uploadPath = uploadsPathFromUrl(source);
  if (uploadPath && fs.existsSync(uploadPath)) {
    return await fs.promises.readFile(uploadPath);
  }
  return null;
}

export async function resolveImageThumbnail(source, meta = {}) {
  if (!source) return null;
  const value = String(source);
  if (!value.startsWith('data:image/') && !value.startsWith('/uploads/')) {
    return value;
  }

  const hash = sourceHash(value);
  if (failedThumbnailSources.has(hash)) {
    return value.startsWith('/uploads/') ? value : null;
  }
  const cached = db
    .prepare('SELECT thumbnail_url AS thumbnailUrl FROM image_thumbnail_cache WHERE source_hash = ?')
    .get(hash);
  if (cached?.thumbnailUrl) {
    return cached.thumbnailUrl;
  }

  try {
    const buffer = await sourceToBuffer(value);
    if (!buffer?.length) {
      return value.startsWith('/uploads/') ? value : null;
    }

    ensureDir(thumbnailDir);
    const outputPath = path.join(thumbnailDir, `${hash}.webp`);
    const info = await sharp(buffer)
      .resize(96, 96, { fit: 'cover', withoutEnlargement: false })
      .webp({ quality: 70, alphaQuality: 80 })
      .toFile(outputPath);
    const thumbnailUrl = `${thumbnailUrlPrefix}/${hash}.webp`;

    db.prepare(`
      INSERT INTO image_thumbnail_cache (
        source_hash, source_type, source_id, source_field, thumbnail_url, width, height, bytes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_hash) DO UPDATE SET
        thumbnail_url = excluded.thumbnail_url,
        width = excluded.width,
        height = excluded.height,
        bytes = excluded.bytes
    `).run(
      hash,
      meta.sourceType || (value.startsWith('/uploads/') ? 'upload' : 'base64'),
      meta.sourceId || null,
      meta.sourceField || null,
      thumbnailUrl,
      info.width || 96,
      info.height || 96,
      info.size || 0,
    );

    return thumbnailUrl;
  } catch (error) {
    failedThumbnailSources.add(hash);
    console.error('[thumbnail] failed to generate search thumbnail:', {
      sourceType: meta.sourceType,
      sourceId: meta.sourceId,
      sourceField: meta.sourceField,
      message: error.message,
    });
    return value.startsWith('/uploads/') ? value : null;
  }
}

export async function resolveFirstImageThumbnail(sources) {
  for (const item of sources) {
    const thumbnail = await resolveImageThumbnail(item?.source, item?.meta || {});
    if (thumbnail) return thumbnail;
  }
  return null;
}
