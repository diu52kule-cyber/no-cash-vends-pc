# NoCashVends

Multi-outlet cafe & restaurant ordering / management system.

## Apps
| Folder | Stack | Deploy | Purpose |
|--------|-------|--------|---------|
| `backend/` | Node + Express + TS | Railway | REST API, talks to Supabase |
| `customer-site/` | Vite + React + TS | Vercel | QR-scan ordering site, themed per outlet |
| `dashboard/` | Next.js 15 + TS | Vercel | Manager / Waiter / KDS dashboards (next phase) |
| `supabase/` | SQL | Supabase | Schema + seed |

## First-time setup
1. Create a Supabase project → SQL editor → paste **`supabase/schema.sql`** → run.
2. Copy `backend/.env.example` → `backend/.env`, fill in Supabase URL + service-role key.
3. Copy `customer-site/.env.example` → `customer-site/.env`, fill in backend URL.
4. `cd backend && npm install && npm run dev` (port 4000)
5. `cd customer-site && npm install && npm run dev` (port 5173)
6. Visit `http://localhost:5173/raasta/t/tbl-001` — Raasta Nagpur, table 1.

## Outlets
- **raasta** — Raasta Nagpur (Caribbean rooftop lounge, Dharampeth).

## Roadmap
- [x] Phase 1: Schema, backend customer API, Raasta customer site
- [ ] Phase 2: Manager dashboard (port reference HTML to Next.js + Supabase Realtime)
- [ ] Phase 3: Waiter dashboard (call queue, add ad-hoc items, table map)
- [ ] Phase 4: Kitchen Display System
- [ ] Phase 5: Deployment walkthrough (Vercel + Railway + Supabase)
