import * as React from "react";
import { cn } from "@/lib/utils";

interface DataTableProps {
  headers: string[];
  rows: (string | number | React.ReactNode)[][];
  className?: string;
}

export function DataTable({ headers, rows, className }: DataTableProps) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-grafite-3">
            {headers.map((header, i) => (
              <th
                key={i}
                className="text-left py-3 px-4 font-mono text-xs uppercase tracking-wider text-grafite-3 font-semibold"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-b border-grafite-2 last:border-0 hover:bg-grafite-2/30 transition-colors"
            >
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={cn(
                    "py-3 px-4",
                    typeof cell === "number" || (typeof cell === "string" && /^[\d.,]+$/.test(cell))
                      ? "font-mono text-white font-medium"
                      : "text-papel/80"
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}