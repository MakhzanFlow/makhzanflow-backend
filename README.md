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

# License

This project is licensed under the MIT License.