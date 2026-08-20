import * as React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: React.ReactNode;
  className?: string;
  highlight?: boolean;
}

export function StatCard({
  label,
  value,
  unit,
  trend,
  trendValue,
  icon,
  className,
  highlight = false,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-sm border p-5 transition-all duration-200",
        highlight
          ? "border-traco-laranja/40 bg-traco-laranja/5 shadow-[0_0_20px_rgba(255,90,31,0.08)]"
          : "border-grafite-3 bg-grafite/50 hover:border-grafite-2",
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs uppercase tracking-wider text-grafite-3 font-semibold">
          {label}
        </span>
        {icon && (
          <span className={cn("opacity-60", highlight && "text-traco-laranja opacity-100")}>
            {icon}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "font-mono text-2xl font-semibold tracking-tight",
            highlight ? "text-traco-laranja" : "text-white"
          )}
        >
          {value}
        </span>
        {unit && (
          <span className="font-mono text-sm text-grafite-3">{unit}</span>
        )}
      </div>
      {trend && trendValue && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          <span
            className={cn(
              "font-mono",
              trend === "up" && "text-green-400",
              trend === "down" && "text-red-400",
              trend === "neutral" && "text-grafite-3"
            )}
          >
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {trendValue}
          </span>
        </div>
      )}
    </div>
  );
}