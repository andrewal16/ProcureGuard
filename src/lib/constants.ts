export const APP_NAME = "ProcureGuard";

export const ROLES = {
  OWNER: "owner",
  MANAGER: "manager",
  VENDOR: "vendor",
  ADMIN: "admin",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner / Direktur",
  manager: "Manager Cabang",
  vendor: "Vendor / Supplier",
  admin: "Admin / Finance",
};

export const ROLE_HOME: Record<Role, string> = {
  owner: "/owner",
  manager: "/manager",
  vendor: "/vendor",
  admin: "/admin",
};

export const PO_STATUS = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  FLAGGED: "flagged",
  APPROVED: "approved",
  REJECTED: "rejected",
  DELIVERED: "delivered",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type POStatus = (typeof PO_STATUS)[keyof typeof PO_STATUS];

export const PO_STATUS_CONFIG: Record<POStatus, { label: string; color: string; bgColor: string }> = {
  draft: { label: "Draft", color: "text-gray-600", bgColor: "bg-gray-100" },
  submitted: { label: "Menunggu Approval", color: "text-blue-600", bgColor: "bg-blue-100" },
  flagged: { label: "Flagged — Perlu Review", color: "text-red-600", bgColor: "bg-red-100" },
  approved: { label: "Approved", color: "text-green-600", bgColor: "bg-green-100" },
  rejected: { label: "Rejected", color: "text-red-600", bgColor: "bg-red-50" },
  delivered: { label: "Delivered", color: "text-emerald-600", bgColor: "bg-emerald-100" },
  completed: { label: "Completed", color: "text-emerald-700", bgColor: "bg-emerald-50" },
  cancelled: { label: "Cancelled", color: "text-gray-400", bgColor: "bg-gray-50" },
};

export const ALERT_TYPES = {
  PRICE_SPIKE: "price_spike",
  EXPENSIVE_VENDOR: "expensive_vendor",
  VOLUME_ANOMALY: "volume_anomaly",
  FREQUENT_VENDOR: "frequent_vendor",
  PRICE_ABOVE_AVERAGE: "price_above_average",
} as const;

export const ALERT_SEVERITY_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  low: { label: "Low", color: "text-yellow-700", bgColor: "bg-yellow-100" },
  medium: { label: "Medium", color: "text-orange-700", bgColor: "bg-orange-100" },
  high: { label: "High", color: "text-red-700", bgColor: "bg-red-100" },
  critical: { label: "Critical", color: "text-red-900", bgColor: "bg-red-200" },
};

export const PRODUCT_CATEGORIES: Record<string, string> = {
  bahan_pokok: "Bahan Pokok",
  dairy: "Dairy",
  tepung: "Tepung",
  gula_pemanis: "Gula & Pemanis",
  coklat_kakao: "Coklat & Kakao",
  buah: "Buah",
  kemasan: "Kemasan",
  lainnya: "Lainnya",
};

export const UNITS: Record<string, string> = {
  kg: "Kilogram",
  gram: "Gram",
  liter: "Liter",
  ml: "Mililiter",
  pcs: "Pieces",
  pack: "Pack",
  box: "Box",
  lusin: "Lusin",
};

export const ANOMALY_THRESHOLDS = {
  PRICE_DEVIATION: { LOW: 15, MEDIUM: 25, HIGH: 40, CRITICAL: 60 },
  PRICE_SPIKE: { LOW: 10, MEDIUM: 25, HIGH: 50 },
  VOLUME_ANOMALY: { MEDIUM: 2, HIGH: 3 },
  VENDOR_BIAS: { THRESHOLD_PCT: 80, LOOKBACK_DAYS: 30 },
};
