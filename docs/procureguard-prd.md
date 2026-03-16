# PRD — ProcureGuard v1.0
## Transparent Procurement & Anti-Markup System

---

## 1. EXECUTIVE SUMMARY

ProcureGuard adalah web-based procurement management system untuk bisnis F&B multi-cabang yang mengeliminasi potensi markup harga oleh manager melalui transparansi harga real-time dari vendor, auto-detection anomali, dan audit trail lengkap. Sistem ini memastikan setiap rupiah yang dikeluarkan tercatat, terlacak, dan ter-justify.

**Target User:** Bisnis F&B skala menengah (2-5 cabang, 10-50 vendor)
**Deployment Target:** Vercel (frontend) + Supabase (backend)
**Timeline MVP:** 2-4 minggu development

---

## 2. TECH STACK & ARSITEKTUR

### 2.1 Tech Stack

| Layer | Teknologi | Alasan |
|-------|-----------|--------|
| Framework | **Next.js 14+ (App Router)** | SSR, API routes, middleware auth |
| Language | **TypeScript** | Type safety, anti-hallucination untuk vibe coding |
| Database | **Supabase (PostgreSQL)** | Auth bawaan, Row Level Security, Realtime subscription, REST + SDK |
| ORM | **Supabase JS Client** | Query builder bawaan, type generation |
| UI | **Tailwind CSS + shadcn/ui** | Rapid prototyping, konsisten |
| Charts | **Recharts** | Dashboard analytics |
| State | **Zustand** | Lightweight global state |
| Form | **React Hook Form + Zod** | Validasi form yang strict |
| Deployment | **Vercel** | Zero-config untuk Next.js |
| Email (opsional) | **Resend** | Notifikasi alert via email |

### 2.2 Arsitektur Diagram

```
┌─────────────────────────────────────────────────┐
│                   FRONTEND                       │
│              Next.js 14 (App Router)             │
│  ┌───────────┬──────────┬──────────┬──────────┐  │
│  │  Owner    │ Manager  │  Vendor  │  Admin   │  │
│  │ Dashboard │ PO Page  │ Catalog  │ Finance  │  │
│  └───────────┴──────────┴──────────┴──────────┘  │
│          │          │          │          │       │
│          ▼          ▼          ▼          ▼       │
│  ┌─────────────────────────────────────────────┐ │
│  │         Middleware (Role Guard)              │ │
│  └─────────────────────────────────────────────┘ │
│          │                                       │
│          ▼                                       │
│  ┌─────────────────────────────────────────────┐ │
│  │      Next.js API Routes (/api/*)            │ │
│  │  - /api/po          (Purchase Orders)       │ │
│  │  - /api/vendors      (Vendor CRUD)          │ │
│  │  - /api/products     (Product/Price)        │ │
│  │  - /api/alerts       (Anomaly alerts)       │ │
│  │  - /api/analytics    (Dashboard data)       │ │
│  │  - /api/audit        (Audit trail)          │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│                  SUPABASE                        │
│  ┌──────────┬───────────┬────────────────────┐  │
│  │   Auth   │ PostgreSQL│  Row Level Security │  │
│  │ (4 roles)│ (12 table)│  (per-role policy)  │  │
│  └──────────┴───────────┴────────────────────┘  │
│  ┌──────────────────────────────────────────┐   │
│  │     Realtime (alert subscription)         │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

## 3. DATABASE SCHEMA

### 3.1 Entity Relationship

```
users (Supabase Auth)
  ├── 1:N → purchase_orders
  ├── 1:N → audit_logs
  └── 1:1 → user_profiles

branches
  ├── 1:N → purchase_orders
  └── N:1 → users (manager assigned)

vendors
  ├── 1:N → vendor_products (katalog + harga)
  ├── 1:N → purchase_order_items
  ├── 1:N → vendor_reviews
  └── computed → vendor_scores

products (master produk)
  ├── 1:N → vendor_products
  └── 1:N → purchase_order_items

purchase_orders
  ├── 1:N → purchase_order_items
  ├── 1:N → audit_logs
  └── 1:N → alerts

alerts
  └── N:1 → purchase_orders

audit_logs
  └── polymorphic (entity_type + entity_id)
```

### 3.2 Table Definitions (SQL)

```sql
-- ============================================================
-- TABLE: user_profiles
-- Extends Supabase Auth users dengan role dan cabang
-- ============================================================
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'vendor', 'admin')),
  branch_id UUID REFERENCES branches(id),
  vendor_id UUID REFERENCES vendors(id), -- hanya untuk role 'vendor'
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: branches
-- Daftar cabang toko
-- ============================================================
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: vendors
-- Data vendor/supplier
-- ============================================================
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  tax_id TEXT, -- NPWP
  bank_name TEXT,
  bank_account TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: products
-- Master data produk (bahan baku)
-- ============================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'bahan_pokok', 'dairy', 'tepung', 'gula_pemanis',
    'coklat_kakao', 'buah', 'kemasan', 'lainnya'
  )),
  unit TEXT NOT NULL CHECK (unit IN ('kg', 'gram', 'liter', 'ml', 'pcs', 'pack', 'box', 'lusin')),
  description TEXT,
  min_stock_alert INTEGER DEFAULT 0, -- untuk notifikasi stok rendah (future)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: vendor_products
-- Katalog harga per vendor per produk (JANTUNG SISTEM)
-- Vendor input sendiri, manager TIDAK BISA edit
-- ============================================================
CREATE TABLE vendor_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price DECIMAL(12,2) NOT NULL CHECK (price > 0),
  min_order INTEGER DEFAULT 1,
  lead_time_days INTEGER DEFAULT 1, -- estimasi hari pengiriman
  is_available BOOLEAN DEFAULT true,
  last_price_update TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vendor_id, product_id) -- 1 vendor, 1 harga per produk
);

