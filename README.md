# MakhzanFlow Backend

A scalable multi-tenant SaaS backend powering **MakhzanFlow**, an inventory management and POS platform designed for warehouses, retail stores, supermarkets, and distributors.

Built with **Node.js**, **Express.js**, **TypeScript**, **Prisma**, and **PostgreSQL (Supabase)** following Clean Architecture principles.

---

# Features

- Multi-tenant SaaS architecture
- JWT Authentication
- Company-based data isolation
- Owner-controlled employee permissions
- Role-free permission system
- Customer management
- Product & Inventory management
- Invoice management
- Payment tracking
- Activity logging
- Join company via invitation code
- Company member approval workflow
- Company subscription support
- File uploads (Cloudinary)
- Email notifications
- Validation using Zod
- Prisma ORM
- Docker support
- RESTful API

---

# Tech Stack

- Node.js
- Express.js
- TypeScript
- PostgreSQL
- Prisma ORM
- Supabase
- Redis
- Cloudinary
- JWT
- Zod
- Docker
- Docker Compose

---

# Project Structure

```
src/
│
├── config/
├── middleware/
├── modules/
│   ├── auth/
│   ├── company/
│   ├── customer/
│   ├── product/
│   ├── inventory/
│   ├── invoice/
│   ├── payment/
│   ├── subscription/
│   ├── activity/
│   └── user/
│
├── services/
├── utils/
├── types/
├── routes/
├── prisma/
└── app.ts
```

---

# Architecture

The project follows a modular feature-based architecture.

Each module contains:

```
module
│
├── controller
├── service
├── repository
├── validation
├── routes
├── types
└── helpers
```

---

# Multi-Tenant Architecture

Every business owns its own data.

```
Company
    │
    ├── Members
    ├── Customers
    ├── Products
    ├── Inventory
    ├── Invoices
    ├── Payments
    └── Activity Logs
```

Every database query is filtered using the authenticated user's active company.

---

# Permission System

MakhzanFlow uses an **Owner-Controlled Permission Model**.

## Owner

- Full system access
- Can approve employees
- Can edit permissions
- Can regenerate join code
- Can manage company settings
- Can promote/demote owners
- Cannot remove the last owner

## Employee

Employees receive permissions stored as JSON.

Example:

```json
{
  "dashboard": true,
  "customers": {
    "view": true,
    "create": true,
    "edit": false,
    "delete": false
  },
  "products": {
    "view": true,
    "create": false,
    "edit": false,
    "delete": false
  },
  "invoices": {
    "view": true,
    "create": true,
    "edit": false,
    "delete": false
  },
  "payments": {
    "view": true,
    "create": false
  },
  "reports": {
    "view": false,
    "export": false
  }
}
```

All authorization is enforced on the backend.

---

# Company Join Flow

1. Owner creates company.
2. System generates an invite code.
3. Employee enters invite code.
4. Join request is created.
5. Owner approves or rejects.
6. Approved employee becomes an active member.

---

# Authentication

Supported authentication methods:

- Email & Password
- Google OAuth (optional)

JWT tokens are verified on every request.

---

# Environment Variables

Create a `.env` file.

```env
PORT=3000

DATABASE_URL=

DIRECT_URL=

JWT_SECRET=

SUPABASE_URL=

SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=

REDIS_URL=

CLOUDINARY_CLOUD_NAME=

CLOUDINARY_API_KEY=

CLOUDINARY_API_SECRET=

EMAIL_HOST=

EMAIL_PORT=

EMAIL_USER=

EMAIL_PASSWORD=
```

---

# Installation

Clone the repository.

```bash
git clone https://github.com/your-org/makhzanflow-backend.git
```

Install dependencies.

```bash
npm install
```

Generate Prisma Client.

```bash
npx prisma generate
```

Run migrations.

```bash
npx prisma migrate dev
```

Start development server.

```bash
npm run dev
```

---

# Docker

Build

```bash
docker compose build
```

Run

```bash
docker compose up
```

Stop

```bash
docker compose down
```

---

# Deployment

## Production: Vercel + Neon + Upstash

The backend deploys to Vercel as a serverless function.

- **Database**: Neon PostgreSQL (pooled endpoint via `DATABASE_URL`, direct endpoint via `DIRECT_URL` for migrations)
- **Redis**: Upstash Redis (REST API via `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`)
- **Entrypoint**: `api/index.ts` (imports the Express app — never calls `app.listen()`)
- **Config**: `vercel.json` routes all traffic to the serverless function

