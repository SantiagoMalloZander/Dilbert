"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Activity,
  Bot,
  Building2,
  FolderCog,
  Loader2,
  Shield,
  Users,
} from "lucide-react";
import {
  canAccessAdmin,
  canConnectChannels,
  canManageUsers,
} from "@/lib/auth/permissions";
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const items: NavItem[] = [
    { href: "/app/crm", label: "CRM", icon: Activity, visible: hasWorkspaceAccess },
    {
      href: "/app/agente",
      label: "Agente IA",
      icon: Bot,
      visible: hasWorkspaceAccess && (role === "owner" || role === "vendor"),
    },
    {
      href: "/app/users",
      label: "Centro de Usuarios",
      icon: Users,
      visible: hasWorkspaceAccess && canManageUsers(role),
    },
    {
      href: "/app/integrations",
      label: role === "vendor" ? "Mis Integraciones" : "Integraciones",
      icon: FolderCog,
      visible: hasWorkspaceAccess && (role === "owner" || canConnectChannels(role)),
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
      visible: isSuperAdmin && canAccessAdmin(email),
    },
  ];

  return (
    <nav className="space-y-0.5">
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
              onClick={(e) => {
                if (active) return;
                e.preventDefault();
                startTransition(() => {
                  router.push(item.href);
                });
              }}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-[#D4420A] text-[#F5F0E8]"
                  : "text-[#F5F0E8]/55 hover:bg-white/8 hover:text-[#F5F0E8]",
                isPending && !active && "opacity-50 pointer-events-none"
              )}
            >
              {isPending && !active ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Icon className="h-4 w-4 shrink-0" />
              )}
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}
