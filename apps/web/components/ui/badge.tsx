import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-traco-laranja focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-traco-laranja/10 text-traco-claro border-traco-laranja/30",
        secondary:
          "border-transparent bg-grafite-2 text-grafite-3 border-grafite-3",
        destructive:
          "border-transparent bg-red-500/10 text-red-400 border-red-500/30",
        outline: "text-papel border-grafite-3",
        success:
          "border-transparent bg-green-500/10 text-green-400 border-green-500/30",
        mono: "font-mono border-grafite-3 bg-grafite-2 text-grafite-3",
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