# Distributor Pro — Offline Distribution Management Desktop Application

A high-performance, offline-first Desktop Application engineered for warehouse and distributor operations. Built with an **ultra-minimal, high-contrast, Apple-inspired interface** tailored specifically for non-technical staff.

---

## 🛠 Tech Stack

- **Desktop Framework:** Electron 33+
- **Frontend:** React 18, TypeScript, Tailwind CSS, Lucide Icons
- **Backend API:** Local Node.js + Express
- **Database:** Local SQLite managed via Prisma ORM
- **Build Tools:** Vite 5, TSX, Electron Builder

---

## 📦 Core Modules Implemented

### 1. Inventory & Stock Management
- **Product Catalog:** Full CRUD operations with SKU, Unit Type (Case, Box, Carton, Bag), Selling Price, Cost Price, and Current Stock.
- **Stock-Level Tracking & Alerts:** Real-time calculation with an urgent alert banner when items fall at or below their minimum reorder threshold.
- **Inbound & Outbound Audit Logging:** Dedicated stock intake modal for receiving supplier shipments (`INBOUND`) and adjustments (`ADJUSTMENT` for breakage or shrinkage) with PO / Delivery Reference numbers and audit notes.

### 2. Customer & Client Management
- **Client Directory:** Centralized registry of stores, provisions, and resorts with contact numbers, physical delivery addresses, and receiving bay details.
- **Pricing Tiers & Discount Profiles:** Automated tiered discounting (`STANDARD` 0%, `WHOLESALE` 10%, `VIP` 15%, or custom percentage) applied instantly at point of sale.
- **Credit Limit & Outstanding Balances:** Live tracking of unpaid distribution orders and outstanding customer credit balances.
- **Order History Drawer:** Instant lookup of all past orders placed by any client with delivery note reprint capabilities.

### 3. Order & Distribution Workflow (POS)
- **Rapid Order Entry:** Frictionless two-column POS interface designed for fast order taking.
- **Dynamic Stock Validation:** Prevents over-ordering with live inventory limits.
- **Status Tracking:** Tracks progression from `PENDING` ➔ `DISPATCHED` ➔ `DELIVERED` (or `CANCELLED` with automatic inventory restoration).
- **Digital Invoices & Delivery Notes:** Apple-styled printable delivery notes with signature sections for warehouse dispatchers and client receiving bays.

### 4. Reporting & Analytics
- **Executive Dashboard:** Live cards for Today's Revenue, Dispatched Orders, Items Requiring Restock, and Outstanding Receivables.
- **End-of-Day Sales Summary:** Detailed gross and net breakdown of all orders processed.
- **Stock Movement History:** Complete audit trail of all warehouse intakes, dispatches, and returns.
- **Customer Receivables Report:** Statement of all accounts with overdue balances.
- **One-Click Export & Print:** Instant CSV export and formatted print stylesheets for all reports.

### 5. Multi-Currency Support (Default: LKR)
- **Instant Currency Switcher:** Seamlessly switch between **LKR (Rs. - Sri Lankan Rupee)**, **USD ($)**, **INR (₹)**, **EUR (€)**, and **GBP (£)** via the dropdown in the sidebar.
- **Persistent State:** Saves currency preference in local storage.
- **Consistent Display:** Automatically formats prices across all screens: Dashboard, POS Order Entry, Inventory, Client Balances, Printable Invoices, and Reports.

---

## 🚀 Getting Started

### 1. Start the Application in Development Mode

You can run the full desktop environment or the web interface:

#### Option A: Running the Integrated Stack
```powershell
# In Terminal 1: Start the Local Express Backend (Port 4812)
npm run dev:server

# In Terminal 2: Start the Vite Dev Server (Port 5173)
npm run dev:vite

# In Terminal 3: Launch Electron Desktop Window
npm run dev:electron
```

#### Option B: Fast Web Testing (Browser)
```powershell
# Starts both the backend API and frontend concurrently:
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📂 Project Structure

```text
Offline Distributor Management/
├── electron/
│   ├── main.ts              # Electron lifecycle, window creation, IPC handlers
│   ├── preload.ts           # Context bridge for desktop printing
│   └── dist/                # Compiled electron scripts
├── prisma/
│   ├── schema.prisma        # SQLite schema (Product, Customer, Order, StockMovement)
│   ├── seed.ts              # Demo seed data (products, customers, orders)
│   └── migrations/          # Version-controlled migrations
├── server/
│   ├── index.ts             # Express REST API (CRUD, atomic POS, reports)
│   └── prisma.ts            # Singleton Prisma client instance
├── src/
│   ├── components/
│   │   ├── Sidebar.tsx      # Apple-styled minimalist sidebar
│   │   ├── InvoiceModal.tsx # Printable delivery note & invoice
│   │   ├── ProductModal.tsx # Add/Edit product modal
│   │   ├── StockAdjustModal.tsx # Receive stock intake modal
│   │   └── CustomerModal.tsx# Add/Edit client profile modal
│   ├── pages/
│   │   ├── Dashboard.tsx    # Today's metrics, low stock banner, quick dispatch
│   │   ├── OrderEntry.tsx   # POS screen for creating distribution orders
│   │   ├── Inventory.tsx    # Inventory management & stock intake
│   │   ├── Customers.tsx    # Clients directory & receivables
│   │   └── Reports.tsx      # EOD sales, stock logs, customer balances & CSV export
│   ├── services/
│   │   └── api.ts           # Typed Axios client for local Express API
│   ├── types/
│   │   └── index.ts         # TypeScript interfaces
│   ├── App.tsx              # Main application router
│   ├── main.tsx             # React DOM entrypoint
│   └── index.css            # Tailwind directives & print styling
├── distributor.db           # SQLite database file
└── package.json
```

---

## 💾 Database Schema Details

- **`Product`**: `id`, `sku`, `name`, `category`, `unit`, `unitPrice`, `costPrice`, `currentStock`, `minStockAlert`
- **`StockMovement`**: `id`, `productId`, `type` (`INBOUND` | `OUTBOUND` | `ADJUSTMENT` | `RETURN`), `quantity`, `referenceId`, `notes`, `createdAt`
- **`Customer`**: `id`, `code`, `name`, `companyName`, `phone`, `deliveryAddress`, `city`, `pricingTier` (`STANDARD` | `WHOLESALE` | `VIP`), `discountPercentage`, `creditLimit`, `outstandingBalance`
- **`Order`**: `id`, `orderNumber`, `customerId`, `status` (`PENDING` | `DISPATCHED` | `DELIVERED` | `CANCELLED`), `paymentStatus` (`UNPAID` | `PARTIAL` | `PAID`), `subtotal`, `discountAmount`, `taxAmount`, `netTotal`, `notes`, `dispatchedAt`, `deliveredAt`
- **`OrderItem`**: `id`, `orderId`, `productId`, `quantity`, `unitPrice`, `lineTotal`
