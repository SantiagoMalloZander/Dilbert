"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

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
  icon: string;
  label: string;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded px-3 py-2 text-sm transition-all ${
        isActive
          ? "bg-[#D4420A] text-[#F5F0E8] font-medium"
          : "text-[#F5F0E8]/55 hover:bg-white/6 hover:text-[#F5F0E8]"
      }`}
    >
      <span className="text-sm leading-none">{icon}</span>
      {label}
    </Link>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="mb-1 mt-5 px-3 text-[9px] font-mono font-semibold uppercase tracking-[0.22em] text-[#F5F0E8]/28">
      {label}
    </p>
  );
}

function DisabledCRMOption({ name, icon }: { name: string; icon: string }) {
  const [clicked, setClicked] = useState(false);

  return (
    <button
      onClick={() => setClicked(true)}
      className="flex w-full items-center justify-between rounded px-3 py-2 text-sm text-[#F5F0E8]/38 hover:bg-white/5 hover:text-[#F5F0E8]/55 transition-colors"
    >
      <span className="flex items-center gap-2.5">
        <span className="text-sm leading-none">{icon}</span>
        {name}
      </span>
      {clicked ? (
        <span className="text-[9px] font-mono text-[#F5F0E8]/25">No disponible</span>
      ) : (
        <span className="text-[9px] font-mono border border-[#F5F0E8]/18 rounded px-1.5 py-0.5 text-[#F5F0E8]/28 uppercase tracking-wider">
          Conectar
        </span>
      )}
    </button>
  );
}

export function Sidebar() {
  const [crmOpen, setCrmOpen] = useState(true);
  const [channelsOpen, setChannelsOpen] = useState(false);

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col bg-[#1A1A1A] px-3 py-5 border-r border-[#F5F0E8]/8">
      {/* Brand */}
      <div className="mb-6 px-3">
        <div className="font-heading text-[22px] tracking-wider text-[#D4420A] leading-none">
          DILBERT.
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#F5F0E8]/28">
            hackITBA 2026
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-[#1A7A6E] animate-pulse shrink-0" />
        </div>
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
          className="flex w-full items-center justify-between rounded px-3 py-2 text-sm text-[#F5F0E8]/55 hover:bg-white/6 hover:text-[#F5F0E8] transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <span className="text-sm leading-none">🗄️</span>
            Conectar CRM
          </span>
          {crmOpen ? (
            <ChevronDown className="h-3 w-3 shrink-0 opacity-35" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 opacity-35" />
          )}
        </button>

        {crmOpen && (
          <div className="ml-3 flex flex-col gap-0.5 border-l border-[#F5F0E8]/10 pl-3">
            {CRM_OPTIONS.map((crm) =>
              crm.href ? (
                <NavLink key={crm.name} href={crm.href} icon={crm.icon} label={crm.name} />
              ) : (
                <DisabledCRMOption key={crm.name} name={crm.name} icon={crm.icon} />
              )
            )}
            <div className="my-1 border-t border-[#F5F0E8]/8" />
            <NavLink href="/dashboard" icon="🤖" label="Dilbert CRM" exact />
          </div>
        )}

        {/* Configuración */}
        <SectionLabel label="Configuración" />
        <button
          onClick={() => setChannelsOpen(!channelsOpen)}
          className="flex w-full items-center justify-between rounded px-3 py-2 text-sm text-[#F5F0E8]/55 hover:bg-white/6 hover:text-[#F5F0E8] transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <span className="text-sm leading-none">📡</span>
            Canales del bot
          </span>
          {channelsOpen ? (
            <ChevronDown className="h-3 w-3 shrink-0 opacity-35" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 opacity-35" />
          )}
        </button>

        {channelsOpen && (
          <div className="ml-3 flex flex-col gap-0.5 border-l border-[#F5F0E8]/10 pl-3">
            {CHANNELS.map((ch) => (
              <div
                key={ch.name}
                className="flex items-center justify-between rounded px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2.5 text-[#F5F0E8]/45">
                  <span className="text-sm leading-none">{ch.icon}</span>
                  {ch.name}
                </span>
                {ch.active ? (
                  <span className="flex items-center gap-1 text-[10px] text-[#1A7A6E] font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#1A7A6E] animate-pulse" />
                    Activo
                  </span>
                ) : (
                  <span className="text-[9px] font-mono text-[#F5F0E8]/22 uppercase tracking-wider">
                    Pronto
                  </span>
                )}
              </div>
            ))}
            <Link
              href="/configuracion"
              className="mt-1 flex items-center gap-2 rounded px-3 py-2 text-xs text-[#F5F0E8]/35 hover:bg-white/5 hover:text-[#F5F0E8]/60 transition-colors"
            >
              Ver configuración →
            </Link>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-[#F5F0E8]/8">
        <div className="px-3 space-y-0.5">
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#F5F0E8]/25">
            Demo Company
          </p>
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#F5F0E8]/18">
            2 vendedores activos
          </p>
        </div>
      </div>
    </aside>
  );
}
