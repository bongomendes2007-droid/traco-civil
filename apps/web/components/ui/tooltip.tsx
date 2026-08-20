"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  side?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({ children, content, side = "top" }: TooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false);
  const [coords, setCoords] = React.useState({ x: 0, y: 0 });
  const triggerRef = React.useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      let x = rect.left + rect.width / 2;
      let y = rect.top;

      if (side === "bottom") y = rect.bottom;
      if (side === "left") x = rect.left;
      if (side === "right") x = rect.right;

      setCoords({ x, y });
    }
    setIsVisible(true);
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsVisible(false)}
        className="inline-block"
      >
        {children}
      </div>
      {isVisible && (
        <div
          className={cn(
            "fixed z-50 px-3 py-1.5 text-xs font-medium text-papel bg-grafite-2 border border-grafite-3 rounded-sm shadow-lg pointer-events-none animate-in fade-in-0 zoom-in-95 duration-200",
            side === "top" && "-translate-x-1/2 -translate-y-full mt-[-8px]",
            side === "bottom" && "-translate-x-1/2 translate-y-full mb-[-8px]",
            side === "left" && "-translate-x-full -translate-y-1/2 mr-[-8px]",
            side === "right" && "translate-x-full -translate-y-1/2 ml-[-8px]"
          )}
          style={{ left: coords.x, top: coords.y }}
        >
          {content}
        </div>
      )}
    </>
  );
}