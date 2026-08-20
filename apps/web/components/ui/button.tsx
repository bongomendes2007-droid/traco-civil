import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-sm text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-traco-laranja focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-traco-laranja text-white hover:bg-traco-brasa shadow-[0_0_0_1px_rgba(255,90,31,0.1)] hover:shadow-[0_4px_12px_rgba(255,90,31,0.25)]",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        outline: "border border-grafite-3 bg-transparent text-papel hover:bg-grafite-2 hover:text-traco-laranja hover:border-traco-laranja/50",
        secondary: "bg-grafite-2 text-papel hover:bg-grafite-3",
        ghost: "hover:bg-grafite-2 hover:text-traco-laranja",
        link: "text-traco-laranja underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-sm px-3",
        lg: "h-11 rounded-sm px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }), "font-display tracking-tight")}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };