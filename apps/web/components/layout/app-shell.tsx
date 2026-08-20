import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

interface AppShellProps {
  children: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}

export function AppShell({ children, breadcrumbs }: AppShellProps) {
  return (
    <div className="flex h-screen bg-white text-[#111110] overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col bg-white min-w-0">
        <Topbar breadcrumbs={breadcrumbs} />
        <div className="flex-1 overflow-auto bg-[#f7f6f2]">
          {children}
        </div>
      </main>
    </div>
  );
}