"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Bot,
  ChevronDown,
  ChevronRight,
  Code2,
  Database,
  LayoutList,
  Radio,
  Sparkles,
} from "lucide-react";

const CRM_OPTIONS: {
  name: string;
  logo: string;
  href?: string;
}[] = [
  { name: "Salesforce", logo: "/CRMs/Salesforce.png" },
  { name: "HubSpot", logo: "/CRMs/Hudstop.png", href: "/crm/hubspot" },
  { name: "Zoho CRM", logo: "/CRMs/ZohoCRM.png" },
];

function CRMIcon({ logo, name }: { logo: string; name: string }) {
  return (
    <div className="h-4 w-4 shrink-0 rounded overflow-hidden bg-white/10 flex items-center justify-center">
      <Image src={logo} alt={name} width={16} height={16} className="object-contain" />
    </div>
  );
}

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
      className={`flex items-center gap-2.5 rounded px-3 py-2 text-sm transition-all ${
        isActive
          ? "bg-[#D4420A] text-[#F5F0E8] font-medium"
          : "text-[#F5F0E8]/55 hover:bg-white/6 hover:text-[#F5F0E8]"
      }`}
    >
      <span className="shrink-0 opacity-80">{icon}</span>
      {label}
    </Link>
  );
}

function CRMNavLink({ href, logo, name }: { href: string; logo: string; name: string }) {
  const pathname = usePathname();
  const isActive = pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded px-3 py-2 text-sm transition-all ${
        isActive
          ? "bg-[#D4420A] text-[#F5F0E8] font-medium"
          : "text-[#F5F0E8]/55 hover:bg-white/6 hover:text-[#F5F0E8]"
      }`}
    >
      <CRMIcon logo={logo} name={name} />
      {name}
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

function DisabledCRMOption({ name, logo }: { name: string; logo: string }) {
  const [clicked, setClicked] = useState(false);

  return (
    <button
      onClick={() => setClicked(true)}
      className="flex w-full items-center justify-between rounded px-3 py-2 text-sm text-[#F5F0E8]/38 hover:bg-white/5 hover:text-[#F5F0E8]/55 transition-colors"
    >
      <span className="flex items-center gap-2.5">
        <CRMIcon logo={logo} name={name} />
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
  const router = useRouter();

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
        <NavLink href="/dashboard" icon={<LayoutList size={14} />} label="Pipeline" exact />
        <NavLink href="/metricas" icon={<BarChart3 size={14} />} label="Métricas" />
        <NavLink href="/analytics" icon={<Sparkles size={14} />} label="Inteligencia IA" />

        {/* CRM */}
        <SectionLabel label="CRM" />
        <button
          onClick={() => setCrmOpen(!crmOpen)}
          className="flex w-full items-center justify-between rounded px-3 py-2 text-sm text-[#F5F0E8]/55 hover:bg-white/6 hover:text-[#F5F0E8] transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <Database size={14} className="opacity-70 shrink-0" />
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
                <CRMNavLink key={crm.name} href={crm.href} logo={crm.logo} name={crm.name} />
              ) : (
                <DisabledCRMOption key={crm.name} name={crm.name} logo={crm.logo} />
              )
            )}
            <div className="my-1 border-t border-[#F5F0E8]/8" />
            <NavLink href="/dashboard" icon={<Bot size={14} />} label="Dilbert CRM" exact />
          </div>
        )}

        {/* Configuración */}
        <SectionLabel label="Configuración" />
        <button
          onClick={() => router.push("/configuracion")}
          className="flex w-full items-center justify-between rounded px-3 py-2 text-sm text-[#F5F0E8]/55 hover:bg-white/6 hover:text-[#F5F0E8] transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <Radio size={14} className="opacity-70 shrink-0" />
            Canales del bot
          </span>
          <ChevronRight className="h-3 w-3 shrink-0 opacity-35" />
        </button>
      </nav>

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-[#F5F0E8]/8 space-y-1">
        <div className="px-3 mb-3 space-y-0.5">
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#F5F0E8]/25">
            Demo Company
          </p>
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#F5F0E8]/18">
            2 vendedores activos
          </p>
        </div>

        {/* Dev */}
        <Link
          href="/dev"
          className="flex items-center gap-2.5 rounded px-3 py-2 text-sm text-[#F5F0E8]/30 hover:bg-white/5 hover:text-[#F5F0E8]/55 transition-colors border border-[#F5F0E8]/8 hover:border-[#F5F0E8]/15"
        >
          <Code2 size={13} className="shrink-0" />
          <span className="font-mono text-[10px] uppercase tracking-[0.15em]">Dev</span>
        </Link>
      </div>
    </aside>
  );
}
