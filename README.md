# Modern ERP & Inventory Management System

A full-stack, responsive Enterprise Resource Planning (ERP) and Inventory Management system built with React, Express, and SQLite. Designed for small to medium-sized businesses, it features a real-time Kitchen Display System (KDS), automated reporting, offline-first POS, and multiple roles (Admin, Cashier, Call Center, KDS).

## Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS 4, Lucide Icons, Motion.
- **Backend:** Node.js 22, Express, SQLite (`better-sqlite3`, WAL mode).
- **Auth:** Session cookies (HttpOnly), scrypt password hashing, role-based access control, login rate limiting.
- **Deployment:** multi-stage Docker image (non-root), Docker Compose, cloudflared tunnel.

## Live deployment

`https://modernerp.sysitadmin.com` — served through a cloudflared tunnel to the container; no host port is exposed publicly. Has three npm scripts: `dev`, `build`, `start`; the Dockerfile runs the built server under a non-root user with a healthcheck on `/api/health`.

## Local development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm start
```

## Docker deployment

```bash
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d --build
```

- `docker-compose.yml`: loopback-only port publish, persistent named volume `modernerp_data` at `/data`.
- `docker-compose.tunnel.yml`: attaches the container to the `cloudflared_default` network so the existing tunnel can reach it by container name, with zero host ports.

## Environment variables

See `.env.example`. Key values:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | HTTP port |
| `DATABASE_PATH` | `data/pos.db` | SQLite file location |
| `SESSION_SECRET` | random | cookie signing secret |
| `SESSION_DAYS` | `7` | session lifetime |
| `COOKIE_SECURE` | `true` in prod | secure cookies |
| `ADMIN_USERNAME` | `admin` | seeded admin on first boot |
| `ADMIN_PASSWORD` | `admin` | seeded admin password on first boot (change immediately) |
| `LOGIN_MAX` | `10` | max login attempts / 15 min / IP |
| `TZ_OFFSET_HOURS` | `0` | report timezone offset (use `8` for PHT) |

> **IMPORTANT:** The seeded admin password is only applied when the users table is empty. Change it after first login via Admin → Edit User, or with a `PUT /api/users/:id`.

## API surface (REST)

Auth: `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`, `POST /api/auth/register` (admin), `POST /api/auth/change-password`.
Resources: `branches`, `users`, `categories`, `items`, `sales`, `orders`, `customers`, `payment-methods`, `settings`, `edit-logs`, `reports/*`, `dashboard`, `uploads`.
Backup: `GET /api/db/export` (JSON), `POST /api/db/import`, `GET /api/db/backup` (binary SQLite snapshot).
Health: `GET /api/health`.

## Security & Access

Default roles: **Admin**, **Cashier**, **Call Center** (creates pending orders), **KDS** (Kitchen Display). The server enforces role guards on every endpoint; the frontend hides gated screens. Password hashes are scrypt; legacy SHA-256 hashes are upgraded on next successful login. Sales totals are recomputed server-side; stock cannot go negative; void/refund restocks automatically and is logged.

Most API endpoints require a valid session cookie. The only public endpoints are `/api/health` and static assets.

---

Built with 💙 for modern businesses.