import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-sm border border-grafite-3 bg-grafite px-3 py-2 text-sm text-papel ring-offset-grafite file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-grafite-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-traco-laranja focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };