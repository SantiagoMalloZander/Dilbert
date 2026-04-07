"use client";

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
  if (!contact) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#030712]/45 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[540px] flex-col border-l border-white/10 bg-[#07101b] text-[#f8fafc] shadow-[0_30px_80px_rgba(2,6,23,0.55)]">
        <div className="border-b border-white/8 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Badge className="border border-white/10 bg-white/5 text-[#d8e4f2]">
                {getSourceLabel(contact.source)}
              </Badge>
              <h2 className="mt-3 text-2xl font-semibold">{contact.fullName}</h2>
              <p className="mt-1 text-sm text-[#9fb0c8]">{contact.companyName || "Sin empresa"}</p>
            </div>
            <Button variant="ghost" size="icon-sm" className="text-white" onClick={onClose}>
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
                className="border-white/10 bg-white/5 text-[#f8fafc]"
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
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-[#6f85a3]">Email</p>
              <p className="mt-2 flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-[#35d6ae]" />
                {contact.email || "Sin email"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-[#6f85a3]">Teléfono</p>
              <p className="mt-2 flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-[#35d6ae]" />
                {contact.phone || "Sin teléfono"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-[#6f85a3]">Cargo</p>
              <p className="mt-2 text-sm">{contact.position || "Sin cargo"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-[#6f85a3]">Creado</p>
              <p className="mt-2 flex items-center gap-2 text-sm">
                <CalendarClock className="h-4 w-4 text-[#35d6ae]" />
                {formatDate(contact.createdAt)}
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#6f85a3]">
              <BriefcaseBusiness className="h-3.5 w-3.5" />
              Leads asociados
            </div>
            <div className="space-y-3">
              {contact.leads.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-[#6f85a3]">
                  Este contacto todavía no tiene leads.
                </div>
              ) : (
                contact.leads.map((lead) => (
                  <div key={lead.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{lead.title}</p>
                        <p className="mt-1 text-xs text-[#9fb0c8]">
                          {formatCurrency(lead.value, lead.currency)} · {lead.status}
                        </p>
                      </div>
                      {lead.stage ? (
                        <Badge className="border border-white/10 bg-transparent text-[#d8e4f2]">
                          {lead.stage.name}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="space-y-3 pb-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#6f85a3]">
              <Sparkles className="h-3.5 w-3.5" />
              Timeline de actividad
            </div>
            <div className="space-y-3">
              {contact.activities.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-[#6f85a3]">
                  Todavía no hay actividad registrada sobre este contacto.
                </div>
              ) : (
                contact.activities.map((activity) => (
                  <div key={activity.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{activity.title}</p>
                      <Badge className="border border-white/10 bg-transparent text-[#d8e4f2]">
                        {activity.type}
                      </Badge>
                    </div>
                    {activity.description ? (
                      <p className="mt-2 text-sm text-[#c3d3e8]">{activity.description}</p>
                    ) : null}
                    <p className="mt-3 text-xs text-[#6f85a3]">
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
