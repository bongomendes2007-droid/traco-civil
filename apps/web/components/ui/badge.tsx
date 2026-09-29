import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#ff5a1f] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#ff5a1f]/10 text-[#ff5a1f] border-[#ff5a1f]/30",
        secondary:
          "border-transparent bg-[#f7f6f2] text-[#9a9a95] border-[#e2e0da]",
        destructive:
          "border-transparent bg-red-500/10 text-red-400 border-red-500/30",
        outline: "text-[#111110] border-[#e2e0da]",
        success:
          "border-transparent bg-green-500/10 text-green-400 border-green-500/30",
        mono: "font-mono border-[#e2e0da] bg-[#f7f6f2] text-[#9a9a95]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };