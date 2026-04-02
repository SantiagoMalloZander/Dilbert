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
import type { AppRole } from "@/lib/roles";

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
    { href: "/crm", label: "CRM", icon: Activity, visible: hasWorkspaceAccess },
    { href: "/account", label: "Cuenta", icon: Building2, visible: hasWorkspaceAccess },
    {
      href: "/users",
      label: "Usuarios",
      icon: Users,
      visible: hasWorkspaceAccess && role === "owner",
    },
    {
      href: "/integrations",
      label: "Integraciones",
      icon: FolderCog,
      visible: hasWorkspaceAccess && role === "vendor",
    },
    {
      href: "/admin",
      label: "Admin",
      icon: Shield,
      visible: isSuperAdmin,
    },
  ];

  return (
    <nav className="flex flex-wrap gap-2">
      {items
        .filter((item) => item.visible)
        .map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/20 hover:text-foreground"
              )}
            >
              <Icon className="mr-2 h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}
