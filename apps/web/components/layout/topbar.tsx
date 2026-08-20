"use client";

import { cn } from "@/lib/utils";
import { Bell, Search, HelpCircle } from "lucide-react";

interface TopbarProps {
  breadcrumbs?: { label: string; href?: string }[];
  className?: string;
}

export function Topbar({ breadcrumbs, className }: TopbarProps) {
  return (
    <header className={cn(
      "h-[68px] border-b border-[#ececea] flex items-center justify-between px-[26px] bg-white sticky top-0 z-40",
      className
    )}>
      {/* Breadcrumbs */}
      <div className="flex items-center gap-[9px] text-[15px]">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-[9px]">
              {i > 0 && <span className="text-[#cfcfc9]">/</span>}
              <span className={cn(
                i === breadcrumbs.length - 1 ? "font-semibold text-[#111110]" : "text-[#9a9a95]"
              )}>
                {crumb.label}
              </span>
            </span>
          ))
        ) : (
          <span className="text-[#9a9a95]">Dashboard</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-[18px]">
        <button className="text-[#6f6f69] hover:text-[#111110] transition-colors">
          <Search size={19} strokeWidth={2} />
        </button>
        <button className="text-[#6f6f69] hover:text-[#111110] transition-colors relative">
          <Bell size={19} strokeWidth={2} />
          <span className="absolute top-[-2px] right-[-2px] w-2 h-2 bg-[#ff5a1f] rounded-full border-[1.5px] border-white" />
        </button>
        <button className="text-[#6f6f69] hover:text-[#111110] transition-colors">
          <HelpCircle size={19} strokeWidth={2} />
        </button>
        <div className="w-px h-[26px] bg-[#ececea] mx-2" />
        <div className="flex items-center gap-[11px]">
          <div className="text-right hidden sm:block leading-[1.25]">
            <p className="text-sm font-semibold text-[#111110]">Marina Prado</p>
            <p className="text-[11px] text-[#ff5a1f] font-mono">Pro Plan</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-[#111110] text-[#ff5a1f] flex items-center justify-center text-[13px] font-bold">
            MP
          </div>
        </div>
      </div>
    </header>
  );
}