"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Building2,
  FolderCog,
  Shield,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/workspace-roles";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  visible: boolean;
};

export function AppNav({
  role,
  isSuperAdmin,
  hasWorkspaceAccess,
}: {
  role: AppRole;
  isSuperAdmin: boolean;
  hasWorkspaceAccess: boolean;
}) {
  const pathname = usePathname();

  const items: NavItem[] = [
    { href: "/app/crm", label: "CRM", icon: Activity, visible: hasWorkspaceAccess },
    {
      href: "/app/users",
      label: "Centro de Usuarios",
      icon: Users,
      visible: hasWorkspaceAccess && role === "owner",
    },
    {
      href: "/app/integrations",
      label: role === "vendor" ? "Mis Integraciones" : "Integraciones",
      icon: FolderCog,
      visible: hasWorkspaceAccess && (role === "owner" || role === "vendor"),
    },
    {
      href: "/app/account",
      label: "Mi Perfil",
      icon: Building2,
      visible: hasWorkspaceAccess,
    },
    {
      href: "/app/admin",
      label: "Admin",
      icon: Shield,
      visible: isSuperAdmin,
    },
  ];

  return (
    <nav className="space-y-1">
      {items
        .filter((item) => item.visible)
        .map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center rounded-2xl border px-3 py-3 text-sm transition-colors",
                active
                  ? "border-primary/30 bg-primary/15 text-primary"
                  : "border-transparent text-muted-foreground hover:border-white/10 hover:bg-white/5 hover:text-foreground"
              )}
            >
              <Icon className="mr-3 h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}
