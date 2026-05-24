import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import customer from './routes/customer';

const app = express();

const origins = (process.env.CORS_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.use('/api/c', customer);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[err]', err);
  const status = err.status ?? 500;
  res.status(status).json({ error: err.message ?? 'Internal error' });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`NoCashVends API → http://localhost:${port}`));
