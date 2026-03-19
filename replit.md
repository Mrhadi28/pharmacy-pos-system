# PharmaPOS Pakistan

## Overview

A complete Pharmacy Point of Sale (POS) and Management System built for Pakistan's pharmacy market. Features a professional green/white medical theme with PKR currency support, Pakistani payment methods (JazzCash, EasyPaisa), and all modules needed to run a pharmacy.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (zod/v4), drizzle-zod
- **API codegen**: Orval (from OpenAPI spec)
- **State management**: Zustand (POS cart)
- **Charts**: Recharts
- **Forms**: react-hook-form + @hookform/resolvers

## Features

1. **Dashboard** - KPI cards (daily sales in PKR, total medicines, low stock alerts, expiring soon), weekly revenue chart, recent transactions
2. **POS / Billing** - Medicine search (name/generic/barcode), shopping cart, discount support, Cash/Card/JazzCash/EasyPaisa payment methods, checkout with F2 shortcut
3. **Medicines / Inventory** - Full CRUD with batch number, barcode, expiry date, prescription flag, low stock highlighting
4. **Customers** - Customer profiles with CNIC, purchase history tracking
5. **Suppliers** - Supplier management with NTN (Pakistani tax number)
6. **Purchase Orders** - Create purchase orders, mark received (auto-updates stock)
7. **Reports** - Sales summary with charts, top-selling medicines, expiring medicines alert

## Structure

```text
artifacts/
├── api-server/         # Express 5 API server (port: 8080)
│   └── src/routes/     # categories, suppliers, medicines, customers, sales, purchases, reports, dashboard
└── pharma-pos/         # React + Vite frontend (port: 20635, served at /)
lib/
├── api-spec/           # OpenAPI spec + Orval codegen config
├── api-client-react/   # Generated React Query hooks
├── api-zod/            # Generated Zod schemas
└── db/
    └── src/schema/     # categories, suppliers, medicines, customers, sales, purchases
scripts/
└── src/seed.ts         # Database seeding script
```

## Running the App

All three services start automatically:
- API Server at `/api`
- Frontend at `/`

## Seeding Data

To reseed sample data:
```bash
pnpm --filter @workspace/scripts run seed
```

## Database Schema

- **categories** - Medicine categories
- **suppliers** - Medicine suppliers with NTN
- **medicines** - Full medicine inventory with stock, expiry, prescription flag
- **customers** - Customer profiles with CNIC support
- **sales + sale_items** - Sales transactions with line items
- **purchases + purchase_items** - Purchase orders from suppliers

## API Routes

All routes prefixed with `/api`:
- `GET/POST /categories`
- `GET/POST/PUT/DELETE /suppliers`
- `GET/POST/PUT/DELETE /medicines`
- `GET/POST/PUT/DELETE /customers`
- `GET/POST /sales`, `GET /sales/:id`
- `GET/POST /purchases`
- `GET /dashboard/stats`
- `GET /reports/sales-summary`
- `GET /reports/top-medicines`
- `GET /reports/expiring-medicines`