-- ============================================================
-- TABLE: price_history
-- Log setiap perubahan harga (untuk trend analysis)
-- ============================================================
CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_product_id UUID NOT NULL REFERENCES vendor_products(id) ON DELETE CASCADE,
  old_price DECIMAL(12,2),
  new_price DECIMAL(12,2) NOT NULL,
  change_percentage DECIMAL(5,2), -- auto-calculated
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: purchase_orders
-- PO dibuat oleh Manager, di-approve oleh Owner
-- ============================================================
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL UNIQUE, -- format: PO-YYYYMMDD-XXX
  branch_id UUID NOT NULL REFERENCES branches(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',        -- Manager sedang buat
    'submitted',    -- Manager sudah submit, menunggu approval
    'flagged',      -- Sistem detect anomali, perlu review owner
    'approved',     -- Owner approved
    'rejected',     -- Owner rejected
    'delivered',    -- Barang sudah diterima
    'completed',    -- Sudah dibayar dan selesai
    'cancelled'     -- Dibatalkan
  )),
  total_amount DECIMAL(14,2) DEFAULT 0,
  notes TEXT,
  rejection_reason TEXT,
  vendor_selection_reason TEXT, -- WAJIB jika vendor bukan "Best Value"
  flagged_reason TEXT, -- alasan auto-flag dari sistem
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: purchase_order_items
-- Detail item dalam PO
-- ============================================================
CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  vendor_product_id UUID NOT NULL REFERENCES vendor_products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL, -- snapshot harga saat PO dibuat
  subtotal DECIMAL(14,2) NOT NULL, -- quantity * unit_price
  -- Price comparison snapshot (untuk evidence)
  avg_market_price DECIMAL(12,2), -- rata-rata harga produk ini dari semua vendor
  lowest_price DECIMAL(12,2), -- harga terendah dari vendor lain
  lowest_price_vendor_id UUID REFERENCES vendors(id),
  price_deviation_pct DECIMAL(5,2), -- % di atas rata-rata
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: vendor_reviews
-- Rating setelah pengiriman (diisi oleh Manager)
-- ============================================================
CREATE TABLE vendor_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  reviewed_by UUID NOT NULL REFERENCES auth.users(id),
  rating_price INTEGER CHECK (rating_price BETWEEN 1 AND 5),
  rating_quality INTEGER CHECK (rating_quality BETWEEN 1 AND 5),
  rating_delivery INTEGER CHECK (rating_delivery BETWEEN 1 AND 5),
  rating_overall DECIMAL(3,2), -- auto-calculated average
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: alerts
-- Notifikasi anomali otomatis
-- ============================================================
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN (
    'price_spike',          -- Harga vendor naik > threshold
    'expensive_vendor',     -- Manager pilih vendor termahal
    'volume_anomaly',       -- Volume order tidak wajar
    'frequent_vendor',      -- Manager selalu pilih vendor yang sama
    'price_above_average'   -- Harga PO di atas rata-rata market
  )),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  po_id UUID REFERENCES purchase_orders(id),
  vendor_id UUID REFERENCES vendors(id),
  branch_id UUID REFERENCES branches(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB, -- data pendukung (angka perbandingan, dll)
  is_read BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: audit_logs
-- Mencatat SEMUA aksi dalam sistem
-- ============================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN (
    'create', 'update', 'delete', 'submit', 'approve',
    'reject', 'cancel', 'login', 'price_change', 'status_change'
  )),
  entity_type TEXT NOT NULL, -- 'purchase_order', 'vendor', 'product', dll
  entity_id UUID,
  description TEXT NOT NULL, -- human-readable: "Manager Budi membuat PO-20240115-001"
  old_value JSONB, -- state sebelum perubahan
  new_value JSONB, -- state setelah perubahan
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- VIEW: vendor_scores (computed scoring)
-- ============================================================
CREATE OR REPLACE VIEW vendor_scores AS
SELECT
  v.id AS vendor_id,
  v.name AS vendor_name,
  COUNT(DISTINCT vr.id) AS total_reviews,
  COALESCE(AVG(vr.rating_price), 0) AS avg_price_rating,
  COALESCE(AVG(vr.rating_quality), 0) AS avg_quality_rating,
  COALESCE(AVG(vr.rating_delivery), 0) AS avg_delivery_rating,
  COALESCE(AVG(vr.rating_overall), 0) AS avg_overall_rating,
  COUNT(DISTINCT po.id) FILTER (WHERE po.status = 'completed') AS completed_orders,
  COUNT(DISTINCT po.id) FILTER (WHERE po.status = 'delivered' AND po.delivered_at <= po.approved_at + INTERVAL '3 days') AS on_time_deliveries,
  -- Composite score (weighted)
  ROUND(
    (COALESCE(AVG(vr.rating_price), 3) * 0.30 +    -- 30% harga
     COALESCE(AVG(vr.rating_quality), 3) * 0.35 +   -- 35% kualitas
     COALESCE(AVG(vr.rating_delivery), 3) * 0.25 +  -- 25% pengiriman
     CASE WHEN v.is_verified THEN 5 ELSE 2.5 END * 0.10  -- 10% verifikasi
    )::DECIMAL, 2
  ) AS composite_score
FROM vendors v
LEFT JOIN vendor_reviews vr ON vr.vendor_id = v.id
LEFT JOIN purchase_orders po ON po.vendor_id = v.id
WHERE v.is_active = true
GROUP BY v.id, v.name, v.is_verified;

-- ============================================================
-- INDEXES untuk performa
-- ============================================================
CREATE INDEX idx_po_status ON purchase_orders(status);
CREATE INDEX idx_po_branch ON purchase_orders(branch_id);
CREATE INDEX idx_po_vendor ON purchase_orders(vendor_id);
CREATE INDEX idx_po_created_by ON purchase_orders(created_by);
CREATE INDEX idx_po_created_at ON purchase_orders(created_at);
CREATE INDEX idx_vendor_products_vendor ON vendor_products(vendor_id);
CREATE INDEX idx_vendor_products_product ON vendor_products(product_id);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_is_read ON alerts(is_read);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_price_history_vp ON price_history(vendor_product_id);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Owner: bisa lihat semua
CREATE POLICY "owner_full_access" ON purchase_orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'owner')
  );

-- Manager: hanya PO milik cabangnya
CREATE POLICY "manager_own_branch" ON purchase_orders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'manager' AND branch_id = purchase_orders.branch_id
    )
  );

-- Vendor: hanya bisa CRUD harga produknya sendiri
CREATE POLICY "vendor_own_products" ON vendor_products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'vendor' AND vendor_id = vendor_products.vendor_id
    )
  );

-- Admin: read-only semua, write hanya audit
CREATE POLICY "admin_read_all" ON purchase_orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## 4. FOLDER STRUCTURE

