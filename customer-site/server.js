// Tiny static server for the Vite build. Runs on Railway.
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const dist = path.join(__dirname, 'dist');

// Hashed assets (JS/CSS/etc under /assets) → cache hard. Vite gives them content-hashed filenames.
app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y' }));
// Everything else (other static files) — short cache
app.use(express.static(dist, { maxAge: '1h', index: false, etag: true }));
// index.html for any SPA route — NEVER cache so new deploys are picked up immediately
app.get('*', (_req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.sendFile(path.join(dist, 'index.html'));
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`customer-site → http://localhost:${port}`));
