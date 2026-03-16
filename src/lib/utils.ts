import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function generatePONumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
  return `PO-${dateStr}-${rand}`;
}

export function calculateDeviation(price: number, average: number): number {
  if (average === 0) return 0;
  return Number((((price - average) / average) * 100).toFixed(2));
}

export function getDeviationColor(pct: number): string {
  if (pct <= 0) return "text-green-600";
  if (pct <= 15) return "text-yellow-600";
  if (pct <= 30) return "text-orange-600";
  return "text-red-600";
}

export function getDeviationBadge(pct: number): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (pct <= 0) return { label: "Best Value", variant: "default" };
  if (pct <= 15) return { label: "Above Average", variant: "secondary" };
  if (pct <= 30) return { label: "Expensive", variant: "outline" };
  return { label: "Most Expensive", variant: "destructive" };
}