```
procureguard/
├── .env.local                    # Supabase keys
├── next.config.js
├── package.json
├── tailwind.config.ts
├── tsconfig.json
│
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql  # SQL di atas
│   └── seed.sql                    # Dummy data (Section 9)
│
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout + font + providers
│   │   ├── page.tsx                # Landing → redirect ke /login
│   │   │
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx        # Login form (email + password)
│   │   │   └── layout.tsx          # Auth layout (centered card)
│   │   │
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx          # Sidebar + topbar + role guard
│   │   │   │
│   │   │   ├── owner/
│   │   │   │   ├── page.tsx              # Owner dashboard (analytics)
│   │   │   │   ├── alerts/
│   │   │   │   │   └── page.tsx          # Alert center
│   │   │   │   ├── purchase-orders/
│   │   │   │   │   ├── page.tsx          # Semua PO (approve/reject)
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx      # Detail PO + comparison
│   │   │   │   ├── vendors/
│   │   │   │   │   └── page.tsx          # Vendor list + scores
│   │   │   │   └── audit/
│   │   │   │       └── page.tsx          # Audit trail log
│   │   │   │
│   │   │   ├── manager/
│   │   │   │   ├── page.tsx              # Manager dashboard
│   │   │   │   ├── purchase-orders/
│   │   │   │   │   ├── page.tsx          # PO list (own branch)
│   │   │   │   │   ├── new/
│   │   │   │   │   │   └── page.tsx      # Buat PO baru
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx      # Detail PO
│   │   │   │   └── vendors/
│   │   │   │       └── page.tsx          # Browse vendor catalog
│   │   │   │
│   │   │   ├── vendor/
│   │   │   │   ├── page.tsx              # Vendor dashboard
│   │   │   │   ├── catalog/
│   │   │   │   │   └── page.tsx          # Kelola produk + harga
│   │   │   │   ├── orders/
│   │   │   │   │   └── page.tsx          # PO yang diterima
│   │   │   │   └── profile/
│   │   │   │       └── page.tsx          # Edit profil vendor
│   │   │   │
│   │   │   └── admin/
│   │   │       ├── page.tsx              # Admin dashboard
│   │   │       ├── finance/
│   │   │       │   └── page.tsx          # Rekap pembayaran
│   │   │       ├── users/
│   │   │       │   └── page.tsx          # Manage users
│   │   │       └── reports/
│   │   │           └── page.tsx          # Generate report
│   │   │
│   │   └── api/
│   │       ├── po/
│   │       │   ├── route.ts              # GET (list), POST (create)
│   │       │   ├── [id]/
│   │       │   │   ├── route.ts          # GET, PATCH, DELETE
│   │       │   │   ├── submit/
│   │       │   │   │   └── route.ts      # POST → submit PO
│   │       │   │   ├── approve/
│   │       │   │   │   └── route.ts      # POST → approve PO
│   │       │   │   └── reject/
│   │       │   │       └── route.ts      # POST → reject PO
│   │       │   └── check-anomaly/
│   │       │       └── route.ts          # POST → anomaly detection
│   │       │
│   │       ├── vendors/
│   │       │   ├── route.ts              # GET, POST
│   │       │   ├── [id]/
│   │       │   │   └── route.ts          # GET, PATCH
│   │       │   ├── scores/
│   │       │   │   └── route.ts          # GET vendor scores
│   │       │   └── compare/
│   │       │       └── route.ts          # GET price comparison
│   │       │
│   │       ├── products/
│   │       │   ├── route.ts              # GET, POST
│   │       │   └── prices/
│   │       │       └── route.ts          # GET price comparison matrix
│   │       │
│   │       ├── alerts/
│   │       │   ├── route.ts              # GET, POST
│   │       │   └── [id]/
│   │       │       └── resolve/
│   │       │           └── route.ts      # PATCH → resolve alert
│   │       │
│   │       ├── analytics/
│   │       │   ├── spending/
│   │       │   │   └── route.ts          # GET spending data
│   │       │   ├── price-trends/
│   │       │   │   └── route.ts          # GET price trend data
│   │       │   └── branch-comparison/
│   │       │       └── route.ts          # GET branch comparison
│   │       │
│   │       └── audit/
│   │           └── route.ts              # GET audit logs
│   │
│   ├── components/
│   │   ├── ui/                           # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── table.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── select.tsx
│   │   │   ├── input.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── alert.tsx
│   │   │   └── sheet.tsx
│   │   │
│   │   ├── layout/
│   │   │   ├── sidebar.tsx               # Role-based sidebar nav
│   │   │   ├── topbar.tsx                # User info + notif bell
│   │   │   └── mobile-nav.tsx            # Responsive nav
│   │   │
│   │   ├── dashboard/
│   │   │   ├── stat-card.tsx             # KPI metric card
│   │   │   ├── spending-chart.tsx        # Line/bar chart pengeluaran
│   │   │   ├── branch-comparison.tsx     # Bar chart perbandingan cabang
│   │   │   ├── price-trend-chart.tsx     # Line chart trend harga
│   │   │   └── recent-alerts.tsx         # Alert list widget
│   │   │
│   │   ├── po/
│   │   │   ├── po-form.tsx               # Form buat PO
│   │   │   ├── po-item-row.tsx           # Row item dalam PO
│   │   │   ├── price-comparison-badge.tsx # Indikator harga vs market
│   │   │   ├── po-status-badge.tsx       # Status badge (color-coded)
│   │   │   ├── po-timeline.tsx           # Timeline status PO
│   │   │   └── approval-dialog.tsx       # Dialog approve/reject
│   │   │
│   │   ├── vendor/
│   │   │   ├── vendor-card.tsx           # Card vendor + score
│   │   │   ├── vendor-score-radar.tsx    # Radar chart scoring
│   │   │   ├── price-input-form.tsx      # Form update harga (vendor)
│   │   │   └── vendor-comparison.tsx     # Side-by-side compare
│   │   │
│   │   └── shared/
│   │       ├── data-table.tsx            # Reusable tanstack table
│   │       ├── empty-state.tsx           # Placeholder kosong
│   │       ├── loading-skeleton.tsx      # Loading state
│   │       ├── confirm-dialog.tsx        # Konfirmasi action
│   │       └── audit-trail-list.tsx      # Timeline audit log
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                 # Browser supabase client
│   │   │   ├── server.ts                 # Server supabase client
│   │   │   └── middleware.ts             # Auth middleware helper
│   │   │
│   │   ├── utils.ts                      # cn(), formatRupiah(), etc
│   │   ├── constants.ts                  # Status labels, role labels
│   │   └── anomaly-detector.ts           # Logic deteksi anomali
│   │
│   ├── hooks/
│   │   ├── use-current-user.ts           # Hook get user + role
│   │   ├── use-alerts.ts                 # Realtime alerts
│   │   └── use-debounce.ts
│   │
│   ├── types/
│   │   ├── database.ts                   # Auto-generated Supabase types
│   │   ├── po.ts                         # PO-related types
│   │   ├── vendor.ts                     # Vendor-related types
│   │   └── analytics.ts                  # Chart data types
│   │
│   └── middleware.ts                     # Next.js middleware (auth + role redirect)
│
└── public/
    ├── logo.svg
    └── placeholder-avatar.png
```

---

## 5. DETAILED USE CASES

### 5.1 UC-01: Vendor Mendaftarkan & Update Harga Produk

**Actor:** Vendor
**Precondition:** Vendor sudah terdaftar dan login
**Flow:**

```
1. Vendor login → redirect ke /vendor
2. Navigasi ke /vendor/catalog
3. Klik "Tambah Produk ke Katalog"
4. Pilih produk dari master products (dropdown search)
5. Input:
   - Harga per unit (REQUIRED, numeric, > 0)
   - Minimum order quantity
   - Estimasi lead time (hari)
6. Klik "Simpan"
7. SYSTEM:
   a. Insert ke vendor_products
   b. Insert ke price_history (old_price = null, new_price = input)
   c. Insert ke audit_logs
   d. Return success
8. Produk muncul di katalog vendor

UPDATE HARGA:
9. Vendor klik "Edit Harga" pada produk existing
10. Input harga baru
11. SYSTEM:
    a. Hitung change_percentage = ((new - old) / old) * 100
    b. IF change_percentage > 10%:
       → Create alert type='price_spike', severity='medium'
    c. IF change_percentage > 25%:
       → Create alert type='price_spike', severity='high'
    d. Update vendor_products.price
    e. Insert ke price_history
    f. Insert ke audit_logs
```

**Validation Rules:**
- Harga harus angka positif, max 12 digit
- Satu vendor hanya bisa punya 1 harga per produk (UNIQUE constraint)
- Hanya vendor pemilik yang bisa edit (RLS enforced)

---

### 5.2 UC-02: Manager Membuat Purchase Order

**Actor:** Manager
**Precondition:** Manager login, minimal 1 vendor punya produk di katalog
**Flow:**

```
1. Manager login → redirect ke /manager
2. Navigasi ke /manager/purchase-orders/new
3. STEP 1 — Pilih Produk:
   a. Klik "Tambah Item"
   b. Pilih produk dari dropdown (master products)
   c. SYSTEM langsung tampilkan:
      ┌──────────────────────────────────────────────┐
      │ Tepung Terigu Protein Tinggi (per kg)        │
      │                                              │
      │  Vendor A: Rp 12.500 ★ 4.2  ← BEST VALUE   │
      │  Vendor B: Rp 13.000 ★ 4.5                  │
      │  Vendor C: Rp 14.200 ★ 3.8                  │
      │                                              │
      │  Rata-rata pasar: Rp 13.233                  │
      └──────────────────────────────────────────────┘
   d. Manager pilih vendor (radio button)
   e. Input quantity
   f. Harga OTOMATIS terisi dari vendor_products.price
      → Manager TIDAK BISA edit harga manual
   g. Subtotal = quantity × unit_price (auto-calculate)

4. STEP 2 — Review & Comparison:
   a. Tampilkan ringkasan semua item
   b. Per item, tampilkan:
      - Harga yang dipilih vs harga terendah
      - Deviasi persentase dari rata-rata
      - Badge: "Best Value" / "Above Average" / "Most Expensive"
   c. Total amount (auto-sum)
   d. IF vendor bukan "Best Value":
      → WAJIB isi "Alasan pemilihan vendor" (textarea, min 20 char)

5. STEP 3 — Submit:
   a. Klik "Submit PO"
   b. SYSTEM:
      i.  Generate po_number: PO-{YYYYMMDD}-{XXX}
      ii. Insert purchase_orders (status = 'submitted')
      iii. Insert purchase_order_items (with snapshot harga + comparison data)
      iv. RUN anomaly detection (lihat Section 6)
      v.  IF anomaly detected:
          → Update PO status = 'flagged'
          → Create alert(s)
      vi. Insert audit_log
   c. Tampilkan konfirmasi + PO number
```

