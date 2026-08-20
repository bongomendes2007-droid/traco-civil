"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import Image from "next/image";
import {
  LayoutGrid,
  FolderOpen,
  FileText,
  BarChart3,
  DollarSign,
  Settings,
  ArrowUp,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/upload", label: "Nova Análise", icon: ArrowUp },
  { href: "/projetos", label: "Projetos", icon: FolderOpen },
  { href: "/plantas", label: "Plantas", icon: FileText },
  { href: "/analises", label: "Análises", icon: BarChart3 },
  { href: "/orcamentos", label: "Orçamentos", icon: DollarSign },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[250px] border-r border-[#ececea] flex flex-col bg-white h-screen sticky top-0 px-[18px] py-[22px]">
      <div className="flex items-center px-2 pb-[22px]">
        <Link href="/">
          <Image
            src="/assets/traco-civil-logo.png"
            alt="TRAÇO CIVIL"
            width={156}
            height={26}
            className="h-[26px] w-auto block"
          />
        </Link>
      </div>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-[13px] px-[14px] py-[11px] rounded-xl text-[15px] font-medium transition-all duration-200",
                isActive
                  ? "bg-[#111110] text-white"
                  : "text-[#6f6f69] hover:bg-[#f4f4f1] hover:text-[#111110]"
              )}
            >
              <Icon size={18} strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-[14px]">
        <Link
          href="/configuracoes"
          className={cn(
            "flex items-center gap-[13px] px-[14px] py-[11px] rounded-xl text-[15px] font-medium transition-all duration-200",
            pathname === "/configuracoes"
              ? "bg-[#111110] text-white"
              : "text-[#6f6f69] hover:bg-[#f4f4f1] hover:text-[#111110]"
          )}
        >
          <Settings size={18} strokeWidth={2} />
          Configurações
        </Link>

        <div className="flex items-center gap-[11px] p-3 border-t border-[#ececea]">
          <div className="w-9 h-9 rounded-full bg-[#111110] text-[#ff5a1f] flex items-center justify-center font-bold text-[13px] flex-none">
            MP
          </div>
          <div className="leading-[1.25] overflow-hidden">
            <div className="text-sm font-semibold whitespace-nowrap">Marina Prado</div>
            <div className="font-mono text-[11px] text-[#9a9a95]">Eng. Orçamentos</div>
          </div>
        </div>
      </div>
    </aside>
  );
}