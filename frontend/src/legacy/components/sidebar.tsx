// @ts-nocheck
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
  LogOut,
  Menu,
  Radio,
  Sparkles,
  X,
} from "lucide-react";

const CRM_OPTIONS: { name: string; logo: string; href?: string }[] = [
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
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  exact?: boolean;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg px-4 py-3 text-base md:text-sm md:gap-2.5 md:px-3 md:py-2.5 transition-all ${
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

function CRMNavLink({ href, logo, name, onClick }: { href: string; logo: string; name: string; onClick?: () => void }) {
  const pathname = usePathname();
  const isActive = pathname.startsWith(href);
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded px-3 py-2.5 text-sm transition-all ${
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
      className="flex w-full items-center justify-between rounded px-3 py-2.5 text-sm text-[#F5F0E8]/38 hover:bg-white/5 transition-colors"
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

function SidebarContent({
  companyName,
  role,
  onClose,
}: {
  companyName: string;
  role: string;
  onClose?: () => void;
}) {
  const [crmOpen, setCrmOpen] = useState(true);
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col bg-[#1A1A1A] px-3 py-5">
      {/* Brand */}
      <div className="mb-6 px-3 flex items-start justify-between">
        <div>
          <div className="font-heading text-[22px] tracking-wider text-[#D4420A] leading-none">
            DILBERT.
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#F5F0E8]/28">
              {companyName || "hackITBA 2026"}
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#1A7A6E] animate-pulse shrink-0" />
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-[#F5F0E8]/40 hover:text-[#F5F0E8] p-1 -mt-1 -mr-1">
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        <SectionLabel label="Ventas" />
        <NavLink href="/dashboard" icon={<LayoutList size={14} />} label="Pipeline" exact onClick={onClose} />
        <NavLink href="/metricas" icon={<BarChart3 size={14} />} label="Métricas" onClick={onClose} />
        <NavLink href="/analytics" icon={<Sparkles size={14} />} label="Inteligencia IA" onClick={onClose} />

        <SectionLabel label="CRM" />
        <button
          onClick={() => setCrmOpen(!crmOpen)}
          className="flex w-full items-center justify-between rounded px-3 py-2.5 text-sm text-[#F5F0E8]/55 hover:bg-white/6 hover:text-[#F5F0E8] transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <Database size={14} className="opacity-70 shrink-0" />
            Conectar CRM
          </span>
          {crmOpen ? <ChevronDown className="h-3 w-3 opacity-35" /> : <ChevronRight className="h-3 w-3 opacity-35" />}
        </button>

        {crmOpen && (
          <div className="ml-3 flex flex-col gap-0.5 border-l border-[#F5F0E8]/10 pl-3">
            {CRM_OPTIONS.map((crm) =>
              crm.href ? (
                <CRMNavLink key={crm.name} href={crm.href} logo={crm.logo} name={crm.name} onClick={onClose} />
              ) : (
                <DisabledCRMOption key={crm.name} name={crm.name} logo={crm.logo} />
              )
            )}
            <div className="my-1 border-t border-[#F5F0E8]/8" />
            <NavLink href="/dashboard" icon={<Bot size={14} />} label="Dilbert CRM" exact onClick={onClose} />
          </div>
        )}

        <SectionLabel label="Configuración" />
        <NavLink href="/configuracion" icon={<Radio size={14} />} label="Canales del bot" onClick={onClose} />
      </nav>

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-[#F5F0E8]/8 space-y-1">
        <div className="px-3 mb-2">
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#F5F0E8]/25">
            {companyName || "Demo Company"}
          </p>
        </div>

        {role === "admin" && (
          <Link
            href="/admin"
            onClick={onClose}
            className="flex items-center gap-2.5 rounded px-3 py-2 text-sm text-[#F5D53F]/60 hover:bg-white/5 hover:text-[#F5D53F] transition-colors"
          >
            <Code2 size={13} className="shrink-0" />
            <span className="font-mono text-[10px] uppercase tracking-[0.15em]">Admin</span>
          </Link>
        )}

        <Link
          href="/dev"
          onClick={onClose}
          className="flex items-center gap-2.5 rounded px-3 py-2 text-sm text-[#F5F0E8]/30 hover:bg-white/5 hover:text-[#F5F0E8]/55 transition-colors border border-[#F5F0E8]/8 hover:border-[#F5F0E8]/15"
        >
          <Code2 size={13} className="shrink-0" />
          <span className="font-mono text-[10px] uppercase tracking-[0.15em]">Dev</span>
        </Link>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-sm text-[#F5F0E8]/25 hover:bg-white/5 hover:text-[#F5F0E8]/50 transition-colors"
        >
          <LogOut size={13} className="shrink-0" />
          <span className="font-mono text-[10px] uppercase tracking-[0.15em]">Cerrar sesión</span>
        </button>
      </div>
    </div>
  );
}

export function Sidebar({ companyName, role }: { companyName: string; role: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-full w-56 shrink-0 flex-col border-r border-[#F5F0E8]/8">
        <SidebarContent companyName={companyName} role={role} />
      </aside>

      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 rounded-md bg-[#1A1A1A] p-2 text-[#F5F0E8]/70 hover:text-[#F5F0E8] shadow-lg"
      >
        <Menu size={20} />
      </button>

      {/* Mobile fullscreen overlay */}
      {mobileOpen && (
        <aside className="md:hidden fixed inset-0 z-50">
          <SidebarContent
            companyName={companyName}
            role={role}
            onClose={() => setMobileOpen(false)}
          />
        </aside>
      )}
    </>
  );
}
