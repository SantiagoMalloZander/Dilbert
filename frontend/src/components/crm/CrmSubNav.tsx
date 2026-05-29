"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Kanban, LayoutDashboard, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/app/crm", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/app/crm/leads", label: "Pipeline", icon: Kanban },
  { href: "/app/crm/contacts", label: "Contactos", icon: Users },
  { href: "/app/crm/analytics", label: "Analytics", icon: BarChart3 },
];

export function CrmSubNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1 rounded-xl border border-[#2A1A0A]/10 bg-[#F5F0E8] p-1">
      {ITEMS.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-card/70"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
