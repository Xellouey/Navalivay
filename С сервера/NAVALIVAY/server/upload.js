import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authMiddleware } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseUploads = path.resolve(__dirname, '../uploads');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let target = String(req.query.target || '').trim();
    // sanitize target: allow a-zA-Z0-9_\/- only
    target = target.replace(/[^a-zA-Z0-9_\/-]/g, '');
    if (target.includes('..')) target = target.replace(/\.\.+/g, '');
    const dest = path.resolve(baseUploads, target || '.');
    if (!dest.startsWith(baseUploads)) return cb(new Error('Invalid target'), '');
    ensureDir(dest);
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  }
});

const uploadMW = multer({ storage });

export const uploadRouter = express.Router();

// Upload up to 10 files: field name 'files'
uploadRouter.post('/api/admin/upload', authMiddleware, uploadMW.array('files', 10), (req, res) => {
  try {
    const files = req.files || [];
    const urls = files.map(f => {
      const rel = path.relative(baseUploads, f.path).replace(/\\/g, '/');
      return '/uploads/' + rel;
    });
    res.json({ ok: true, urls });
  } catch (e) {
    res.status(400).json({ error: 'upload_failed', details: String(e) });
  }
});
