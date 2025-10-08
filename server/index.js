import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import cors from 'cors';
import helmet from 'helmet';
import { initDb } from './db.js';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';
import { uploadRouter } from './upload.js';
import { crmRouter } from './routes/crm.js';
import { crmOperationsRouter } from './routes/crm-operations.js';
import { crmFinanceRouter } from './routes/crm-finance.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8081;
app.set('trust proxy', 1);

// Init DB (tables + seed)
initDb();

// Middlewares
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));
app.use(helmet({ contentSecurityPolicy: false }));

// Static
const uploadsDir = path.resolve(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));

// Health
app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// Public API
app.use(publicRouter);
// Admin API
app.use(adminRouter);
// Upload API
app.use(uploadRouter);
// CRM API
app.use(crmRouter);
app.use(crmOperationsRouter);
app.use(crmFinanceRouter);


app.listen(PORT, () => {
  console.log(`[navalivay] server listening on :${PORT}`);
});
