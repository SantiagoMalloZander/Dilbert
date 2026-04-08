"use client";

import { useRouter } from "next/navigation";
import { Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuickActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  isLoading?: boolean;
}

function QuickActionCard({
  icon,
  title,
  description,
  onClick,
  isLoading,
}: QuickActionCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="group relative overflow-hidden rounded-[24px] border border-[#2A1A0A]/15 bg-gradient-to-br from-white/5 to-white/[0.02] p-5 text-left transition-all hover:border-[#D4420A]/30 hover:bg-[#D4420A]/5"
    >
      <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 translate-y-[-8px] rounded-full bg-[#D4420A] opacity-0 blur-3xl transition-all group-hover:opacity-5" />
      <div className="relative z-10 flex items-start gap-3">
        <div className="rounded-xl bg-[#D4420A]/10 p-2.5 text-[#D4420A] group-hover:bg-[#D4420A]/20">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </button>
  );
}

export interface QuickActionsConfig {
  canCreateLead?: boolean;
  canCreateContact?: boolean;
  canViewPipeline?: boolean;
  canManageIntegrations?: boolean;
  onCreateLead?: () => void;
  onCreateContact?: () => void;
  onViewPipeline?: () => void;
  onManageIntegrations?: () => void;
}

export function QuickActionsSection({
  canCreateLead = true,
  canCreateContact = true,
  canViewPipeline = true,
  canManageIntegrations = false,
  onCreateLead,
  onCreateContact,
  onViewPipeline,
  onManageIntegrations,
}: QuickActionsConfig) {
  const router = useRouter();

  const handleCreateLead = () => {
    onCreateLead?.() || router.push("/app/crm/leads?create=true");
  };

  const handleCreateContact = () => {
    onCreateContact?.() || router.push("/app/crm/contacts?create=true");
  };

  const handleViewPipeline = () => {
    onViewPipeline?.() || router.push("/app/crm/leads");
  };

  const handleManageIntegrations = () => {
    onManageIntegrations?.() || router.push("/app/integrations");
  };

  const actions = [
    {
      show: canCreateLead,
      icon: <Plus className="h-5 w-5" />,
      title: "Crear Lead",
      description: "Nueva oportunidad de venta",
      onClick: handleCreateLead,
    },
    {
      show: canCreateContact,
      icon: <Plus className="h-5 w-5" />,
      title: "Crear Contacto",
      description: "Nueva persona o empresa",
      onClick: handleCreateContact,
    },
    {
      show: canViewPipeline,
      icon: <Zap className="h-5 w-5" />,
      title: "Ver Pipeline",
      description: "Kanban de oportunidades",
      onClick: handleViewPipeline,
    },
    {
      show: canManageIntegrations,
      icon: <Plus className="h-5 w-5" />,
      title: "Integraciones",
      description: "Conectar canales",
      onClick: handleManageIntegrations,
    },
  ].filter((action) => action.show);

  if (actions.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[32px] border border-[#2A1A0A]/15 bg-background px-6 py-7 text-white shadow-[0_28px_80px_rgba(2,6,23,0.32)]">
      <div className="mb-5 space-y-1">
        <h2 className="text-lg font-semibold">Acciones rápidas</h2>
        <p className="text-sm text-muted-foreground">
          Comienza aquí tu flujo de trabajo
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((action, index) => (
          <QuickActionCard
            key={index}
            icon={action.icon}
            title={action.title}
            description={action.description}
            onClick={action.onClick}
          />
        ))}
      </div>
    </section>
  );
}
