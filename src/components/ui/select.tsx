import * as React from "react";
import { cn } from "@/lib/utils";

type SelectContextType = { value?: string; onValueChange?: (value: string) => void };
const SelectContext = React.createContext<SelectContextType>({});

export function Select({ value, onValueChange, children }: { value?: string; onValueChange?: (value: string) => void; children: React.ReactNode }) {
  return <SelectContext.Provider value={{ value, onValueChange }}>{children}</SelectContext.Provider>;
}

export function SelectTrigger({ className, children }: React.ComponentProps<"div">) {
  return <div className={cn("flex h-10 w-full items-center rounded-md border px-3 py-2 text-sm", className)}>{children}</div>;
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value } = React.useContext(SelectContext);
  return <span>{value || placeholder || ""}</span>;
}

export function SelectContent({ className, children }: React.ComponentProps<"div">) {
  return <div className={cn("mt-2 space-y-1 rounded-md border p-2", className)}>{children}</div>;
}

export function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = React.useContext(SelectContext);
  return (
    <button
      type="button"
      className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-gray-100"
      onClick={() => ctx.onValueChange?.(value)}
    >
      {children}
    </button>
  );
}
