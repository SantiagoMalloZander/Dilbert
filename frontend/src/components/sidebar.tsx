"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const CRM_OPTIONS: { name: string; icon: string; href?: string }[] = [
  { name: "Salesforce", icon: "☁️" },
  { name: "HubSpot", icon: "🟠", href: "/crm/hubspot" },
  { name: "Pipedrive", icon: "🟢" },
  { name: "Zoho CRM", icon: "🔵" },
  { name: "Odoo CRM", icon: "🟣" },
  { name: "Freshsales", icon: "🌿" },
];

const CHANNELS = [
  { name: "Telegram", icon: "✈️", active: true },
  { name: "WhatsApp", icon: "💬", active: false },
  { name: "Instagram", icon: "📸", active: false },
  { name: "Messenger", icon: "💙", active: false },
  { name: "Slack", icon: "⚡", active: false },
];

function NavLink({
  href,
  icon,
  label,
  exact = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
        isActive
          ? "bg-primary text-primary-foreground font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <span className="text-base leading-none">{icon}</span>
      {label}
    </Link>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
      {label}
    </p>
  );
}

function DisabledCRMOption({ name, icon }: { name: string; icon: string }) {
  const [clicked, setClicked] = useState(false);

  return (
    <button
      onClick={() => setClicked(true)}
      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-muted-foreground/60 hover:bg-muted transition-colors"
    >
      <span className="flex items-center gap-2.5">
        <span className="text-base leading-none">{icon}</span>
        {name}
      </span>
      {clicked ? (
        <span className="text-xs text-muted-foreground">No disponible</span>
      ) : (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal opacity-60">
          Conectar
        </Badge>
      )}
    </button>
  );
}

export function Sidebar() {
  const [crmOpen, setCrmOpen] = useState(true);
  const [channelsOpen, setChannelsOpen] = useState(false);

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r bg-card px-3 py-4">
      {/* Brand */}
      <div className="mb-4 px-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">Dilbert</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 h-4 font-normal">
            CRM
          </Badge>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">hackITBA 2026</p>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {/* Ventas */}
        <SectionLabel label="Ventas" />
        <NavLink href="/dashboard" icon="📋" label="Pipeline" exact />
        <NavLink href="/metricas" icon="📊" label="Métricas" />
        <NavLink href="/analytics" icon="🧠" label="Inteligencia IA" />

        {/* CRM */}
        <SectionLabel label="CRM" />
        <button
          onClick={() => setCrmOpen(!crmOpen)}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <span className="text-base leading-none">🗄️</span>
            Conectar CRM
          </span>
          {crmOpen ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          )}
        </button>

        {crmOpen && (
          <div className="ml-3 flex flex-col gap-0.5 border-l pl-3">
            {CRM_OPTIONS.map((crm) =>
              crm.href ? (
                <NavLink key={crm.name} href={crm.href} icon={crm.icon} label={crm.name} />
              ) : (
                <DisabledCRMOption key={crm.name} name={crm.name} icon={crm.icon} />
              )
            )}
            <div className="my-1 border-t" />
            <NavLink href="/dashboard" icon="🤖" label="Dilbert CRM" exact />
          </div>
        )}

        {/* Configuración */}
        <SectionLabel label="Configuración" />
        <button
          onClick={() => setChannelsOpen(!channelsOpen)}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <span className="text-base leading-none">📡</span>
            Canales del bot
          </span>
          {channelsOpen ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          )}
        </button>

        {channelsOpen && (
          <div className="ml-3 flex flex-col gap-0.5 border-l pl-3">
            {CHANNELS.map((ch) => (
              <div
                key={ch.name}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2.5 text-muted-foreground">
                  <span className="text-base leading-none">{ch.icon}</span>
                  {ch.name}
                </span>
                {ch.active ? (
                  <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    Activo
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground/50">Pronto</span>
                )}
              </div>
            ))}
            <Link
              href="/configuracion"
              className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              Ver configuración →
            </Link>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="mt-auto pt-4 border-t">
        <div className="px-3 text-[10px] text-muted-foreground/50">
          <p>Demo Company</p>
          <p className="mt-0.5">2 vendedores activos</p>
        </div>
      </div>
    </aside>
  );
}
