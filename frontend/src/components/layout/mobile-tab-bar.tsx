"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bot, Settings, Shield, UserRound } from "lucide-react";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/workspace-roles";

type TabItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  visible: boolean;
};

/**
 * Bottom tab bar for mobile (hidden on lg+, where the sidebar lives).
 * Native-app feel: fixed, icons + tiny labels, safe-area aware.
 */
export function MobileTabBar({
  role,
  email,
  isSuperAdmin,
  hasWorkspaceAccess,
}: {
  role: AppRole;
  email?: string | null;
  isSuperAdmin: boolean;
  hasWorkspaceAccess: boolean;
}) {
  const pathname = usePathname();

  const items: TabItem[] = [
    { href: "/app/crm", label: "CRM", icon: Activity, visible: hasWorkspaceAccess },
    {
      href: "/app/agente",
      label: "Agente",
      icon: Bot,
      visible: hasWorkspaceAccess && (role === "owner" || role === "vendor"),
    },
    {
      href: "/app/settings",
      label: "Ajustes",
      icon: Settings,
      visible: hasWorkspaceAccess && (role === "owner" || isSuperAdmin),
    },
    { href: "/app/account", label: "Perfil", icon: UserRound, visible: hasWorkspaceAccess },
    {
      href: "/app/admin",
      label: "Admin",
      icon: Shield,
      visible: isSuperAdmin && canAccessAdmin(email),
    },
  ];

  const visible = items.filter((item) => item.visible);
  if (!visible.length) return null;

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {visible.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 px-1 pb-2 pt-2.5 transition-colors active:scale-95",
                active ? "text-[#D4420A]" : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                  active && "bg-[#D4420A]/10"
                )}
              >
                <Icon className="h-[21px] w-[21px]" />
              </span>
              <span className={cn("text-[10px] leading-none", active ? "font-semibold" : "font-medium")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