**Validation Rules:**
- Minimal 1 item per PO
- Quantity harus integer positif
- Harga READONLY (dari vendor_products), bukan input manual
- vendor_selection_reason WAJIB jika vendor bukan best value
- Manager hanya bisa buat PO untuk cabangnya sendiri

---

### 5.3 UC-03: Owner Review & Approve/Reject PO

**Actor:** Owner
**Precondition:** Ada PO dengan status 'submitted' atau 'flagged'
**Flow:**

```
1. Owner login → redirect ke /owner
2. Dashboard menampilkan:
   - Jumlah PO pending approval
   - Jumlah alert unresolved
   - Quick stats
3. Navigasi ke /owner/purchase-orders
4. List PO sortable by: tanggal, status, cabang, amount
5. PO dengan status 'flagged' ditandai merah + ikon warning
6. Klik PO → /owner/purchase-orders/[id]

7. Detail PO menampilkan:
   a. Info PO (nomor, tanggal, cabang, manager pembuat)
   b. Tabel item dengan kolom:
      | Produk | Vendor | Qty | Harga | Terendah | Deviasi | Badge |
   c. IF flagged: box merah menampilkan alasan flag
   d. Price comparison visual (bar chart per item)
   e. Vendor score card
   f. Alasan pemilihan vendor (jika vendor bukan best value)
   g. Audit trail PO ini

8. Owner memilih:
   APPROVE:
   a. Klik "Approve"
   b. Optional: tambah catatan
   c. SYSTEM:
      i.   Update PO status = 'approved'
      ii.  Set approved_by, approved_at
      iii. Insert audit_log
      iv.  IF ada alert terkait → mark as resolved

   REJECT:
   a. Klik "Reject"
   b. WAJIB isi rejection_reason (min 20 char)
   c. SYSTEM:
      i.   Update PO status = 'rejected'
      ii.  Insert audit_log
      iii. Manager bisa lihat alasan rejection
```

---

### 5.4 UC-04: Sistem Mendeteksi Anomali (Auto)

**Actor:** System (trigger saat PO di-submit & saat vendor update harga)
**Lihat Section 6 untuk detail logic**

---

### 5.5 UC-05: Owner Melihat Dashboard Analytics

**Actor:** Owner
**Flow:**

```
1. Owner login → /owner (dashboard)
2. SECTION: KPI Cards
   - Total spending bulan ini vs bulan lalu (% change)
   - Jumlah PO bulan ini
   - Rata-rata PO value
   - Alert unresolved count

3. SECTION: Spending Trend (Line Chart)
   - X axis: bulan (6 bulan terakhir)
   - Y axis: total spending
   - Filter: per cabang / semua cabang

4. SECTION: Branch Comparison (Bar Chart)
   - Spending per cabang bulan ini
   - Dengan benchmark rata-rata

5. SECTION: Top Vendors (Table)
   - Vendor, total PO, total spending, avg score
   - Sortable

6. SECTION: Recent Alerts (List)
   - 5 alert terbaru
   - Color-coded by severity
   - Link ke detail

7. SECTION: Price Trend (Line Chart)
   - Pilih produk → lihat trend harga dari semua vendor
   - Deteksi kenaikan abnormal
```

---

### 5.6 UC-06: Admin Finance Merekap Pembayaran

**Actor:** Admin
**Flow:**

```
1. Admin login → /admin
2. Navigasi ke /admin/finance
3. Filter: periode, cabang, vendor, status
4. Tabel PO completed:
   | PO# | Cabang | Vendor | Amount | Status | Tanggal |
5. Export ke CSV (client-side generate)
6. Summary: total per vendor, total per cabang
```

---

## 6. ANOMALY DETECTION ENGINE

File: `src/lib/anomaly-detector.ts`

```typescript
// Pseudocode — logic yang harus diimplementasi

interface AnomalyCheckResult {
  hasAnomaly: boolean;
  alerts: AlertToCreate[];
}

interface AlertToCreate {
  type: AlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  metadata: Record<string, any>;
}

export async function checkPOAnomalies(
  po: PurchaseOrder,
  items: POItemWithComparison[],
  supabase: SupabaseClient
): Promise<AnomalyCheckResult> {
  const alerts: AlertToCreate[] = [];

  // ─── CHECK 1: Harga di atas rata-rata market ───
  // Untuk setiap item dalam PO:
  //   IF item.price_deviation_pct > 15%
  //     → alert 'price_above_average', severity berdasarkan:
  //       15-25% = 'low'
  //       25-40% = 'medium'
  //       40-60% = 'high'
  //       >60%   = 'critical'

  // ─── CHECK 2: Manager pilih vendor termahal ───
  // IF item.unit_price === MAX(semua vendor untuk produk ini)
  //   DAN ada vendor lain yang lebih murah >10%
  //     → alert 'expensive_vendor', severity 'medium'

  // ─── CHECK 3: Volume anomaly ───
  // Ambil rata-rata quantity produk ini dalam 3 bulan terakhir dari cabang ini
  // IF current quantity > 2x average
  //     → alert 'volume_anomaly', severity 'medium'
  // IF current quantity > 3x average
  //     → alert 'volume_anomaly', severity 'high'

  // ─── CHECK 4: Frequent vendor bias ───
  // Hitung dalam 30 hari terakhir, berapa kali manager ini pilih vendor X
  // IF >80% PO ke vendor yang sama DAN ada vendor lain yang lebih murah
  //     → alert 'frequent_vendor', severity 'medium'

  return {
    hasAnomaly: alerts.length > 0,
    alerts,
  };
}

export async function checkPriceSpikeAnomaly(
  vendorProductId: string,
  oldPrice: number,
  newPrice: number,
  supabase: SupabaseClient
): Promise<AlertToCreate | null> {
  const changePct = ((newPrice - oldPrice) / oldPrice) * 100;

  // IF changePct > 10% → alert severity 'low'
  // IF changePct > 25% → alert severity 'medium'
  // IF changePct > 50% → alert severity 'high'
  // ELSE → return null
}
```

### Threshold Configuration (constants.ts)

```typescript
export const ANOMALY_THRESHOLDS = {
  PRICE_DEVIATION: {
    LOW: 15,      // 15% di atas rata-rata
    MEDIUM: 25,
    HIGH: 40,
    CRITICAL: 60,
  },
  PRICE_SPIKE: {
    LOW: 10,      // kenaikan 10%
    MEDIUM: 25,
    HIGH: 50,
  },
  VOLUME_ANOMALY: {
    MEDIUM: 2,    // 2x rata-rata
    HIGH: 3,      // 3x rata-rata
  },
  VENDOR_BIAS: {
    THRESHOLD_PCT: 80,     // >80% PO ke vendor yang sama
    LOOKBACK_DAYS: 30,
  },
};
```

---

## 7. API ROUTES SPECIFICATION

### 7.1 Purchase Orders

