export interface UserProfile {
  id: string;
  full_name: string;
  role: "owner" | "manager" | "vendor" | "admin";
  branch_id: string | null;
  vendor_id: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Vendor {
  id: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  tax_id: string | null;
  bank_name: string | null;
  bank_account: string | null;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  description: string | null;
  min_stock_alert: number;
  created_at: string;
}

export interface VendorProduct {
  id: string;
  vendor_id: string;
  product_id: string;
  price: number;
  min_order: number;
  lead_time_days: number;
  is_available: boolean;
  last_price_update: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  vendor?: Vendor;
  product?: Product;
}

export interface PriceHistory {
  id: string;
  vendor_product_id: string;
  old_price: number | null;
  new_price: number;
  change_percentage: number | null;
  changed_at: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  branch_id: string;
  created_by: string;
  vendor_id: string;
  status: string;
  total_amount: number;
  notes: string | null;
  rejection_reason: string | null;
  vendor_selection_reason: string | null;
  flagged_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  branch?: Branch;
  vendor?: Vendor;
  creator?: UserProfile;
  approver?: UserProfile;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  product_id: string;
  vendor_product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  avg_market_price: number | null;
  lowest_price: number | null;
  lowest_price_vendor_id: string | null;
  price_deviation_pct: number | null;
  created_at: string;
  // Joined
  product?: Product;
  vendor_product?: VendorProduct;
  lowest_price_vendor?: Vendor;
}

export interface VendorReview {
  id: string;
  po_id: string;
  vendor_id: string;
  reviewed_by: string;
  rating_price: number | null;
  rating_quality: number | null;
  rating_delivery: number | null;
  rating_overall: number | null;
  notes: string | null;
  created_at: string;
}

export interface Alert {
  id: string;
  type: string;
  severity: string;
  po_id: string | null;
  vendor_id: string | null;
  branch_id: string | null;
  title: string;
  description: string;
  metadata: Record<string, any> | null;
  is_read: boolean;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  // Joined
  purchase_order?: PurchaseOrder;
  vendor?: Vendor;
  branch?: Branch;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string;
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
  // Joined
  user?: UserProfile;
}

export interface VendorScore {
  vendor_id: string;
  vendor_name: string;
  total_reviews: number;
  avg_price_rating: number;
  avg_quality_rating: number;
  avg_delivery_rating: number;
  avg_overall_rating: number;
  completed_orders: number;
  on_time_deliveries: number;
  composite_score: number;
}
