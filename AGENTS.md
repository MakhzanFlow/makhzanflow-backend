# Project Rules — MakhzanFlow Backend

> Version: 1.0
> Tech Stack: Express.js + TypeScript + PostgreSQL + Prisma + JWT
> Architecture: Clean Architecture + Repository Pattern
> Goal: Build a scalable multi-tenant SaaS backend that replaces Supabase completely.

---

# 1. Core Principles

## Rule 1
The backend is the single source of truth.

- Flutter never talks directly to PostgreSQL.
- Flutter never contains business logic.
- Flutter communicates only through REST APIs.

```
Flutter
    │
    ▼
Express API
    │
    ▼
Services
    │
    ▼
Repositories
    │
    ▼
Prisma
    │
    ▼
PostgreSQL
```

---

## Rule 2

Business logic belongs only inside Services.

Never place business logic inside:

- Controllers
- Routes
- Prisma queries

Example:

❌ Wrong

```ts
router.post(...)
```

calculates invoice totals.

✅ Correct

```text
Controller
    ↓
InvoiceService
    ↓
InvoiceRepository
```

---

## Rule 3

Controllers should be thin.

Controllers only:

- receive request
- validate input
- call service
- return response

Nothing else.

---

# 2. Project Structure

```
src
│
├── app.ts
├── server.ts
│
├── config
│   ├── env.ts
│   ├── prisma.ts
│   └── logger.ts
│
├── routes
│
├── controllers
│
├── services
│
├── repositories
│
├── middlewares
│
├── validators
│
├── types
│
├── utils
│
├── errors
│
└── constants
```

---

# 3. Layer Responsibilities

## Routes

Responsible for:

- endpoint declaration
- middleware chain

Nothing else.

Example

```
POST /api/products
```

↓

```
authenticate
```

↓

```
authorize
```

↓

```
validator
```

↓

```
controller
```

---

## Controllers

Responsible for:

- parsing request
- calling service
- formatting response

Controllers never:

- query database
- calculate totals
- update stock

---

## Services

Services contain:

- business rules
- workflows
- transactions
- calculations

Example

InvoiceService

```
create invoice

↓

create items

↓

update inventory

↓

create payment

↓

commit transaction
```

---

## Repositories

Repositories are the only layer allowed to use Prisma.

Example

```
ProductRepository
```

contains

```
prisma.product.findMany()

prisma.product.create()

prisma.product.update()
```

No business logic.

---

# 4. Authentication

Authentication uses JWT.

No Supabase Auth.

Required endpoints

```
POST /api/auth/register

POST /api/auth/login

POST /api/auth/refresh

POST /api/auth/logout

GET /api/auth/me
```

Access Token

```
15 minutes
```

Refresh Token

```
30 days
```

Passwords

```
bcrypt
```

Never store plain passwords.

---

# 5. Authorization

Authorization is role based.

Roles

```
Owner

Admin

Member
```

Permissions are stored inside

```
company_members.permissions
```

Every request must know

```
user

company

role
```

---

# 6. Multi-Tenancy

Every query must be scoped by company.

Never write

```ts
findMany()
```

Always write

```ts
findMany({
    where:{
        companyId
    }
})
```

No endpoint may return data belonging to another company.

---

# 7. Database Rules

Never write raw SQL unless necessary.

Prefer Prisma.

All schema changes go through Prisma Migrations.

Never edit production database manually.

---

# 8. Transactions

Whenever multiple tables are modified together, use a transaction.

Example

Invoice Creation

```
Invoice

↓

Invoice Items

↓

Products

↓

Inventory Logs

↓

Payments
```

Must execute using

```
prisma.$transaction()
```

Never allow partial writes.

---

# 9. Validation

Every request must be validated.

Use

- Zod

or

- express-validator

Never trust client input.

---

# 10. Error Handling

All errors pass through one global middleware.

Response format

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": []
}
```

Never expose stack traces.

---

# 11. API Response Standard

Success

```json
{
  "success": true,
  "data": {}
}
```

Failure

```json
{
  "success": false,
  "message": "Product not found"
}
```

---

# 12. Pagination

Every list endpoint supports

```
?page=1

&limit=20
```

Response

```json
{
    "data": [],
    "pagination":{
        "page":1,
        "limit":20,
        "total":250,
        "pages":13
    }
}
```

---

# 13. Filtering

Endpoints should support

```
search

sort

order

page

limit
```

Example

```
GET /products

?search=milk

&page=2

&limit=20

&sort=name

&order=asc
```

---

# 14. Logging

Log

- requests
- errors
- login attempts
- unexpected exceptions

Never log

- passwords
- tokens
- secrets

---

# 15. Environment Variables

Never hardcode secrets.

Required

```
DATABASE_URL

JWT_SECRET

JWT_REFRESH_SECRET

PORT

NODE_ENV
```

---

# 16. Security

Always use

Helmet

CORS

Rate Limiting

Input Validation

Password Hashing

JWT

Parameterized Queries (Prisma)

---

# 17. REST Naming

Resources use plural names.

Good

```
/products

/customers

/invoices
```

Bad

```
/getProducts

/createProduct

/productList
```

Use HTTP verbs correctly.

GET

POST

PUT

PATCH

DELETE

---

# 18. Code Style

Use

```
camelCase
```

for variables.

Use

```
PascalCase
```

for classes.

Use

```
kebab-case
```

for filenames.

Example

```
product.controller.ts

invoice.service.ts

auth.middleware.ts
```

---

# 19. Dependency Injection

Repositories should be injected into services.

Services should be injected into controllers.

Avoid creating Prisma clients everywhere.

Use one singleton.

---

# 20. Testing

Every feature should include

- Unit Tests
- Integration Tests

Critical flows

- Login
- Invoice Creation
- Payments
- Inventory Updates
- Authorization

must always be tested.

---

# 21. Flutter Integration Rules

Flutter communicates only through REST.

Never expose database schema.

Flutter repositories should call

```
GET /api/products

POST /api/invoices

GET /api/customers
```

using Dio.

No Supabase SDK.

---

# 22. Future Scalability

The architecture must support

- Mobile App
- Web Dashboard
- Admin Panel
- Public API
- Multiple Companies
- Subscription Plans
- Payment Providers
- Notifications
- Background Jobs

without major refactoring.

---

# Golden Rule

Business logic belongs in **Services**.

Database access belongs in **Repositories**.

Controllers remain thin.

Every database query is company-scoped.

The backend is the only source of truth.