```
GET    /api/po
  Query: ?status=submitted&branch_id=xxx&page=1&limit=20
  Response: { data: PO[], total: number, page: number }
  Auth: owner (semua), manager (own branch only), admin (read only)

POST   /api/po
  Body: {
    vendor_id: string,
    items: Array<{ product_id, vendor_product_id, quantity }>,
    notes?: string,
    vendor_selection_reason?: string
  }
  Logic:
    1. Validate items
    2. Snapshot harga dari vendor_products
    3. Hitung avg_market_price, lowest_price, deviation per item
    4. Insert PO + items
    5. Run anomaly detection
    6. IF anomaly → status='flagged', create alerts
    7. ELSE → status='submitted'
    8. Insert audit_log
  Auth: manager only

GET    /api/po/[id]
  Response: PO with items, comparison data, audit trail
  Auth: owner, manager (own branch), admin

POST   /api/po/[id]/approve
  Body: { notes?: string }
  Logic: update status, set approved_by/at, resolve alerts, audit_log
  Auth: owner only

POST   /api/po/[id]/reject
  Body: { rejection_reason: string } // REQUIRED
  Logic: update status, set rejection_reason, audit_log
  Auth: owner only
```

### 7.2 Vendors

```
GET    /api/vendors
  Query: ?search=xxx&is_verified=true
  Response: { data: Vendor[] }
  Auth: all roles

GET    /api/vendors/scores
  Response: { data: VendorScore[] } // from view
  Auth: owner, manager, admin

GET    /api/vendors/compare
  Query: ?product_id=xxx
  Response: {
    product: Product,
    vendors: Array<{
      vendor: Vendor,
      price: number,
      score: number,
      is_best_value: boolean
    }>
  }
  Auth: owner, manager
```

### 7.3 Analytics

```
GET    /api/analytics/spending
  Query: ?period=6m&branch_id=xxx
  Response: {
    monthly: Array<{ month, total, po_count }>,
    comparison: { current_month, prev_month, change_pct }
  }
  Auth: owner, admin

GET    /api/analytics/price-trends
  Query: ?product_id=xxx&period=6m
  Response: {
    product: Product,
    trends: Array<{
      month: string,
      vendors: Array<{ vendor_name, avg_price }>
    }>
  }
  Auth: owner

GET    /api/analytics/branch-comparison
  Query: ?period=current_month
  Response: {
    branches: Array<{
      branch: Branch,
      total_spending: number,
      po_count: number,
      avg_po_value: number,
      most_used_vendor: string
    }>
  }
  Auth: owner
```

---

## 8. MIDDLEWARE & AUTH FLOW

### 8.1 Next.js Middleware

```typescript
// src/middleware.ts

import { createMiddlewareClient } from '@/lib/supabase/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ROLE_ROUTES: Record<string, string[]> = {
  owner:   ['/owner'],
  manager: ['/manager'],
  vendor:  ['/vendor'],
  admin:   ['/admin'],
};

const ROLE_HOME: Record<string, string> = {
  owner:   '/owner',
  manager: '/manager',
  vendor:  '/vendor',
  admin:   '/admin',
};

export async function middleware(req: NextRequest) {
  const { supabase, response } = createMiddlewareClient(req);
  const { data: { session } } = await supabase.auth.getSession();

  const path = req.nextUrl.pathname;

  // 1. Belum login → redirect ke /login
  if (!session && !path.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // 2. Sudah login tapi akses /login → redirect ke role home
  if (session && path.startsWith('/login')) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    return NextResponse.redirect(
      new URL(ROLE_HOME[profile?.role || 'manager'], req.url)
    );
  }

  // 3. Role-based access control
  if (session) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    const role = profile?.role;

    // Cek apakah user akses route yang bukan miliknya
    for (const [routeRole, prefixes] of Object.entries(ROLE_ROUTES)) {
      if (routeRole !== role && prefixes.some(p => path.startsWith(p))) {
        return NextResponse.redirect(
          new URL(ROLE_HOME[role || 'manager'], req.url)
        );
      }
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.svg).*)'],
};
```

### 8.2 Login Flow

```
1. User masuk ke /login
2. Input email + password
3. Call supabase.auth.signInWithPassword()
4. IF success:
   a. Fetch user_profiles → get role
   b. Redirect ke ROLE_HOME[role]
5. IF fail:
   a. Show error message
```

---

## 9. DUMMY DATA (SEED)

### 9.1 Dummy Users

```sql
-- ============================================================
-- SEED: Users (password untuk semua: "password123")
-- Buat dulu di Supabase Auth, lalu insert profile
-- ============================================================

-- Cara: Gunakan Supabase Dashboard > Authentication > Add User
-- atau gunakan supabase.auth.admin.createUser() di seed script

-- User 1: OWNER
-- Email: owner@procureguard.demo
-- Password: password123
-- Profile:
INSERT INTO user_profiles (id, full_name, role, phone) VALUES
  ('OWNER_UUID', 'Sari Kusuma', 'owner', '081234567890');

-- User 2: MANAGER Cabang Jakarta
-- Email: manager.jkt@procureguard.demo
-- Password: password123
INSERT INTO user_profiles (id, full_name, role, branch_id, phone) VALUES
  ('MANAGER_JKT_UUID', 'Budi Santoso', 'manager', 'BRANCH_JKT_UUID', '081234567891');

-- User 3: MANAGER Cabang Bandung
-- Email: manager.bdg@procureguard.demo
-- Password: password123
INSERT INTO user_profiles (id, full_name, role, branch_id, phone) VALUES
  ('MANAGER_BDG_UUID', 'Rina Wati', 'manager', 'BRANCH_BDG_UUID', '081234567892');

-- User 4: VENDOR (PT Tepung Nusantara)
-- Email: vendor.tepung@procureguard.demo
-- Password: password123
INSERT INTO user_profiles (id, full_name, role, vendor_id, phone) VALUES
  ('VENDOR_1_UUID', 'Agus Salim', 'vendor', 'VENDOR_1_UUID', '081234567893');

-- User 5: VENDOR (CV Dairy Fresh)
-- Email: vendor.dairy@procureguard.demo
-- Password: password123
INSERT INTO user_profiles (id, full_name, role, vendor_id, phone) VALUES
  ('VENDOR_2_UUID', 'Linda Hartono', 'vendor', 'VENDOR_2_UUID', '081234567894');

-- User 6: ADMIN / Finance
-- Email: admin@procureguard.demo
-- Password: password123
INSERT INTO user_profiles (id, full_name, role, phone) VALUES
  ('ADMIN_UUID', 'Dewi Lestari', 'admin', '081234567895');
```

### 9.2 Dummy Branches

```sql
INSERT INTO branches (id, name, address, city, phone) VALUES
  ('BRANCH_JKT_UUID', 'Sweet Bake - Kemang',
   'Jl. Kemang Raya No. 45', 'Jakarta Selatan', '021-7654321'),
  ('BRANCH_BDG_UUID', 'Sweet Bake - Dago',
   'Jl. Ir. H. Juanda No. 120', 'Bandung', '022-2503456'),
  ('BRANCH_SBY_UUID', 'Sweet Bake - Darmo',
   'Jl. Raya Darmo No. 88', 'Surabaya', '031-5678901');
```

### 9.3 Dummy Vendors

