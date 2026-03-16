"use client";

import { Badge } from "@/components/ui/badge";
import { PO_STATUS_CONFIG } from "@/lib/constants";
import { AlertTriangle } from "lucide-react";

export function POStatusBadge({ status }: { status: string }) {
  const config = (PO_STATUS_CONFIG as Record<string, { label: string; color: string; bgColor: string }>)[status] || {
    label: status,
    color: "text-gray-700",
    bgColor: "bg-gray-100",
  };

  return (
    <Badge className={`${config.bgColor} ${config.color} border-0`}>
      {status === "flagged" && <AlertTriangle className="mr-1 h-3 w-3" />}
      {config.label}
    </Badge>
  );
}