### Required production environment variables

```env
DATABASE_URL=postgresql://...-pooler...?sslmode=require
DIRECT_URL=postgresql://...?sslmode=require
JWT_SECRET=
JWT_REFRESH_SECRET=
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
NODE_ENV=production
```

### Apply migrations to production

```bash
DIRECT_URL="postgresql://...?sslmode=require" npx prisma migrate deploy
```

### Local development

Docker Compose runs Postgres (port 5433) and Redis (port 6379). The app uses
`@upstash/redis` only when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`
are set; otherwise it falls back to the local Docker Redis client.

## Future: VPS Migration

To move from Vercel to a VPS (Railway, Render, DigitalOcean, etc.):

1. Delete `api/index.ts` and `vercel.json` (the only Vercel-specific files)
2. Run `npm run build && npm start` — `src/server.ts` starts the HTTP listener
   when `VERCEL` is not set
3. Point `DATABASE_URL` at the VPS database (or keep Neon), set `DIRECT_URL`
   for migrations
4. Optionally swap the Upstash REST client for a TCP client (`redis`/`ioredis`)
   in `src/config/redis.ts`
5. Add PM2 or systemd and a reverse proxy (Nginx/Caddy) for SSL

---

# Available Scripts

```bash
npm run dev

npm run build

npm run start

npm run lint

npm run lint:fix

npm run format

npm run prisma:generate

npm run prisma:migrate

npm run prisma:studio
```

---

# API Modules

- Authentication
- Users
- Companies
- Company Members
- Join Requests
- Customers
- Products
- Inventory
- Invoices
- Payments
- Subscriptions
- Activity Logs

---

# Security

- JWT Authentication
- Zod Validation
- Rate Limiting
- Helmet
- CORS
- SQL Injection Protection (Prisma)
- Multi-tenant Isolation
- Backend Permission Validation
- Owner Protection Rules

---

# Database

PostgreSQL hosted on Supabase.

Main entities include:

- Users
- Companies
- Company Members
- Join Requests
- Customers
- Products
- Inventory Logs
- Invoices
- Invoice Items
- Payments
- Activity Logs
- Subscription Plans
- Billing History

---

# Activity Logging

Important operations are automatically logged:

- Company Created
- Member Joined
- Permission Updated
- Invoice Created
- Product Added
- Customer Added
- Payment Added
- Join Request Approved
- Join Request Rejected

---

# Error Responses

Example:

```json
{
  "success": false,
  "message": "Permission denied. Please contact your company owner."
}
```

---

# Future Roadmap

- Offline synchronization
- Barcode scanning
- Receipt printing
- Analytics dashboard
- Mobile push notifications
- AI-powered inventory forecasting
- Audit reports
- Multi-language support
- Public REST API
- Webhooks

---

# Operations & Deployment Notes

- **Database URLs**: `DATABASE_URL` must be the **pooled** connection string (PgBouncer/Neon pool) used by the app at runtime. `DIRECT_URL` (optional locally, recommended in prod) is the **direct** connection used only by `prisma migrate deploy`. Local docker-compose example: `DATABASE_URL="postgresql://postgres:postgres@localhost:5433/makhzanflow"`.
- **JWT secrets**: `JWT_SECRET` and `JWT_REFRESH_SECRET` must be two **different** 256-bit values — the app refuses to boot otherwise. Rotating either one invalidates all sessions (force logout by design).
- **Redis in production**: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are **required** when `NODE_ENV=production`; the app fails fast instead of falling back to an in-memory cache. Local dev uses the docker-compose Redis (`REDIS_HOST`/`REDIS_PORT`, defaults `localhost:6379`).
- **Rate limits**: the `DISABLE_RATE_LIMIT=1` test hook is honored only outside production.
- **Migrations**: run `prisma migrate deploy && prisma generate` before build (see `vercel-build`). The `20260923000000_soft_delete_and_indexes` migration adds `companies.deleted_at` (soft-delete) and hot-path indexes.
- **Company deletion is a soft-delete** (`deleted_at`); data is preserved and restorable via `POST /api/companies/:id/restore` (owner only).

---

# License

This project is licensed under the MIT License.