```sql
INSERT INTO vendors (id, name, contact_person, email, phone, address, city, tax_id, is_verified) VALUES
  ('VENDOR_1_UUID', 'PT Tepung Nusantara',
   'Agus Salim', 'agus@tepungnusantara.co.id', '021-5551001',
   'Jl. Industri Raya No. 10, Kawasan Industri Pulogadung', 'Jakarta Timur',
   '01.234.567.8-001.000', true),

  ('VENDOR_2_UUID', 'CV Dairy Fresh',
   'Linda Hartono', 'linda@dairyfresh.co.id', '021-5551002',
   'Jl. Raya Bogor KM 30 No. 5', 'Depok',
   '02.345.678.9-002.000', true),

  ('VENDOR_3_UUID', 'UD Gula Manis Sejahtera',
   'Hendra Wijaya', 'hendra@gulamanis.com', '021-5551003',
   'Jl. Pasar Baru No. 22', 'Jakarta Pusat',
   '03.456.789.0-003.000', true),

  ('VENDOR_4_UUID', 'PT Coklat Premium Indonesia',
   'Maya Putri', 'maya@coklatpremium.co.id', '022-5551004',
   'Jl. Soekarno-Hatta No. 500', 'Bandung',
   '04.567.890.1-004.000', true),

  ('VENDOR_5_UUID', 'CV Buah Segar Nusantara',
   'Roni Setiawan', 'roni@buahsegar.co.id', '021-5551005',
   'Jl. Raya Tangerang KM 12', 'Tangerang',
   '05.678.901.2-005.000', false),

  ('VENDOR_6_UUID', 'PT Kemasan Indah',
   'Siti Rahayu', 'siti@kemasanindah.co.id', '021-5551006',
   'Jl. Raya Bekasi KM 25', 'Bekasi',
   '06.789.012.3-006.000', true);
```

### 9.4 Dummy Products (Master)

```sql
INSERT INTO products (id, name, category, unit, description) VALUES
  -- Tepung
  ('PROD_01', 'Tepung Terigu Protein Tinggi', 'tepung', 'kg',
   'Untuk roti, donat, mie. Protein 12-14%'),
  ('PROD_02', 'Tepung Terigu Protein Sedang', 'tepung', 'kg',
   'Untuk cake, cookies. Protein 10-11%'),
  ('PROD_03', 'Tepung Maizena', 'tepung', 'kg',
   'Pati jagung, untuk pengental'),

  -- Dairy
  ('PROD_04', 'Butter Unsalted', 'dairy', 'kg',
   'Lemak susu minimal 82%'),
  ('PROD_05', 'Whipping Cream', 'dairy', 'liter',
   'Heavy cream 35% fat'),
  ('PROD_06', 'Susu Full Cream UHT', 'dairy', 'liter',
   'Susu segar UHT'),
  ('PROD_07', 'Cream Cheese', 'dairy', 'kg',
   'Untuk cheesecake dan frosting'),

  -- Gula & Pemanis
  ('PROD_08', 'Gula Pasir Putih', 'gula_pemanis', 'kg',
   'Gula kristal putih'),
  ('PROD_09', 'Gula Halus / Icing Sugar', 'gula_pemanis', 'kg',
   'Gula bubuk untuk dekorasi'),
  ('PROD_10', 'Madu Murni', 'gula_pemanis', 'kg',
   'Madu asli tanpa campuran'),

  -- Coklat
  ('PROD_11', 'Dark Chocolate Couverture 70%', 'coklat_kakao', 'kg',
   'Coklat batang premium cocoa 70%'),
  ('PROD_12', 'Cocoa Powder', 'coklat_kakao', 'kg',
   'Bubuk kakao untuk baking'),

  -- Buah
  ('PROD_13', 'Strawberry Segar', 'buah', 'kg',
   'Grade A, untuk topping'),
  ('PROD_14', 'Blueberry Import', 'buah', 'kg',
   'Blueberry segar import'),

  -- Bahan Pokok
  ('PROD_15', 'Telur Ayam Grade A', 'bahan_pokok', 'kg',
   'Telur segar grade A'),
  ('PROD_16', 'Minyak Goreng', 'bahan_pokok', 'liter',
   'Minyak goreng kelapa sawit'),

  -- Kemasan
  ('PROD_17', 'Box Kue 20x20cm', 'kemasan', 'pcs',
   'Kardus kue putih food grade'),
  ('PROD_18', 'Cup Plastik 250ml', 'kemasan', 'pcs',
   'Cup dessert transparan');
```

### 9.5 Dummy Vendor Products (Harga)

```sql
-- PT Tepung Nusantara (vendor 1) — spesialisasi tepung + bahan pokok
INSERT INTO vendor_products (vendor_id, product_id, price, min_order, lead_time_days) VALUES
  ('VENDOR_1_UUID', 'PROD_01', 12500.00, 25, 2),  -- tepung protein tinggi
  ('VENDOR_1_UUID', 'PROD_02', 11000.00, 25, 2),  -- tepung protein sedang
  ('VENDOR_1_UUID', 'PROD_03', 18000.00, 10, 2),  -- maizena
  ('VENDOR_1_UUID', 'PROD_08', 14500.00, 50, 1),  -- gula pasir
  ('VENDOR_1_UUID', 'PROD_15', 28000.00, 10, 1),  -- telur
  ('VENDOR_1_UUID', 'PROD_16', 17500.00, 20, 1);  -- minyak goreng

-- CV Dairy Fresh (vendor 2) — spesialisasi dairy
INSERT INTO vendor_products (vendor_id, product_id, price, min_order, lead_time_days) VALUES
  ('VENDOR_2_UUID', 'PROD_04', 125000.00, 5, 1),   -- butter unsalted
  ('VENDOR_2_UUID', 'PROD_05', 65000.00, 5, 1),    -- whipping cream
  ('VENDOR_2_UUID', 'PROD_06', 18500.00, 12, 1),   -- susu UHT
  ('VENDOR_2_UUID', 'PROD_07', 95000.00, 3, 2),    -- cream cheese
  ('VENDOR_2_UUID', 'PROD_15', 29500.00, 10, 1);   -- telur (lebih mahal)

-- UD Gula Manis (vendor 3) — spesialisasi gula & pemanis
INSERT INTO vendor_products (vendor_id, product_id, price, min_order, lead_time_days) VALUES
  ('VENDOR_3_UUID', 'PROD_08', 13800.00, 50, 1),   -- gula pasir (TERMURAH)
  ('VENDOR_3_UUID', 'PROD_09', 22000.00, 10, 2),   -- icing sugar
  ('VENDOR_3_UUID', 'PROD_10', 85000.00, 5, 3),    -- madu
  ('VENDOR_3_UUID', 'PROD_01', 13200.00, 20, 3);   -- tepung (lebih mahal)

-- PT Coklat Premium (vendor 4) — spesialisasi coklat
INSERT INTO vendor_products (vendor_id, product_id, price, min_order, lead_time_days) VALUES
  ('VENDOR_4_UUID', 'PROD_11', 185000.00, 3, 2),   -- dark couverture
  ('VENDOR_4_UUID', 'PROD_12', 65000.00, 5, 2),    -- cocoa powder
  ('VENDOR_4_UUID', 'PROD_04', 130000.00, 5, 3),   -- butter (lebih mahal)
  ('VENDOR_4_UUID', 'PROD_05', 68000.00, 5, 3);    -- whipping cream (lebih mahal)

-- CV Buah Segar (vendor 5) — spesialisasi buah
INSERT INTO vendor_products (vendor_id, product_id, price, min_order, lead_time_days) VALUES
  ('VENDOR_5_UUID', 'PROD_13', 75000.00, 3, 1),    -- strawberry
  ('VENDOR_5_UUID', 'PROD_14', 220000.00, 2, 2),   -- blueberry import
  ('VENDOR_5_UUID', 'PROD_10', 90000.00, 3, 2);    -- madu (lebih mahal)

-- PT Kemasan Indah (vendor 6) — spesialisasi kemasan
INSERT INTO vendor_products (vendor_id, product_id, price, min_order, lead_time_days) VALUES
  ('VENDOR_6_UUID', 'PROD_17', 3500.00, 100, 3),   -- box kue
  ('VENDOR_6_UUID', 'PROD_18', 1200.00, 200, 3);   -- cup plastik
```

