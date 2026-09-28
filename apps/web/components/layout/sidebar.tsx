"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useCurrentUser, deriveInitials } from "@/lib/hooks/useCurrentUser";
import { Tooltip } from "@/components/ui/tooltip";
import {
  LayoutGrid,
  FolderOpen,
  FileText,
  BarChart3,
  DollarSign,
  Settings,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const SIDEBAR_COLLAPSED_KEY = "traco_sidebar_collapsed";

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
  const { user, loading: userLoading } = useCurrentUser();
  const [collapsed, setCollapsed] = useState(false);

  // Restore collapsed state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (stored) setCollapsed(stored === "true");
    } catch {
      // localStorage unavailable
    }
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
    } catch {
      // localStorage unavailable
    }
  };

  return (
    <aside
      className={cn(
        "border-r border-[#ececea] flex flex-col bg-white h-screen sticky top-0 py-[22px] transition-all duration-300 ease-in-out",
        collapsed ? "w-[68px] px-[10px]" : "w-[250px] px-[18px]"
      )}
    >
      <div className="flex items-center px-2 pb-[22px] min-h-[48px]">
        {collapsed ? (
          /* PLACEHOLDER: ícone quadrado temporário — trocar por logo real da marca quando disponível */
          <Link
            href="/"
            className="w-[36px] h-[36px] rounded-lg flex items-center justify-center text-white font-bold text-[14px] tracking-tight flex-none"
            style={{ background: "#ff5a1f" }}
            title="TRAÇO CIVIL"
          >
            TC
          </Link>
        ) : (
          <Link href="/">
            <Image
              src="/assets/traco-civil-logo.png"
              alt="TRAÇO CIVIL"
              width={156}
              height={26}
              className="h-[26px] w-auto block"
            />
          </Link>
        )}
      </div>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-[13px] rounded-xl text-[15px] font-medium transition-all duration-200",
                collapsed ? "justify-center px-0 py-[11px]" : "px-[14px] py-[11px]",
                isActive
                  ? "bg-[#111110] text-white"
                  : "text-[#6f6f69] hover:bg-[#f4f4f1] hover:text-[#111110]"
              )}
            >
              <Icon size={18} strokeWidth={2} className="flex-none" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
          return collapsed ? (
            <Tooltip key={item.href} content={item.label} side="right">
              {linkContent}
            </Tooltip>
          ) : (
            <div key={item.href}>{linkContent}</div>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-[14px]">
        {collapsed ? (
          <Tooltip content="Configurações" side="right">
            <Link
              href="/configuracoes"
              className={cn(
                "flex items-center justify-center py-[11px] rounded-xl transition-all duration-200",
                pathname === "/configuracoes"
                  ? "bg-[#111110] text-white"
                  : "text-[#6f6f69] hover:bg-[#f4f4f1] hover:text-[#111110]"
              )}
            >
              <Settings size={18} strokeWidth={2} />
            </Link>
          </Tooltip>
        ) : (
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
        )}

        <div className={cn("flex items-center border-t border-[#ececea]", collapsed ? "justify-center p-2" : "gap-[11px] p-3")}>
          {collapsed ? (
            <Tooltip content={userLoading ? "Carregando..." : (user?.name ?? "Usuário")} side="right">
              <div className="w-9 h-9 rounded-full bg-[#111110] text-[#ff5a1f] flex items-center justify-center font-bold text-[13px] flex-none cursor-default">
                {userLoading ? "…" : deriveInitials(user?.name ?? "")}
              </div>
            </Tooltip>
          ) : (
            <>
              <div className="w-9 h-9 rounded-full bg-[#111110] text-[#ff5a1f] flex items-center justify-center font-bold text-[13px] flex-none">
                {userLoading ? "…" : deriveInitials(user?.name ?? "")}
              </div>
              <div className="leading-[1.25] overflow-hidden">
                {userLoading ? (
                  <>
                    <div className="h-4 w-24 bg-[#ececea] rounded animate-pulse mb-1" />
                    <div className="h-3 w-16 bg-[#ececea] rounded animate-pulse" />
                  </>
                ) : (
                  <>
                    <div className="text-sm font-semibold whitespace-nowrap">{user?.name ?? "Usuário"}</div>
                    <div className="font-mono text-[11px] text-[#9a9a95]">{user?.role ?? "Usuário"}</div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Toggle button */}
        <button
          onClick={toggleCollapsed}
          className="flex items-center justify-center w-full py-[8px] rounded-lg text-[#9a9a95] hover:bg-[#f4f4f1] hover:text-[#111110] transition-colors"
          title={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
          {collapsed ? <ChevronRight size={16} strokeWidth={2} /> : <ChevronLeft size={16} strokeWidth={2} />}
        </button>
      </div>
    </aside>
  );
}