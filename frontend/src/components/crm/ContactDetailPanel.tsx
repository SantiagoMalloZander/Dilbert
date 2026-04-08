"use client";

import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  CalendarClock,
  Mail,
  Phone,
  Plus,
  Sparkles,
  UserRoundPlus,
  X,
} from "lucide-react";
import type {
  ContactDetailRecord,
  ContactSearchResult,
  ContactSource,
} from "@/modules/crm/contacts/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

function getSourceLabel(source: ContactSource) {
  switch (source) {
    case "whatsapp":
      return "WhatsApp";
    case "gmail":
      return "Gmail";
    case "instagram":
      return "Instagram";
    case "zoom":
      return "Zoom";
    case "meet":
      return "Meet";
    case "import":
      return "Importado";
    default:
      return "Manual";
  }
}

function formatCurrency(value: number | null, currency: string) {
  if (value == null) {
    return "Sin valor";
  }

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function ContactDetailPanel({
  contact,
  onClose,
  onEdit,
  onCreateLead,
  canEdit,
  canCreateLead,
}: {
  contact: ContactDetailRecord | null;
  onClose: () => void;
  onEdit: () => void;
  onCreateLead: (contact: ContactSearchResult) => void;
  canEdit: boolean;
  canCreateLead: boolean;
}) {
  const router = useRouter();

  if (!contact) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#030712]/45 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[540px] flex-col border-l border-[#2A1A0A]/15 bg-background text-foreground shadow-hard">
        <div className="border-b border-[#2A1A0A]/10 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Badge className="border border-[#2A1A0A]/15 bg-[#F5F0E8] text-foreground">
                {getSourceLabel(contact.source)}
              </Badge>
              <h2 className="mt-3 text-2xl font-semibold">{contact.fullName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{contact.companyName || "Sin empresa"}</p>
            </div>
            <Button variant="ghost" size="icon-sm" className="text-foreground" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {canEdit ? (
              <Button onClick={onEdit}>
                <UserRoundPlus className="mr-2 h-4 w-4" />
                Editar contacto
              </Button>
            ) : null}
            {canCreateLead ? (
              <Button
                variant="outline"
                className="border-[#2A1A0A]/15 bg-[#F5F0E8] text-foreground"
                onClick={() =>
                  onCreateLead({
                    id: contact.id,
                    fullName: contact.fullName,
                    email: contact.email,
                    companyName: contact.companyName,
                  })
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Nuevo lead para este contacto
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#2A1A0A]/15 bg-[#F5F0E8] p-4">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="mt-2 flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-[#D4420A]" />
                {contact.email || "Sin email"}
              </p>
            </div>
            <div className="rounded-2xl border border-[#2A1A0A]/15 bg-[#F5F0E8] p-4">
              <p className="text-xs text-muted-foreground">Teléfono</p>
              <p className="mt-2 flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-[#D4420A]" />
                {contact.phone || "Sin teléfono"}
              </p>
            </div>
            <div className="rounded-2xl border border-[#2A1A0A]/15 bg-[#F5F0E8] p-4">
              <p className="text-xs text-muted-foreground">Cargo</p>
              <p className="mt-2 text-sm">{contact.position || "Sin cargo"}</p>
            </div>
            <div className="rounded-2xl border border-[#2A1A0A]/15 bg-[#F5F0E8] p-4">
              <p className="text-xs text-muted-foreground">Creado</p>
              <p className="mt-2 flex items-center gap-2 text-sm">
                <CalendarClock className="h-4 w-4 text-[#D4420A]" />
                {formatDate(contact.createdAt)}
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <BriefcaseBusiness className="h-3.5 w-3.5" />
              Leads asociados
            </div>
            <div className="space-y-3">
              {contact.leads.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#2A1A0A]/15 px-4 py-5 text-sm text-muted-foreground">
                  Este contacto todavía no tiene leads.
                </div>
              ) : (
                contact.leads.map((lead) => (
                  <button
                    key={lead.id}
                    onClick={() => router.push(`/app/crm/leads?lead=${lead.id}`)}
                    className="group w-full rounded-2xl border border-[#2A1A0A]/15 bg-[#F5F0E8] p-4 text-left transition-all hover:border-[#D4420A]/30 hover:bg-[#D4420A]/5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-medium group-hover:text-[#D4420A]">{lead.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatCurrency(lead.value, lead.currency)} · {lead.status}
                        </p>
                      </div>
                      {lead.stage ? (
                        <Badge className="border border-[#2A1A0A]/15 bg-transparent text-foreground">
                          {lead.stage.name}
                        </Badge>
                      ) : null}
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="space-y-3 pb-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Timeline de actividad
            </div>
            <div className="space-y-3">
              {contact.activities.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#2A1A0A]/15 px-4 py-5 text-sm text-muted-foreground">
                  Todavía no hay actividad registrada sobre este contacto.
                </div>
              ) : (
                contact.activities.map((activity) => (
                  <div key={activity.id} className="rounded-2xl border border-[#2A1A0A]/15 bg-[#F5F0E8] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{activity.title}</p>
                      <Badge className="border border-[#2A1A0A]/15 bg-transparent text-foreground">
                        {activity.type}
                      </Badge>
                    </div>
                    {activity.description ? (
                      <p className="mt-2 text-sm text-[#c3d3e8]">{activity.description}</p>
                    ) : null}
                    <p className="mt-3 text-xs text-muted-foreground">
                      {activity.user?.name || "Usuario"} · {formatDate(activity.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}
