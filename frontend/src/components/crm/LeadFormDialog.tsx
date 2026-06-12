"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Search, X } from "lucide-react";
import { createContact, searchContactsAction } from "@/modules/crm/contacts/actions";
import type { ContactFormInput, ContactSearchResult } from "@/modules/crm/contacts/types";
import { createLead } from "@/modules/crm/leads/actions";
import { EMPTY_LEAD_REAL_ESTATE, validateLeadSearchFields, type LeadRealEstateFields } from "@/modules/crm/leads/types";
import { LeadRealEstateFormSection } from "@/components/crm/LeadRealEstateFormSection";
import { PropertyPickerDialog } from "@/components/crm/PropertyPickerDialog";
import { useSubmitGuard } from "@/lib/use-submit-guard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { emitGlobalToast } from "@/lib/global-toast";
import { cn } from "@/lib/utils";

interface LeadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelines: Array<{ id: string; name: string; stages: Array<{ id: string; name: string }> }>;
  assignees: Array<{ id: string; name: string }>;
  isOwner: boolean;
  presetContact?: ContactSearchResult | null;
}

function validateContactForm(form: ContactFormInput) {
  return {
    firstName: form.firstName.trim() ? "" : "El nombre es obligatorio.",
    lastName: form.lastName.trim() ? "" : "El apellido es obligatorio.",
    email:
      !form.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
        ? ""
        : "Ingresá un email válido.",
    phone:
      !form.phone || /^[+\d\s()-]{7,20}$/.test(form.phone)
        ? ""
        : "Ingresá un teléfono válido.",
  };
}