### 9.6 Dummy Purchase Orders (Skenario Realistis)

```sql
-- ─── PO 1: NORMAL — Manager Jakarta, vendor best value ───
INSERT INTO purchase_orders
  (id, po_number, branch_id, created_by, vendor_id, status,
   total_amount, submitted_at, approved_at, approved_by, created_at)
VALUES
  ('PO_001', 'PO-20250301-001', 'BRANCH_JKT_UUID', 'MANAGER_JKT_UUID',
   'VENDOR_1_UUID', 'completed', 1625000.00,
   '2025-03-01 10:00:00+07', '2025-03-01 14:00:00+07', 'OWNER_UUID',
   '2025-03-01 09:30:00+07');

INSERT INTO purchase_order_items
  (po_id, product_id, vendor_product_id, quantity, unit_price, subtotal,
   avg_market_price, lowest_price, lowest_price_vendor_id, price_deviation_pct)
VALUES
  ('PO_001', 'PROD_01', 'VP_VENDOR1_PROD01', 50, 12500, 625000,
   12850, 12500, 'VENDOR_1_UUID', -2.72),
  ('PO_001', 'PROD_08', 'VP_VENDOR1_PROD08', 30, 14500, 435000,
   14150, 13800, 'VENDOR_3_UUID', 2.47),
  ('PO_001', 'PROD_15', 'VP_VENDOR1_PROD15', 20, 28000, 560000,
   28750, 28000, 'VENDOR_1_UUID', -2.61);

-- ─── PO 2: FLAGGED — Manager Jakarta pilih vendor mahal ───
INSERT INTO purchase_orders
  (id, po_number, branch_id, created_by, vendor_id, status,
   total_amount, vendor_selection_reason, flagged_reason,
   submitted_at, created_at)
VALUES
  ('PO_002', 'PO-20250305-001', 'BRANCH_JKT_UUID', 'MANAGER_JKT_UUID',
   'VENDOR_4_UUID', 'flagged', 1950000.00,
   'Kualitas butter dari Vendor 4 lebih premium untuk pesanan wedding cake',
   'Vendor dipilih bukan best value. Harga butter 4% di atas rata-rata.',
   '2025-03-05 11:00:00+07', '2025-03-05 10:30:00+07');

INSERT INTO purchase_order_items
  (po_id, product_id, vendor_product_id, quantity, unit_price, subtotal,
   avg_market_price, lowest_price, lowest_price_vendor_id, price_deviation_pct)
VALUES
  ('PO_002', 'PROD_04', 'VP_VENDOR4_PROD04', 10, 130000, 1300000,
   127500, 125000, 'VENDOR_2_UUID', 1.96),
  ('PO_002', 'PROD_05', 'VP_VENDOR4_PROD05', 10, 68000, 680000,
   66500, 65000, 'VENDOR_2_UUID', 2.26);

-- ─── PO 3: SUBMITTED — Manager Bandung, menunggu approval ───
INSERT INTO purchase_orders
  (id, po_number, branch_id, created_by, vendor_id, status,
   total_amount, submitted_at, created_at)
VALUES
  ('PO_003', 'PO-20250310-001', 'BRANCH_BDG_UUID', 'MANAGER_BDG_UUID',
   'VENDOR_2_UUID', 'submitted', 1287500.00,
   '2025-03-10 09:00:00+07', '2025-03-10 08:30:00+07');

INSERT INTO purchase_order_items
  (po_id, product_id, vendor_product_id, quantity, unit_price, subtotal,
   avg_market_price, lowest_price, lowest_price_vendor_id, price_deviation_pct)
VALUES
  ('PO_003', 'PROD_04', 'VP_VENDOR2_PROD04', 8, 125000, 1000000,
   127500, 125000, 'VENDOR_2_UUID', -1.96),
  ('PO_003', 'PROD_06', 'VP_VENDOR2_PROD06', 15, 18500, 277500,
   18500, 18500, 'VENDOR_2_UUID', 0.00);

-- ─── PO 4: REJECTED — contoh PO yang ditolak ───
INSERT INTO purchase_orders
  (id, po_number, branch_id, created_by, vendor_id, status,
   total_amount, rejection_reason,
   submitted_at, created_at)
VALUES
  ('PO_004', 'PO-20250308-001', 'BRANCH_JKT_UUID', 'MANAGER_JKT_UUID',
   'VENDOR_5_UUID', 'rejected', 2650000.00,
   'Volume blueberry terlalu tinggi dibanding forecast penjualan bulan ini. Mohon revisi quantity.',
   '2025-03-08 10:00:00+07', '2025-03-08 09:30:00+07');
```

### 9.7 Dummy Alerts

```sql
INSERT INTO alerts (type, severity, po_id, vendor_id, branch_id,
  title, description, is_read, is_resolved, metadata) VALUES
  ('expensive_vendor', 'medium', 'PO_002', 'VENDOR_4_UUID', 'BRANCH_JKT_UUID',
   'Vendor bukan Best Value dipilih',
   'Manager Budi memilih PT Coklat Premium untuk butter (Rp130.000/kg) padahal CV Dairy Fresh menawarkan Rp125.000/kg. Deviasi: +4%',
   false, false,
   '{"selected_price": 130000, "best_price": 125000, "deviation_pct": 4.0}'),

  ('volume_anomaly', 'high', 'PO_004', 'VENDOR_5_UUID', 'BRANCH_JKT_UUID',
   'Volume order blueberry tidak wajar',
   'Order 15kg blueberry dari cabang Kemang, rata-rata 3 bulan terakhir hanya 5kg/bulan. Volume 3x lipat dari rata-rata.',
   true, true,
   '{"ordered_qty": 15, "avg_monthly_qty": 5, "multiplier": 3.0}'),

  ('price_spike', 'medium', NULL, 'VENDOR_5_UUID', NULL,
   'Kenaikan harga strawberry 12%',
   'CV Buah Segar menaikkan harga Strawberry Segar dari Rp67.000 ke Rp75.000/kg (+11.9%)',
   false, false,
   '{"old_price": 67000, "new_price": 75000, "change_pct": 11.9}'),

  ('frequent_vendor', 'medium', NULL, NULL, 'BRANCH_JKT_UUID',
   'Potensi vendor bias — Cabang Kemang',
   'Manager Budi telah memilih PT Tepung Nusantara untuk 85% PO dalam 30 hari terakhir meskipun vendor lain menawarkan harga lebih kompetitif.',
   false, false,
   '{"vendor_name": "PT Tepung Nusantara", "usage_pct": 85, "period_days": 30}');
```

### 9.8 Dummy Vendor Reviews

```sql
INSERT INTO vendor_reviews
  (po_id, vendor_id, reviewed_by, rating_price, rating_quality,
   rating_delivery, rating_overall, notes) VALUES
  ('PO_001', 'VENDOR_1_UUID', 'MANAGER_JKT_UUID', 4, 4, 5, 4.33,
   'Pengiriman tepat waktu, kualitas tepung konsisten.'),
  ('PO_001', 'VENDOR_1_UUID', 'MANAGER_BDG_UUID', 4, 3, 4, 3.67,
   'Harga bersaing, tapi packaging bisa lebih baik.');
```

---

## 10. ENVIRONMENT VARIABLES

```bash
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# App
NEXT_PUBLIC_APP_NAME=ProcureGuard
NEXT_PUBLIC_APP_URL=https://procureguard.vercel.app

# Optional: Resend (email notifications)
RESEND_API_KEY=re_xxxx
```

---

## 11. DEPLOYMENT CHECKLIST

