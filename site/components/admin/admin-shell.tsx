"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { OnlineBadge } from "@/components/shared/online-badge";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";

const COLLAPSED_STORAGE_KEY = "admin-sidebar-collapsed";

export function AdminShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // Só roda uma vez no mount para sincronizar com o localStorage (indisponível no SSR) —
    // não dá pra ler no useState inicial sem causar mismatch de hidratação.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <div className="flex h-svh overflow-hidden">
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r bg-muted/20 transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b px-3">
          {!collapsed && (
            <span className="truncate px-1 font-bold">Administração</span>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(collapsed && "mx-auto")}
            onClick={toggleCollapsed}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <AdminSidebar collapsed={collapsed} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b px-4 md:hidden">
          <div className="flex items-center gap-3">
            <AdminMobileNav />
            <span className="font-bold">Administração</span>
          </div>
          <div className="flex items-center gap-2">
            <OnlineBadge />
            <ThemeToggle />
          </div>
        </div>
        <div className="hidden h-14 shrink-0 items-center justify-end gap-2 border-b px-4 md:flex">
          <OnlineBadge />
          <ThemeToggle />
        </div>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
