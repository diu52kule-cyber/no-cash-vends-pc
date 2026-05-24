// Tiny static server for the Vite build. Runs on Railway.
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const dist = path.join(__dirname, 'dist');

app.use(express.static(dist, { maxAge: '1h', index: false }));
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`customer-site → http://localhost:${port}`));