export function LeadFormDialog({
  open,
  onOpenChange,
  pipelines,
  assignees,
  isOwner,
  presetContact,
}: LeadFormDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createInlineContact, setCreateInlineContact] = useState(!presetContact);
  const [query, setQuery] = useState(presetContact?.fullName || "");
  const [searchResults, setSearchResults] = useState<ContactSearchResult[]>(
    presetContact ? [presetContact] : []
  );
  const [selectedContact, setSelectedContact] = useState<ContactSearchResult | null>(presetContact || null);
  const [form, setForm] = useState({
    title: "",
    value: "",
    currency: "ARS",
    probability: 30,
    expectedCloseDate: "",
    pipelineId: pipelines[0]?.id || "",
    stageId: pipelines[0]?.stages[0]?.id || "",
    assignedTo: assignees[0]?.id || "",
  });
  const [realEstate, setRealEstate] = useState<LeadRealEstateFields>(EMPTY_LEAD_REAL_ESTATE);
  const [baseProperty, setBaseProperty] = useState<{ id: string; title: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [inlineContact, setInlineContact] = useState<ContactFormInput>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    companyName: "",
    position: "",
  });

  useEffect(() => {
    if (!open || createInlineContact) {
      return;
    }

    const normalized = query.trim();
    if (!normalized) {
      return;
    }

    const handle = window.setTimeout(async () => {
      const response = await searchContactsAction(normalized);
      if (response.error) {
        emitGlobalToast({ tone: "error", text: response.error });
        return;
      }
      setSearchResults(response.data || []);
    }, 300);

    return () => window.clearTimeout(handle);
  }, [createInlineContact, open, presetContact, query]);

  const inlineErrors = validateContactForm(inlineContact);

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      emitGlobalToast({ tone: "error", text: "El lead necesita un título." });
      return;
    }

    const searchError = validateLeadSearchFields(realEstate);
    if (searchError) {
      emitGlobalToast({ tone: "error", text: searchError });
      return;
    }

    let contactId = selectedContact?.id || null;

    if (createInlineContact) {
      const hasInlineErrors = Object.values(inlineErrors).some(Boolean);
      if (hasInlineErrors) {
        emitGlobalToast({ tone: "error", text: "Revisá los datos del contacto inline." });
        return;
      }

      const contactResponse = await createContact(inlineContact);
      if (contactResponse.error || !contactResponse.data) {
        emitGlobalToast({
          tone: "error",
          text: contactResponse.error || "No pudimos crear el contacto inline.",
        });
        return;
      }

      contactId = contactResponse.data.id;
    }

    if (!contactId) {
      emitGlobalToast({ tone: "error", text: "Seleccioná un contacto." });
      return;
    }

    const response = await createLead({
      title: form.title,
      contactId,
      value: form.value.trim() ? Number(form.value) : null,
      currency: form.currency,
      probability: form.probability,
      expectedCloseDate: form.expectedCloseDate || null,
      pipelineId: form.pipelineId,
      stageId: form.stageId,
      assignedTo: isOwner ? form.assignedTo || null : null,
      source: "manual",
      realEstate,
      listingId: baseProperty?.id ?? null,
    });

    if (response.error) {
      emitGlobalToast({ tone: "error", text: response.error });
      return;
    }

    emitGlobalToast({ tone: "success", text: "Lead creado." });
    onOpenChange(false);
    startTransition(() => {
      router.refresh();
    });
  };

  const [submitLead, isSubmitting] = useSubmitGuard(handleSubmit);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[3px] border-border bg-background text-foreground sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo lead</DialogTitle>
          <DialogDescription>
            Creá una oportunidad nueva y vinculala a un contacto existente o nuevo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="lead-title">Título</Label>
              <Input
                id="lead-title"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label>Contacto</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setCreateInlineContact((current) => {
                      const nextValue = !current;
                      if (nextValue) {
                        setSelectedContact(null);
                      } else {
                        setSearchResults(presetContact ? [presetContact] : []);
                      }
                      return nextValue;
                    })
                  }
                >
                  {createInlineContact ? "Elegir existente" : "Crear inline"}
                </Button>
              </div>

              {createInlineContact ? (
                <div className="grid gap-3 rounded-2xl border border-border bg-background/50 p-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Input
                      placeholder="Nombre"
                      value={inlineContact.firstName}
                      onChange={(event) =>
                        setInlineContact((current) => ({
                          ...current,
                          firstName: event.target.value,
                        }))
                      }
                    />
                    {inlineErrors.firstName ? (
                      <p className="text-xs text-red-600">{inlineErrors.firstName}</p>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <Input
                      placeholder="Apellido"
                      value={inlineContact.lastName}
                      onChange={(event) =>
                        setInlineContact((current) => ({
                          ...current,
                          lastName: event.target.value,
                        }))
                      }
                    />
                    {inlineErrors.lastName ? (
                      <p className="text-xs text-red-600">{inlineErrors.lastName}</p>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <Input
                      type="email"
                      placeholder="Email"
                      value={inlineContact.email || ""}
                      onChange={(event) =>
                        setInlineContact((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                    />
                    {inlineErrors.email ? (
                      <p className="text-xs text-red-600">{inlineErrors.email}</p>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <Input
                      placeholder="Teléfono"
                      value={inlineContact.phone || ""}
                      onChange={(event) =>
                        setInlineContact((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                    />
                    {inlineErrors.phone ? (
                      <p className="text-xs text-red-600">{inlineErrors.phone}</p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Buscá por nombre, email o empresa"
                      value={query}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setQuery(nextValue);
                        setSelectedContact(null);
                        if (!nextValue.trim()) {
                          setSearchResults(presetContact ? [presetContact] : []);
                        }
                      }}
                    />
                  </div>
                  <div className="max-h-40 space-y-2 overflow-y-auto">
                    {searchResults.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => {
                          setSelectedContact(contact);
                          setQuery(contact.fullName);
                        }}
                        className={cn(
                          "w-full rounded-xl border px-3 py-2 text-left transition-colors",
                          selectedContact?.id === contact.id
                            ? "border-primary bg-primary/10"
                            : "border-border bg-background/50 hover:bg-background/70"
                        )}
                      >
                        <p className="font-medium">{contact.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {contact.email || "Sin email"} · {contact.companyName || "Sin empresa"}
                        </p>
                      </button>
                    ))}
                    {query && searchResults.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No encontramos contactos con esa búsqueda.</p>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead-value">Valor</Label>
              <Input
                id="lead-value"
                type="number"
                value={form.value}
                onChange={(event) =>
                  setForm((current) => ({ ...current, value: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Moneda</Label>
              <Select
                value={form.currency}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, currency: value || "ARS" }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-close-date">Fecha estimada de cierre</Label>
              <Input
                id="lead-close-date"
                type="date"
                value={form.expectedCloseDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    expectedCloseDate: event.target.value,
                  }))
                }
              />
            </div>
            {isOwner ? (
              <div className="space-y-2">
                <Label>Vendedor asignado</Label>
                <Select
                  value={form.assignedTo}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, assignedTo: value || current.assignedTo }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <span className="flex-1 truncate text-left text-sm">
                      {assignees.find((a) => a.id === form.assignedTo)?.name || "Seleccioná vendedor"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {assignees.map((assignee) => (
                      <SelectItem key={assignee.id} value={assignee.id}>
                        {assignee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
        </div>

        <LeadRealEstateFormSection
          values={realEstate}
          onChange={(patch) => setRealEstate((prev) => ({ ...prev, ...patch }))}
          idPrefix="create-re"
        />

        <div className="space-y-2">
          <Label>Inmueble que consultó (opcional)</Label>
          {baseProperty ? (
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-muted p-3">
              <span className="flex items-center gap-2 truncate text-sm font-medium">
                <Building2 className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{baseProperty.title}</span>
              </span>
              <button
                type="button"
                onClick={() => setBaseProperty(null)}
                className="shrink-0 text-muted-foreground hover:text-[#D4420A]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/50 p-3 text-sm font-medium text-muted-foreground transition-all hover:border-[#D4420A]/30 hover:text-[#D4420A]"
            >
              <Building2 className="h-4 w-4" />
              Elegir del catálogo
            </button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={isSubmitting} onClick={submitLead}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Crear lead
          </Button>
        </DialogFooter>
      </DialogContent>

      <PropertyPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={(property) => {
          setBaseProperty({ id: property.id, title: property.title });
          setPickerOpen(false);
        }}
      />
    </Dialog>
  );
}
