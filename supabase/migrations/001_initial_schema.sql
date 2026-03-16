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
