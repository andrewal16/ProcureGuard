import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

const Sheet = Dialog.Root;

function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentPropsWithoutRef<typeof Dialog.Content> & { side?: "top" | "right" | "bottom" | "left" }) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <Dialog.Content
        className={cn(
          "fixed z-50 bg-white shadow-lg transition",
          side === "left" && "inset-y-0 left-0 h-full",
          side === "right" && "inset-y-0 right-0 h-full",
          side === "top" && "inset-x-0 top-0",
          side === "bottom" && "inset-x-0 bottom-0",
          className
        )}
        {...props}
      >
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}

export { Sheet, SheetContent };