### 11.1 Supabase Setup
```
1. Buat project baru di supabase.com
2. Jalankan migration SQL (Section 3.2) di SQL Editor
3. Buat dummy users di Authentication → Add User:
   - owner@procureguard.demo / password123
   - manager.jkt@procureguard.demo / password123
   - manager.bdg@procureguard.demo / password123
   - vendor.tepung@procureguard.demo / password123
   - vendor.dairy@procureguard.demo / password123
   - admin@procureguard.demo / password123
4. Catat UUID tiap user, replace di seed SQL
5. Jalankan seed SQL (Section 9)
6. Enable RLS pada semua tabel
7. Buat policies (Section 3.2 bagian RLS)
8. Copy URL + anon key ke .env.local
```

### 11.2 Vercel Deployment
```
1. Push code ke GitHub
2. Connect repo di vercel.com
3. Set environment variables
4. Deploy
5. Test semua login credentials
```

---

## 12. ACCEPTANCE CRITERIA (TESTING SCENARIOS)

### Scenario 1: Anti-Markup Core Test
```
GIVEN  Manager login sebagai manager.jkt@procureguard.demo
WHEN   Membuat PO baru dan memilih produk "Tepung Terigu Protein Tinggi"
THEN   Harga otomatis terisi dari vendor_products (READONLY)
AND    Perbandingan harga semua vendor ditampilkan
AND    Manager TIDAK BISA mengetik/edit harga manual
```

### Scenario 2: Flagging Test
```
GIVEN  Manager membuat PO dan memilih vendor TERMAHAL
WHEN   PO di-submit
THEN   Status PO = 'flagged'
AND    Alert 'expensive_vendor' dibuat
AND    Alert muncul di Owner dashboard
AND    Manager WAJIB mengisi alasan pemilihan vendor
```

### Scenario 3: Owner Approval Flow
```
GIVEN  Owner login dan ada PO 'flagged'
WHEN   Owner buka detail PO
THEN   Terlihat: comparison harga, alasan flag, alasan manager, vendor score
WHEN   Owner klik "Approve"
THEN   PO status → 'approved', audit_log tercatat
WHEN   Owner klik "Reject" + isi alasan
THEN   PO status → 'rejected', rejection_reason tersimpan
```

### Scenario 4: Vendor Update Harga
```
GIVEN  Vendor login dan update harga produk dari Rp12.500 ke Rp15.000
WHEN   Perubahan disimpan
THEN   price_history tercatat (old=12500, new=15000, change=+20%)
AND    Alert 'price_spike' severity 'medium' dibuat (>10%)
AND    Owner bisa lihat alert ini
```

### Scenario 5: Dashboard Analytics
```
GIVEN  Owner login
WHEN   Melihat dashboard
THEN   Terlihat: total spending, PO count, comparison chart per cabang
AND    Bisa filter per cabang dan per periode
AND    Alert unresolved ditampilkan
```

---

## 13. PAGE-BY-PAGE UI SPECIFICATION

### Login Page (/login)
```
┌──────────────────────────────────────┐
│            🛡️ ProcureGuard           │
│     Transparent Procurement System   │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ Email                        │    │
│  └──────────────────────────────┘    │
│  ┌──────────────────────────────┐    │
│  │ Password                     │    │
│  └──────────────────────────────┘    │
│                                      │
│  [         Masuk           ]         │
│                                      │
│  Demo Accounts:                      │
│  owner@procureguard.demo             │
│  manager.jkt@procureguard.demo       │
│  vendor.tepung@procureguard.demo     │
│  admin@procureguard.demo             │
│  (password: password123)             │
└──────────────────────────────────────┘
```

### Owner Dashboard (/owner)
```
┌─────────────────────────────────────────────────────┐
│ SIDEBAR          │  OWNER DASHBOARD                  │
│ ─────────        │                                   │
│ 📊 Dashboard     │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐│
│ 📋 Purchase      │  │Spend│ │ PO  │ │Alert│ │ Avg │││
│    Orders        │  │this │ │count│ │ !! │ │ PO  │││
│ 🔔 Alerts (3)   │  │month│ │     │ │    │ │value│││
│ 🏪 Vendors      │  └─────┘ └─────┘ └─────┘ └─────┘│
│ 📝 Audit Trail  │                                   │
│ ─────────        │  ┌─────────────────────────────┐  │
│ Sari Kusuma      │  │  📈 Spending Trend (6 bulan) │  │
│ Owner            │  │  [Line Chart]                │  │
│ [Logout]         │  └─────────────────────────────┘  │
│                  │                                   │
│                  │  ┌──────────────┐ ┌─────────────┐ │
│                  │  │Branch Compare│ │Recent Alerts│ │
│                  │  │ [Bar Chart]  │ │ • Alert 1   │ │
│                  │  │              │ │ • Alert 2   │ │
│                  │  └──────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Manager — Buat PO (/manager/purchase-orders/new)
```
┌─────────────────────────────────────────────────────┐
│ BUAT PURCHASE ORDER BARU                             │
│                                                      │
│ Step 1: Pilih Item                                   │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Produk: [Dropdown: Tepung Terigu Protein Ti... ▼]│ │
│ │                                                  │ │
│ │ 💰 Perbandingan Harga:                           │ │
│ │ ┌──────────────────────────────────────────────┐ │ │
│ │ │ ● PT Tepung Nusantara  Rp12.500  ★4.2 BEST │ │ │
│ │ │ ○ UD Gula Manis        Rp13.200  ★3.8      │ │ │
│ │ │                                              │ │ │
│ │ │ Rata-rata pasar: Rp12.850                    │ │ │
│ │ └──────────────────────────────────────────────┘ │ │
│ │                                                  │ │
│ │ Quantity: [___50___]  kg                         │ │
│ │ Harga/unit: Rp 12.500 (READONLY — dari vendor)  │ │
│ │ Subtotal: Rp 625.000                             │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ [+ Tambah Item]                                      │
│                                                      │
│ Step 2: Review                                       │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Item     │ Vendor    │ Harga   │ Market │ Status │ │
│ │ Tepung PT│ Vendor 1  │ 12.500  │ 12.850 │ ✅BEST │ │
│ │ Gula     │ Vendor 3  │ 13.800  │ 14.150 │ ✅BEST │ │
│ ├──────────┴───────────┴─────────┴────────┴────────┤ │
│ │                           TOTAL: Rp 1.039.000    │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ [       Submit PO       ]                            │
└─────────────────────────────────────────────────────┘
```

---

## 14. NOTES UNTUK VIBE CODING

### Urutan Build yang Direkomendasikan:
```
Phase 1 — Foundation (Week 1):
  1. Setup Next.js + Tailwind + shadcn/ui
  2. Setup Supabase (schema + seed + auth)
  3. Login page + middleware auth
  4. Dashboard layout (sidebar + topbar)
  5. Role-based routing

Phase 2 — Core Feature (Week 2):
  6. Vendor catalog (CRUD harga)
  7. Price comparison API
  8. PO creation form (READONLY price!)
  9. Anomaly detection engine
  10. PO submit + auto-flagging

Phase 3 — Owner Tools (Week 3):
  11. Owner dashboard (stat cards + charts)
  12. PO approval/rejection flow
  13. Alert center
  14. Audit trail viewer

Phase 4 — Polish (Week 4):
  15. Admin finance page
  16. Vendor scoring view
  17. Responsive mobile
  18. Final testing semua scenarios
```

### Prompting Tips untuk AI Coding:
```
- Selalu include file path saat minta generate code
- Minta satu file per prompt, jangan sekaligus
- Sertakan type definitions sebelum minta implementasi
- Test setiap halaman sebelum lanjut ke berikutnya
- Jika error, paste error message lengkap ke AI
```
