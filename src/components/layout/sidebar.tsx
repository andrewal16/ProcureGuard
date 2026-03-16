"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/constants";
import {
  LayoutDashboard, ShoppingCart, Bell, Store, FileText,
  Package, ClipboardList, User, DollarSign, Users, BarChart3, Shield,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const NAV_ITEMS: Record<Role, NavItem[]> = {
  owner: [
    { label: "Dashboard", href: "/owner", icon: LayoutDashboard },
    { label: "Purchase Orders", href: "/owner/purchase-orders", icon: ShoppingCart },
    { label: "Alerts", href: "/owner/alerts", icon: Bell },
    { label: "Vendors", href: "/owner/vendors", icon: Store },
    { label: "Audit Trail", href: "/owner/audit", icon: FileText },
  ],
  manager: [
    { label: "Dashboard", href: "/manager", icon: LayoutDashboard },
    { label: "Purchase Orders", href: "/manager/purchase-orders", icon: ShoppingCart },
    { label: "Vendors", href: "/manager/vendors", icon: Store },
  ],
  vendor: [
    { label: "Dashboard", href: "/vendor", icon: LayoutDashboard },
    { label: "Katalog & Harga", href: "/vendor/catalog", icon: Package },
    { label: "Pesanan Masuk", href: "/vendor/orders", icon: ClipboardList },
    { label: "Profil", href: "/vendor/profile", icon: User },
  ],
  admin: [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Finance", href: "/admin/finance", icon: DollarSign },
    { label: "Users", href: "/admin/users", icon: Users },
    { label: "Reports", href: "/admin/reports", icon: BarChart3 },
  ],
};

interface SidebarProps {
  role: Role;
  userName: string;
  className?: string;
}

export function Sidebar({ role, userName, className }: SidebarProps) {
  const pathname = usePathname();
  const items = NAV_ITEMS[role] || [];

  return (
    <aside className={cn("flex h-full w-64 flex-col border-r bg-white", className)}>
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Shield className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">ProcureGuard</span>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {items.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== `/${role}` && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground capitalize">{role}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
